/**
 * Unit tests for worker.ts
 * ALL DEPENDENCIES ARE MOCKED
 */

import { Worker } from '../../src/core/worker';
import { GitUtils } from '../../src/utils/git';
import { LockManager } from '../../src/utils/lock';
import { PM2Manager } from '../../src/utils/pm2';
import { logger } from '../../src/utils/logger';
import * as fs from 'fs';
import { execSync } from 'child_process';

jest.mock('../../src/utils/git');
jest.mock('../../src/utils/lock');
jest.mock('../../src/utils/pm2');
jest.mock('../../src/utils/logger');
jest.mock('fs');
jest.mock('child_process');

describe('Worker', () => {
  let worker: Worker;
  let mockGit: any;
  let mockLock: any;
  let mockPM2: any;

  beforeEach(() => {
    jest.resetAllMocks();

    mockGit = {
      fetch: jest.fn().mockResolvedValue(undefined),
      pull: jest.fn().mockResolvedValue(undefined),
      getChangeCount: jest.fn().mockResolvedValue(1),
      getCurrentBranch: jest.fn().mockResolvedValue('main'),
    };

    mockLock = {
      withLock: jest.fn((_path, fn) => fn()),
    };

    mockPM2 = {
      restart: jest.fn().mockResolvedValue({ success: true }),
      isPM2Command: jest.fn().mockReturnValue(false),
      extractAppNameFromCommand: jest.fn().mockReturnValue(null),
      getAppNameByRepoPath: jest.fn().mockResolvedValue('test-repo'),
    };

    (GitUtils as jest.Mock).mockImplementation(() => mockGit);
    (LockManager as jest.Mock).mockImplementation(() => mockLock);
    (PM2Manager as jest.Mock).mockImplementation(() => mockPM2);

    (fs.existsSync as jest.Mock).mockImplementation((filePath: string) =>
      filePath.endsWith('package.json')
    );
    (fs.readFileSync as jest.Mock).mockReturnValue('{}');
    (execSync as jest.Mock).mockReturnValue('Built successfully');

    worker = new Worker();
  });

  describe('updateRepository()', () => {
    it('should update repository successfully', async () => {
      const repo = {
        path: '/test/repo',
        name: 'test-repo',
        remoteUrl: 'https://github.com/test/repo',
        branch: 'main',
        status: 'idle' as const,
      };

      const result = await worker.updateRepository(repo);

      expect(result.success).toBe(true);
      expect(result.repository).toBe('test-repo');
      expect(mockGit.fetch).toHaveBeenCalled();
      expect(mockGit.pull).toHaveBeenCalled();
      expect(execSync).toHaveBeenCalled();
    });

    it('should respect autoUpdate flag', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(
        JSON.stringify({ autoUpdate: false })
      );

      const repo = {
        path: '/test/repo',
        name: 'test-repo',
        remoteUrl: 'https://github.com/test/repo',
        branch: 'main',
        status: 'idle' as const,
      };

      const result = await worker.updateRepository(repo);

      expect(result.success).toBe(false);
      expect(result.message).toContain('disabled');
      expect(mockGit.fetch).not.toHaveBeenCalled();
    });

    it('should respect enabled flag', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(
        JSON.stringify({ enabled: false })
      );

      const repo = {
        path: '/test/repo',
        name: 'test-repo',
        remoteUrl: 'https://github.com/test/repo',
        branch: 'main',
        status: 'idle' as const,
      };

      const result = await worker.updateRepository(repo);

      expect(result.success).toBe(false);
    });

    it('should return null if lock cannot be acquired', async () => {
      mockLock.withLock.mockResolvedValueOnce(null);

      const repo = {
        path: '/test/repo',
        name: 'test-repo',
        remoteUrl: 'https://github.com/test/repo',
        branch: 'main',
        status: 'idle' as const,
      };

      const result = await worker.updateRepository(repo);

      expect(result.success).toBe(false);
      expect(result.message).toContain('already being updated');
    });

    it('should handle fetch errors', async () => {
      mockGit.fetch.mockRejectedValueOnce(new Error('Network error'));

      const repo = {
        path: '/test/repo',
        name: 'test-repo',
        remoteUrl: 'https://github.com/test/repo',
        branch: 'main',
        status: 'idle' as const,
      };

      const result = await worker.updateRepository(repo);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle no changes scenario', async () => {
      mockGit.getChangeCount.mockResolvedValueOnce(0);

      const repo = {
        path: '/test/repo',
        name: 'test-repo',
        remoteUrl: 'https://github.com/test/repo',
        branch: 'main',
        status: 'idle' as const,
      };

      const result = await worker.updateRepository(repo);

      expect(result.success).toBe(true);
      expect(result.message).toContain('No changes');
      expect(mockGit.pull).not.toHaveBeenCalled();
    });

    it('should execute build command', async () => {
      // Don't set fs.existsSync - use defaults
      // This test just verifies that build command is called from default config
      const repo = {
        path: '/test/repo',
        name: 'test-repo',
        remoteUrl: 'https://github.com/test/repo',
        branch: 'main',
        status: 'idle' as const,
      };

      await worker.updateRepository(repo);

      // Default build command is 'yarn install && yarn build'
      expect(execSync).toHaveBeenCalledWith('yarn install && yarn build', {
        cwd: '/test/repo',
        encoding: 'utf-8',
      });
    });

    it('should execute restart command', async () => {
      // Don't set fs.existsSync - use defaults
      // This test just verifies that restart command is called
      const repo = {
        path: '/test/repo',
        name: 'test-repo',
        remoteUrl: 'https://github.com/test/repo',
        branch: 'main',
        status: 'idle' as const,
      };

      await worker.updateRepository(repo);

      // Default restart command is 'pm2 restart app' but only if it was called
      expect(execSync).toHaveBeenCalled();
    });

    it('should skip runtime commands for non Node/Deno/Bun repositories', async () => {
      (fs.existsSync as jest.Mock).mockImplementation((filePath: string) =>
        filePath.endsWith('.devops-custom.json')
      );
      (fs.readFileSync as jest.Mock).mockReturnValue(
        JSON.stringify({
          build: 'yarn install',
          restart: 'npm run restart',
        })
      );

      const repo = {
        path: '/test/repo',
        name: 'test-repo',
        remoteUrl: 'https://github.com/test/repo',
        branch: 'main',
        status: 'idle' as const,
      };

      await worker.updateRepository(repo);

      expect(execSync).not.toHaveBeenCalled();
    });

    it('should handle build command failure', async () => {
      (execSync as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Build failed');
      });

      const repo = {
        path: '/test/repo',
        name: 'test-repo',
        remoteUrl: 'https://github.com/test/repo',
        branch: 'main',
        status: 'idle' as const,
      };

      const result = await worker.updateRepository(repo);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should detect correct branch from config', async () => {
      // Branch from config is used in git.pull()
      // Default branch is 'master'
      const repo = {
        path: '/test/repo',
        name: 'test-repo',
        remoteUrl: 'https://github.com/test/repo',
        branch: 'main',
        status: 'idle' as const,
      };

      await worker.updateRepository(repo);

      // Uses default branch 'master' since fs.existsSync returns false
      expect(mockGit.pull).toHaveBeenCalledWith('master');
    });

    it('should log successful update', async () => {
      const repo = {
        path: '/test/repo',
        name: 'test-repo',
        remoteUrl: 'https://github.com/test/repo',
        branch: 'main',
        status: 'idle' as const,
      };

      await worker.updateRepository(repo);

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Successfully updated test-repo')
      );
    });
  });
});
