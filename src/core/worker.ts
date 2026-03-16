/**
 * Worker core - handles repository updates
 * Manages git pull, build execution, and PM2 restarts
 */

import { execSync } from 'child_process';
import { Repository, UpdateResult, DiabliteConfig } from '../types';
import { GitUtils } from '../utils/git';
import { LockManager } from '../utils/lock';
import { logger } from '../utils/logger';
import fs from 'fs';
import path from 'path';

export class Worker {
  private lockManager = new LockManager();

  /**
   * Load repository configuration
   */
  private loadRepoConfig(repoPath: string): DiabliteConfig {
    const configPath = path.join(repoPath, '.devops-custom.json');
    
    if (!fs.existsSync(configPath)) {
      return {
        branch: 'master',
        build: 'yarn build',
        restart: 'pm2 restart app',
        autoUpdate: true,
        enabled: true,
      };
    }

    try {
      const content = fs.readFileSync(configPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      logger.warn(`Failed to load config for ${repoPath}: ${error}`);
      return {
        branch: 'master',
        build: 'yarn build',
        restart: 'pm2 restart app',
        autoUpdate: true,
        enabled: true,
      };
    }
  }

  /**
   * Execute a shell command in a directory
   */
  private executeCommand(command: string, cwd: string): string {
    try {
      const result = execSync(command, { cwd, encoding: 'utf-8' });
      return result;
    } catch (error: any) {
      throw new Error(`Command failed: ${error.message}`);
    }
  }

  /**
   * Update a single repository
   */
  async updateRepository(repo: Repository): Promise<UpdateResult> {
    const config = this.loadRepoConfig(repo.path);

    if (!config.enabled || !config.autoUpdate) {
      return {
        success: false,
        message: 'Repository updates disabled',
        repository: repo.name,
        timestamp: new Date(),
      };
    }

    // Try to acquire lock
    const lockResult = await this.lockManager.withLock(
      repo.path,
      async () => this.performUpdate(repo, config)
    );

    if (lockResult === null) {
      return {
        success: false,
        message: 'Repository is already being updated',
        repository: repo.name,
        timestamp: new Date(),
      };
    }

    return lockResult;
  }

  /**
   * Perform the actual update (assumes lock is held)
   */
  private async performUpdate(
    repo: Repository,
    config: DiabliteConfig
  ): Promise<UpdateResult> {
    const branch = config.branch || 'master';
    const buildCmd = config.build || 'yarn build';
    const restartCmd = config.restart || 'pm2 restart app';

    try {
      const git = new GitUtils(repo.path);

      // Fetch latest
      logger.info(`Fetching for ${repo.name}`);
      await git.fetch();

      // Check for changes
      const changeCount = await git.getChangeCount(branch);
      if (changeCount === 0) {
        logger.debug(`No changes for ${repo.name}`);
        return {
          success: true,
          message: 'No changes detected',
          repository: repo.name,
          timestamp: new Date(),
        };
      }

      // Pull changes
      logger.info(`Pulling ${branch} for ${repo.name}`);
      await git.pull(branch);

      // Run build
      logger.info(`Building ${repo.name}`);
      this.executeCommand(buildCmd, repo.path);

      // Restart with PM2
      logger.info(`Restarting ${repo.name}`);
      this.executeCommand(restartCmd, repo.path);

      logger.info(`Successfully updated ${repo.name}`);
      return {
        success: true,
        message: `Successfully pulled, built, and restarted ${repo.name}`,
        repository: repo.name,
        timestamp: new Date(),
      };
    } catch (error: any) {
      logger.error(`Update failed for ${repo.name}: ${error.message}`);
      return {
        success: false,
        message: `Update failed: ${error.message}`,
        repository: repo.name,
        timestamp: new Date(),
        error: error as Error,
      };
    }
  }
}
