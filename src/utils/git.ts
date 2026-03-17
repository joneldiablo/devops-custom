/**
 * Git utility functions using simple-git
 * Wraps common git operations for the daemon
 */

import { simpleGit, SimpleGit } from 'simple-git';
import { logger } from './logger';

export class GitUtils {
  private git: SimpleGit;
  private repoPath: string;

  constructor(repoPath: string) {
    this.repoPath = repoPath;
    this.git = simpleGit(repoPath);
  }

  /**
   * Fetch all remotes and prune deleted branches
   */
  async fetch(): Promise<void> {
    try {
      await this.git.fetch(['--all', '--prune']);
      logger.debug(`Fetched ${this.repoPath}`);
    } catch (error) {
      logger.error(`Fetch failed for ${this.repoPath}: ${error}`);
      throw error;
    }
  }

  /**
   * Check if there are unpulled changes
   * Returns the count of commits ahead in remote
   */
  async getChangeCount(
    branch: string = 'master',
    remote: string = 'origin'
  ): Promise<number> {
    try {
      const result = await this.git.raw([
        'rev-list',
        `HEAD..${remote}/${branch}`,
        '--count',
      ]);
      return parseInt(result.trim(), 10) || 0;
    } catch (error) {
      logger.error(`Change count check failed for ${this.repoPath}: ${error}`);
      return 0;
    }
  }

  /**
   * Pull latest changes from remote
   */
  async pull(remote: string = 'origin', branch: string = 'master'): Promise<void> {
    try {
      await this.git.pull(remote, branch);
      logger.info(`Pulled ${remote}/${branch} from ${this.repoPath}`);
    } catch (error) {
      logger.error(`Pull failed for ${this.repoPath}: ${error}`);
      throw error;
    }
  }

  /**
   * Get current branch name
   */
  async getCurrentBranch(): Promise<string> {
    try {
      const branch = await this.git.revparse(['--abbrev-ref', 'HEAD']);
      return branch.trim();
    } catch (error) {
      logger.error(`Branch check failed for ${this.repoPath}: ${error}`);
      throw error;
    }
  }

  /**
   * Get remote URL
   */
  async getRemoteUrl(remote: string = 'origin'): Promise<string> {
    try {
      const url = await this.git.getConfig(`remote.${remote}.url`);
      return url.value || '';
    } catch (error) {
      logger.error(`Remote URL fetch failed for ${this.repoPath}: ${error}`);
      throw error;
    }
  }

  /**
   * Check whether a git remote exists by name
   */
  async hasRemote(remote: string = 'origin'): Promise<boolean> {
    try {
      const result = await this.git.raw(['remote']);
      const remotes = result
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
      return remotes.includes(remote);
    } catch (error) {
      logger.warn(`Remote check failed for ${this.repoPath}: ${error}`);
      return false;
    }
  }

  /**
   * Check if repo has unpushed local commits
   */
  async hasUnpushedChanges(
    branch: string = 'master',
    remote: string = 'origin'
  ): Promise<boolean> {
    try {
      const result = await this.git.raw([
        'rev-list',
        `${remote}/${branch}...HEAD`,
        '--count',
      ]);
      return parseInt(result.trim(), 10) > 0;
    } catch (error) {
      logger.warn(`Unpushed check failed for ${this.repoPath}: ${error}`);
      return false;
    }
  }
}
