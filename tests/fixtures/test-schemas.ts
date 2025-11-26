/**
 * Test schemas for ClickORM test suite
 * Provides sample schemas for testing various features
 */

import { DataType, SchemaDefinition } from '../../src/core/types.js';

/**
 * Simple user schema for basic tests
 */
export const usersSchema = {
  id: {
    type: DataType.UInt32,
    primaryKey: true,
    comment: 'User ID',
  },
  name: {
    type: DataType.String,
    comment: 'User name',
  },
  email: {
    type: DataType.String,
    unique: true,
    comment: 'User email',
  },
  age: {
    type: DataType.UInt8,
    nullable: true,
    comment: 'User age',
  },
  active: {
    type: DataType.Boolean,
    default: true,
    comment: 'Is user active',
  },
  createdAt: {
    type: DataType.DateTime,
    default: () => new Date(),
    comment: 'Creation timestamp',
  },
} as const satisfies SchemaDefinition;

/**
 * Posts schema with relationships
 */
export const postsSchema = {
  id: {
    type: DataType.UInt32,
    primaryKey: true,
  },
  userId: {
    type: DataType.UInt32,
  },
  title: {
    type: DataType.String,
  },
  content: {
    type: DataType.String,
  },
  published: {
    type: DataType.Boolean,
    default: false,
  },
  viewCount: {
    type: DataType.UInt32,
    default: 0,
  },
  createdAt: {
    type: DataType.DateTime,
  },
  updatedAt: {
    type: DataType.DateTime,
    nullable: true,
  },
} as const satisfies SchemaDefinition;

/**
 * Complex schema with various data types
 */
export const complexSchema = {
  id: {
    type: DataType.UInt64,
    primaryKey: true,
  },
  uuid: {
    type: DataType.UUID,
  },
  score: {
    type: DataType.Float64,
  },
  status: {
    type: DataType.Enum8,
    enumValues: ['pending', 'active', 'inactive', 'deleted'],
  },
  tags: {
    type: DataType.Array,
    elementType: DataType.String,
  },
  metadata: {
    type: DataType.JSON,
    nullable: true,
  },
  ip: {
    type: DataType.IPv4,
    nullable: true,
  },
  eventDate: {
    type: DataType.Date,
  },
  timestamp: {
    type: DataType.DateTime64,
    precision: 3,
  },
} as const satisfies SchemaDefinition;

/**
 * Schema with all nullable fields (except primary key)
 */
export const nullableSchema = {
  id: {
    type: DataType.UInt32,
    primaryKey: true,
  },
  optionalString: {
    type: DataType.String,
    nullable: true,
  },
  optionalNumber: {
    type: DataType.Int32,
    nullable: true,
  },
  optionalDate: {
    type: DataType.DateTime,
    nullable: true,
  },
} as const satisfies SchemaDefinition;

/**
 * Schema with auto-increment
 */
export const autoIncrementSchema = {
  id: {
    type: DataType.UInt32,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataType.String,
  },
} as const satisfies SchemaDefinition;

/**
 * Schema with decimal and fixed string
 */
export const specialTypesSchema = {
  id: {
    type: DataType.UInt32,
    primaryKey: true,
  },
  price: {
    type: DataType.Decimal,
    precision: 10,
    scale: 2,
  },
  code: {
    type: DataType.FixedString,
    length: 10,
  },
} as const satisfies SchemaDefinition;

/**
 * Test data for users schema
 */
export const usersTestData = [
  {
    id: 1,
    name: 'Alice Johnson',
    email: 'alice@example.com',
    age: 25,
    active: true,
    createdAt: new Date('2024-01-01'),
  },
  {
    id: 2,
    name: 'Bob Smith',
    email: 'bob@example.com',
    age: 30,
    active: true,
    createdAt: new Date('2024-01-02'),
  },
  {
    id: 3,
    name: 'Charlie Brown',
    email: 'charlie@example.com',
    age: null,
    active: false,
    createdAt: new Date('2024-01-03'),
  },
];

/**
 * Test data for posts schema
 */
export const postsTestData = [
  {
    id: 1,
    userId: 1,
    title: 'First Post',
    content: 'This is the first post content',
    published: true,
    viewCount: 100,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-05'),
  },
  {
    id: 2,
    userId: 1,
    title: 'Second Post',
    content: 'This is the second post content',
    published: false,
    viewCount: 0,
    createdAt: new Date('2024-01-02'),
    updatedAt: null,
  },
  {
    id: 3,
    userId: 2,
    title: "Bob's Post",
    content: 'Content from Bob',
    published: true,
    viewCount: 50,
    createdAt: new Date('2024-01-03'),
    updatedAt: null,
  },
];
