/**
 * Build command - executes only build step for a given repository path
 */

import fs from 'fs';
import path from 'path';
import { Worker } from '../../core/worker';
import { logger } from '../../utils/logger';

export interface BuildCommandOptions {
  repoPath: string;
  loadBashrc?: boolean;
  bashrcPath?: string;
}

export async function buildCommand(options: BuildCommandOptions): Promise<void> {
  const expandedRepoPath = expandPath(options.repoPath);

  if (options.loadBashrc !== undefined) {
    process.env.LOAD_BASHRC = String(options.loadBashrc);
  }
  if (options.bashrcPath) {
    process.env.BASHRC_PATH = options.bashrcPath;
  }

  if (!fs.existsSync(expandedRepoPath) || !fs.statSync(expandedRepoPath).isDirectory()) {
    throw new Error(`Invalid repository path: ${expandedRepoPath}`);
  }

  logger.info(`Running build-only for: ${expandedRepoPath}`);
  const worker = new Worker();
  const result = await worker.runBuildOnly(expandedRepoPath);

  if (!result.success) {
    throw new Error(result.message);
  }

  logger.info(result.message);
}

function expandPath(inputPath: string): string {
  const home = process.env.HOME || process.env.USERPROFILE || '~';
  return inputPath.startsWith('~')
    ? path.join(home, inputPath.slice(1))
    : inputPath;
}

