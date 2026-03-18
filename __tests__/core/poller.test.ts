/**
 * Unit tests for poller.ts
 * ALL DEPENDENCIES ARE MOCKED
 */

import { Poller } from '../../src/core/poller';
import { Scanner } from '../../src/core/scanner';
import { Worker } from '../../src/core/worker';
import { logger } from '../../src/utils/logger';
import { PollerOptions } from '../../src/types';

jest.mock('../../src/core/scanner');
jest.mock('../../src/core/worker');
jest.mock('../../src/utils/logger');

// Mock setTimeout and clearTimeout globally
let mockSetTimeoutId = 0;
const mockSetTimeout = jest.fn((callback: () => void, delay: number) => {
  mockSetTimeoutId++;
  return mockSetTimeoutId as unknown as NodeJS.Timeout;
});

const mockClearTimeout = jest.fn();

global.setTimeout = mockSetTimeout as any;
global.clearTimeout = mockClearTimeout as any;

describe('Poller', () => {
  let poller: Poller;
  let mockScanner: any;
  let mockWorker: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSetTimeout.mockClear();
    mockClearTimeout.mockClear();
    mockSetTimeoutId = 0;

    mockScanner = {
      scan: jest.fn().mockResolvedValue([]),
      getRepos: jest.fn().mockReturnValue([]),
    };

    mockWorker = {
      updateRepository: jest.fn().mockResolvedValue({
        success: true,
        message: 'Updated',
        repository: 'test-repo',
        timestamp: new Date(),
      }),
    };

    (Scanner as jest.Mock).mockImplementation(() => mockScanner);
    (Worker as jest.Mock).mockImplementation(() => mockWorker);

    poller = new Poller();
  });

  describe('start()', () => {
    it('should scan repositories on startup', async () => {
      const options: PollerOptions = {
        pollInterval: 5000,
        reposRoot: '/repos',
        logLevel: 'info',
      };

      await poller.start(options);
      expect(mockScanner.scan).toHaveBeenCalledWith('/repos');
    });

    it('should prevent multiple starts', async () => {
      const options: PollerOptions = {
        pollInterval: 5000,
        reposRoot: '/repos',
        logLevel: 'info',
      };

      await poller.start(options);
      await poller.start(options);

      expect(logger.warn).toHaveBeenCalledWith('Poller already running');
    });

    it('should call setTimeout for polling', async () => {
      const options: PollerOptions = {
        pollInterval: 5000,
        reposRoot: '/repos',
        logLevel: 'info',
      };

      await poller.start(options);

      expect(mockSetTimeout).toHaveBeenCalledWith(
        expect.any(Function),
        5000
      );
    });
  });

  describe('stop()', () => {
    it('should stop polling', async () => {
      const options: PollerOptions = {
        pollInterval: 5000,
        reposRoot: '/repos',
        logLevel: 'info',
      };

      await poller.start(options);
      poller.stop();

      expect(poller.isRunning()).toBe(false);
      expect(logger.info).toHaveBeenCalledWith('Poller daemon stopped');
    });

    it('should call clearTimeout when stopping', async () => {
      const options: PollerOptions = {
        pollInterval: 5000,
        reposRoot: '/repos',
        logLevel: 'info',
      };

      await poller.start(options);
      poller.stop();

      expect(mockClearTimeout).toHaveBeenCalled();
    });

    it('should warn if not running', () => {
      poller.stop();

      expect(logger.warn).toHaveBeenCalledWith('Poller not running');
    });
  });

  describe('isRunning()', () => {
    it('should return true when running', async () => {
      const options: PollerOptions = {
        pollInterval: 5000,
        reposRoot: '/repos',
        logLevel: 'info',
      };

      await poller.start(options);

      expect(poller.isRunning()).toBe(true);
    });

    it('should return false when stopped', async () => {
      const options: PollerOptions = {
        pollInterval: 5000,
        reposRoot: '/repos',
        logLevel: 'info',
      };

      await poller.start(options);
      poller.stop();

      expect(poller.isRunning()).toBe(false);
    });
  });

  describe('getRepositories()', () => {
    it('should return current repositories', () => {
      const repos = [
        { name: 'repo1', path: '/repos/repo1', status: 'idle' as const },
      ];

      mockScanner.getRepos.mockReturnValue(repos);

      const result = poller.getRepositories();

      expect(result).toEqual(repos);
    });

    it('should return empty array when no repos', () => {
      mockScanner.getRepos.mockReturnValue([]);

      const result = poller.getRepositories();

      expect(result).toEqual([]);
    });
  });
});
