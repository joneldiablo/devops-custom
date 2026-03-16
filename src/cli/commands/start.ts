/**
 * CLI command: start
 * 
 * Merges environment variables with CLI parameters
 * Starts the background daemon that polls for updates
 */

import { PollerOptions } from '../../types';
import { logger } from '../../utils/logger';

export const describe = 'Start the auto-update daemon';

export const builder = (y: any) => y
  .option('poll-interval', {
    alias: 'p',
    type: 'number',
    description: 'Poll interval in milliseconds',
    default: parseInt(process.env.POLL_INTERVAL || '300000', 10),
  })
  .option('repos-root', {
    alias: 'r',
    type: 'string',
    description: 'Root directory to scan for repositories',
    default: process.env.REPOS_ROOT || '~/projects',
  })
  .option('log-level', {
    alias: 'l',
    type: 'string',
    description: 'Log level',
    default: process.env.LOG_LEVEL || 'info',
    choices: ['debug', 'info', 'warn', 'error'],
  });

export async function handler(argv: any) {
  const config: PollerOptions = {
    pollInterval: argv['poll-interval'],
    reposRoot: argv['repos-root'],
    logLevel: argv['log-level'],
  };

  logger.info('[start] Starting daemon with config:', config);
  
  // TODO: Implementation
  // 1. Load and validate config
  // 2. Scan for repos
  // 3. Start polling loop
  // 4. Register signal handlers (SIGTERM, SIGINT)
  // 5. Keep process alive
}
