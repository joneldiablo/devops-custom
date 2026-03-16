/**
 * File-based lock system for managing concurrent updates
 * Prevents simultaneous deployments to the same repository
 */

import fs from 'fs';
import path from 'path';
import { logger } from './logger';

export class LockManager {
  private lockFileName = '.deploying';
  private staleTimeout = 30 * 60 * 1000; // 30 minutes

  /**
   * Get lock file path for a repository
   */
  private getLockPath(repoPath: string): string {
    return path.join(repoPath, this.lockFileName);
  }

  /**
   * Check if lock file exists and is not stale
   */
  isLocked(repoPath: string): boolean {
    const lockPath = this.getLockPath(repoPath);
    
    if (!fs.existsSync(lockPath)) {
      return false;
    }

    // Check if lock is stale
    const stats = fs.statSync(lockPath);
    const age = Date.now() - stats.mtime.getTime();

    if (age > this.staleTimeout) {
      logger.warn(`Stale lock found at ${lockPath}, removing`);
      this.releaseLock(repoPath);
      return false;
    }

    return true;
  }

  /**
   * Acquire lock for a repository
   * Returns true if lock was acquired, false if already locked
   */
  acquireLock(repoPath: string): boolean {
    if (this.isLocked(repoPath)) {
      logger.warn(`Lock already exists for ${repoPath}`);
      return false;
    }

    const lockPath = this.getLockPath(repoPath);
    try {
      fs.writeFileSync(
        lockPath,
        JSON.stringify({
          timestamp: new Date().toISOString(),
          pid: process.pid,
        }),
        'utf-8'
      );
      logger.debug(`Lock acquired for ${repoPath}`);
      return true;
    } catch (error) {
      logger.error(`Failed to acquire lock for ${repoPath}: ${error}`);
      return false;
    }
  }

  /**
   * Release lock for a repository
   */
  releaseLock(repoPath: string): void {
    const lockPath = this.getLockPath(repoPath);
    try {
      if (fs.existsSync(lockPath)) {
        fs.unlinkSync(lockPath);
        logger.debug(`Lock released for ${repoPath}`);
      }
    } catch (error) {
      logger.error(`Failed to release lock for ${repoPath}: ${error}`);
    }
  }

  /**
   * Execute a function with lock management
   * Automatically acquires and releases lock
   */
  async withLock<T>(
    repoPath: string,
    fn: () => Promise<T>
  ): Promise<T | null> {
    if (!this.acquireLock(repoPath)) {
      return null;
    }

    try {
      return await fn();
    } finally {
      this.releaseLock(repoPath);
    }
  }
}
