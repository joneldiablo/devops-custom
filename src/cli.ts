#!/usr/bin/env node

/**
 * CLI Entry point for devops-custom
 * 
 * Integrates environment variables with CLI parameters using yargs.
 * ENV vars set defaults, CLI flags override them.
 * 
 * Commands:
 * - start: Starts the auto-update daemon
 * - scan: Lists all detected repositories
 * - status: Shows daemon status
 */

require('dotenv').config();

import path from 'path';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { logger } from './utils/logger';
import { PollerOptions } from './types';
import { startCommand } from './cli/commands/start';
import { scanCommand } from './cli/commands/scan';
import { statusCommand } from './cli/commands/status';

/**
 * Get default config from environment variables
 */
function getConfigFromEnv(): Partial<PollerOptions> {
  const home = process.env.HOME || process.env.USERPROFILE || '~';
  const expandPath = (p: string) => p.replace('~', home);
  const parseBoolean = (value: string | undefined, defaultValue: boolean): boolean => {
    if (value === undefined) return defaultValue;
    return !['false', '0', 'no', 'off'].includes(value.toLowerCase());
  };

  return {
    pollInterval: parseInt(process.env.POLL_INTERVAL || '300000', 10),
    reposRoot: expandPath(process.env.REPOS_ROOT || '~/projects'),
    logLevel: (process.env.LOG_LEVEL || 'info') as any,
    loadBashrc: parseBoolean(process.env.LOAD_BASHRC, true),
    bashrcPath: process.env.BASHRC_PATH || '~/.bashrc',
  };
}

// Initialize CLI
const cli = yargs(hideBin(process.argv));
const baseConfig = getConfigFromEnv();

// Define and register commands
cli
  .command(
    'start',
    'Start the auto-update daemon',
    (y) =>
      y
        .option('poll-interval', {
          alias: 'p',
          type: 'number',
          description: 'Poll interval in milliseconds',
          default: baseConfig.pollInterval,
        })
        .option('repos-root', {
          alias: 'r',
          type: 'string',
          description: 'Root directory to scan for repositories',
          default: baseConfig.reposRoot,
        })
        .option('log-level', {
          alias: 'l',
          type: 'string',
          description: 'Log level (debug, info, warn, error)',
          default: baseConfig.logLevel,
          choices: ['debug', 'info', 'warn', 'error'],
        })
        .option('load-bashrc', {
          type: 'boolean',
          description: 'Load bashrc before running build command subprocess',
          default: baseConfig.loadBashrc,
        })
        .option('bashrc-path', {
          type: 'string',
          description: 'Bashrc path to source before build command',
          default: baseConfig.bashrcPath,
        }),
    async (argv) => {
      const config: PollerOptions = {
        pollInterval: argv['poll-interval'] as number,
        reposRoot: argv['repos-root'] as string,
        logLevel: argv['log-level'] as any,
        loadBashrc: argv['load-bashrc'] as boolean,
        bashrcPath: argv['bashrc-path'] as string,
      };

      await startCommand(config);
    }
  )
  .command(
    'scan',
    'Scan and list all repositories',
    (y) =>
      y
        .option('repos-root', {
          alias: 'r',
          type: 'string',
          description: 'Root directory to scan',
          default: baseConfig.reposRoot,
        })
        .option('log-level', {
          alias: 'l',
          type: 'string',
          description: 'Log level',
          default: baseConfig.logLevel,
          choices: ['debug', 'info', 'warn', 'error'],
        }),
    async (argv) => {
      const config: Partial<PollerOptions> = {
        reposRoot: argv['repos-root'] as string,
        logLevel: argv['log-level'] as any,
      };

      await scanCommand(config);
    }
  )
  .command(
    'status',
    'Show daemon status',
    (y) => y,
    async (argv) => {
      await statusCommand();
    }
  )
  .demandCommand(1)
  .alias('h', 'help')
  .alias('v', 'version')
  .help()
  .strict()
  .argv;
