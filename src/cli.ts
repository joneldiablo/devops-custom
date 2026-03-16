#!/usr/bin/env node

/**
 * CLI Entry point for diablito-deploy
 * 
 * This file handles the CLI interface and integrates environment variables
 * with yargs command-line parameters. ENV vars are passed as config, but
 * CLI parameters can override them.
 * 
 * Pattern:
 * - Load .env file with dotenv
 * - Parse env vars into default config
 * - Use yargs to define commands (start, scan, status)
 * - Each command can override env vars with CLI flags
 * - Pass merged config to handlers
 */

require('dotenv').config();

import path from 'path';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { logger } from './utils/logger';
import { PollerOptions } from './types';

/**
 * Get default config from environment variables
 */
function getConfigFromEnv(): Partial<PollerOptions> {
  return {
    pollInterval: parseInt(process.env.POLL_INTERVAL || '300000', 10), // 5 minutes default
    reposRoot: process.env.REPOS_ROOT || path.expandUser('~/projects'),
    logLevel: (process.env.LOG_LEVEL || 'info') as any,
  };
}

// Initialize CLI
const cli = yargs(hideBin(process.argv));

// Get base config from env
const baseConfig = getConfigFromEnv();

logger.info(`[CLI] Starting diablito-deploy`);
logger.info(`[CLI] Poll interval: ${baseConfig.pollInterval}ms`);
logger.info(`[CLI] Repos root: ${baseConfig.reposRoot}`);
logger.info(`[CLI] Log level: ${baseConfig.logLevel}`);

// Define commands
cli
  .command(
    'start',
    'Start the auto-update daemon',
    (y) => y
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
        description: 'Log level: debug, info, warn, error',
        default: baseConfig.logLevel,
        choices: ['debug', 'info', 'warn', 'error'],
      }),
    async (argv) => {
      // Merge env defaults with CLI overrides
      const config: PollerOptions = {
        pollInterval: argv['poll-interval'] as number,
        reposRoot: argv['repos-root'] as string,
        logLevel: argv['log-level'] as any,
      };
      
      logger.info('[start] Starting daemon with config:', config);
      // Implementation will go here
      // const daemon = await startDaemon(config);
    }
  )
  .command(
    'scan',
    'Scan for repositories',
    (y) => y
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
      
      logger.info('[scan] Scanning for repositories with config:', config);
      // Implementation will go here
    }
  )
  .command(
    'status',
    'Show daemon status',
    (y) => y,
    async (argv) => {
      logger.info('[status] Fetching daemon status');
      // Implementation will go here
    }
  )
  .demandCommand(1)
  .help()
  .argv;
