/**
 * Scan command - lists all detected repositories
 */

import { Scanner } from '../../core/scanner';
import { PollerOptions } from '../../types';
import { logger } from '../../utils/logger';

export async function scanCommand(options: Partial<PollerOptions>): Promise<void> {
  const reposRoot = options.reposRoot || '~/projects';
  
  logger.info(`Scanning for repositories in: ${reposRoot}`);

  const scanner = new Scanner();
  const repos = await scanner.scan(reposRoot, true); // Force rescan

  if (repos.length === 0) {
    logger.info('No repositories found');
    return;
  }

  logger.info(`Found ${repos.length} repositories:\n`);
  
  // Display in table format
  console.table(
    repos.map((repo) => ({
      Name: repo.name,
      Path: repo.path,
      'Remote URL': repo.remoteUrl,
      Branch: repo.branch,
      Status: repo.status,
    }))
  );
}
