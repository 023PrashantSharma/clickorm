/**
 * Mock ClickHouse client for testing
 * Provides a mock implementation for testing without a real database
 */

/**
 * Mock query result
 */
export interface MockQueryResult<T = unknown> {
  json: () => Promise<T[]>;
  text: () => Promise<string>;
}

/**
 * Mock ClickHouse client interface
 */
export interface MockClickHouseClient {
  query: jest.Mock<Promise<MockQueryResult>>;
  insert: jest.Mock<Promise<void>>;
  command: jest.Mock<Promise<void>>;
  ping: jest.Mock<Promise<void>>;
  close: jest.Mock<Promise<void>>;
}

/**
 * Create a mock ClickHouse client
 */
export function createMockClickHouseClient(): MockClickHouseClient {
  return {
    query: jest.fn().mockResolvedValue({
      json: jest.fn().mockResolvedValue([]),
      text: jest.fn().mockResolvedValue(''),
    }),
    insert: jest.fn().mockResolvedValue(undefined),
    command: jest.fn().mockResolvedValue(undefined),
    ping: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
  };
}

/**
 * Create a mock client that returns specific data
 */
export function createMockClientWithData<T>(data: T[]): MockClickHouseClient {
  const mockClient = createMockClickHouseClient();
  mockClient.query.mockResolvedValue({
    json: jest.fn().mockResolvedValue(data),
    text: jest.fn().mockResolvedValue(JSON.stringify(data)),
  });
  return mockClient;
}

/**
 * Create a mock client that throws errors
 */
export function createMockClientWithError(error: Error): MockClickHouseClient {
  const mockClient = createMockClickHouseClient();
  mockClient.query.mockRejectedValue(error);
  mockClient.insert.mockRejectedValue(error);
  mockClient.command.mockRejectedValue(error);
  mockClient.ping.mockRejectedValue(error);
  return mockClient;
}

/**
 * Create a mock client with custom behavior
 */
export function createMockClientWithBehavior(
  behavior: Partial<MockClickHouseClient>
): MockClickHouseClient {
  const mockClient = createMockClickHouseClient();
  return { ...mockClient, ...behavior };
}
