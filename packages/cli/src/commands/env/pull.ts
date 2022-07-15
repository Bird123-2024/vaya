import chalk from 'chalk';
import { outputFile, readFile } from 'fs-extra';
import { closeSync, openSync, readSync } from 'fs';
import { resolve } from 'path';
import { Dictionary } from '@vercel/client';
import { Project, ProjectEnvTarget } from '../../types';
import Client from '../../util/client';
import exposeSystemEnvs from '../../util/dev/expose-system-envs';
import { emoji, prependEmoji } from '../../util/emoji';
import getSystemEnvValues from '../../util/env/get-system-env-values';
import getDecryptedEnvRecords from '../../util/get-decrypted-env-records';
import confirm from '../../util/input/confirm';
import { Output } from '../../util/output';
import param from '../../util/output/param';
import stamp from '../../util/output/stamp';
import { getCommandName } from '../../util/pkg-name';
import { EnvRecordsSource } from '../../util/env/get-env-records';
import { parseEnv } from '../../util/parse-env';

const CONTENTS_PREFIX = '# Created by Vercel CLI\n';

type Options = {
  '--debug': boolean;
  '--yes': boolean;
};

function readHeadSync(path: string, length: number) {
  const buffer = Buffer.alloc(length);
  const fd = openSync(path, 'r');
  try {
    readSync(fd, buffer, 0, buffer.length, null);
  } finally {
    closeSync(fd);
  }
  return buffer.toString();
}

function tryReadHeadSync(path: string, length: number) {
  try {
    return readHeadSync(path, length);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      throw err;
    }
  }
}

export default async function pull(
  client: Client,
  project: Project,
  environment: ProjectEnvTarget,
  opts: Partial<Options>,
  args: string[],
  output: Output,
  cwd: string,
  source: Extract<EnvRecordsSource, 'vercel-cli:env:pull' | 'vercel-cli:pull'>
) {
  if (args.length > 1) {
    output.error(
      `Invalid number of arguments. Usage: ${getCommandName(`env pull <file>`)}`
    );
    return 1;
  }

  // handle relative or absolute filename
  const [filename = '.env'] = args;
  const fullPath = resolve(cwd, filename);
  const skipConfirmation = opts['--yes'];

  const head = tryReadHeadSync(fullPath, Buffer.byteLength(CONTENTS_PREFIX));
  const exists = typeof head !== 'undefined';

  if (head === CONTENTS_PREFIX) {
    output.log(`Overwriting existing ${chalk.bold(filename)} file`);
  } else if (
    exists &&
    !skipConfirmation &&
    !(await confirm(
      client,
      `Found existing file ${param(filename)}. Do you want to overwrite?`,
      false
    ))
  ) {
    output.log('Aborted');
    return 0;
  }

  output.log(
    `Downloading \`${chalk.cyan(
      environment
    )}\` Environment Variables for Project ${chalk.bold(project.name)}`
  );

  const pullStamp = stamp();
  output.spinner('Downloading');

  const [{ envs: projectEnvs }, { systemEnvValues }] = await Promise.all([
    getDecryptedEnvRecords(output, client, project.id, source, environment),
    project.autoExposeSystemEnvs
      ? getSystemEnvValues(output, client, project.id)
      : { systemEnvValues: [] },
  ]);

  const records = exposeSystemEnvs(
    projectEnvs,
    systemEnvValues,
    project.autoExposeSystemEnvs,
    undefined,
    environment
  );

  let deltaString: string | undefined;
  if (exists) {
    const oldEnv = await createEnvObject(fullPath, output);

    if (oldEnv && records) {
      deltaString = buildDeltaString(oldEnv, records);
    }
  }

  const contents =
    CONTENTS_PREFIX +
    Object.entries(records)
      .map(([key, value]) => `${key}="${escapeValue(value)}"`)
      .join('\n') +
    '\n';

  await outputFile(fullPath, contents, 'utf8');

  output.print(
    `${prependEmoji(
      `${exists ? 'Updated' : 'Created'} ${chalk.bold(
        filename
      )} file ${chalk.gray(pullStamp())}`,
      emoji('success')
    )}\n`
  );

  if (deltaString) {
    output.print('\n' + deltaString);
  } else if (exists) {
    output.log('No changes found.');
  }

  return 0;
}

function escapeValue(value: string | undefined) {
  return value
    ? value
        .replace(new RegExp('\n', 'g'), '\\n') // combine newlines (unix) into one line
        .replace(new RegExp('\r', 'g'), '\\r') // combine newlines (windows) into one line
    : '';
}

async function createEnvObject(
  envPath: string,
  output: Output
): Promise<Dictionary<string | undefined> | undefined> {
  try {
    // Inspired by https://github.com/tswaters/env-file-parser/blob/master/lib/parse.js
    let envArr = (await readFile(envPath, 'utf-8'))
      // remove double quotes
      .replace(/"/g, '')
      // split on new line
      .split(/\r?\n|\r/)
      // filter comments
      .filter(line => /^[^#]/.test(line))
      // needs equal sign
      .filter(line => /=/i.test(line));
    return parseEnv(envArr);
  } catch (err) {
    output.debug(`Error parsing env file: ${err}`);
  }
}

function findChanges(
  oldEnv: Dictionary<string | undefined>,
  newEnv: Dictionary<string | undefined>
): {
  added: string[];
  changed: string[];
  removed: string[];
} {
  let added = [];
  let changed = [];
  let removed = [];

  for (const key of Object.keys(newEnv)) {
    if (!oldEnv[key] && oldEnv[key] !== '') {
      added.push(key);
    } else if (oldEnv[key] !== newEnv[key]) {
      changed.push(key);
    }
    delete oldEnv[key];
  }
  removed = Object.keys(oldEnv);

  return {
    added,
    changed,
    removed,
  };
}

function buildDeltaString(
  oldEnv: Dictionary<string | undefined>,
  newEnv: Dictionary<string | undefined>
): string {
  let { added, changed, removed } = findChanges(oldEnv, newEnv);

  let deltaString = '';
  deltaString += chalk.green(addDeltaSection(added, '+'));
  deltaString += chalk.yellow(addDeltaSection(changed, '~'));
  deltaString += chalk.red(addDeltaSection(removed, '-'));

  return deltaString;
}

function addDeltaSection(arr: string[], prefix: string): string {
  let deltaSection = '';
  let ellipsis = '';
  for (const [i, item] of arr.entries()) {
    if (i === 2) ellipsis = '…';
    if (i === 3) break;

    deltaSection += `${prefix} ${item}${ellipsis}\n`;
  }
  return deltaSection;
}
