/**
 * Tests for Logger utility
 * Tests logging functionality and output formatting
 */

import { Logger, LogLevel, createLogger, defaultLogger } from '../../../src/utils/logger.js';

describe('Logger', () => {
  let logger: Logger;
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    logger = new Logger({ level: LogLevel.DEBUG, enabled: true });
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('constructor', () => {
    it('should create logger with default config', () => {
      const log = new Logger();
      expect(log).toBeInstanceOf(Logger);
    });

    it('should create logger with custom config', () => {
      const log = new Logger({ level: LogLevel.ERROR, prefix: 'Test' });
      expect(log).toBeInstanceOf(Logger);
    });
  });

  describe('setLevel()', () => {
    it('should change log level', () => {
      logger.setLevel(LogLevel.ERROR);
      logger.debug('test');
      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });

  describe('setEnabled()', () => {
    it('should disable logging', () => {
      logger.setEnabled(false);
      logger.info('test');
      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('should enable logging', () => {
      logger.setEnabled(true);
      logger.info('test');
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('debug()', () => {
    it('should log debug messages', () => {
      logger.debug('Debug message');
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should not log when level is higher', () => {
      logger.setLevel(LogLevel.INFO);
      logger.debug('Debug message');
      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('should log with context', () => {
      logger.debug('Debug message', { key: 'value' });
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('info()', () => {
    it('should log info messages', () => {
      logger.info('Info message');
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('warn()', () => {
    it('should log warn messages', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      logger.warn('Warning message');
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  describe('error()', () => {
    it('should log error messages', () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();
      logger.error('Error message');
      expect(errorSpy).toHaveBeenCalled();
      errorSpy.mockRestore();
    });

    it('should log error with Error object', () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();
      const error = new Error('Test error');
      logger.error('Error occurred', error);
      expect(errorSpy).toHaveBeenCalled();
      errorSpy.mockRestore();
    });
  });

  describe('child()', () => {
    it('should create child logger with prefix', () => {
      const child = logger.child('Child');
      expect(child).toBeInstanceOf(Logger);
    });

    it('should create nested prefix', () => {
      const parent = new Logger({ prefix: 'Parent' });
      const child = parent.child('Child');
      expect(child).toBeInstanceOf(Logger);
    });
  });

  describe('logQuery()', () => {
    it('should log query execution', () => {
      logger.logQuery('SELECT * FROM users', [1], 100);
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('logConnection()', () => {
    it('should log connection events', () => {
      logger.logConnection('connect', { host: 'localhost' });
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should log error events', () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();
      logger.logConnection('error', { message: 'Connection failed' });
      expect(errorSpy).toHaveBeenCalled();
      errorSpy.mockRestore();
    });
  });

  describe('Format output', () => {
    it('should format with pretty output', () => {
      const prettyLogger = new Logger({ pretty: true });
      const spy = jest.spyOn(console, 'log').mockImplementation();
      prettyLogger.info('Test');
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('should format with JSON output', () => {
      const jsonLogger = new Logger({ pretty: false });
      const spy = jest.spyOn(console, 'log').mockImplementation();
      jsonLogger.info('Test');
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  describe('Custom output', () => {
    it('should use custom output function', () => {
      const customOutput = jest.fn();
      const customLogger = new Logger({ output: customOutput });
      customLogger.info('Test');
      expect(customOutput).toHaveBeenCalled();
    });
  });
});

describe('createLogger()', () => {
  it('should create new logger', () => {
    const logger = createLogger({ level: LogLevel.DEBUG });
    expect(logger).toBeInstanceOf(Logger);
  });
});

describe('defaultLogger', () => {
  it('should be a Logger instance', () => {
    expect(defaultLogger).toBeInstanceOf(Logger);
  });
});
