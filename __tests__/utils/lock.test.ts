/**
 * Unit tests for lock.ts
 * ALL DEPENDENCIES ARE MOCKED
 */

import { LockManager } from '../../src/utils/lock';
import { logger } from '../../src/utils/logger';
import * as fs from 'fs';
import * as path from 'path';

jest.mock('fs');
jest.mock('../../src/utils/logger');

describe('LockManager', () => {
  let lockManager: LockManager;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set default mock behaviors
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    (fs.writeFileSync as jest.Mock).mockReturnValue(undefined);
    (fs.unlinkSync as jest.Mock).mockReturnValue(undefined);
    (fs.statSync as jest.Mock).mockReturnValue({
      mtime: new Date(Date.now() - 5 * 60 * 1000),
    });
    
    lockManager = new LockManager();
  });

  describe('isLocked()', () => {
    it('should return false if lock file does not exist', () => {
      (fs.existsSync as jest.Mock).mockReturnValueOnce(false);

      const locked = lockManager.isLocked('/test/repo');

      expect(locked).toBe(false);
      expect(fs.existsSync).toHaveBeenCalledWith('/test/repo/.deploying');
    });

    it('should return true if lock file exists and is fresh', () => {
      const now = Date.now();
      const stats = {
        mtime: new Date(now - 5 * 60 * 1000), // 5 minutes ago
      };

      (fs.existsSync as jest.Mock).mockReturnValueOnce(true);
      (fs.statSync as jest.Mock).mockReturnValueOnce(stats);

      const locked = lockManager.isLocked('/test/repo');

      expect(locked).toBe(true);
    });

    it('should remove stale lock (older than 30 minutes)', () => {
      const now = Date.now();
      const stats = {
        mtime: new Date(now - 31 * 60 * 1000), // 31 minutes ago
      };

      (fs.existsSync as jest.Mock)
        .mockReturnValueOnce(true) // exists check
        .mockReturnValueOnce(true); // unlink check

      (fs.statSync as jest.Mock).mockReturnValueOnce(stats);

      const locked = lockManager.isLocked('/test/repo');

      expect(locked).toBe(false);
      expect(logger.warn).toHaveBeenCalled();
      expect(fs.unlinkSync).toHaveBeenCalled();
    });
  });

  describe('acquireLock()', () => {
    it('should create lock file successfully', () => {
      (fs.existsSync as jest.Mock).mockReturnValueOnce(false);

      const acquired = lockManager.acquireLock('/test/repo');

      expect(acquired).toBe(true);
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        '/test/repo/.deploying',
        expect.stringContaining('timestamp'),
        'utf-8'
      );
      expect(logger.debug).toHaveBeenCalledWith('Lock acquired for /test/repo');
    });

    it('should fail if already locked', () => {
      (fs.existsSync as jest.Mock).mockReturnValueOnce(true);
      const freshTime = new Date(Date.now() - 5 * 60 * 1000);
      (fs.statSync as jest.Mock).mockReturnValueOnce({
        mtime: freshTime,
      });

      const acquired = lockManager.acquireLock('/test/repo');

      expect(acquired).toBe(false);
      expect(fs.writeFileSync).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalled();
    });

    it('should handle write errors', () => {
      (fs.existsSync as jest.Mock).mockReturnValueOnce(false);
      (fs.writeFileSync as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Permission denied');
      });

      const acquired = lockManager.acquireLock('/test/repo');

      expect(acquired).toBe(false);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('releaseLock()', () => {
    it('should delete lock file', () => {
      (fs.existsSync as jest.Mock).mockReturnValueOnce(true);

      lockManager.releaseLock('/test/repo');

      expect(fs.unlinkSync).toHaveBeenCalledWith('/test/repo/.deploying');
      expect(logger.debug).toHaveBeenCalledWith('Lock released for /test/repo');
    });

    it('should not error if lock does not exist', () => {
      (fs.existsSync as jest.Mock).mockReturnValueOnce(false);

      lockManager.releaseLock('/test/repo');

      expect(fs.unlinkSync).not.toHaveBeenCalled();
    });

    it('should handle unlink errors', () => {
      (fs.existsSync as jest.Mock).mockReturnValueOnce(true);
      (fs.unlinkSync as jest.Mock).mockImplementationOnce(() => {
        throw new Error('File in use');
      });

      lockManager.releaseLock('/test/repo');

      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('withLock()', () => {
    it('should acquire lock, execute function, and release lock', async () => {
      // Chain mockReturnValueOnce calls: first for isLocked check, second for releaseLock check
      (fs.existsSync as jest.Mock)
        .mockReturnValueOnce(false) // First call in isLocked returns false (not locked)
        .mockReturnValueOnce(true); // Second call in releaseLock returns true (file exists)

      const fn = jest.fn().mockResolvedValueOnce('result');

      const result = await lockManager.withLock('/test/repo', fn);

      expect(fs.writeFileSync).toHaveBeenCalled(); // acquire
      expect(fn).toHaveBeenCalled();
      expect(fs.unlinkSync).toHaveBeenCalled(); // release
      expect(result).toBe('result');
    });

    it('should return null if lock acquisition fails', async () => {
      (fs.existsSync as jest.Mock).mockReturnValueOnce(true);
      const freshTime = new Date(Date.now() - 5 * 60 * 1000);
      (fs.statSync as jest.Mock).mockReturnValueOnce({
        mtime: freshTime,
      });

      const fn = jest.fn();

      const result = await lockManager.withLock('/test/repo', fn);

      expect(result).toBeNull();
      expect(fn).not.toHaveBeenCalled();
    });

    it('should release lock even if function throws', async () => {
      // Chain mockReturnValueOnce calls: first for isLocked check, second for releaseLock check
      (fs.existsSync as jest.Mock)
        .mockReturnValueOnce(false) // First call in isLocked returns false (not locked)
        .mockReturnValueOnce(true); // Second call in releaseLock returns true (file exists)

      const fn = jest.fn().mockRejectedValueOnce(new Error('Test error'));

      await expect(
        lockManager.withLock('/test/repo', fn)
      ).rejects.toThrow('Test error');

      expect(fs.unlinkSync).toHaveBeenCalled(); // lock should be released
    });

    it('should handle lock file write errors', async () => {
      (fs.existsSync as jest.Mock).mockReturnValueOnce(false);
      (fs.writeFileSync as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Write error');
      });

      const fn = jest.fn();

      const result = await lockManager.withLock('/test/repo', fn);

      expect(result).toBeNull();
      expect(fn).not.toHaveBeenCalled();
    });
  });
});
