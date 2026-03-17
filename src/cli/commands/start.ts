/**
 * Start command - launches the auto-update daemon
 */

import { Poller } from '../../core/poller';
import { PollerOptions } from '../../types';
import { logger } from '../../utils/logger';

export async function startCommand(options: PollerOptions): Promise<void> {
  if (options.loadBashrc !== undefined) {
    process.env.LOAD_BASHRC = String(options.loadBashrc);
  }
  if (options.bashrcPath) {
    process.env.BASHRC_PATH = options.bashrcPath;
  }

  logger.info('\n================================');
  logger.info('===== DEVOPS-CUSTOM START =====');
  logger.info('================================');
  logger.info('Starting devops-custom daemon');
  logger.info(`Poll interval: ${options.pollInterval}ms`);
  logger.info(`Repos root: ${options.reposRoot}`);
  logger.info(`Log level: ${options.logLevel}`);
  logger.info(`Load bashrc: ${process.env.LOAD_BASHRC}`);
  logger.info(`Bashrc path: ${process.env.BASHRC_PATH}`);

  const poller = new Poller();

  // Handle graceful shutdown
  const gracefulShutdown = () => {
    logger.info('Received SIGTERM/SIGINT, shutting down gracefully...');
    poller.stop();
    process.exit(0);
  };

  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);

  try {
    await poller.start(options);
    // Poller runs continuously, waiting for signal to stop
  } catch (error) {
    logger.error(`Failed to start daemon: ${error}`);
    process.exit(1);
  }
}
