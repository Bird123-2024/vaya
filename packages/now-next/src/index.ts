import {
  BuildOptions,
  Config,
  createLambda,
  debug,
  download,
  FileBlob,
  FileFsRef,
  Files,
  getLambdaOptionsFromFunction,
  getNodeVersion,
  getSpawnOptions,
  glob,
  Lambda,
  PackageJson,
  PrepareCacheOptions,
  Prerender,
  runNpmInstall,
  runPackageJsonScript,
  execCommand,
  getNodeBinPath,
} from '@now/build-utils';
import { Route, Handler } from '@now/routing-utils';
import {
  convertHeaders,
  convertRedirects,
  convertRewrites,
} from '@now/routing-utils/dist/superstatic';
import nodeFileTrace, { NodeFileTraceReasons } from '@zeit/node-file-trace';
import { ChildProcess, fork } from 'child_process';
import {
  lstatSync,
  pathExists,
  readFile,
  unlink as unlinkFile,
  writeFile,
} from 'fs-extra';
import os from 'os';
import path from 'path';
import resolveFrom from 'resolve-from';
import semver from 'semver';
import createServerlessConfig from './create-serverless-config';
import nextLegacyVersions from './legacy-versions';
import {
  createLambdaFromPseudoLayers,
  createPseudoLayer,
  EnvConfig,
  excludeFiles,
  ExperimentalTraceVersion,
  getDynamicRoutes,
  getExportIntent,
  getExportStatus,
  getNextConfig,
  getPathsInside,
  getPrerenderManifest,
  getRoutes,
  getRoutesManifest,
  getSourceFilePathFromPage,
  isDynamicRoute,
  normalizePackageJson,
  normalizePage,
  stringMap,
  syncEnvVars,
  validateEntrypoint,
  PseudoLayer,
} from './utils';
import escapeStringRegexp from 'escape-string-regexp';

interface BuildParamsMeta {
  isDev: boolean | undefined;
  env?: EnvConfig;
  buildEnv?: EnvConfig;
}

interface BuildParamsType extends BuildOptions {
  files: Files;
  entrypoint: string;
  workPath: string;
  meta: BuildParamsMeta;
}

export const version = 2;
// Limit for max size each lambda can be, currently 50 MB
const lambdaCompressedByteLimit = 50 * 1000 * 1000;
const htmlContentType = 'text/html; charset=utf-8';
const nowDevChildProcesses = new Set<ChildProcess>();

['SIGINT', 'SIGTERM'].forEach(signal => {
  process.once(signal as NodeJS.Signals, () => {
    for (const child of nowDevChildProcesses) {
      debug(
        `Got ${signal}, killing dev server child process (pid=${child.pid})`
      );
      process.kill(child.pid, signal);
    }
    process.exit(0);
  });
});

const MAX_AGE_ONE_YEAR = 31536000;

/**
 * Read package.json from files
 */
async function readPackageJson(entryPath: string) {
  const packagePath = path.join(entryPath, 'package.json');

  try {
    return JSON.parse(await readFile(packagePath, 'utf8'));
  } catch (err) {
    debug('package.json not found in entry');
    return {};
  }
}

/**
 * Write package.json
 */
async function writePackageJson(workPath: string, packageJson: PackageJson) {
  await writeFile(
    path.join(workPath, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  );
}

/**
 * Write .npmrc with npm auth token
 */
async function writeNpmRc(workPath: string, token: string) {
  await writeFile(
    path.join(workPath, '.npmrc'),
    `//registry.npmjs.org/:_authToken=${token}`
  );
}

function getNextVersion(packageJson: {
  dependencies?: { [key: string]: string };
  devDependencies?: { [key: string]: string };
}) {
  let nextVersion;
  if (packageJson.dependencies && packageJson.dependencies.next) {
    nextVersion = packageJson.dependencies.next;
  } else if (packageJson.devDependencies && packageJson.devDependencies.next) {
    nextVersion = packageJson.devDependencies.next;
  }
  return nextVersion;
}

function isLegacyNext(nextVersion: string) {
  // If version is using the dist-tag instead of a version range
  if (nextVersion === 'canary' || nextVersion === 'latest') {
    return false;
  }

  // If the version is an exact match with the legacy versions
  if (nextLegacyVersions.indexOf(nextVersion) !== -1) {
    return true;
  }

  const maxSatisfying = semver.maxSatisfying(nextLegacyVersions, nextVersion);
  // When the version can't be matched with legacy versions, so it must be a newer version
  if (maxSatisfying === null) {
    return false;
  }

  return true;
}

const name = '[@now/next]';
const urls: stringMap = {};

function startDevServer(entryPath: string, runtimeEnv: EnvConfig) {
  // `env` is omitted since that makes it default to `process.env`
  const forked = fork(path.join(__dirname, 'dev-server.js'), [], {
    cwd: entryPath,
    execArgv: [],
  });

  const getUrl = () =>
    new Promise<string>((resolve, reject) => {
      forked.once('message', resolve);
      forked.once('error', reject);
    });

  forked.send({ dir: entryPath, runtimeEnv });

  return { forked, getUrl };
}

export const build = async ({
  files,
  workPath,
  entrypoint,
  config = {} as Config,
  meta = {} as BuildParamsMeta,
}: BuildParamsType): Promise<{
  routes: Route[];
  output: Files;
  watch?: string[];
  childProcesses: ChildProcess[];
}> => {
  validateEntrypoint(entrypoint);

  const entryDirectory = path.dirname(entrypoint);
  const entryPath = path.join(workPath, entryDirectory);
  const outputDirectory = config.outputDirectory || '.next';
  const dotNextStatic = path.join(entryPath, outputDirectory, 'static');

  await download(files, workPath, meta);

  const pkg = await readPackageJson(entryPath);
  const nextVersion = getNextVersion(pkg);

  const nodeVersion = await getNodeVersion(entryPath, undefined, config, meta);
  const spawnOpts = getSpawnOptions(meta, nodeVersion);

  if (!nextVersion) {
    throw new Error(
      'No Next.js version could be detected in "package.json". Make sure `"next"` is installed in "dependencies" or "devDependencies"'
    );
  }

  if (meta.isDev) {
    let childProcess: ChildProcess | undefined;

    // If this is the initial build, we want to start the server
    if (!urls[entrypoint]) {
      if (!process.env.NODE_ENV) {
        process.env.NODE_ENV = 'development';
      }

      // The runtime env vars consist of the base `process.env` vars, but with the
      // build env vars removed, and the runtime env vars mixed in afterwards
      const runtimeEnv: EnvConfig = Object.assign({}, process.env);
      syncEnvVars(runtimeEnv, meta.buildEnv || {}, meta.env || {});

      const { forked, getUrl } = startDevServer(entryPath, runtimeEnv);
      urls[entrypoint] = await getUrl();
      childProcess = forked;
      nowDevChildProcesses.add(forked);
      debug(
        `${name} Development server for ${entrypoint} running at ${urls[entrypoint]}`
      );
    }

    const pathsInside = getPathsInside(entryDirectory, files);

    return {
      output: {},
      routes: await getRoutes(
        entryPath,
        entryDirectory,
        pathsInside,
        files,
        urls[entrypoint]
      ),
      watch: pathsInside,
      childProcesses: childProcess ? [childProcess] : [],
    };
  }

  if (await pathExists(dotNextStatic)) {
    console.warn(
      'WARNING: You should not upload the `.next` directory. See https://zeit.co/docs/v2/deployments/official-builders/next-js-now-next/ for more details.'
    );
  }

  const isLegacy = isLegacyNext(nextVersion);
  let shouldRunScript = 'now-build';

  debug(`MODE: ${isLegacy ? 'legacy' : 'serverless'}`);

  if (isLegacy) {
    try {
      await unlinkFile(path.join(entryPath, 'yarn.lock'));
    } catch (err) {
      debug('no yarn.lock removed');
    }

    try {
      await unlinkFile(path.join(entryPath, 'package-lock.json'));
    } catch (err) {
      debug('no package-lock.json removed');
    }

    console.warn(
      "WARNING: your application is being deployed in @now/next's legacy mode. http://err.sh/zeit/now/now-next-legacy-mode"
    );

    debug('Normalizing package.json');
    const packageJson = normalizePackageJson(pkg);
    debug('Normalized package.json result: ', packageJson);
    await writePackageJson(entryPath, packageJson);
  } else if (pkg.scripts && pkg.scripts['now-build']) {
    debug('Found user `now-build` script');
    shouldRunScript = 'now-build';
  } else if (pkg.scripts && pkg.scripts['build']) {
    debug('Found user `build` script');
    shouldRunScript = 'build';
  } else if (!pkg.scripts || !pkg.scripts['now-build']) {
    debug(
      'Your application is being built using `next build`. ' +
        'If you need to define a different build step, please create a `now-build` script in your `package.json` ' +
        '(e.g. `{ "scripts": { "now-build": "npm run prepare && next build" } }`).'
    );
    pkg.scripts = {
      'now-build': 'next build',
      ...(pkg.scripts || {}),
    };
    shouldRunScript = 'now-build';
    await writePackageJson(entryPath, pkg);
  }

  if (process.env.NPM_AUTH_TOKEN) {
    debug('Found NPM_AUTH_TOKEN in environment, creating .npmrc');
    await writeNpmRc(entryPath, process.env.NPM_AUTH_TOKEN);
  }

  console.log('Installing dependencies...');
  await runNpmInstall(entryPath, [], spawnOpts, meta);

  let realNextVersion: string | undefined;
  try {
    realNextVersion = require(resolveFrom(entryPath, 'next/package.json'))
      .version;

    debug(`Detected Next.js version: ${realNextVersion}`);
  } catch (_ignored) {
    debug(`Could not identify real Next.js version, that's OK!`);
  }

  if (!isLegacy) {
    await createServerlessConfig(workPath, entryPath, realNextVersion);
  }

  debug('Running user script...');
  const memoryToConsume = Math.floor(os.totalmem() / 1024 ** 2) - 128;
  const env: { [key: string]: string | undefined } = { ...spawnOpts.env };
  env.NODE_OPTIONS = `--max_old_space_size=${memoryToConsume}`;

  if (config.buildCommand) {
    // Add `node_modules/.bin` to PATH
    const nodeBinPath = await getNodeBinPath({ cwd: entryPath });
    env.PATH = `${nodeBinPath}${path.delimiter}${env.PATH}`;

    debug(
      `Added "${nodeBinPath}" to PATH env because a build command was used.`
    );

    console.log(`Running "${config.buildCommand}"`);
    await execCommand(config.buildCommand, {
      ...spawnOpts,
      cwd: entryPath,
      env,
    });
  } else {
    await runPackageJsonScript(entryPath, shouldRunScript, {
      ...spawnOpts,
      env,
    });
  }

  const appMountPrefixNoTrailingSlash = path.posix
    .join('/', entryDirectory)
    .replace(/\/+$/, '');

  const routesManifest = await getRoutesManifest(
    entryPath,
    outputDirectory,
    realNextVersion
  );
  const prerenderManifest = await getPrerenderManifest(entryPath);
  const headers: Route[] = [];
  const rewrites: Route[] = [];
  const redirects: Route[] = [];
  const nextBasePathRoute: Route[] = [];
  const dataRoutes: Route[] = [];
  let dynamicRoutes: Route[] = [];
  let nextBasePath: string | undefined;
  // whether they have enabled pages/404.js as the custom 404 page
  let hasPages404 = false;

  if (routesManifest) {
    switch (routesManifest.version) {
      case 1:
      case 2: {
        redirects.push(...convertRedirects(routesManifest.redirects));
        rewrites.push(...convertRewrites(routesManifest.rewrites));

        if (routesManifest.headers) {
          headers.push(...convertHeaders(routesManifest.headers));
        }

        if (routesManifest.dataRoutes) {
          // Load the /_next/data routes for both dynamic SSG and SSP pages.
          // These must be combined and sorted to prevent conflicts
          for (const dataRoute of routesManifest.dataRoutes) {
            const ssgDataRoute =
              prerenderManifest.fallbackRoutes[dataRoute.page] ||
              prerenderManifest.legacyBlockingRoutes[dataRoute.page];

            // we don't need to add routes for non-lazy SSG routes since
            // they have outputs which would override the routes anyways
            if (
              prerenderManifest.staticRoutes[dataRoute.page] ||
              prerenderManifest.omittedRoutes.includes(dataRoute.page)
            ) {
              continue;
            }

            dataRoutes.push({
              src: dataRoute.dataRouteRegex.replace(
                /^\^/,
                `^${appMountPrefixNoTrailingSlash}`
              ),
              dest: path.join(
                '/',
                entryDirectory,
                // make sure to route SSG data route to the data prerender
                // output, we don't do this for SSP routes since they don't
                // have a separate data output
                (ssgDataRoute && ssgDataRoute.dataRoute) || dataRoute.page
              ),
              check: true,
            });
          }
        }

        if (routesManifest.pages404) {
          hasPages404 = true;
        }

        if (routesManifest.basePath && routesManifest.basePath !== '/') {
          nextBasePath = routesManifest.basePath;

          if (!nextBasePath.startsWith('/')) {
            throw new Error(
              'basePath must start with `/`. Please upgrade your `@now/next` builder and try again. Contact support if this continues to happen.'
            );
          }
          if (nextBasePath.endsWith('/')) {
            throw new Error(
              'basePath must not end with `/`. Please upgrade your `@now/next` builder and try again. Contact support if this continues to happen.'
            );
          }

          nextBasePathRoute.push({
            src: `^${nextBasePath}(?:$|/(.*))$`,
            dest: `/$1`,
            continue: true,
          });
        }
        break;
      }
      default: {
        // update MIN_ROUTES_MANIFEST_VERSION in ./utils.ts
        throw new Error(
          'This version of `@now/next` does not support the version of Next.js you are trying to deploy.\n' +
            'Please upgrade your `@now/next` builder and try again. Contact support if this continues to happen.'
        );
      }
    }
  }

  const userExport = await getExportStatus(entryPath);

  if (userExport) {
    const exportIntent = await getExportIntent(entryPath);
    const { trailingSlash = false } = exportIntent || {};

    const resultingExport = await getExportStatus(entryPath);
    if (!resultingExport) {
      throw new Error(
        'Exporting Next.js app failed. Please check your build logs and contact us if this continues.'
      );
    }

    if (resultingExport.success !== true) {
      throw new Error(
        'Export of Next.js app failed. Please check your build logs.'
      );
    }

    const outDirectory = resultingExport.outDirectory;

    debug(`next export should use trailing slash: ${trailingSlash}`);

    // This handles pages, `public/`, and `static/`.
    const filesAfterBuild = await glob('**', outDirectory);

    const output: Files = { ...filesAfterBuild };

    // Strip `.html` extensions from build output
    Object.entries(output)
      .filter(([name]) => name.endsWith('.html'))
      .forEach(([name, value]) => {
        const cleanName = name.slice(0, -5);
        delete output[name];
        output[cleanName] = value;
        if (value.type === 'FileBlob' || value.type === 'FileFsRef') {
          value.contentType = value.contentType || 'text/html; charset=utf-8';
        }
      });

    return {
      output,
      routes: [
        // TODO: low priority: handle trailingSlash

        // Add top level rewrite for basePath if provided
        ...nextBasePathRoute,

        // User headers
        ...headers,

        // User redirects
        ...redirects,

        // Make sure to 404 for the /404 path itself
        {
          src: path.join('/', entryDirectory, '404'),
          status: 404,
          continue: true,
        },

        // Next.js pages, `static/` folder, reserved assets, and `public/`
        // folder
        { handle: 'filesystem' },

        // These need to come before handle: miss or else they are grouped
        // with that routing section
        ...rewrites,

        // We need to make sure to 404 for /_next after handle: miss since
        // handle: miss is called before rewrites and to prevent rewriting
        // /_next
        { handle: 'miss' },
        {
          src: path.join(
            '/',
            entryDirectory,
            '_next/static/(?:[^/]+/pages|chunks|runtime|css|media)/.+'
          ),
          status: 404,
          check: true,
          dest: '$0',
        },

        // Dynamic routes
        // TODO: do we want to do this?: ...dynamicRoutes,
        // (if so make sure to add any dynamic routes after handle: 'rewrite' )

        // routes to call after a file has been matched
        { handle: 'hit' },
        // Before we handle static files we need to set proper caching headers
        {
          // This ensures we only match known emitted-by-Next.js files and not
          // user-emitted files which may be missing a hash in their filename.
          src: path.join(
            '/',
            entryDirectory,
            '_next/static/(?:[^/]+/pages|chunks|runtime|css|media)/.+'
          ),
          // Next.js assets contain a hash or entropy in their filenames, so they
          // are guaranteed to be unique and cacheable indefinitely.
          headers: {
            'cache-control': `public,max-age=${MAX_AGE_ONE_YEAR},immutable`,
          },
          continue: true,
        },

        // error handling
        ...(output[path.join('./', entryDirectory, '404')]
          ? [
              { handle: 'error' } as Handler,

              {
                status: 404,
                src: path.join(entryDirectory, '.*'),
                dest: path.join('/', entryDirectory, '404'),
              },
            ]
          : []),
      ],
      watch: [],
      childProcesses: [],
    };
  }

  if (isLegacy) {
    debug('Running npm install --production...');
    await runNpmInstall(entryPath, ['--production'], spawnOpts, meta);
  }

  if (process.env.NPM_AUTH_TOKEN) {
    await unlinkFile(path.join(entryPath, '.npmrc'));
  }

  // map page to the lambda it's in
  const pageLambdaMap: { [page: string]: string } = {};
  const pageLambdaRoutes: Route[] = [];
  const dynamicPageLambdaRoutes: Route[] = [];
  const lambdas: { [key: string]: Lambda } = {};
  const prerenders: { [key: string]: Prerender | FileFsRef } = {};
  const staticPages: { [key: string]: FileFsRef } = {};
  const dynamicPages: string[] = [];
  let static404Page: string | undefined;
  let page404Path = '';
  let buildId: string;

  try {
    buildId = await readFile(
      path.join(entryPath, outputDirectory, 'BUILD_ID'),
      'utf8'
    );
  } catch (err) {
    console.error(
      'BUILD_ID not found in ".next". The "package.json" "build" script did not run "next build"'
    );
    throw new Error('Missing BUILD_ID');
  }
  const escapedBuildId = escapeStringRegexp(buildId);

  if (isLegacy) {
    const filesAfterBuild = await glob('**', entryPath);

    debug('Preparing serverless function files...');
    const dotNextRootFiles = await glob(`${outputDirectory}/*`, entryPath);
    const dotNextServerRootFiles = await glob(
      `${outputDirectory}/server/*`,
      entryPath
    );
    const nodeModules = excludeFiles(
      await glob('node_modules/**', entryPath),
      file => file.startsWith('node_modules/.cache')
    );
    const launcherFiles = {
      'now__bridge.js': new FileFsRef({
        fsPath: path.join(__dirname, 'now__bridge.js'),
      }),
    };
    const nextFiles: { [key: string]: FileFsRef } = {
      ...nodeModules,
      ...dotNextRootFiles,
      ...dotNextServerRootFiles,
      ...launcherFiles,
    };
    if (filesAfterBuild['next.config.js']) {
      nextFiles['next.config.js'] = filesAfterBuild['next.config.js'];
    }
    const pagesDir = path.join(
      entryPath,
      outputDirectory,
      'server',
      'static',
      buildId,
      'pages'
    );
    const pages = await glob('**/*.js', pagesDir);
    const launcherPath = path.join(__dirname, 'legacy-launcher.js');
    const launcherData = await readFile(launcherPath, 'utf8');

    await Promise.all(
      Object.keys(pages).map(async page => {
        // These default pages don't have to be handled as they'd always 404
        if (['_app.js', '_error.js', '_document.js'].includes(page)) {
          return;
        }

        const pathname = page.replace(/\.js$/, '');
        const launcher = launcherData.replace(
          'PATHNAME_PLACEHOLDER',
          `/${pathname.replace(/(^|\/)index$/, '')}`
        );

        const pageFiles = {
          [`${outputDirectory}/server/static/${buildId}/pages/_document.js`]: filesAfterBuild[
            `${outputDirectory}/server/static/${buildId}/pages/_document.js`
          ],
          [`${outputDirectory}/server/static/${buildId}/pages/_app.js`]: filesAfterBuild[
            `${outputDirectory}/server/static/${buildId}/pages/_app.js`
          ],
          [`${outputDirectory}/server/static/${buildId}/pages/_error.js`]: filesAfterBuild[
            `${outputDirectory}/server/static/${buildId}/pages/_error.js`
          ],
          [`${outputDirectory}/server/static/${buildId}/pages/${page}`]: filesAfterBuild[
            `${outputDirectory}/server/static/${buildId}/pages/${page}`
          ],
        };

        const lambdaOptions = await getLambdaOptionsFromFunction({
          sourceFile: await getSourceFilePathFromPage({ workPath, page }),
          config,
        });

        debug(`Creating serverless function for page: "${page}"...`);
        lambdas[path.join(entryDirectory, pathname)] = await createLambda({
          files: {
            ...nextFiles,
            ...pageFiles,
            'now__launcher.js': new FileBlob({ data: launcher }),
          },
          handler: 'now__launcher.launcher',
          runtime: nodeVersion.runtime,
          ...lambdaOptions,
        });
        debug(`Created serverless function for page: "${page}"`);
      })
    );
  } else {
    debug('Preparing serverless function files...');
    const pagesDir = path.join(
      entryPath,
      outputDirectory,
      'serverless',
      'pages'
    );

    const pages = await glob('**/*.js', pagesDir);
    const staticPageFiles = await glob('**/*.html', pagesDir);

    Object.keys(staticPageFiles).forEach((page: string) => {
      const pathname = page.replace(/\.html$/, '');
      const routeName = normalizePage(pathname);

      // Prerendered routes emit a `.html` file but should not be treated as a
      // static page.
      // Lazily prerendered routes have a fallback `.html` file on newer
      // Next.js versions so we need to also not treat it as a static page here.
      if (
        prerenderManifest.staticRoutes[routeName] ||
        prerenderManifest.fallbackRoutes[routeName]
      ) {
        return;
      }

      const staticRoute = path.join(entryDirectory, pathname);

      staticPages[staticRoute] = staticPageFiles[page];
      staticPages[staticRoute].contentType = htmlContentType;

      if (isDynamicRoute(pathname)) {
        dynamicPages.push(routeName);
        return;
      }
    });

    // this can be either 404.html in latest versions
    // or _errors/404.html versions while this was experimental
    static404Page =
      staticPages[path.join(entryDirectory, '404')] && hasPages404
        ? path.join(entryDirectory, '404')
        : staticPages[path.join(entryDirectory, '_errors/404')]
        ? path.join(entryDirectory, '_errors/404')
        : undefined;

    // > 1 because _error is a lambda but isn't used if a static 404 is available
    const pageKeys = Object.keys(pages);
    const hasLambdas = !static404Page || pageKeys.length > 1;

    if (pageKeys.length === 0) {
      const nextConfig = await getNextConfig(workPath, entryPath);

      if (nextConfig != null) {
        console.info('Found next.config.js:');
        console.info(nextConfig);
        console.info();
      }

      throw new Error(
        'No serverless pages were built. https://err.sh/zeit/now/now-next-no-serverless-pages-built'
      );
    }

    // Assume tracing to be safe, bail if we know we don't need it.
    let requiresTracing = hasLambdas;
    try {
      if (
        realNextVersion &&
        semver.lt(realNextVersion, ExperimentalTraceVersion)
      ) {
        debug(
          'Next.js version is too old for us to trace the required dependencies.\n' +
            'Assuming Next.js has handled it!'
        );
        requiresTracing = false;
      }
    } catch (err) {
      console.log(
        'Failed to check Next.js version for tracing compatibility: ' + err
      );
    }

    let assets:
      | undefined
      | {
          [filePath: string]: FileFsRef;
        };

    let pseudoLayerBytes = 0;
    let apiPseudoLayerBytes = 0;
    const pseudoLayers: PseudoLayer[] = [];
    const apiPseudoLayers: PseudoLayer[] = [];

    const isApiPage = (page: string) =>
      page.replace(/\\/g, '/').match(/serverless\/pages\/api/);

    const tracedFiles: {
      [filePath: string]: FileFsRef;
    } = {};
    const apiTracedFiles: {
      [filePath: string]: FileFsRef;
    } = {};

    if (requiresTracing) {
      const tracingLabel =
        'Traced Next.js serverless functions for external files in';
      console.time(tracingLabel);

      const apiPages: string[] = [];
      const nonApiPages: string[] = [];
      const allPagePaths = Object.keys(pages).map(page => pages[page].fsPath);

      for (const page of allPagePaths) {
        if (isApiPage(page)) {
          apiPages.push(page);
        } else {
          nonApiPages.push(page);
        }
      }

      const {
        fileList: apiFileList,
        reasons: apiReasons,
      } = await nodeFileTrace(apiPages, { base: workPath });

      const { fileList, reasons: nonApiReasons } = await nodeFileTrace(
        nonApiPages,
        { base: workPath }
      );

      debug(`node-file-trace result for pages: ${fileList}`);

      const collectTracedFiles = (
        reasons: NodeFileTraceReasons,
        files: { [filePath: string]: FileFsRef }
      ) => (file: string) => {
        const reason = reasons[file];
        if (reason && reason.type === 'initial') {
          // Initial files are manually added to the lambda later
          return;
        }
        const { mode } = lstatSync(path.join(workPath, file));

        files[file] = new FileFsRef({
          fsPath: path.join(workPath, file),
          mode,
        });
      };

      fileList.forEach(collectTracedFiles(nonApiReasons, tracedFiles));
      apiFileList.forEach(collectTracedFiles(apiReasons, apiTracedFiles));
      console.timeEnd(tracingLabel);

      const zippingLabel = 'Compressed shared serverless function files';
      console.time(zippingLabel);

      let pseudoLayer;
      let apiPseudoLayer;
      ({ pseudoLayer, pseudoLayerBytes } = await createPseudoLayer(
        tracedFiles
      ));
      ({
        pseudoLayer: apiPseudoLayer,
        pseudoLayerBytes: apiPseudoLayerBytes,
      } = await createPseudoLayer(apiTracedFiles));

      pseudoLayers.push(pseudoLayer);
      apiPseudoLayers.push(apiPseudoLayer);

      console.timeEnd(zippingLabel);
    } else {
      // An optional assets folder that is placed alongside every page
      // entrypoint.
      // This is a legacy feature that was needed before we began tracing
      // lambdas.
      assets = await glob(
        'assets/**',
        path.join(entryPath, outputDirectory, 'serverless')
      );

      const assetKeys = Object.keys(assets);
      if (assetKeys.length > 0) {
        debug(
          'detected (legacy) assets to be bundled with serverless function:'
        );
        assetKeys.forEach(assetFile => debug(`\t${assetFile}`));
        debug(
          '\nPlease upgrade to Next.js 9.1 to leverage modern asset handling.'
        );
      }
    }

    const launcherPath = path.join(__dirname, 'templated-launcher.js');
    const launcherData = await readFile(launcherPath, 'utf8');
    const allLambdasLabel = `All serverless functions created in`;

    if (hasLambdas) {
      console.time(allLambdasLabel);
    }

    console.log({
      pseudoLayerBytes,
      apiPseudoLayerBytes,
    });

    // Do initial check to make sure the traced files don't already
    // exceed the lambda size limit as we won't be able to continue
    // if they do
    if (
      pseudoLayerBytes >= lambdaCompressedByteLimit ||
      apiPseudoLayerBytes >= lambdaCompressedByteLimit
    ) {
      throw new Error(
        `Required lambda files exceed max lambda size of ${lambdaCompressedByteLimit} bytes`
      );
    }

    type LambdaGroup = {
      pages: {
        // '/index': './.next/serverless/pages/index.js
        [outputName: string]: {
          pageName: string;
          pageFileName: string;
        };
      };
      isApiLambda: boolean;
      lambdaIdentifier: string;
      lambdaCombinedBytes: number;
    };
    const apiLambdaGroups: Array<LambdaGroup> = [];
    const pageLambdaGroups: Array<LambdaGroup> = [];

    for (const page of pageKeys) {
      // These default pages don't have to be handled as they'd always 404
      if (['_app.js', '_document.js'].includes(page)) {
        continue;
      }

      // Don't create add _error to lambda if we have a static 404 page or
      // pages404 is enabled and 404.js is present
      if (
        page === '_error.js' &&
        ((static404Page && staticPages[static404Page]) ||
          (hasPages404 && pages['404.js']))
      ) {
        continue;
      }

      const pageFileName = path.normalize(
        path.relative(workPath, pages[page].fsPath)
      );
      const pathname = page.replace(/\.js$/, '');
      const routeIsApi = isApiPage(pageFileName);
      const routeIsDynamic = isDynamicRoute(pathname);

      if (routeIsDynamic) {
        dynamicPages.push(normalizePage(pathname));
      }
      const outputName = path.join('/', entryDirectory, pathname);

      const lambdaGroups = routeIsApi ? apiLambdaGroups : pageLambdaGroups;
      let lambdaGroupIndex = lambdaGroups.length - 1;
      const lastLambdaGroup = lambdaGroups[lambdaGroupIndex];
      let currentLambdaGroup = lastLambdaGroup;

      if (
        !currentLambdaGroup ||
        currentLambdaGroup.lambdaCombinedBytes >= lambdaCompressedByteLimit
      ) {
        lambdaGroupIndex++;
        currentLambdaGroup = {
          pages: {},
          isApiLambda: !!routeIsApi,
          lambdaCombinedBytes: !requiresTracing
            ? 0
            : routeIsApi
            ? apiPseudoLayerBytes
            : pseudoLayerBytes,
          lambdaIdentifier: path.join(
            entryDirectory,
            `__NEXT_${routeIsApi ? 'API' : 'PAGE'}_LAMBDA_${lambdaGroupIndex}`
          ),
        };
      }

      let dynamicPrefix = path.join('/', entryDirectory);
      dynamicPrefix = dynamicPrefix === '/' ? '' : dynamicPrefix;

      dynamicRoutes = await getDynamicRoutes(
        entryPath,
        entryDirectory,
        dynamicPages,
        false,
        routesManifest,
        new Set(prerenderManifest.omittedRoutes)
      ).then(arr =>
        arr.map(route => {
          route.src = route.src.replace('^', `^${dynamicPrefix}`);
          return route;
        })
      );

      const pageLambdaRoute: Route = {
        src: `^${escapeStringRegexp(outputName).replace(
          /\/index$/,
          '(/|/index|)'
        )}$`,
        dest: `${path.join('/', currentLambdaGroup.lambdaIdentifier)}`,
        headers: {
          'x-nextjs-page': outputName,
        },
        check: true,
      };

      if (routeIsDynamic) {
        dynamicPageLambdaRoutes.push(pageLambdaRoute);
      } else {
        pageLambdaRoutes.push(pageLambdaRoute);
      }

      if (page === '_error.js' || (hasPages404 && page === '404.js')) {
        page404Path = path.join('/', entryDirectory, pathname);
      }

      // TODO: compress page files here so we can track
      // how much they increase lambda size
      currentLambdaGroup.pages[outputName] = {
        pageFileName,
        pageName: page,
      };
      lambdaGroups[lambdaGroupIndex] = currentLambdaGroup;
    }

    if (hasLambdas) {
      // since we combine the pages into lambda groups
      // we need to merge the lambda options into one
      // this means they should only configure lambda options
      // for one page as doing it for another will override it
      const getMergedLambdaOptions = async (pageKeys: string[]) => {
        if (pageKeys.length === 0) return {};

        const lambdaOptions = await getLambdaOptionsFromFunction({
          sourceFile: await getSourceFilePathFromPage({
            workPath,
            page: pageKeys[0],
          }),
          config,
        });

        for (const page of pageKeys) {
          if (page === pageKeys[0]) continue;
          const sourceFile = await getSourceFilePathFromPage({
            workPath,
            page,
          });
          const newOptions = await getLambdaOptionsFromFunction({
            sourceFile,
            config,
          });

          for (const key of Object.keys(newOptions)) {
            // eslint-disable-next-line
            if (typeof (newOptions as any)[key] !== 'undefined') {
              // eslint-disable-next-line
              (lambdaOptions as any)[key] = (newOptions as any)[key];
            }
          }
        }
        return lambdaOptions;
      };

      const mergedPageLambdaOptions = await getMergedLambdaOptions(
        pageKeys.filter(page => !page.startsWith('api/'))
      );
      const mergedApiLambdaOptions = await getMergedLambdaOptions(
        pageKeys.filter(page => page.startsWith('api/'))
      );

      console.log({
        pages,
        apiLambdaGroups,
        pageLambdaGroups,
        mergedApiLambdaOptions,
        mergedPageLambdaOptions,
      });

      await Promise.all(
        [...apiLambdaGroups, ...pageLambdaGroups].map(
          async function buildLambdaGroup(group: LambdaGroup) {
            const groupPageKeys = Object.keys(group.pages);
            console.log({ group, groupPageKeys });

            const launcher = launcherData.replace(
              /\/\/ __LAUNCHER_PAGE_HANDLER__/g,
              `
              const url = require('url');
              page = function(req, res) {
                const pages = {
                  ${groupPageKeys
                    .map(
                      page =>
                        `'${page}': require('./${path.join(
                          './',
                          group.pages[page].pageFileName
                        )}')`
                    )
                    .join(',\n')}
                  ${
                    '' /*
                    '/about': require('./.next/serverless/pages/about.js')
                  */
                  }
                }
                console.log('req.url', req.url)
                console.log('got headers', JSON.stringify(req.headers, null, 2))
                let toRender = req.headers['x-nextjs-page']

                if (!toRender) {
                  try {
                    const { pathname } = url.parse(req.url)
                    toRender = pathname
                  } catch (_) {
                    // handle failing to parse url
                    res.statusCode = 400
                    return res.end('Bad Request')
                  }
                }

                let currentPage = pages[toRender]

                if (
                  toRender &&
                  !currentPage &&
                  toRender.includes('/_next/data')
                ) {
                  toRender = toRender
                    .replace(new RegExp('/_next/data/${escapedBuildId}/'), '/')
                    .replace(/\\.json$/, '')

                  currentPage = pages[toRender]

                  if (!currentPage) {
                    // for prerendered dynamic routes (/blog/post-1) we need to
                    // find the match since it won't match the page directly
                    const dynamicRoutes = ${JSON.stringify(
                      dynamicRoutes.map(route => ({
                        src: route.src,
                        dest: route.dest,
                      }))
                    )}

                    for (const route of dynamicRoutes) {
                      const matcher = new RegExp(route.src)

                      if (matcher.test(toRender)) {
                        toRender = route.dest
                        currentPage = pages[toRender]
                        break
                      }
                    }
                  }
                }

                console.log({ toRender })

                if (!currentPage) {
                  res.statusCode = 500
                  return res.end('internal server error')
                }
                const method = currentPage.render || currentPage.default || currentPage
                return method(req, res)
              }
            `
            );
            const launcherFiles: { [name: string]: FileFsRef | FileBlob } = {
              'now__bridge.js': new FileFsRef({
                fsPath: path.join(__dirname, 'now__bridge.js'),
              }),
              'now__launcher.js': new FileBlob({ data: launcher }),
            };

            const pageFiles: Files = {};

            for (const page of groupPageKeys) {
              const { pageFileName, pageName } = group.pages[page];
              pageFiles[pageFileName] = pages[pageName];
              pageLambdaMap[page] = group.lambdaIdentifier;
            }

            console.log(pageFiles);

            if (requiresTracing) {
              lambdas[
                group.lambdaIdentifier
              ] = await createLambdaFromPseudoLayers({
                files: {
                  ...launcherFiles,
                  // [requiresTracing ? pageFileName : 'page.js']: pages[page],
                  ...pageFiles,
                },
                layers: group.isApiLambda ? apiPseudoLayers : pseudoLayers,
                handler: 'now__launcher.launcher',
                runtime: nodeVersion.runtime,
                ...(group.isApiLambda
                  ? mergedApiLambdaOptions
                  : mergedPageLambdaOptions),
              });
            } else {
              lambdas[group.lambdaIdentifier] = await createLambda({
                files: {
                  ...launcherFiles,
                  ...assets,
                  ...tracedFiles,
                  // ['page.js']: pages[page],
                  ...pageFiles,
                },
                handler: 'now__launcher.launcher',
                runtime: nodeVersion.runtime,
                ...(group.isApiLambda
                  ? mergedApiLambdaOptions
                  : mergedPageLambdaOptions),
              });
            }
          }
        )
      );
      console.timeEnd(allLambdasLabel);
    }

    console.log({
      lambdas,
      pageLambdaMap,
      pageLambdaRoutes,
      dynamicPageLambdaRoutes,
    });

    let prerenderGroup = 1;
    const onPrerenderRoute = (
      routeKey: string,
      { isBlocking, isFallback }: { isBlocking: boolean; isFallback: boolean }
    ) => {
      if (isBlocking && isFallback) {
        throw new Error(
          'invariant: isBlocking and isFallback cannot both be true'
        );
      }

      // Get the route file as it'd be mounted in the builder output
      const routeFileNoExt = routeKey === '/' ? '/index' : routeKey;

      const htmlFsRef = isBlocking
        ? // Blocking pages do not have an HTML fallback
          null
        : new FileFsRef({
            fsPath: path.join(
              pagesDir,
              isFallback
                ? // Fallback pages have a special file.
                  prerenderManifest.fallbackRoutes[routeKey].fallback
                : // Otherwise, the route itself should exist as a static HTML
                  // file.
                  `${routeFileNoExt}.html`
            ),
          });
      const jsonFsRef =
        // JSON data does not exist for fallback or blocking pages
        isFallback || isBlocking
          ? null
          : new FileFsRef({
              fsPath: path.join(pagesDir, `${routeFileNoExt}.json`),
            });

      let initialRevalidate: false | number;
      let srcRoute: string | null;
      let dataRoute: string;

      if (isFallback || isBlocking) {
        const pr = isFallback
          ? prerenderManifest.fallbackRoutes[routeKey]
          : prerenderManifest.legacyBlockingRoutes[routeKey];
        initialRevalidate = 1; // TODO: should Next.js provide this default?
        // @ts-ignore
        if (initialRevalidate === false) {
          // Lazy routes cannot be "snapshotted" in time.
          throw new Error('invariant isLazy: initialRevalidate !== false');
        }
        srcRoute = null;
        dataRoute = pr.dataRoute;
      } else {
        const pr = prerenderManifest.staticRoutes[routeKey];
        ({ initialRevalidate, srcRoute, dataRoute } = pr);
      }

      const outputPathPage = path.posix.join(entryDirectory, routeFileNoExt);
      const outputSrcPathPage = path.join(
        '/',
        srcRoute == null
          ? outputPathPage
          : path.join(entryDirectory, srcRoute === '/' ? '/index' : srcRoute)
      );

      const outputPathData = path.posix.join(entryDirectory, dataRoute);
      const lambdaId = pageLambdaMap[outputSrcPathPage];
      const lambda = lambdas[lambdaId];

      if (lambda == null) {
        throw new Error(`Unable to find lambda for route: ${routeFileNoExt}`);
      }

      if (initialRevalidate === false) {
        if (htmlFsRef == null || jsonFsRef == null) {
          throw new Error('invariant: htmlFsRef != null && jsonFsRef != null');
        }
      }

      prerenders[outputPathPage] = new Prerender({
        expiration: initialRevalidate,
        lambda,
        fallback: htmlFsRef,
        group: prerenderGroup,
        bypassToken: prerenderManifest.bypassToken,
      });
      prerenders[outputPathData] = new Prerender({
        expiration: initialRevalidate,
        lambda,
        fallback: jsonFsRef,
        group: prerenderGroup,
        bypassToken: prerenderManifest.bypassToken,
      });

      ++prerenderGroup;
    };

    Object.keys(prerenderManifest.staticRoutes).forEach(route =>
      onPrerenderRoute(route, { isBlocking: false, isFallback: false })
    );
    Object.keys(prerenderManifest.fallbackRoutes).forEach(route =>
      onPrerenderRoute(route, { isBlocking: false, isFallback: true })
    );
    Object.keys(prerenderManifest.legacyBlockingRoutes).forEach(route =>
      onPrerenderRoute(route, { isBlocking: true, isFallback: false })
    );

    // We still need to use lazyRoutes if the dataRoutes field
    // isn't available for backwards compatibility
    if (!(routesManifest && routesManifest.dataRoutes)) {
      // Dynamic pages for lazy routes should be handled by the lambda flow.
      [
        ...Object.entries(prerenderManifest.fallbackRoutes),
        ...Object.entries(prerenderManifest.legacyBlockingRoutes),
      ].forEach(([, { dataRoute, dataRouteRegex }]) => {
        dataRoutes.push({
          // Next.js provided data route regex
          src: dataRouteRegex.replace(
            /^\^/,
            `^${appMountPrefixNoTrailingSlash}`
          ),
          // Location of prerender in builder output
          dest: path.posix.join(entryDirectory, dataRoute),
          check: true,
        });
      });
    }
  }

  const nextStaticFiles = await glob(
    '**',
    path.join(entryPath, outputDirectory, 'static')
  );
  const staticFolderFiles = await glob('**', path.join(entryPath, 'static'));
  const publicFolderFiles = await glob('**', path.join(entryPath, 'public'));

  const staticFiles = Object.keys(nextStaticFiles).reduce(
    (mappedFiles, file) => ({
      ...mappedFiles,
      [path.join(entryDirectory, `_next/static/${file}`)]: nextStaticFiles[
        file
      ],
    }),
    {}
  );
  const staticDirectoryFiles = Object.keys(staticFolderFiles).reduce(
    (mappedFiles, file) => ({
      ...mappedFiles,
      [path.join(entryDirectory, 'static', file)]: staticFolderFiles[file],
    }),
    {}
  );
  const publicDirectoryFiles = Object.keys(publicFolderFiles).reduce(
    (mappedFiles, file) => ({
      ...mappedFiles,
      [path.join(
        entryDirectory,
        file.replace(/public[/\\]+/, '')
      )]: publicFolderFiles[file],
    }),
    {}
  );

  return {
    output: {
      ...publicDirectoryFiles,
      ...lambdas,
      ...prerenders,
      ...staticPages,
      ...staticFiles,
      ...staticDirectoryFiles,
    },
    /*
      Desired routes order
      - Runtime headers
      - User headers and redirects
      - Runtime redirects
      - Runtime routes
      - Check filesystem (including pages), if nothing found continue
      - User rewrites
      - Builder rewrites
    */
    routes: [
      // Add top level rewrite for basePath if provided
      ...nextBasePathRoute,

      // headers
      ...headers,

      // redirects
      ...redirects,

      // Make sure to 404 for the /404 path itself
      {
        src: path.join('/', entryDirectory, '404'),
        status: 404,
        continue: true,
      },

      // Next.js page lambdas, `static/` folder, reserved assets, and `public/`
      // folder
      { handle: 'filesystem' },

      // map pages to their lambda
      ...pageLambdaRoutes,

      // map /blog/[post] to correct lambda for iSSG
      ...dynamicPageLambdaRoutes,

      // These need to come before handle: miss or else they are grouped
      // with that routing section
      ...rewrites,

      // We need to make sure to 404 for /_next after handle: miss since
      // handle: miss is called before rewrites and to prevent rewriting /_next
      { handle: 'miss' },
      {
        src: path.join(
          '/',
          entryDirectory,
          '_next/static/(?:[^/]+/pages|chunks|runtime|css|media)/.+'
        ),
        status: 404,
        check: true,
        dest: '$0',
      },

      // routes that are called after each rewrite or after routes
      // if there no rewrites
      { handle: 'rewrite' },

      // re-check page routes to map them to the lambda
      ...pageLambdaRoutes,

      // /_next/data routes for getServerProps/getStaticProps pages
      ...dataRoutes,

      // Dynamic routes (must come after dataRoutes as they are more specific)
      ...dynamicRoutes,

      // finally add dynamic page mappings to their respective lambda
      ...dynamicPageLambdaRoutes,

      // routes to call after a file has been matched
      { handle: 'hit' },
      // Before we handle static files we need to set proper caching headers
      {
        // This ensures we only match known emitted-by-Next.js files and not
        // user-emitted files which may be missing a hash in their filename.
        src: path.join(
          '/',
          entryDirectory,
          '_next/static/(?:[^/]+/pages|chunks|runtime|css|media)/.+'
        ),
        // Next.js assets contain a hash or entropy in their filenames, so they
        // are guaranteed to be unique and cacheable indefinitely.
        headers: {
          'cache-control': `public,max-age=${MAX_AGE_ONE_YEAR},immutable`,
        },
        continue: true,
      },

      // error handling
      ...(isLegacy
        ? []
        : [
            // Custom Next.js 404 page
            { handle: 'error' } as Handler,

            {
              src: path.join('/', entryDirectory, '.*'),
              // if static 404 is not present but we have pages/404.js
              // it is a lambda due to _app getInitialProps
              dest: path.join('/', (static404Page
                ? static404Page
                : pageLambdaMap[page404Path]) as string),
              headers: {
                'x-nextjs-page': page404Path,
              },
              status: 404,
            },
          ]),
    ],
    watch: [],
    childProcesses: [],
  };
};

export const prepareCache = async ({
  workPath,
  entrypoint,
  config = {},
}: PrepareCacheOptions): Promise<Files> => {
  debug('Preparing cache...');
  const entryDirectory = path.dirname(entrypoint);
  const entryPath = path.join(workPath, entryDirectory);
  const outputDirectory = config.outputDirectory || '.next';

  const pkg = await readPackageJson(entryPath);
  const nextVersion = getNextVersion(pkg);
  if (!nextVersion) throw new Error('Could not parse Next.js version');
  const isLegacy = isLegacyNext(nextVersion);

  if (isLegacy) {
    // skip caching legacy mode (swapping deps between all and production can get bug-prone)
    return {};
  }

  debug('Producing cache file manifest...');
  const cacheEntrypoint = path.relative(workPath, entryPath);
  const cache = {
    ...(await glob(path.join(cacheEntrypoint, 'node_modules/**'), workPath)),
    ...(await glob(
      path.join(cacheEntrypoint, outputDirectory, 'cache/**'),
      workPath
    )),
  };
  debug('Cache file manifest produced');
  return cache;
};
