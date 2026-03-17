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
import { execSync, spawn } from 'child_process';
import { EventEmitter } from 'events';

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
      discardLocalChanges: jest.fn().mockResolvedValue(undefined),
      pull: jest.fn().mockResolvedValue(undefined),
      getLatestCommitMessage: jest.fn().mockResolvedValue('feat: update deps'),
      getChangeCount: jest.fn().mockResolvedValue(1),
      hasRemote: jest.fn().mockResolvedValue(true),
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
    (spawn as jest.Mock).mockImplementation(() => {
      const proc = new EventEmitter() as any;
      process.nextTick(() => proc.emit('close', 0, null));
      return proc;
    });

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
      expect(mockGit.discardLocalChanges).toHaveBeenCalled();
      expect(mockGit.pull).toHaveBeenCalledWith('origin', 'master');
      expect(mockGit.getLatestCommitMessage).toHaveBeenCalled();
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
      expect(execSync).not.toHaveBeenCalled();
      expect(mockPM2.restart).not.toHaveBeenCalled();
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
      expect(execSync).not.toHaveBeenCalled();
      expect(mockPM2.restart).not.toHaveBeenCalled();
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

      expect(spawn).toHaveBeenCalledWith(
        '/bin/bash',
        ['-lc', 'yarn install; yarn build'],
        expect.objectContaining({
          cwd: '/test/repo',
          stdio: 'ignore',
        })
      );
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
      (spawn as jest.Mock).mockImplementationOnce(() => {
        const proc = new EventEmitter() as any;
        process.nextTick(() => proc.emit('close', 1, null));
        return proc;
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

      // Uses default remote/branch from merged config
      expect(mockGit.pull).toHaveBeenCalledWith('origin', 'master');
    });

    it('should skip update when configured remote does not exist', async () => {
      mockGit.hasRemote.mockResolvedValueOnce(false);

      const repo = {
        path: '/test/repo',
        name: 'test-repo',
        remoteUrl: 'https://github.com/test/repo',
        branch: 'main',
        status: 'idle' as const,
      };

      const result = await worker.updateRepository(repo);

      expect(result.success).toBe(false);
      expect(result.message).toContain('does not exist');
      expect(mockGit.pull).not.toHaveBeenCalled();
      expect(execSync).not.toHaveBeenCalled();
      expect(mockPM2.restart).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('remote "origin" does not exist')
      );
    });

    it('should not restart when pull fails', async () => {
      mockGit.pull.mockRejectedValueOnce(new Error('Pull failed'));

      const repo = {
        path: '/test/repo',
        name: 'test-repo',
        remoteUrl: 'https://github.com/test/repo',
        branch: 'main',
        status: 'idle' as const,
      };

      const result = await worker.updateRepository(repo);

      expect(result.success).toBe(false);
      expect(execSync).not.toHaveBeenCalled();
      expect(mockPM2.restart).not.toHaveBeenCalled();
    });

    it('should not restart when build command is empty', async () => {
      (fs.existsSync as jest.Mock).mockImplementation((filePath: string) =>
        filePath.endsWith('.devops-custom.json')
      );
      (fs.readFileSync as jest.Mock).mockReturnValue(
        JSON.stringify({
          build: '',
          restart: 'pm2 restart test-repo',
        })
      );
      mockPM2.isPM2Command.mockReturnValue(true);
      mockPM2.extractAppNameFromCommand.mockReturnValue('test-repo');

      const repo = {
        path: '/test/repo',
        name: 'test-repo',
        remoteUrl: 'https://github.com/test/repo',
        branch: 'main',
        status: 'idle' as const,
      };

      const result = await worker.updateRepository(repo);

      expect(result.success).toBe(true);
      expect(execSync).not.toHaveBeenCalled();
      expect(mockPM2.restart).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('build step was not executed')
      );
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

    it('should log latest commit message after pull', async () => {
      const repo = {
        path: '/test/repo',
        name: 'test-repo',
        remoteUrl: 'https://github.com/test/repo',
        branch: 'main',
        status: 'idle' as const,
      };

      await worker.updateRepository(repo);

      expect(logger.info).toHaveBeenCalledWith(
        'Latest commit for test-repo: feat: update deps'
      );
    });
  });
});
