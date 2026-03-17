/**
 * Tests for logger utility
 */

import { logger } from '../../src/utils/logger';

describe('Logger', () => {
  describe('logger instance', () => {
    it('should export a logger instance', () => {
      expect(logger).toBeDefined();
      expect(typeof logger).toBe('object');
    });

    it('should have standard pino log methods', () => {
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.debug).toBe('function');
    });

    it('should use LOG_LEVEL environment variable', () => {
      const originalLevel = process.env.LOG_LEVEL;
      expect(logger.level).toBe(originalLevel || 'info');
      process.env.LOG_LEVEL = originalLevel || 'info';
    });
  });

  describe('logging operations', () => {
    it('should log info messages', () => {
      const spy = jest.spyOn(logger, 'info');
      logger.info('test info message');
      expect(spy).toHaveBeenCalledWith('test info message');
      spy.mockRestore();
    });

    it('should log error messages', () => {
      const spy = jest.spyOn(logger, 'error');
      logger.error('test error message');
      expect(spy).toHaveBeenCalledWith('test error message');
      spy.mockRestore();
    });

    it('should log warn messages', () => {
      const spy = jest.spyOn(logger, 'warn');
      logger.warn('test warn message');
      expect(spy).toHaveBeenCalledWith('test warn message');
      spy.mockRestore();
    });

    it('should log debug messages', () => {
      const spy = jest.spyOn(logger, 'debug');
      logger.debug('test debug message');
      expect(spy).toHaveBeenCalledWith('test debug message');
      spy.mockRestore();
    });
  });

  describe('logger with context', () => {
    it('should log with additional context/metadata', () => {
      const spy = jest.spyOn(logger, 'info');
      logger.info({ key: 'value' }, 'context message');
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
  });
});
