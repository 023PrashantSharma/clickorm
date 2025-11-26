/**
 * Test utility functions
 * Provides helpers for common test patterns
 */

/**
 * Expect a function to throw a specific error type
 */
export function expectToThrow<T extends Error>(
  fn: () => unknown,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ErrorType: new (...args: any[]) => T,
  messagePattern?: string | RegExp
): void {
  expect(fn).toThrow(ErrorType);
  if (messagePattern) {
    expect(fn).toThrow(messagePattern);
  }
}

/**
 * Expect an async function to throw a specific error type
 */
export async function expectAsyncToThrow<T extends Error>(
  fn: () => Promise<unknown>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ErrorType: new (...args: any[]) => T,
  messagePattern?: string | RegExp
): Promise<void> {
  await expect(fn()).rejects.toThrow(ErrorType);
  if (messagePattern) {
    await expect(fn()).rejects.toThrow(messagePattern);
  }
}

/**
 * Wait for a specific amount of time
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, ms);
  });
}

/**
 * Create a spy on console methods
 */
export function createConsoleSpy(
  method: 'log' | 'warn' | 'error' | 'debug' = 'log'
): jest.SpyInstance {
  return jest.spyOn(console, method).mockImplementation(() => {});
}

/**
 * Restore all console spies
 */
export function restoreConsoleSpy(...spies: jest.SpyInstance[]): void {
  spies.forEach((spy) => spy.mockRestore());
}

/**
 * Create a mock function with typed return value
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createMockFn<T, A extends any[] = any[]>(): jest.Mock<T, A> {
  return jest.fn<T, A>();
}

/**
 * Assert that an object has specific properties
 */
export function assertHasProperties<T extends Record<string, unknown>>(
  obj: unknown,
  properties: (keyof T)[]
): asserts obj is T {
  expect(obj).toBeDefined();
  expect(typeof obj).toBe('object');
  expect(obj).not.toBeNull();

  for (const prop of properties) {
    expect(obj).toHaveProperty(String(prop));
  }
}

/**
 * Deep clone an object for testing
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Generate random test data
 */
export const generateTestData = {
  /**
   * Generate random string
   */
  string: (length = 10): string => {
    return Math.random()
      .toString(36)
      .substring(2, 2 + length);
  },

  /**
   * Generate random number
   */
  number: (min = 0, max = 1000): number => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },

  /**
   * Generate random email
   */
  email: (): string => {
    return `test-${generateTestData.string(8)}@example.com`;
  },

  /**
   * Generate random UUID
   */
  uuid: (): string => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  },

  /**
   * Generate random date
   */
  date: (start = new Date(2020, 0, 1), end = new Date()): Date => {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  },
};

/**
 * Mock timer utilities
 */
export const mockTimers = {
  /**
   * Use fake timers
   */
  use: (): void => {
    jest.useFakeTimers();
  },

  /**
   * Restore real timers
   */
  restore: (): void => {
    jest.useRealTimers();
  },

  /**
   * Advance timers by time
   */
  advance: (ms: number): void => {
    jest.advanceTimersByTime(ms);
  },

  /**
   * Run all timers
   */
  runAll: (): void => {
    jest.runAllTimers();
  },
};

/**
 * Snapshot testing utilities
 */
export const snapshot = {
  /**
   * Match inline snapshot
   */
  matchInline: (value: unknown): void => {
    expect(value).toMatchInlineSnapshot();
  },

  /**
   * Match snapshot
   */
  match: (value: unknown): void => {
    expect(value).toMatchSnapshot();
  },
};
