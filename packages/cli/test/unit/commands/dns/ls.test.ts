import { describe, beforeEach, expect, it } from 'vitest';
import { client } from '../../../mocks/client';
import dns from '../../../../src/commands/dns';
import { useUser } from '../../../mocks/user';
import { useDns } from '../../../mocks/dns';

describe('dns ls', () => {
  beforeEach(() => {
    useUser();
    useDns();
  });

  describe('[domain] missing', () => {
    it('should list up to 20 dns by default', async () => {
      client.setArgv('dns', 'ls');
      let exitCodePromise = dns(client);
      await expect(client.stderr).toOutput('example-19.com');
      await expect(exitCodePromise).resolves.toEqual(0);
    });

    it('track subcommand invocation', async () => {
      client.setArgv('dns', 'ls');
      let exitCodePromise = dns(client);

      await expect(exitCodePromise).resolves.toEqual(0);
      expect(client.telemetryEventStore).toHaveTelemetryEvents([
        {
          key: 'subcommand:list',
          value: 'ls',
        },
      ]);
    });

    describe('--limit', () => {
      it('should list up to 2 dns if limit set to 2', async () => {
        client.setArgv('dns', 'ls', '--limit', '2');
        let exitCodePromise = dns(client);
        await expect(client.stderr).toOutput('example-2.com');
        await expect(exitCodePromise).resolves.toEqual(0);
      });

      it('track subcommand invocation', async () => {
        client.setArgv('dns', 'ls', '--limit', '2');
        let exitCodePromise = dns(client);

        await expect(exitCodePromise).resolves.toEqual(0);
        expect(client.telemetryEventStore).toHaveTelemetryEvents([
          {
            key: 'subcommand:list',
            value: 'ls',
          },
          {
            key: 'option:limit',
            value: '[REDACTED]',
          },
        ]);
      });
    });

    describe('--next', () => {
      it('tracks the use of next option', async () => {
        client.setArgv('dns', 'ls', '--next', '1729878610745');
        let exitCodePromise = dns(client);

        await expect(exitCodePromise).resolves.toEqual(0);
        expect(client.telemetryEventStore).toHaveTelemetryEvents([
          {
            key: 'subcommand:list',
            value: 'ls',
          },
          {
            key: 'option:next',
            value: '[REDACTED]',
          },
        ]);
      });
    });
  });

  describe('[domain]', () => {
    it('tracks the use of domain argument', async () => {
      client.scenario.get('/v4/domains/:domain?/records', (req, res) => {
        res.json({
          records: [],
          pagination: { count: 1, total: 1, page: 1, pages: 1 },
        });
      });
      client.setArgv('dns', 'ls', 'example-19.com');
      let exitCodePromise = dns(client);

      await expect(exitCodePromise).resolves.toEqual(0);
      expect(client.telemetryEventStore).toHaveTelemetryEvents([
        {
          key: 'subcommand:list',
          value: 'ls',
        },
        {
          key: 'argument:domainName',
          value: '[REDACTED]',
        },
      ]);
    });
  });
});
