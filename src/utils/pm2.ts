/**
 * PM2 utilities for daemon management
 * LITE VERSION: Only handles process restart
 * Maps git repo path to PM2 app name for restart
 */

import { execSync } from 'child_process';
import { logger } from './logger';

export interface PM2RestartResult {
  success: boolean;
  message: string;
  appName?: string;
}

export class PM2Manager {
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
