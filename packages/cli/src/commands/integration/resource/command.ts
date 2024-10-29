import { yesOption } from '../../../util/arg-common';
import { packageName } from '../../../util/pkg-name';

export const removeSubcommand = {
  name: 'remove',
  description: 'Delete an integration resource',
  arguments: [
    {
      name: 'resource',
      required: true,
    },
  ],
  options: [
    {
      name: 'disconnect-all',
      description:
        'disconnects all projects from the specified resource before deletion',
      shorthand: 'a',
      type: Boolean,
      deprecated: false,
    },
    {
      ...yesOption,
      description: 'Skip the confirmation prompt when deleting a resource',
    },
  ],
  examples: [
    {
      name: 'Delete a resource',
      value: [
        `${packageName} integration-resource remove <resource>`,
        `${packageName} integration-resource remove my-acme-resource`,
      ],
    },
    {
      name: 'Disconnect all projects from a resource, then delete it',
      value: [
        `${packageName} integration-resource remove <resource> --disconnect-all`,
        `${packageName} integration-resource remove my-acme-resource --disconnect-all`,
        `${packageName} integration-resource remove my-acme-resource -a`,
      ],
    },
  ],
} as const;

export const disconnectSubcommand = {
  name: 'disconnect',
  description: 'Disconnect a resource from a project, or the current project',
  arguments: [
    {
      name: 'resource',
      required: true,
    },
    {
      name: 'project',
      required: false,
    },
  ],
  options: [
    {
      name: 'all',
      description: 'disconnects all projects from the specified resource',
      shorthand: 'a',
      type: Boolean,
      deprecated: false,
    },
    {
      ...yesOption,
      description: 'Skip the confirmation prompt when disconnecting a resource',
    },
  ],
  examples: [
    {
      name: 'Disconnect a resource from the current projecct',
      value: [
        `${packageName} integration-resource disconnect <resource>`,
        `${packageName} integration-resource disconnect my-acme-resource`,
      ],
    },
    {
      name: 'Disconnect all projects from a resource',
      value: [
        `${packageName} integration-resource disconnect <resource> --unlink-all`,
        `${packageName} integration-resource disconnect my-acme-resource --all`,
        `${packageName} integration-resource disconnect my-acme-resource -a`,
      ],
    },
    {
      name: 'Disconnect a resource from a specified project',
      value: [
        `${packageName} integration-resource disconnect <resource> <project>`,
        `${packageName} integration-resource disconnect my-acme-resource my-project`,
      ],
    },
  ],
} as const;

export const integrationResourceCommand = {
  name: 'integration',
  description: 'Manage marketplace integrations',
  options: [],
  arguments: [
    {
      name: 'command',
      required: true,
    },
  ],
  subcommands: [disconnectSubcommand, removeSubcommand],
  examples: [],
} as const;
