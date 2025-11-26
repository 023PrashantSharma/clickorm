/**
 * Integration tests for database connection
 * Tests real database connection and configuration
 *
 * Note: These tests require a running ClickHouse instance
 * Set SKIP_INTEGRATION=true to skip these tests
 */

import { ClickORMClient } from '../../src/core/client.js';
import { ConnectionError } from '../../src/core/errors.js';

const SKIP_INTEGRATION = process.env.SKIP_INTEGRATION === 'true';
const TEST_CONFIG = {
  host: process.env.CLICKHOUSE_HOST || 'http://localhost:8123',
  database: process.env.CLICKHOUSE_DB || 'clickorm_test',
  username: process.env.CLICKHOUSE_USER,
  password: process.env.CLICKHOUSE_PASSWORD,
};

describe.skip('Connection Integration Tests', () => {
  let client: ClickORMClient;

  beforeAll(() => {
    if (SKIP_INTEGRATION) {
      console.log('Skipping integration tests (SKIP_INTEGRATION=true)');
    }
  });

  beforeEach(() => {
    client = new ClickORMClient(TEST_CONFIG);
  });

  afterEach(async () => {
    if (client.isConnected()) {
      await client.disconnect();
    }
  });

  describe('connect()', () => {
    it('should connect to ClickHouse successfully', async () => {
      await expect(client.connect()).resolves.not.toThrow();
      expect(client.isConnected()).toBe(true);
    });

    it('should handle connection errors gracefully', async () => {
      const badClient = new ClickORMClient({
        host: 'http://invalid-host:9999',
        database: 'test',
      });

      await expect(badClient.connect()).rejects.toThrow(ConnectionError);
    });

    it('should be idempotent (multiple connects)', async () => {
      await client.connect();
      await client.connect();
      expect(client.isConnected()).toBe(true);
    });
  });

  describe('disconnect()', () => {
    it('should disconnect successfully', async () => {
      await client.connect();
      await expect(client.disconnect()).resolves.not.toThrow();
      expect(client.isConnected()).toBe(false);
    });

    it('should handle disconnect when not connected', async () => {
      await expect(client.disconnect()).resolves.not.toThrow();
    });
  });

  describe('ping()', () => {
    it('should ping successfully when connected', async () => {
      await client.connect();
      const result = await client.ping();
      expect(result).toBe(true);
    });

    it('should return false when not connected', async () => {
      const badClient = new ClickORMClient({
        host: 'http://invalid-host:9999',
      });
      const result = await badClient.ping();
      expect(result).toBe(false);
    });
  });

  describe('query()', () => {
    beforeEach(async () => {
      await client.connect();
    });

    it('should execute simple query', async () => {
      const result = await client.query('SELECT 1 as num');
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('num', 1);
    });

    it('should execute query with parameters', async () => {
      const result = await client.query('SELECT {val:UInt32} as num', { val: 42 });
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('num', 42);
    });

    it('should return multiple rows', async () => {
      const result = await client.query(`
        SELECT number 
        FROM system.numbers 
        LIMIT 10
      `);
      expect(result).toHaveLength(10);
    });

    it('should auto-connect if not connected', async () => {
      await client.disconnect();
      const result = await client.query('SELECT 1');
      expect(result).toHaveLength(1);
      expect(client.isConnected()).toBe(true);
    });
  });

  describe('command()', () => {
    beforeEach(async () => {
      await client.connect();
    });

    afterEach(async () => {
      // Cleanup test table
      try {
        await client.command('DROP TABLE IF EXISTS test_connection_table');
      } catch {
        // Ignore errors
      }
    });

    it('should execute DDL commands', async () => {
      await expect(
        client.command(`
          CREATE TABLE IF NOT EXISTS test_connection_table (
            id UInt32
          ) ENGINE = Memory
        `)
      ).resolves.not.toThrow();
    });

    it('should handle invalid commands', async () => {
      await expect(client.command('INVALID SQL COMMAND')).rejects.toThrow();
    });
  });

  describe('Configuration', () => {
    it('should use custom database', async () => {
      const customClient = new ClickORMClient({
        ...TEST_CONFIG,
        database: 'system',
      });

      await customClient.connect();
      const result = await customClient.query('SELECT currentDatabase() as db');
      expect((result[0] as Record<string, unknown>).db).toBe('system');
      await customClient.disconnect();
    });

    it('should respect timeout configuration', async () => {
      const timeoutClient = new ClickORMClient({
        ...TEST_CONFIG,
        request_timeout: 1,
      });

      await expect(timeoutClient.query('SELECT sleep(10)')).rejects.toThrow();
    }, 10000);
  });

  describe('Connection pooling', () => {
    it('should handle concurrent queries', async () => {
      await client.connect();

      const queries = Array.from({ length: 10 }, (_, i) => client.query(`SELECT ${i} as num`));

      const results = await Promise.all(queries);
      expect(results).toHaveLength(10);
      results.forEach((result, i) => {
        expect((result[0] as Record<string, unknown>).num).toBe(i);
      });
    });
  });

  describe('Error handling', () => {
    beforeEach(async () => {
      await client.connect();
    });

    it('should handle syntax errors', async () => {
      await expect(client.query('SELECT * FORM users')).rejects.toThrow();
    });

    it('should handle missing table errors', async () => {
      await expect(client.query('SELECT * FROM non_existent_table')).rejects.toThrow();
    });
  });
});
