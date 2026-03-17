/**
 * Repository scanner core
 * Finds all git repositories in a directory tree
 * Loads per-repo configuration from .devops-custom.json
 */

import fs from 'fs';
import path from 'path';
import { GitUtils } from '../utils/git';
import { Repository, DiabliteConfig } from '../types';
import { logger } from '../utils/logger';

export class Scanner {
  private scannedAt: Date | null = null;
  private repos: Repository[] = [];
  private scanTimeout = 24 * 60 * 60 * 1000; // 24 hours

  private logStage(stage: string, target: string): void {
    logger.info(`\n===== ${stage.toUpperCase()} :: ${target} =====`);
  }

  /**
   * Check if a directory is a git repository
   */
  private isGitRepo(dirPath: string): boolean {
    return fs.existsSync(path.join(dirPath, '.git'));
  }

  /**
   * Load config file for a repository
   */
  private loadRepoConfig(repoPath: string): DiabliteConfig {
    const configPath = path.join(repoPath, '.devops-custom.json');
    const defaultConfig: DiabliteConfig = {
      branch: 'master',
      remote: 'origin',
      build: 'yarn install && yarn build',
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
      logger.warn(`Failed to parse config at ${configPath}: ${error}`);
      return defaultConfig;
    }
  }

  /**
   * Recursively scan directory for git repositories
   * Filters out hidden directories (starting with .)
   */
  private async scanDirectory(dirPath: string): Promise<Repository[]> {
    const repos: Repository[] = [];

    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        // Skip hidden directories
        if (entry.name.startsWith('.')) {
          continue;
        }

        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          // Check if this directory is a git repo
          if (this.isGitRepo(fullPath)) {
            try {
              const git = new GitUtils(fullPath);
              const remoteUrl = await git.getRemoteUrl();
              const currentBranch = await git.getCurrentBranch();
              const config = this.loadRepoConfig(fullPath);

              const repo: Repository = {
                path: fullPath,
                name: entry.name,
                remoteUrl,
                branch: config.branch || currentBranch,
                status: 'idle',
                lastChecked: new Date(),
              };

              repos.push(repo);
              logger.info(`Found repo: ${fullPath}`);
            } catch (error) {
              logger.warn(`Failed to initialize repo at ${fullPath}: ${error}`);
            }
          } else {
            // Recursively scan subdirectories
            const subRepos = await this.scanDirectory(fullPath);
            repos.push(...subRepos);
          }
        }
      }
    } catch (error) {
      logger.error(`Error scanning directory ${dirPath}: ${error}`);
    }

    return repos;
  }

  /**
   * Scan for all repositories starting from root
   * Uses cache if scanned recently
   */
  async scan(reposRoot: string, force: boolean = false): Promise<Repository[]> {
    // Return cached repos if scanned recently and not forced
    if (
      !force &&
      this.scannedAt &&
      Date.now() - this.scannedAt.getTime() < this.scanTimeout
    ) {
      logger.debug(`Using cached repos (scanned ${this.scannedAt})`);
      return this.repos;
    }

    this.logStage('searching', reposRoot);
    logger.info(`Scanning for repos in ${reposRoot}`);
    const expandedRoot = this.expandPath(reposRoot);

    this.repos = await this.scanDirectory(expandedRoot);
    this.scannedAt = new Date();

    logger.info(`Found ${this.repos.length} repositories`);
    return this.repos;
  }

  /**
   * Expand ~ in paths
   */
  private expandPath(dirPath: string): string {
    if (dirPath.startsWith('~')) {
      return path.join(process.env.HOME || '', dirPath.slice(1));
    }
    return dirPath;
  }

  /**
   * Get cached repositories
   */
  getRepos(): Repository[] {
    return this.repos;
  }

  /**
   * Get a specific repository by name
   */
  getRepo(name: string): Repository | undefined {
    return this.repos.find((r) => r.name === name);
  }
}
