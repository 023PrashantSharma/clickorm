/**
 * Integration tests for complex queries
 * Tests advanced query features with real database
 *
 * Note: These tests require a running ClickHouse instance
 * Set SKIP_INTEGRATION=true to skip these tests
 */

import { ClickORMClient } from '../../src/core/client.js';
import { usersTestData, postsTestData } from '../fixtures/test-schemas.js';

const SKIP_INTEGRATION = process.env.SKIP_INTEGRATION === 'true';
const TEST_CONFIG = {
  host: process.env.CLICKHOUSE_HOST || 'http://localhost:8123',
  database: process.env.CLICKHOUSE_DB || 'clickorm_test',
  username: process.env.CLICKHOUSE_USER,
  password: process.env.CLICKHOUSE_PASSWORD,
};

describe.skip('Query Integration Tests', () => {
  let client: ClickORMClient;
  const USERS_TABLE = 'test_users_query';
  const POSTS_TABLE = 'test_posts_query';

  beforeAll(async () => {
    if (SKIP_INTEGRATION) {
      console.log('Skipping integration tests (SKIP_INTEGRATION=true)');
      return;
    }

    client = new ClickORMClient(TEST_CONFIG);
    await client.connect();

    // Create tables
    await client.command(`
      CREATE TABLE IF NOT EXISTS ${USERS_TABLE} (
        id UInt32,
        name String,
        email String,
        age Nullable(UInt8),
        active Boolean,
        createdAt DateTime
      ) ENGINE = Memory
    `);

    await client.command(`
      CREATE TABLE IF NOT EXISTS ${POSTS_TABLE} (
        id UInt32,
        userId UInt32,
        title String,
        content String,
        published Boolean,
        viewCount UInt32,
        createdAt DateTime,
        updatedAt Nullable(DateTime)
      ) ENGINE = Memory
    `);

    // Insert test data
    await client.insert(USERS_TABLE, usersTestData);
    await client.insert(POSTS_TABLE, postsTestData);
  });

  afterAll(async () => {
    if (client && client.isConnected()) {
      await client.command(`DROP TABLE IF EXISTS ${USERS_TABLE}`);
      await client.command(`DROP TABLE IF EXISTS ${POSTS_TABLE}`);
      await client.disconnect();
    }
  });

  describe('Aggregation queries', () => {
    it('should perform COUNT aggregation', async () => {
      const result = await client.query(`
        SELECT COUNT(*) as total
        FROM ${USERS_TABLE}
      `);
      expect((result[0] as Record<string, unknown>).total).toBeGreaterThan(0);
    });

    it('should perform AVG aggregation', async () => {
      const result = await client.query(`
        SELECT AVG(age) as avgAge 
        FROM ${USERS_TABLE} 
        WHERE age IS NOT NULL
      `);
      expect((result[0] as Record<string, unknown>).avgAge).toBeGreaterThan(0);
    });

    it('should perform multiple aggregations', async () => {
      const result = await client.query(`
        SELECT 
          COUNT(*) as total,
          MIN(age) as minAge,
          MAX(age) as maxAge,
          AVG(age) as avgAge
        FROM ${USERS_TABLE}
        WHERE age IS NOT NULL
      `);
      expect(result[0]).toHaveProperty('total');
      expect(result[0]).toHaveProperty('minAge');
      expect(result[0]).toHaveProperty('maxAge');
      expect(result[0]).toHaveProperty('avgAge');
    });

    it('should perform GROUP BY aggregation', async () => {
      const result = await client.query(`
        SELECT 
          active,
          COUNT(*) as count
        FROM ${USERS_TABLE}
        GROUP BY active
        ORDER BY active
      `);
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('JOIN queries', () => {
    it('should perform INNER JOIN', async () => {
      const result = await client.query(`
        SELECT 
          u.name as userName,
          p.title as postTitle
        FROM ${USERS_TABLE} u
        INNER JOIN ${POSTS_TABLE} p ON p.userId = u.id
      `);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('userName');
      expect(result[0]).toHaveProperty('postTitle');
    });

    it('should perform LEFT JOIN', async () => {
      const result = await client.query(`
        SELECT 
          u.id,
          u.name,
          p.title
        FROM ${USERS_TABLE} u
        LEFT JOIN ${POSTS_TABLE} p ON p.userId = u.id
      `);
      expect(result.length).toBeGreaterThanOrEqual(usersTestData.length);
    });

    it('should perform JOIN with aggregation', async () => {
      const result = await client.query(`
        SELECT 
          u.name,
          COUNT(p.id) as postCount
        FROM ${USERS_TABLE} u
        LEFT JOIN ${POSTS_TABLE} p ON p.userId = u.id
        GROUP BY u.name
        ORDER BY postCount DESC
      `);
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('Complex WHERE clauses', () => {
    it('should handle IN operator', async () => {
      const result = await client.query(`
        SELECT * FROM ${USERS_TABLE}
        WHERE id IN (1, 2)
      `);
      expect(result.length).toBeLessThanOrEqual(2);
    });

    it('should handle BETWEEN operator', async () => {
      const result = await client.query(`
        SELECT * FROM ${USERS_TABLE}
        WHERE age BETWEEN 20 AND 30
      `);
      result.forEach((row) => {
        const r = row as Record<string, unknown>;
        if (r.age !== null) {
          expect(r.age).toBeGreaterThanOrEqual(20);
          expect(r.age).toBeLessThanOrEqual(30);
        }
      });
    });

    it('should handle LIKE operator', async () => {
      const result = await client.query(`
        SELECT * FROM ${USERS_TABLE}
        WHERE name LIKE '%li%'
      `);
      result.forEach((row) => {
        expect(((row as Record<string, unknown>).name as string).toLowerCase()).toContain('li');
      });
    });

    it('should handle complex AND/OR conditions', async () => {
      const result = await client.query(`
        SELECT * FROM ${USERS_TABLE}
        WHERE (active = true AND age > 20) 
           OR (active = false AND age IS NULL)
      `);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle IS NULL conditions', async () => {
      const result = await client.query(`
        SELECT * FROM ${USERS_TABLE}
        WHERE age IS NULL
      `);
      result.forEach((row) => {
        expect((row as Record<string, unknown>).age).toBeNull();
      });
    });
  });

  describe('Subqueries', () => {
    it('should execute subquery in WHERE clause', async () => {
      const result = await client.query(`
        SELECT * FROM ${POSTS_TABLE}
        WHERE userId IN (
          SELECT id FROM ${USERS_TABLE} WHERE active = true
        )
      `);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should execute subquery in SELECT clause', async () => {
      const result = await client.query(`
        SELECT 
          u.*,
          (SELECT COUNT(*) FROM ${POSTS_TABLE} p WHERE p.userId = u.id) as postCount
        FROM ${USERS_TABLE} u
      `);
      expect(result[0]).toHaveProperty('postCount');
    });
  });

  describe('ORDER BY and LIMIT', () => {
    it('should order results ascending', async () => {
      const result = await client.query(`
        SELECT * FROM ${USERS_TABLE}
        ORDER BY name ASC
      `);
      const names = result.map((r) => (r as Record<string, unknown>).name);
      const sortedNames = [...names].sort();
      expect(names).toEqual(sortedNames);
    });

    it('should order results descending', async () => {
      const result = await client.query(`
        SELECT * FROM ${USERS_TABLE}
        ORDER BY name DESC
      `);
      const names = result.map((r) => (r as Record<string, unknown>).name);
      const sortedNames = [...names].sort().reverse();
      expect(names).toEqual(sortedNames);
    });

    it('should limit results', async () => {
      const limit = 2;
      const result = await client.query(`
        SELECT * FROM ${USERS_TABLE}
        LIMIT ${limit}
      `);
      expect(result.length).toBeLessThanOrEqual(limit);
    });

    it('should use OFFSET', async () => {
      const allResults = await client.query(`
        SELECT * FROM ${USERS_TABLE}
        ORDER BY id
      `);

      const offsetResults = await client.query(`
        SELECT * FROM ${USERS_TABLE}
        ORDER BY id
        LIMIT 10 OFFSET 1
      `);

      expect((offsetResults[0] as Record<string, unknown>).id).toBe(
        (allResults[1] as Record<string, unknown>).id
      );
    });
  });

  describe('Date and time functions', () => {
    it('should use NOW() function', async () => {
      const result = await client.query('SELECT NOW() as currentTime');
      expect((result[0] as Record<string, unknown>).currentTime).toBeInstanceOf(Date);
    });

    it('should use toDate() function', async () => {
      const result = await client.query(`
        SELECT toDate(createdAt) as date
        FROM ${USERS_TABLE}
        LIMIT 1
      `);
      expect((result[0] as Record<string, unknown>).date).toBeDefined();
    });

    it('should filter by date', async () => {
      const result = await client.query(`
        SELECT * FROM ${USERS_TABLE}
        WHERE createdAt >= '2024-01-01'
      `);
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('String functions', () => {
    it('should use UPPER() function', async () => {
      const result = await client.query(`
        SELECT UPPER(name) as upperName
        FROM ${USERS_TABLE}
        LIMIT 1
      `);
      const row = result[0] as Record<string, unknown>;
      expect(row.upperName).toBe((row.upperName as string).toUpperCase());
    });

    it('should use CONCAT() function', async () => {
      const result = await client.query(`
        SELECT concat(name, ' - ', email) as combined
        FROM ${USERS_TABLE}
        LIMIT 1
      `);
      expect((result[0] as Record<string, unknown>).combined).toContain(' - ');
    });

    it('should use LENGTH() function', async () => {
      const result = await client.query(`
        SELECT name, length(name) as nameLength
        FROM ${USERS_TABLE}
        LIMIT 1
      `);
      const row = result[0] as Record<string, unknown>;
      expect(row.nameLength).toBe((row.name as string).length);
    });
  });

  describe('DISTINCT queries', () => {
    it('should return distinct values', async () => {
      const result = await client.query(`
        SELECT DISTINCT active
        FROM ${USERS_TABLE}
      `);
      expect(result.length).toBeLessThanOrEqual(2); // true and false
    });
  });

  describe('UNION queries', () => {
    it('should combine results with UNION', async () => {
      const result = await client.query(`
        SELECT name FROM ${USERS_TABLE} WHERE id = 1
        UNION ALL
        SELECT name FROM ${USERS_TABLE} WHERE id = 2
      `);
      expect(result.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Performance queries', () => {
    it('should handle complex analytical query', async () => {
      const startTime = Date.now();

      const result = await client.query(`
        SELECT 
          u.name,
          COUNT(p.id) as totalPosts,
          SUM(p.viewCount) as totalViews,
          AVG(p.viewCount) as avgViews,
          MAX(p.viewCount) as maxViews
        FROM ${USERS_TABLE} u
        LEFT JOIN ${POSTS_TABLE} p ON p.userId = u.id
        WHERE u.active = true
        GROUP BY u.name
        HAVING COUNT(p.id) > 0
        ORDER BY totalViews DESC
      `);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(5000); // Should complete in 5 seconds
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
