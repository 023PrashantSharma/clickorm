/**
 * Additional test data for ClickORM test suite
 * Provides sample data for various testing scenarios
 */

import { DataType, SchemaDefinition } from '../../src/core/types.js';

/**
 * Product schema for e-commerce tests
 */
export const productsSchema = {
  id: {
    type: DataType.UInt32,
    primaryKey: true,
  },
  sku: {
    type: DataType.String,
    unique: true,
  },
  name: {
    type: DataType.String,
  },
  description: {
    type: DataType.String,
    nullable: true,
  },
  price: {
    type: DataType.Decimal,
    precision: 10,
    scale: 2,
  },
  stock: {
    type: DataType.Int32,
    default: 0,
  },
  category: {
    type: DataType.Enum8,
    enumValues: ['electronics', 'clothing', 'food', 'books'],
  },
  tags: {
    type: DataType.Array,
    elementType: DataType.String,
  },
  createdAt: {
    type: DataType.DateTime,
  },
} as const satisfies SchemaDefinition;

/**
 * Product test data
 */
export const productsTestData = [
  {
    id: 1,
    sku: 'ELECTRONICS-001',
    name: 'Laptop',
    description: 'High-performance laptop',
    price: 999.99,
    stock: 50,
    category: 'electronics',
    tags: ['computer', 'portable'],
    createdAt: new Date('2024-01-01'),
  },
  {
    id: 2,
    sku: 'CLOTH-001',
    name: 'T-Shirt',
    description: null,
    price: 19.99,
    stock: 200,
    category: 'clothing',
    tags: ['apparel', 'casual'],
    createdAt: new Date('2024-01-02'),
  },
  {
    id: 3,
    sku: 'BOOK-001',
    name: 'TypeScript Handbook',
    description: 'Learn TypeScript',
    price: 39.99,
    stock: 0,
    category: 'books',
    tags: ['programming', 'education'],
    createdAt: new Date('2024-01-03'),
  },
];

/**
 * Events schema for analytics tests
 */
export const eventsSchema = {
  id: {
    type: DataType.UInt64,
    primaryKey: true,
  },
  eventType: {
    type: DataType.String,
  },
  userId: {
    type: DataType.UInt32,
  },
  metadata: {
    type: DataType.JSON,
    nullable: true,
  },
  timestamp: {
    type: DataType.DateTime64,
    precision: 3,
  },
  ipAddress: {
    type: DataType.IPv4,
    nullable: true,
  },
} as const satisfies SchemaDefinition;

/**
 * Events test data
 */
export const eventsTestData = [
  {
    id: 1,
    eventType: 'page_view',
    userId: 1,
    metadata: { page: '/home', referrer: 'google' },
    timestamp: new Date('2024-01-01T10:00:00.000Z'),
    ipAddress: '192.168.1.1',
  },
  {
    id: 2,
    eventType: 'click',
    userId: 1,
    metadata: { button: 'signup', position: 'header' },
    timestamp: new Date('2024-01-01T10:05:00.000Z'),
    ipAddress: '192.168.1.1',
  },
  {
    id: 3,
    eventType: 'purchase',
    userId: 2,
    metadata: { productId: 1, amount: 999.99 },
    timestamp: new Date('2024-01-01T11:00:00.000Z'),
    ipAddress: '192.168.1.2',
  },
];

/**
 * Locations schema for geographic tests
 */
export const locationsSchema = {
  id: {
    type: DataType.UInt32,
    primaryKey: true,
  },
  name: {
    type: DataType.String,
  },
  country: {
    type: DataType.String,
  },
  city: {
    type: DataType.String,
  },
  coordinates: {
    type: DataType.Tuple,
  },
  population: {
    type: DataType.UInt32,
    nullable: true,
  },
} as const satisfies SchemaDefinition;

/**
 * Locations test data
 */
export const locationsTestData = [
  {
    id: 1,
    name: 'New York Office',
    country: 'USA',
    city: 'New York',
    coordinates: [40.7128, -74.006],
    population: 8336817,
  },
  {
    id: 2,
    name: 'London Office',
    country: 'UK',
    city: 'London',
    coordinates: [51.5074, -0.1278],
    population: 9002488,
  },
  {
    id: 3,
    name: 'Tokyo Office',
    country: 'Japan',
    city: 'Tokyo',
    coordinates: [35.6762, 139.6503],
    population: 13960000,
  },
];

/**
 * Large dataset for performance testing
 */
export function generateLargeDataset(count: number): Array<{
  id: number;
  name: string;
  value: number;
  timestamp: Date;
}> {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: `Item ${i + 1}`,
    value: Math.random() * 1000,
    timestamp: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
  }));
}

/**
 * Test data with edge cases
 */
export const edgeCaseData = {
  emptyString: '',
  whitespace: '   ',
  specialChars: '!@#$%^&*()',
  unicode: '你好世界',
  emoji: '😀🎉🚀',
  longString: 'a'.repeat(10000),
  zero: 0,
  negative: -999,
  maxInt32: 2147483647,
  minInt32: -2147483648,
  maxFloat: Number.MAX_VALUE,
  minFloat: Number.MIN_VALUE,
  infinity: Infinity,
  negativeInfinity: -Infinity,
  nan: NaN,
  null: null,
  undefined: undefined,
  emptyArray: [],
  emptyObject: {},
  nestedObject: {
    level1: {
      level2: {
        level3: {
          value: 'deep',
        },
      },
    },
  },
};

/**
 * Test queries for complex scenarios
 */
export const testQueries = {
  simpleSelect: 'SELECT * FROM users',
  selectWithWhere: 'SELECT * FROM users WHERE id = 1',
  selectWithJoin: 'SELECT u.*, p.title FROM users u LEFT JOIN posts p ON p.userId = u.id',
  selectWithGroupBy: 'SELECT country, COUNT(*) as count FROM locations GROUP BY country',
  selectWithOrderBy: 'SELECT * FROM products ORDER BY price DESC, name ASC',
  selectWithLimit: 'SELECT * FROM events LIMIT 100 OFFSET 50',
  complexQuery: `
    SELECT 
      u.id,
      u.name,
      COUNT(p.id) as post_count,
      AVG(p.viewCount) as avg_views
    FROM users u
    LEFT JOIN posts p ON p.userId = u.id
    WHERE u.active = true
    GROUP BY u.id, u.name
    HAVING COUNT(p.id) > 5
    ORDER BY avg_views DESC
    LIMIT 10
  `,
};

/**
 * Test error scenarios
 */
export const errorScenarios = {
  invalidTableName: '123invalid',
  sqlInjection: "'; DROP TABLE users--",
  invalidFieldName: 'field-with-dashes',
  invalidEmail: 'not-an-email',
  invalidUUID: 'not-a-uuid',
  invalidIPv4: '999.999.999.999',
  invalidIPv6: 'not-ipv6',
  invalidURL: 'not a url',
  tooLongString: 'x'.repeat(100000),
  invalidDate: 'invalid-date',
  invalidJSON: '{invalid json}',
  negativeLimit: -1,
  negativeOffset: -10,
  zeroTimeout: 0,
};

/**
 * Mock API responses
 */
export const mockAPIResponses = {
  success: {
    rows: 10,
    duration: 25,
    bytesRead: 1024,
  },
  empty: {
    rows: 0,
    duration: 5,
    bytesRead: 0,
  },
  error: {
    code: 500,
    message: 'Internal server error',
  },
  timeout: {
    code: 408,
    message: 'Request timeout',
  },
};

/**
 * Configuration test data
 */
export const testConfigs = {
  minimal: {
    host: 'http://localhost:8123',
  },
  complete: {
    host: 'http://localhost:8123',
    database: 'test_db',
    username: 'test_user',
    password: 'test_password',
    schema: 'public',
    logging: {
      enabled: true,
      level: 'debug' as const,
      queries: true,
    },
  },
  production: {
    host: 'https://prod.example.com:8443',
    database: 'production',
    username: 'prod_user',
    password: 'strong_password',
    schema: 'main',
    logging: {
      enabled: false,
      level: 'error' as const,
      queries: false,
    },
  },
};
