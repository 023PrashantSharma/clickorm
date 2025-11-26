/**
 * Jest test setup configuration
 * Runs before all tests
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Quiet logs during tests

// Global test timeout
jest.setTimeout(10000);

// Mock console methods to reduce noise during tests
globalThis.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Setup and teardown hooks
beforeAll(async () => {
  // Global setup
});

afterAll(async () => {
  // Global cleanup
});

beforeEach(() => {
  // Clear mocks before each test
  jest.clearAllMocks();
});

afterEach(() => {
  // Cleanup after each test
});

export {};
