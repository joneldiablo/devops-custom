/**
 * Unit tests for pm2.ts
 * ALL DEPENDENCIES ARE MOCKED
 */

import { PM2Manager } from '../../src/utils/pm2';
import { logger } from '../../src/utils/logger';
import { execSync } from 'child_process';
import * as pm2 from 'pm2';

jest.mock('child_process');
jest.mock('pm2');
jest.mock('../../src/utils/logger');

describe('PM2Manager', () => {
  let pm2Manager: PM2Manager;

  beforeEach(() => {
    jest.clearAllMocks();
    pm2Manager = new PM2Manager();
  });

  describe('restart()', () => {
    it('should restart PM2 app successfully', async () => {
      (execSync as jest.Mock).mockReturnValueOnce('myapp restarted');

      const result = await pm2Manager.restart('myapp');

      expect(result.success).toBe(true);
      expect(result.appName).toBe('myapp');
      expect(result.message).toContain('Restarted myapp');
      expect(execSync).toHaveBeenCalledWith(
        'pm2 restart myapp --no-autorestart',
        expect.objectContaining({ encoding: 'utf-8' })
      );
      expect(logger.info).toHaveBeenCalled();
    });

    it('should handle restart failures', async () => {
      const error = new Error('PM2 not installed');
      (execSync as jest.Mock).mockImplementationOnce(() => {
        throw error;
      });

      const result = await pm2Manager.restart('myapp');

      expect(result.success).toBe(false);
      expect(result.appName).toBe('myapp');
      expect(result.message).toContain('Restart failed');
      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle app not found', async () => {
      const error = new Error('App not found');
      (execSync as jest.Mock).mockImplementationOnce(() => {
        throw error;
      });

      const result = await pm2Manager.restart('nonexistent');

      expect(result.success).toBe(false);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('getAppNameByRepoPath()', () => {
    it('should resolve app name from pm_cwd', async () => {
      (pm2.connect as jest.Mock).mockImplementation((cb: any) => cb(null));
      (pm2.disconnect as jest.Mock).mockImplementation(() => {});
      (pm2.list as jest.Mock).mockImplementation((cb: any) =>
        cb(null, [
          {
            name: 'api-service',
            pm2_env: { pm_cwd: '/srv/api-service' },
          },
        ])
      );

      const appName = await pm2Manager.getAppNameByRepoPath('/srv/api-service');

      expect(appName).toBe('api-service');
    });

    it('should fallback to folder name when app not found', async () => {
      (pm2.connect as jest.Mock).mockImplementation((cb: any) => cb(null));
      (pm2.disconnect as jest.Mock).mockImplementation(() => {});
      (pm2.list as jest.Mock).mockImplementation((cb: any) => cb(null, []));

      const appName = await pm2Manager.getAppNameByRepoPath('/srv/my-project');

      expect(appName).toBe('my-project');
    });
  });

  describe('extractAppNameFromCommand()', () => {
    it('should extract app name from restart command', () => {
      const appName = pm2Manager.extractAppNameFromCommand(
        'pm2 restart myapp'
      );

      expect(appName).toBe('myapp');
    });

    it('should extract app name with dashes', () => {
      const appName = pm2Manager.extractAppNameFromCommand(
        'pm2 restart my-app-name'
      );

      expect(appName).toBe('my-app-name');
    });

    it('should extract app name with underscores', () => {
      const appName = pm2Manager.extractAppNameFromCommand(
        'pm2 restart my_app_name'
      );

      expect(appName).toBe('my_app_name');
    });

    it('should return null for non-pm2 commands', () => {
      const appName = pm2Manager.extractAppNameFromCommand(
        'yarn rebuild'
      );

      expect(appName).toBeNull();
    });

    it('should return null if restart command malformed', () => {
      const appName = pm2Manager.extractAppNameFromCommand(
        'pm2 restart'
      );

      expect(appName).toBeNull();
    });

    it('should handle extra spaces', () => {
      const appName = pm2Manager.extractAppNameFromCommand(
        'pm2   restart   myapp'
      );

      expect(appName).toBe('myapp');
    });
  });

  describe('isPM2Command()', () => {
    it('should detect pm2 restart commands', () => {
      const ispm2 = pm2Manager.isPM2Command('pm2 restart myapp');

      expect(ispm2).toBe(true);
    });

    it('should handle extra spaces', () => {
      const ispm2 = pm2Manager.isPM2Command('pm2   restart   myapp');

      expect(ispm2).toBe(true);
    });

    it('should return false for non-pm2 commands', () => {
      const ispm2 = pm2Manager.isPM2Command('yarn build');

      expect(ispm2).toBe(false);
    });

    it('should return false for other pm2 commands', () => {
      const ispm2 = pm2Manager.isPM2Command('pm2 start myapp');

      expect(ispm2).toBe(false);
    });

    it('should return false for empty string', () => {
      const ispm2 = pm2Manager.isPM2Command('');

      expect(ispm2).toBe(false);
    });
  });
});
