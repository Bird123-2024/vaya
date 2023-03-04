import tar from 'tar';
import execa from 'execa';
import fetch from 'node-fetch';
import {
  createWriteStream,
  mkdirp,
  pathExists,
  readFile,
  remove,
} from 'fs-extra';
import { join, delimiter, dirname } from 'path';
import stringArgv from 'string-argv';
import { cloneEnv, debug } from '@vercel/build-utils';
import { pipeline } from 'stream';
import { promisify } from 'util';
import { tmpdir } from 'os';
import yauzl from 'yauzl-promise';
import XDGAppPaths from 'xdg-app-paths';
import type { Env } from '@vercel/build-utils';

const streamPipeline = promisify(pipeline);

const versionMap = new Map([
  ['1.19', '1.19.6'],
  ['1.18', '1.18.10'],
  ['1.17', '1.17.13'],
  ['1.16', '1.16.15'],
  ['1.15', '1.15.15'],
  ['1.14', '1.14.15'],
  ['1.13', '1.13.15'],
]);
const archMap = new Map([
  ['x64', 'amd64'],
  ['x86', '386'],
]);
const platformMap = new Map([['win32', 'windows']]);
export const cacheDir = join('.vercel', 'cache', 'golang');
const getGoDir = (workPath: string) => join(workPath, cacheDir);
const GO_FLAGS = process.platform === 'win32' ? [] : ['-ldflags', '-s -w'];
const GO_MIN_VERSION = 13;
const getPlatform = (p: string) => platformMap.get(p) || p;
const getArch = (a: string) => archMap.get(a) || a;

function getGoUrl(version: string) {
  const { arch, platform } = process;
  const goArch = getArch(arch);
  const goPlatform = getPlatform(platform);
  const ext = platform === 'win32' ? 'zip' : 'tar.gz';
  const filename = `go${version}.${goPlatform}-${goArch}.${ext}`;
  return {
    filename,
    url: `https://dl.google.com/go/${filename}`,
  };
}

const goGlobalCachePath = join(XDGAppPaths('com.vercel.cli').cache(), 'golang');

export const OUT_EXTENSION = process.platform === 'win32' ? '.exe' : '';

export async function getAnalyzedEntrypoint(
  workPath: string,
  filePath: string,
  modulePath: string
) {
  const bin = join(__dirname, `analyze${OUT_EXTENSION}`);

  const isAnalyzeExist = await pathExists(bin);
  if (!isAnalyzeExist) {
    debug(`Building analyze bin: ${bin}`);
    const src = join(__dirname, 'util', 'analyze.go');
    const go = await createGo({
      workPath,
    });
    await go.build(src, bin);
  }

  debug(`Analyzing entrypoint ${filePath} with modulePath ${modulePath}`);
  const args = [`-modpath=${modulePath}`, filePath];
  const analyzed = await execa.stdout(bin, args);
  debug(`Analyzed entrypoint ${analyzed}`);
  return analyzed;
}

class GoWrapper {
  private env: Env;
  private opts: execa.Options;

  constructor(env: Env, opts: execa.Options = {}) {
    if (!opts.cwd) {
      opts.cwd = process.cwd();
    }
    this.env = env;
    this.opts = opts;
  }

  private execute(...args: string[]) {
    const { opts, env } = this;
    debug(
      `Exec: go ${args
        .map(a => (a.includes(' ') ? `"${a}"` : a))
        .join(' ')} CWD=${opts.cwd}`
    );
    return execa('go', args, { stdio: 'inherit', ...opts, env });
  }

  mod() {
    return this.execute('mod', 'tidy');
  }

  get(src?: string) {
    const args = ['get'];
    if (src) {
      debug(`Fetching 'go' dependencies for file ${src}`);
      args.push(src);
    } else {
      debug(`Fetching 'go' dependencies for cwd ${this.opts.cwd}`);
    }
    return this.execute(...args);
  }

  build(src: string | string[], dest: string) {
    debug(`Building optimized 'go' binary ${src} -> ${dest}`);
    const sources = Array.isArray(src) ? src : [src];

    const flags = process.env.GO_BUILD_FLAGS
      ? stringArgv(process.env.GO_BUILD_FLAGS)
      : GO_FLAGS;

    return this.execute('build', ...flags, '-o', dest, ...sources);
  }
}

type CreateGoOptions = {
  goPath?: string;
  modulePath?: string;
  opts?: execa.Options;
  workPath: string;
};

export async function createGo({
  goPath,
  modulePath,
  opts = {},
  workPath,
}: CreateGoOptions) {
  if (goPath === undefined) {
    goPath = getGoDir(workPath);
  }

  // parse the `go.mod`, if exists
  let goPreferredVersion;
  if (modulePath) {
    goPreferredVersion = await parseGoModVersion(modulePath);
  }

  // default to newest (first) supported go version
  const goSelectedVersion =
    goPreferredVersion || Array.from(versionMap.values())[0];

  const env = cloneEnv(process.env, opts.env);
  const goGlobalDir = join(
    goGlobalCachePath,
    `${goSelectedVersion}_${process.platform}_${process.arch}`
  );
  const goGlobalBinDir = join(goGlobalDir, 'bin');

  if (goPreferredVersion) {
    debug(`Preferred go version ${goPreferredVersion} (from go.mod)`);
    env.GO111MODULE = 'on';
  }

  // check we have the desired `go` version cached
  if (await pathExists(goGlobalBinDir)) {
    // check if `go` has already been downloaded and that the version is correct
    env.GOROOT = goGlobalDir;
    env.PATH = `${goGlobalBinDir}${delimiter}${env.PATH}`;
    const { failed, stdout } = await execa('go', ['version'], {
      env,
      reject: false,
    });
    if (!failed) {
      const { version, short } = parseGoVersionString(stdout);
      if (version === goSelectedVersion || short === goSelectedVersion) {
        debug(`Selected go ${version} (from cache)`);
        return new GoWrapper(env, opts);
      } else {
        debug(`Found cached go ${version}, but need ${goSelectedVersion}`);
      }
    }
  }

  if (!goPreferredVersion) {
    // check if `go` is installed in the system PATH and if it's the version we want
    const { failed, stdout } = await execa('go', ['version'], {
      env,
      reject: false,
    });
    if (!failed) {
      const { version, minor } = parseGoVersionString(stdout);
      if (minor < GO_MIN_VERSION) {
        debug(`Found go ${version} in system PATH, but version is unsupported`);
      } else if (!goPreferredVersion || goPreferredVersion === version) {
        debug(`Selected go ${version} (from system PATH)`);
        return new GoWrapper(env, opts);
      } else {
        debug(
          `Found go ${version} in system PATH, but preferred version is ${goPreferredVersion}`
        );
      }
    }
  }

  // we need to download and cache the desired `go` version
  await download({
    dest: goGlobalDir,
    version: goSelectedVersion,
  });

  env.GOROOT = goGlobalDir;
  env.PATH = `${goGlobalBinDir}${delimiter}${env.PATH}`;
  return new GoWrapper(env, opts);
}

/**
 * Download and installs the Go distribution.
 *
 * @param dest The directory to install Go into. If directory exists, it is
 * first deleted before installing.
 * @param version The Go version to download
 */
async function download({ dest, version }: { dest: string; version: string }) {
  const { filename, url } = getGoUrl(version);
  debug(`Downloading go: ${url}`);
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Failed to download: ${url} (${res.status})`);
  }

  debug(`Installing go ${version} to ${dest}`);

  await remove(dest);
  await mkdirp(dest);

  if (/\.zip$/.test(filename)) {
    const zipFile = join(tmpdir(), filename);
    try {
      await streamPipeline(res.body, createWriteStream(zipFile));
      const zip = await yauzl.open(zipFile);
      let entry = await zip.readEntry();
      while (entry) {
        const fileName = entry.fileName.split('/').slice(1).join('/');

        if (fileName) {
          const destPath = join(dest, fileName);

          if (/\/$/.test(fileName)) {
            await mkdirp(destPath);
          } else {
            const [entryStream] = await Promise.all([
              entry.openReadStream(),
              mkdirp(dirname(destPath)),
            ]);
            const out = createWriteStream(destPath);
            await streamPipeline(entryStream, out);
          }
        }

        entry = await zip.readEntry();
      }
    } finally {
      await remove(zipFile);
    }
    return;
  }

  await new Promise((resolve, reject) => {
    res.body
      .on('error', reject)
      .pipe(tar.extract({ cwd: dest, strip: 1 }))
      .on('error', reject)
      .on('finish', resolve);
  });
}

const goVersionRegExp = /(\d+)\.(\d+)(?:\.(\d+))?/;

/**
 * Parses the raw output from `go version` and returns the version parts.
 *
 * @param goVersionOutput The output from `go version`
 */
function parseGoVersionString(goVersionOutput: string) {
  const matches = goVersionOutput.match(goVersionRegExp) || [];
  const major = parseInt(matches[1], 10);
  const minor = parseInt(matches[2], 10);
  const patch = parseInt(matches[3] || '0', 10);
  return {
    version: `${major}.${minor}.${patch}`,
    short: `${major}.${minor}`,
    major,
    minor,
    patch,
  };
}

/**
 * Attempts to parse the preferred Go version from the `go.mod` file.
 *
 * @param modulePath The directory containing the `go.mod` file
 * @returns
 */
async function parseGoModVersion(
  modulePath: string
): Promise<string | undefined> {
  let version;
  const file = join(modulePath, 'go.mod');

  try {
    const content = await readFile(file, 'utf8');
    const matches = /^go (\d+)\.(\d+)\.?$/gm.exec(content) || [];
    const major = parseInt(matches[1], 10);
    const minor = parseInt(matches[2], 10);
    const full = versionMap.get(`${major}.${minor}`);
    if (major === 1 && minor >= GO_MIN_VERSION && full) {
      version = full;
    } else {
      console.log(`Warning: Unknown Go version in ${file}`);
    }
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      debug(`File not found: ${file}`);
    } else {
      throw err;
    }
  }

  return version;
}
