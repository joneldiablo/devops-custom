/**
 * Unit tests for git.ts utilities
 * ALL DEPENDENCIES ARE MOCKED
 */

import { GitUtils } from '../../src/utils/git';
import { logger } from '../../src/utils/logger';
import { simpleGit } from 'simple-git';

// Mock dependencies
jest.mock('simple-git');
jest.mock('../../src/utils/logger');

describe('GitUtils', () => {
  let git: GitUtils;
  let mockGitInstance: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Set up simpleGit mock
    mockGitInstance = {
      fetch: jest.fn().mockResolvedValue({}),
      pull: jest.fn().mockResolvedValue({}),
      raw: jest.fn(),
      revparse: jest.fn(),
      getConfig: jest.fn(),
    };

    (simpleGit as jest.Mock).mockReturnValue(mockGitInstance);

    git = new GitUtils('/test/repo');
  });

  describe('fetch()', () => {
    it('should fetch all remotes with prune', async () => {
      await git.fetch();

      expect(mockGitInstance.fetch).toHaveBeenCalledWith(['--all', '--prune']);
      expect(logger.debug).toHaveBeenCalledWith('Fetched /test/repo');
    });

    it('should handle fetch errors', async () => {
      const error = new Error('Network error');
      mockGitInstance.fetch.mockRejectedValueOnce(error);

      await expect(git.fetch()).rejects.toThrow('Network error');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('getChangeCount()', () => {
    it('should return number of commits ahead', async () => {
      mockGitInstance.raw.mockResolvedValueOnce('5\n');

      const count = await git.getChangeCount('main');

      expect(count).toBe(5);
      expect(mockGitInstance.raw).toHaveBeenCalledWith([
        'rev-list',
        'HEAD...origin/main',
        '--count',
      ]);
    });

    it('should return 0 if no changes', async () => {
      mockGitInstance.raw.mockResolvedValueOnce('0\n');

      const count = await git.getChangeCount('main');

      expect(count).toBe(0);
    });

    it('should handle errors gracefully', async () => {
      mockGitInstance.raw.mockRejectedValueOnce(new Error('Git error'));

      const count = await git.getChangeCount('main');

      expect(count).toBe(0);
      expect(logger.error).toHaveBeenCalled();
    });

    it('should use default branch if not specified', async () => {
      mockGitInstance.raw.mockResolvedValueOnce('3\n');

      await git.getChangeCount();

      expect(mockGitInstance.raw).toHaveBeenCalledWith(
        expect.arrayContaining(['HEAD...origin/master'])
      );
    });
  });

  describe('pull()', () => {
    it('should pull from origin branch', async () => {
      await git.pull('main');

      expect(mockGitInstance.pull).toHaveBeenCalledWith('origin', 'main');
      expect(logger.info).toHaveBeenCalledWith('Pulled main from /test/repo');
    });

    it('should use default branch if not specified', async () => {
      await git.pull();

      expect(mockGitInstance.pull).toHaveBeenCalledWith('origin', 'master');
    });

    it('should handle pull errors', async () => {
      const error = new Error('Merge conflict');
      mockGitInstance.pull.mockRejectedValueOnce(error);

      await expect(git.pull('main')).rejects.toThrow('Merge conflict');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('getCurrentBranch()', () => {
    it('should return current branch name', async () => {
      mockGitInstance.revparse.mockResolvedValueOnce('main\n');

      const branch = await git.getCurrentBranch();

      expect(branch).toBe('main');
      expect(mockGitInstance.revparse).toHaveBeenCalledWith([
        '--abbrev-ref',
        'HEAD',
      ]);
    });

    it('should handle errors', async () => {
      mockGitInstance.revparse.mockRejectedValueOnce(new Error('Git error'));

      await expect(git.getCurrentBranch()).rejects.toThrow();
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('getRemoteUrl()', () => {
    it('should return remote origin URL', async () => {
      mockGitInstance.getConfig.mockResolvedValueOnce({
        value: 'https://github.com/user/repo.git',
      });

      const url = await git.getRemoteUrl();

      expect(url).toBe('https://github.com/user/repo.git');
      expect(mockGitInstance.getConfig).toHaveBeenCalledWith(
        'remote.origin.url'
      );
    });

    it('should return empty string if remote not found', async () => {
      mockGitInstance.getConfig.mockResolvedValueOnce({ value: '' });

      const url = await git.getRemoteUrl();

      expect(url).toBe('');
    });

    it('should handle errors', async () => {
      mockGitInstance.getConfig.mockRejectedValueOnce(new Error('Git error'));

      await expect(git.getRemoteUrl()).rejects.toThrow();
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('hasUnpushedChanges()', () => {
    it('should return true if there are unpushed commits', async () => {
      mockGitInstance.raw.mockResolvedValueOnce('2\n');

      const hasPending = await git.hasUnpushedChanges('main');

      expect(hasPending).toBe(true);
      expect(mockGitInstance.raw).toHaveBeenCalledWith([
        'rev-list',
        'origin/main...HEAD',
        '--count',
      ]);
    });

    it('should return false if no unpushed commits', async () => {
      mockGitInstance.raw.mockResolvedValueOnce('0\n');

      const hasPending = await git.hasUnpushedChanges('main');

      expect(hasPending).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      mockGitInstance.raw.mockRejectedValueOnce(new Error('Git error'));

      const hasPending = await git.hasUnpushedChanges('main');

      expect(hasPending).toBe(false);
      expect(logger.warn).toHaveBeenCalled();
    });
  });
});
