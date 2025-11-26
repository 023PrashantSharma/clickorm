/**
 * Integration tests for CRUD operations
 * Tests create, read, update, delete operations with real database
 *
 * Note: These tests require a running ClickHouse instance
 * Set SKIP_INTEGRATION=true to skip these tests
 */

import { ClickORMClient } from '../../src/core/client.js';
import { usersTestData } from '../fixtures/test-schemas.js';

const SKIP_INTEGRATION = process.env.SKIP_INTEGRATION === 'true';
const TEST_CONFIG = {
  host: process.env.CLICKHOUSE_HOST || 'http://localhost:8123',
  database: process.env.CLICKHOUSE_DB || 'clickorm_test',
  username: process.env.CLICKHOUSE_USER,
  password: process.env.CLICKHOUSE_PASSWORD,
};

describe.skip('CRUD Integration Tests', () => {
  let client: ClickORMClient;
  const TABLE_NAME = 'test_users_crud';

  beforeAll(async () => {
    if (SKIP_INTEGRATION) {
      console.log('Skipping integration tests (SKIP_INTEGRATION=true)');
      return;
    }

    client = new ClickORMClient(TEST_CONFIG);
    await client.connect();
  });

  afterAll(async () => {
    if (client && client.isConnected()) {
      await client.disconnect();
    }
  });

  beforeEach(async () => {
    // Create test table
    await client.command(`
      CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
        id UInt32,
        name String,
        email String,
        age Nullable(UInt8),
        active Boolean,
        createdAt DateTime
      ) ENGINE = Memory
    `);
  });

  afterEach(async () => {
    // Drop test table
    await client.command(`DROP TABLE IF EXISTS ${TABLE_NAME}`);
  });

  describe('INSERT operations', () => {
    it('should insert single record', async () => {
      await client.insert(TABLE_NAME, [usersTestData[0]]);

      const result = await client.query(`SELECT * FROM ${TABLE_NAME}`);
      expect(result).toHaveLength(1);
      expect((result[0] as Record<string, unknown>).name).toBe(usersTestData[0].name);
    });

    it('should insert multiple records', async () => {
      await client.insert(TABLE_NAME, usersTestData);

      const result = await client.query(`SELECT * FROM ${TABLE_NAME}`);
      expect(result).toHaveLength(usersTestData.length);
    });

    it('should handle nullable fields', async () => {
      const dataWithNull = {
        ...usersTestData[0],
        age: null,
      };
      await client.insert(TABLE_NAME, [dataWithNull]);

      const result = await client.query(`SELECT * FROM ${TABLE_NAME}`);
      expect((result[0] as Record<string, unknown>).age).toBeNull();
    });

    it('should handle large batch inserts', async () => {
      const largeBatch = Array.from({ length: 1000 }, (_, i) => ({
        id: i + 1,
        name: `User ${i}`,
        email: `user${i}@example.com`,
        age: 25,
        active: true,
        createdAt: new Date(),
      }));

      await client.insert(TABLE_NAME, largeBatch);

      const count = await client.query(`SELECT count() as total FROM ${TABLE_NAME}`);
      expect((count[0] as Record<string, unknown>).total).toBe(1000);
    }, 10000);
  });

  describe('SELECT operations', () => {
    beforeEach(async () => {
      await client.insert(TABLE_NAME, usersTestData);
    });

    it('should select all records', async () => {
      const result = await client.query(`SELECT * FROM ${TABLE_NAME}`);
      expect(result).toHaveLength(usersTestData.length);
    });

    it('should select with WHERE clause', async () => {
      const result = await client.query(`
        SELECT * FROM ${TABLE_NAME} 
        WHERE id = 1
      `);
      expect(result).toHaveLength(1);
      expect((result[0] as Record<string, unknown>).id).toBe(1);
    });

    it('should select with parameters', async () => {
      const result = await client.query(`SELECT * FROM ${TABLE_NAME} WHERE id = {id:UInt32}`, {
        id: 1,
      });
      expect(result).toHaveLength(1);
    });

    it('should select specific columns', async () => {
      const result = await client.query(`SELECT id, name FROM ${TABLE_NAME}`);
      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('name');
      expect(result[0]).not.toHaveProperty('email');
    });

    it('should support ORDER BY', async () => {
      const result = await client.query(`
        SELECT * FROM ${TABLE_NAME} 
        ORDER BY name ASC
      `);
      const names = result.map((r) => (r as Record<string, unknown>).name);
      const sortedNames = [...names].sort();
      expect(names).toEqual(sortedNames);
    });

    it('should support LIMIT', async () => {
      const result = await client.query(`
        SELECT * FROM ${TABLE_NAME} 
        LIMIT 2
      `);
      expect(result).toHaveLength(2);
    });

    it('should support aggregation', async () => {
      const result = await client.query(`
        SELECT COUNT(*) as total, AVG(age) as avgAge 
        FROM ${TABLE_NAME}
      `);
      expect((result[0] as Record<string, unknown>).total).toBe(usersTestData.length);
    });
  });

  describe('UPDATE operations', () => {
    beforeEach(async () => {
      await client.insert(TABLE_NAME, usersTestData);
    });

    it('should update records with ALTER TABLE', async () => {
      // ClickHouse uses ALTER TABLE for updates with mutations
      await client.command(`
        ALTER TABLE ${TABLE_NAME} 
        UPDATE name = 'Updated Name' 
        WHERE id = 1
      `);

      // Wait for mutation to complete
      await new Promise((resolve) => globalThis.setTimeout(resolve, 1000));

      const result = await client.query(`
        SELECT * FROM ${TABLE_NAME} 
        WHERE id = 1
      `);
      expect((result[0] as Record<string, unknown>).name).toBe('Updated Name');
    }, 5000);

    it('should update multiple fields', async () => {
      await client.command(`
        ALTER TABLE ${TABLE_NAME} 
        UPDATE name = 'New Name', active = false 
        WHERE id = 1
      `);

      await new Promise((resolve) => globalThis.setTimeout(resolve, 1000));

      const result = await client.query(`
        SELECT * FROM ${TABLE_NAME} 
        WHERE id = 1
      `);
      expect((result[0] as Record<string, unknown>).name).toBe('New Name');
      expect((result[0] as Record<string, unknown>).active).toBe(false);
    }, 5000);
  });

  describe('DELETE operations', () => {
    beforeEach(async () => {
      await client.insert(TABLE_NAME, usersTestData);
    });

    it('should delete records with ALTER TABLE DELETE', async () => {
      await client.command(`
        ALTER TABLE ${TABLE_NAME} 
        DELETE WHERE id = 1
      `);

      await new Promise((resolve) => globalThis.setTimeout(resolve, 1000));

      const result = await client.query(`SELECT * FROM ${TABLE_NAME}`);
      expect(result.length).toBeLessThan(usersTestData.length);
    }, 5000);

    it('should delete with condition', async () => {
      await client.command(`
        ALTER TABLE ${TABLE_NAME} 
        DELETE WHERE active = false
      `);

      await new Promise((resolve) => globalThis.setTimeout(resolve, 1000));

      const result = await client.query(`
        SELECT * FROM ${TABLE_NAME} 
        WHERE active = false
      `);
      expect(result).toHaveLength(0);
    }, 5000);
  });

  describe('Transaction-like operations', () => {
    it('should handle bulk operations atomically', async () => {
      const insertData = Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        name: `User ${i}`,
        email: `user${i}@example.com`,
        age: 25,
        active: true,
        createdAt: new Date(),
      }));

      try {
        await client.insert(TABLE_NAME, insertData);
        const count = await client.query(`SELECT count() as total FROM ${TABLE_NAME}`);
        expect((count[0] as Record<string, unknown>).total).toBe(100);
      } catch (error) {
        // If insert fails, no partial data should exist
        const count = await client.query(`SELECT count() as total FROM ${TABLE_NAME}`);
        expect((count[0] as Record<string, unknown>).total).toBe(0);
      }
    });
  });

  describe('Data type handling', () => {
    it('should handle different data types correctly', async () => {
      const testData = {
        id: 999,
        name: 'Type Test',
        email: 'type@test.com',
        age: 30,
        active: true,
        createdAt: new Date('2024-01-01T00:00:00Z'),
      };

      await client.insert(TABLE_NAME, [testData]);

      const result = await client.query(`
        SELECT * FROM ${TABLE_NAME} 
        WHERE id = 999
      `);

      const row = result[0] as Record<string, unknown>;
      expect(typeof row.id).toBe('number');
      expect(typeof row.name).toBe('string');
      expect(typeof row.active).toBe('boolean');
      expect(row.createdAt).toBeInstanceOf(Date);
    });
  });
});
