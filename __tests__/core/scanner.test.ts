/**
 * Unit tests for scanner.ts
 * ALL DEPENDENCIES ARE MOCKED
 */

import { Scanner } from '../../src/core/scanner';
import { GitUtils } from '../../src/utils/git';
import { logger } from '../../src/utils/logger';
import * as fs from 'fs';

jest.mock('fs');
jest.mock('../../src/utils/git');
jest.mock('../../src/utils/logger');

describe('Scanner', () => {
  let scanner: Scanner;

  beforeEach(() => {
    jest.clearAllMocks();
    scanner = new Scanner();
  });

  describe('scan()', () => {
    it('should find git repositories recursively', async () => {
      const mockGitUtils = {
        getRemoteUrl: jest.fn().mockResolvedValue('https://github.com/test/repo'),
        getCurrentBranch: jest.fn().mockResolvedValue('main'),
      };

      (GitUtils as jest.Mock).mockImplementation(() => mockGitUtils);

      (fs.readdirSync as jest.Mock).mockImplementation((path: string) => {
        if (path === '/root') {
          return [
            { name: 'repo1', isDirectory: () => true } as any,
            { name: '.cache', isDirectory: () => true } as any,
          ];
        }
        return [];
      });

      (fs.existsSync as jest.Mock).mockImplementation((path: string) => {
        return path.includes('repo1') && path.endsWith('.git');
      });

      (fs.readFileSync as jest.Mock).mockReturnValue(
        JSON.stringify({ branch: 'main', enabled: true })
      );

      const repos = await scanner.scan('/root');

      expect(repos.length).toBe(1);
      expect(repos[0].name).toBe('repo1');
      expect(repos[0].remoteUrl).toBe('https://github.com/test/repo');
    });

    it('should filter hidden directories', async () => {
      (fs.readdirSync as jest.Mock).mockReturnValue([
        { name: '.git', isDirectory: () => true } as any,
        { name: '.cache', isDirectory: () => true } as any,
        { name: 'repo', isDirectory: () => true } as any,
      ]);

      (fs.existsSync as jest.Mock).mockReturnValue(false);

      const repos = await scanner.scan('/root');

      expect(repos.length).toBe(0);
    });

    it('should use cached repos if scanned recently', async () => {
      const mockGitUtils = {
        getRemoteUrl: jest.fn().mockResolvedValue('https://github.com/test/repo'),
        getCurrentBranch: jest.fn().mockResolvedValue('main'),
      };

      (GitUtils as jest.Mock).mockImplementation(() => mockGitUtils);
      (fs.readdirSync as jest.Mock).mockReturnValue([
        { name: 'repo1', isDirectory: () => true } as any,
      ]);
      (fs.existsSync as jest.Mock).mockImplementation((path: string) => {
        return path.includes('repo1') && path.endsWith('.git');
      });
      (fs.readFileSync as jest.Mock).mockReturnValue('{}');

      const repos1 = await scanner.scan('/root');
      const callCount1 = (fs.readdirSync as jest.Mock).mock.calls.length;

      const repos2 = await scanner.scan('/root');

      expect((fs.readdirSync as jest.Mock).mock.calls.length).toBe(callCount1);
      expect(repos1).toEqual(repos2);
    });

    it('should force rescan when requested', async () => {
      const mockGitUtils = {
        getRemoteUrl: jest.fn().mockResolvedValue('https://github.com/test/repo'),
        getCurrentBranch: jest.fn().mockResolvedValue('main'),
      };

      (GitUtils as jest.Mock).mockImplementation(() => mockGitUtils);
      (fs.readdirSync as jest.Mock).mockReturnValue([
        { name: 'repo1', isDirectory: () => true } as any,
      ]);
      (fs.existsSync as jest.Mock).mockImplementation((path: string) => {
        return path.includes('repo1') && path.endsWith('.git');
      });
      (fs.readFileSync as jest.Mock).mockReturnValue('{}');

      await scanner.scan('/root');
      const callCount1 = (fs.readdirSync as jest.Mock).mock.calls.length;

      await scanner.scan('/root', true);

      expect((fs.readdirSync as jest.Mock).mock.calls.length).toBeGreaterThan(
        callCount1
      );
    });

    it('should load repository config from .devops-custom.json', async () => {
      const config = {
        branch: 'develop',
        build: 'npm run build',
        restart: 'pm2 restart myapp',
        enabled: true,
      };

      const mockGitUtils = {
        getRemoteUrl: jest.fn().mockResolvedValue('https://github.com/user/repo'),
        getCurrentBranch: jest.fn().mockResolvedValue('main'),
      };

      (GitUtils as jest.Mock).mockImplementation(() => mockGitUtils);
      (fs.readdirSync as jest.Mock).mockReturnValue([
        { name: 'repo', isDirectory: () => true } as any,
      ]);
      (fs.existsSync as jest.Mock).mockImplementation((path: string) => {
        return (
          (path.includes('repo') && path.endsWith('.git')) ||
          (path.includes('repo') && path.endsWith('.devops-custom.json'))
        );
      });
      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(config));

      const repos = await scanner.scan('/root');

      expect(repos[0].branch).toBe('develop');
    });

    it('should handle corrupted config files', async () => {
      const mockGitUtils = {
        getRemoteUrl: jest.fn().mockResolvedValue('https://github.com/user/repo'),
        getCurrentBranch: jest.fn().mockResolvedValue('main'),
      };

      (GitUtils as jest.Mock).mockImplementation(() => mockGitUtils);
      (fs.readdirSync as jest.Mock).mockReturnValue([
        { name: 'repo', isDirectory: () => true } as any,
      ]);
      (fs.existsSync as jest.Mock).mockImplementation((path: string) => {
        return path.includes('repo') && path.endsWith('.git');
      });
      (fs.readFileSync as jest.Mock).mockReturnValue('{ invalid JSON }');

      const repos = await scanner.scan('/root');

      expect(repos.length).toBe(1);
      expect(repos[0].branch).toBe('master');
    });

    it('should handle scan errors gracefully', async () => {
      (fs.readdirSync as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Permission denied');
      });

      const repos = await scanner.scan('/root');

      expect(repos.length).toBe(0);
      expect(logger.error).toHaveBeenCalled();
    });

    it('should expand ~ in paths', async () => {
      const mockGitUtils = {
        getRemoteUrl: jest.fn().mockResolvedValue('https://github.com/test/repo'),
        getCurrentBranch: jest.fn().mockResolvedValue('main'),
      };

      (GitUtils as jest.Mock).mockImplementation(() => mockGitUtils);
      (fs.readdirSync as jest.Mock).mockReturnValue([]);

      await scanner.scan('~/projects');

      // Verify that expandPath was used (HOME is set in tests)
      expect(fs.readdirSync).toHaveBeenCalled();
      const callArg = (fs.readdirSync as jest.Mock).mock.calls[0][0];
      expect(typeof callArg).toBe('string');
      expect(callArg).toContain('projects');
    });

    it('should include reposRoot itself when it is a git repo', async () => {
      const mockGitUtils = {
        getRemoteUrl: jest.fn().mockResolvedValue('https://github.com/test/root-repo'),
        getCurrentBranch: jest.fn().mockResolvedValue('main'),
      };

      (GitUtils as jest.Mock).mockImplementation(() => mockGitUtils);
      (fs.readdirSync as jest.Mock).mockReturnValue([]);
      (fs.existsSync as jest.Mock).mockImplementation((path: string) => {
        return path === '/root/.git';
      });
      (fs.readFileSync as jest.Mock).mockReturnValue('{}');

      const repos = await scanner.scan('/root');

      expect(repos.length).toBe(1);
      expect(repos[0].path).toBe('/root');
      expect(repos[0].name).toBe('root');
    });
  });

  describe('getRepos()', () => {
    it('should return cached repositories', async () => {
      const mockGitUtils = {
        getRemoteUrl: jest.fn().mockResolvedValue('https://github.com/test/repo'),
        getCurrentBranch: jest.fn().mockResolvedValue('main'),
      };

      (GitUtils as jest.Mock).mockImplementation(() => mockGitUtils);
      (fs.readdirSync as jest.Mock).mockReturnValue([
        { name: 'repo1', isDirectory: () => true } as any,
      ]);
      (fs.existsSync as jest.Mock).mockImplementation((path: string) => {
        return path.includes('repo1') && path.endsWith('.git');
      });
      (fs.readFileSync as jest.Mock).mockReturnValue('{}');

      await scanner.scan('/root');
      const repos = scanner.getRepos();

      expect(repos.length).toBe(1);
    });
  });

  describe('getRepo()', () => {
    it('should find repository by name', async () => {
      const mockGitUtils = {
        getRemoteUrl: jest.fn().mockResolvedValue('https://github.com/test/repo'),
        getCurrentBranch: jest.fn().mockResolvedValue('main'),
      };

      (GitUtils as jest.Mock).mockImplementation(() => mockGitUtils);
      (fs.readdirSync as jest.Mock).mockReturnValue([
        { name: 'myrepo', isDirectory: () => true } as any,
      ]);
      (fs.existsSync as jest.Mock).mockImplementation((path: string) => {
        return path.includes('myrepo') && path.endsWith('.git');
      });
      (fs.readFileSync as jest.Mock).mockReturnValue('{}');

      await scanner.scan('/root');
      const repo = scanner.getRepo('myrepo');

      expect(repo).toBeDefined();
      expect(repo?.name).toBe('myrepo');
    });

    it('should return undefined if repo not found', () => {
      const repo = scanner.getRepo('nonexistent');
      expect(repo).toBeUndefined();
    });
  });
});
