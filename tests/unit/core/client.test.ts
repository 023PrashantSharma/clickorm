/**
 * Tests for ClickORM Client
 * Tests client initialization and basic operations with mocked ClickHouse client
 */

import { ClickORMClient, createClickORMClient } from '../../../src/core/client.js';
import { ConnectionError, QueryError } from '../../../src/core/errors.js';
import { LogLevel } from '../../../src/index.js';
import { createMockClickHouseClient } from '../../fixtures/mock-client.js';
import { usersSchema } from '../../fixtures/test-schemas.js';

// Mock the @clickhouse/client module
const mockClickHouseClient = createMockClickHouseClient();
jest.mock('@clickhouse/client', () => ({
  createClient: jest.fn(() => mockClickHouseClient),
}));

describe('ClickORMClient', () => {
  let client: ClickORMClient;

  beforeEach(() => {
    jest.clearAllMocks();
    client = new ClickORMClient({
      host: 'http://localhost:8123',
      database: 'test',
      logging: { enabled: false },
    });
  });

  describe('constructor', () => {
    it('should create client with config', () => {
      expect(client).toBeInstanceOf(ClickORMClient);
    });

    it('should use default config', () => {
      const defaultClient = new ClickORMClient();
      expect(defaultClient).toBeInstanceOf(ClickORMClient);
    });

    it('should initialize with custom logging config', () => {
      const customClient = new ClickORMClient({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        logging: { enabled: true, level: 'debug' as LogLevel, queries: true },
      });
      expect(customClient).toBeInstanceOf(ClickORMClient);
    });
  });

  describe('connect()', () => {
    it('should connect successfully', async () => {
      await expect(client.connect()).resolves.not.toThrow();
      expect(client.isConnected()).toBe(true);
    });

    it('should throw ConnectionError on failure', async () => {
      mockClickHouseClient.ping.mockRejectedValueOnce(new Error('Connection refused'));
      await expect(client.connect()).rejects.toThrow(ConnectionError);
    });
  });

  describe('disconnect()', () => {
    it('should disconnect successfully', async () => {
      await client.connect();
      await expect(client.disconnect()).resolves.not.toThrow();
      expect(client.isConnected()).toBe(false);
    });

    it('should throw ConnectionError on failure', async () => {
      mockClickHouseClient.close.mockRejectedValueOnce(new Error('Close failed'));
      await expect(client.disconnect()).rejects.toThrow(ConnectionError);
    });
  });

  describe('isConnected()', () => {
    it('should return false initially', () => {
      expect(client.isConnected()).toBe(false);
    });

    it('should return true after connect', async () => {
      await client.connect();
      expect(client.isConnected()).toBe(true);
    });
  });

  describe('query()', () => {
    it('should execute query', async () => {
      const mockData = [{ id: 1, name: 'Test' }];
      mockClickHouseClient.query.mockResolvedValueOnce({
        json: jest.fn().mockResolvedValue(mockData),
        text: jest.fn().mockResolvedValue(''),
      });

      const result = await client.query('SELECT * FROM users');
      expect(result).toEqual(mockData);
    });

    it('should auto-connect if not connected', async () => {
      await client.query('SELECT 1');
      expect(client.isConnected()).toBe(true);
    });

    it('should pass parameters', async () => {
      await client.query('SELECT * FROM users WHERE id = {id:UInt32}', { id: 1 });
      expect(mockClickHouseClient.query).toHaveBeenCalledWith(
        expect.objectContaining({
          query_params: { id: 1 },
        })
      );
    });

    it('should throw QueryError on failure', async () => {
      mockClickHouseClient.query.mockRejectedValueOnce(new Error('Query failed'));
      await expect(client.query('INVALID SQL')).rejects.toThrow(QueryError);
    });
  });

  describe('command()', () => {
    it('should execute command', async () => {
      await expect(client.command('CREATE TABLE test (id UInt32)')).resolves.not.toThrow();
    });

    it('should throw QueryError on failure', async () => {
      mockClickHouseClient.command.mockRejectedValueOnce(new Error('Command failed'));
      await expect(client.command('INVALID')).rejects.toThrow(QueryError);
    });
  });

  describe('insert()', () => {
    it('should execute bulk insert', async () => {
      const data = [{ id: 1, name: 'Test' }];
      await client.insert('users', data);
      expect(mockClickHouseClient.insert).toHaveBeenCalledWith({
        table: 'users',
        values: data,
        format: 'JSONEachRow',
      });
    });

    it('should throw QueryError on failure', async () => {
      mockClickHouseClient.insert.mockRejectedValueOnce(new Error('Insert failed'));
      await expect(client.insert('users', [{ id: 1 }])).rejects.toThrow(QueryError);
    });
  });

  describe('ping()', () => {
    it('should return true on successful ping', async () => {
      const result = await client.ping();
      expect(result).toBe(true);
    });

    it('should return false on failed ping', async () => {
      mockClickHouseClient.ping.mockRejectedValueOnce(new Error('Ping failed'));
      const result = await client.ping();
      expect(result).toBe(false);
    });
  });

  describe('getConfig()', () => {
    it('should return readonly config', () => {
      const config = client.getConfig();
      expect(config.host).toBe('http://localhost:8123');
      expect(config.database).toBe('test');
    });
  });

  describe('getLogger()', () => {
    it('should return logger instance', () => {
      const logger = client.getLogger();
      expect(logger).toBeDefined();
    });
  });

  describe('getClickHouseClient()', () => {
    it('should return underlying client', () => {
      const underlyingClient = client.getClickHouseClient();
      expect(underlyingClient).toBeDefined();
    });
  });

  describe('define()', () => {
    it('should define a model', () => {
      const model = client.define('users', usersSchema);
      expect(model).toBeDefined();
      expect(model.schema).toBeDefined();
      expect(model.client).toBe(client);
    });

    it('should store model', () => {
      client.define('users', usersSchema);
      const model = client.getModel('users');
      expect(model).toBeDefined();
    });

    it('should allow redefining models', () => {
      client.define('users', usersSchema);
      expect(() => client.define('users', usersSchema)).not.toThrow();
    });
  });

  describe('getModel()', () => {
    it('should return defined model', () => {
      client.define('users', usersSchema);
      const model = client.getModel('users');
      expect(model).toBeDefined();
    });

    it('should return undefined for non-existent model', () => {
      const model = client.getModel('nonexistent');
      expect(model).toBeUndefined();
    });
  });

  describe('sync()', () => {
    beforeEach(() => {
      client.define('users', usersSchema);
    });

    it('should create tables with ifNotExists by default', async () => {
      await client.sync();
      expect(mockClickHouseClient.command).toHaveBeenCalled();
    });

    it('should force recreate tables', async () => {
      await client.sync({ force: true });
      expect(mockClickHouseClient.command).toHaveBeenCalled();
    });
  });

  describe('drop()', () => {
    it('should drop all tables', async () => {
      client.define('users', usersSchema);
      await client.drop();
      expect(mockClickHouseClient.command).toHaveBeenCalled();
    });
  });
});

describe('createClickORMClient()', () => {
  it('should create new client instance', () => {
    const client = createClickORMClient();
    expect(client).toBeInstanceOf(ClickORMClient);
  });

  it('should pass config to client', () => {
    const client = createClickORMClient({ database: 'mydb' });
    expect(client.getConfig().database).toBe('mydb');
  });
});
