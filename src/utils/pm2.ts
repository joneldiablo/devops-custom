/**
 * PM2 utilities for daemon management
 * LITE VERSION: Only handles process restart
 * Maps git repo path to PM2 app name for restart
 */

import { execSync } from 'child_process';
import path from 'path';
import type { ProcessDescription } from 'pm2';
import { logger } from './logger';

export interface PM2RestartResult {
  success: boolean;
  message: string;
  appName?: string;
}

export class PM2Manager {
  /**
   * Try to resolve PM2 app name using repository path.
   * Falls back to folder name if no PM2 process matches the path.
   */
  async getAppNameByRepoPath(repoPath: string): Promise<string> {
    const normalizedRepoPath = path.resolve(repoPath);

    try {
      const processes = await this.listProcesses();
      const processByCwd = processes.find((proc) => {
        const cwd = proc.pm2_env?.pm_cwd;
        return cwd ? path.resolve(cwd) === normalizedRepoPath : false;
      });

      if (processByCwd?.name) {
        return processByCwd.name;
      }

      const processByExecPath = processes.find((proc) => {
        const execPath = proc.pm2_env?.pm_exec_path;
        if (!execPath) return false;
        return path.dirname(path.resolve(execPath)) === normalizedRepoPath;
      });

      if (processByExecPath?.name) {
        return processByExecPath.name;
      }
    } catch (error: any) {
      logger.warn(
        `Could not resolve PM2 app from path ${repoPath}, using folder name: ${error.message}`
      );
    }

    return path.basename(normalizedRepoPath);
  }

  private async listProcesses(): Promise<ProcessDescription[]> {
    const pm2 = require('pm2') as typeof import('pm2');

    return await new Promise((resolve, reject) => {
      pm2.connect((connectError) => {
        if (connectError) {
          reject(connectError);
          return;
        }

        pm2.list((listError, processDescriptionList) => {
          pm2.disconnect();

          if (listError) {
            reject(listError);
            return;
          }

          resolve(processDescriptionList || []);
        });
      });
    });
  }

  /**
   * Restart a PM2 process by app name
   * Useful when repo config has explicit pm2 app name
   */
  async restart(appName: string): Promise<PM2RestartResult> {
    try {
      logger.debug(`Restarting PM2 app: ${appName}`);

      const result = execSync(`pm2 restart ${appName} --no-autorestart`, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      logger.info(`PM2 app restarted: ${appName}`);

      return {
        success: true,
        message: `Restarted ${appName}`,
        appName,
      };
    } catch (error: any) {
      logger.error(`Failed to restart PM2 app ${appName}: ${error.message}`);

      return {
        success: false,
        message: `Restart failed: ${error.message}`,
        appName,
      };
    }
  }

  /**
   * Detect PM2 app name from repository config
   * Config should have 'restart' command like 'pm2 restart myapp'
   * Extracts app name from the restart command
   */
  extractAppNameFromCommand(restartCommand: string): string | null {
    // Pattern: pm2 restart <appname>
    const match = restartCommand.match(/pm2\s+restart\s+([\w\-]+)/);
    return match ? match[1] : null;
  }

  /**
   * Determine if a restart command is a PM2 command
   */
  isPM2Command(restartCommand: string): boolean {
    return /pm2\s+restart/.test(restartCommand);
  }
}
