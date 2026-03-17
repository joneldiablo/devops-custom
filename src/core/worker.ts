/**
 * Worker core - handles repository updates
 * Manages git pull, build execution, and PM2 restarts
 */

import { execSync } from 'child_process';
import { Repository, UpdateResult, DiabliteConfig } from '../types';
import { GitUtils } from '../utils/git';
import { LockManager } from '../utils/lock';
import { PM2Manager } from '../utils/pm2';
import { logger } from '../utils/logger';
import fs from 'fs';
import path from 'path';

export class Worker {
  private lockManager = new LockManager();
  private pm2Manager = new PM2Manager();
  private runtimeProjectMarkers = [
    'package.json',
    'deno.json',
    'deno.jsonc',
    'bunfig.toml',
  ];

  private runtimeCommandPatterns = [
    /^npm(\s|$)/i,
    /^npx(\s|$)/i,
    /^yarn(\s|$)/i,
    /^pnpm(\s|$)/i,
    /^node(\s|$)/i,
    /^bun(\s|$)/i,
    /^deno(\s|$)/i,
  ];

  /**
   * Log a clear stage separator to improve terminal readability
   */
  private logStage(stage: string, repoName: string): void {
    logger.info(`\n===== ${stage.toUpperCase()} :: ${repoName} =====`);
  }

  /**
   * Load repository configuration
   */
  private loadRepoConfig(repoPath: string): DiabliteConfig {
    const configPath = path.join(repoPath, '.devops-custom.json');
    const defaultConfig: DiabliteConfig = {
      branch: 'master',
      remote: 'origin',
      build: 'yarn install; yarn build',
      autoUpdate: true,
      enabled: true,
    };
    
    if (!fs.existsSync(configPath)) {
      return defaultConfig;
    }

    try {
      const content = fs.readFileSync(configPath, 'utf-8');
      const parsedConfig = JSON.parse(content);
      const mergedConfig: DiabliteConfig = {
        ...defaultConfig,
        ...parsedConfig,
      };
      logger.info(
        `Loaded .devops-custom.json for ${repoPath}: ${JSON.stringify(mergedConfig)}`
      );
      return mergedConfig;
    } catch (error) {
      logger.warn(`Failed to load config for ${repoPath}: ${error}`);
      return defaultConfig;
    }
  }

  /**
   * Execute a shell command in a directory
   */
  private executeCommand(command: string, cwd: string): string {
    try {
      execSync(command, {
        cwd,
        encoding: 'utf-8',
        stdio: 'inherit',
      });
      return '';
    } catch (error: any) {
      throw new Error(`Command failed: ${error.message}`);
    }
  }

  /**
   * Execute build script and evaluate success from the last executed command.
   */
  private executeBuildCommand(command: string, cwd: string): boolean {
    const wrappedCommand = `set +e\n${command}\nexit $?`;

    try {
      execSync(wrappedCommand, {
        cwd,
        encoding: 'utf-8',
        stdio: 'inherit',
        shell: '/bin/bash',
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Detect if repository appears to be Node/Deno/Bun based project
   */
  private isRuntimeProject(repoPath: string): boolean {
    return this.runtimeProjectMarkers.some((marker) =>
      fs.existsSync(path.join(repoPath, marker))
    );
  }

  /**
   * Detect commands that belong to Node/Deno/Bun tooling
   */
  private isRuntimeCommand(command: string): boolean {
    const trimmed = command.trim();
    return this.runtimeCommandPatterns.some((pattern) => pattern.test(trimmed));
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
    const remote = config.remote || 'origin';
    const buildCmd =
      config.build === undefined ? 'yarn install; yarn build' : config.build.trim();
    const restartCmd =
      config.restart ||
      `pm2 restart ${await this.pm2Manager.getAppNameByRepoPath(repo.path)}`;
    const isRuntimeRepo = this.isRuntimeProject(repo.path);

    try {
      const git = new GitUtils(repo.path);
      let pullExecuted = false;

      // Fetch latest
      logger.info(`Fetching for ${repo.name}`);
      await git.fetch();

      // Validate remote before attempting pull/update
      const hasRemote = await git.hasRemote(remote);
      if (!hasRemote) {
        const skipMessage = `Skipping update for ${repo.name}: remote "${remote}" does not exist`;
        logger.warn(skipMessage);
        return {
          success: false,
          message: skipMessage,
          repository: repo.name,
          timestamp: new Date(),
        };
      }

      // Check for changes
      const changeCount = await git.getChangeCount(branch, remote);
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
      this.logStage('pulling', repo.name);
      logger.info(`Pulling ${remote}/${branch} for ${repo.name}`);
      await git.pull(remote, branch);
      pullExecuted = true;

      // Run build
      let buildExecuted = false;
      if (!buildCmd) {
        logger.info(`Skipping build for ${repo.name}: no build command configured`);
      } else if (!isRuntimeRepo && this.isRuntimeCommand(buildCmd)) {
        logger.info(
          `Skipping runtime build command for non Node/Deno/Bun repo: ${repo.name} (${buildCmd})`
        );
      } else {
        this.logStage('build', repo.name);
        logger.info(`Building ${repo.name}`);
        const buildSucceeded = this.executeBuildCommand(buildCmd, repo.path);
        if (!buildSucceeded) {
          throw new Error(
            `Build failed for ${repo.name}: last executed build command returned non-zero`
          );
        }
        buildExecuted = true;
      }

      // Restart - use PM2Manager if PM2 command, otherwise execSync
      if (!pullExecuted) {
        logger.info(`Skipping restart for ${repo.name}: pull step was not executed`);
      } else if (!buildExecuted) {
        logger.info(
          `Skipping restart for ${repo.name}: build step was not executed`
        );
      } else if (!isRuntimeRepo && this.isRuntimeCommand(restartCmd)) {
        logger.info(
          `Skipping runtime restart command for non Node/Deno/Bun repo: ${repo.name} (${restartCmd})`
        );
      } else {
        this.logStage('restart', repo.name);
        logger.info(`Restarting ${repo.name}`);
        if (this.pm2Manager.isPM2Command(restartCmd)) {
          const appName = this.pm2Manager.extractAppNameFromCommand(restartCmd);
          if (appName) {
            await this.pm2Manager.restart(appName);
          } else {
            logger.warn(
              `Could not extract app name from restart command: ${restartCmd}`
            );
          }
        } else {
          this.executeCommand(restartCmd, repo.path);
        }
      }

      logger.info(`Successfully updated ${repo.name}`);
      return {
        success: true,
        message: `Successfully updated ${repo.name}`,
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
