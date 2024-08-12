import { Command } from '../help';
import { packageName } from '../../util/pkg-name';
import { yesOption } from '../../util/arg-common';

export const buildCommand = {
  name: 'build',
  description: 'Build the project.',
  arguments: [],
  options: [
    {
      name: 'prod',
      description: 'Build a production deployment',
      shorthand: null,
      type: Boolean,
      deprecated: false,
    },
    {
      name: 'target',
      shorthand: null,
      type: String,
      deprecated: false,
      description: 'Specify the target environment',
    },
    {
      name: 'output',
      description: 'Directory where built assets should be written to',
      shorthand: null,
      argument: 'PATH',
      type: String,
      deprecated: false,
    },
    {
      ...yesOption,
      description:
        'Skip the confirmation prompt about pulling environment variables and project settings when not found locally',
    },
  ],
  examples: [
    {
      name: 'Build the project',
      value: `${packageName} build`,
    },
    {
      name: 'Build the project in a specific directory',
      value: `${packageName} build --cwd ./path-to-project`,
    },
  ],
} as const satisfies Command;
