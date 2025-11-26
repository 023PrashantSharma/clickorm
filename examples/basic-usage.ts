// @ts-nocheck - This file demonstrates the planned API that is not yet fully implemented
/**
 * Basic usage example for ClickORM
 * Demonstrates INTENDED API (work in progress)
 *
 * NOTE: This example shows the planned API design.
 * Many methods are not yet implemented and will cause TypeScript errors.
 * This serves as documentation for the future API.
 */

/* eslint-disable no-console */

import { createClickORMClient, DataType } from '../src/index.js';
import { LogLevel } from '../src/utils/logger.js';

/**
 * Example: User Management System
 */
async function main(): Promise<void> {
  // 1. Create ClickORM client
  const orm = createClickORMClient({
    host: 'http://localhost:8123',
    database: 'default',
    username: 'default',
    password: '',
    application: 'user-management',
    logging: {
      enabled: true,
      level: LogLevel.INFO,
      queries: true,
    },
  });

  // 2. Define User schema with full type safety
  const UserSchema = {
    id: {
      type: DataType.UInt32,
      primaryKey: true,
      comment: 'User ID',
    },
    name: {
      type: DataType.String,
      nullable: false,
      comment: 'User full name',
    },
    email: {
      type: DataType.String,
      unique: true,
      comment: 'User email address',
    },
    age: {
      type: DataType.UInt8,
      nullable: true,
      comment: 'User age',
    },
    country: {
      type: DataType.String,
      default: 'US',
      comment: 'User country code',
    },
    isActive: {
      type: DataType.Boolean,
      default: true,
      comment: 'Whether user is active',
    },
    createdAt: {
      type: DataType.DateTime,
      default: () => new Date(),
      comment: 'Account creation timestamp',
    },
    metadata: {
      type: DataType.JSON,
      nullable: true,
      comment: 'Additional user metadata',
    },
    tags: {
      type: DataType.Array,
      elementType: DataType.String,
      nullable: true,
      comment: 'User tags',
    },
  } as const;

  // 3. Create model - TypeScript infers the full type automatically
  const User = orm.define('users', UserSchema);

  try {
    // 4. Connect to ClickHouse
    await orm.connect();
    console.log('✓ Connected to ClickHouse');

    // 5. Sync schema (create table if not exists)
    await orm.sync();
    console.log('✓ Schema synced');

    // 6. INSERT - Single record
    // TypeScript knows exactly what fields are required/optional
    await User.insert({
      id: 1,
      name: 'Alice Johnson',
      email: 'alice@example.com',
      age: 25,
      country: 'IN',
      metadata: {
        department: 'Engineering',
        team: 'Backend',
      },
      tags: ['developer', 'typescript', 'nodejs'],
    });
    console.log('✓ Inserted single user');

    // 7. INSERT - Batch insert for performance
    await User.insertMany([
      {
        id: 2,
        name: 'Bob Smith',
        email: 'bob@example.com',
        age: 30,
        country: 'US',
      },
      {
        id: 3,
        name: 'Carol White',
        email: 'carol@example.com',
        age: 28,
        country: 'UK',
      },
      {
        id: 4,
        name: 'David Brown',
        email: 'david@example.com',
        age: 35,
        country: 'IN',
      },
    ]);
    console.log('✓ Batch inserted users');

    // 8. SELECT - With type-safe WHERE conditions
    const indianUsers = await User.where({ country: 'IN' })
      .where({ age: { gte: 18 } })
      .execute();
    console.log('✓ Found Indian users:', indianUsers.length);

    // 9. SELECT - Specific fields (type-safe)
    const userEmails = await User.select(['name', 'email'])
      .where({ isActive: true })
      .orderBy('name', 'ASC')
      .execute();
    // Type: Array<{ name: string; email: string }>
    console.log('✓ User emails:', userEmails);

    // 10. SELECT - Complex WHERE conditions
    const filteredUsers = await User.where({
      and: [
        { age: { gte: 18, lt: 65 } },
        {
          or: [{ country: 'US' }, { country: 'IN' }],
        },
      ],
    }).execute();
    console.log('✓ Filtered users:', filteredUsers.length);

    // 11. SELECT - Using operators
    const searchUsers = await User.where({
      name: { like: '%Johnson%' },
      email: { notNull: true },
      country: { in: ['US', 'IN', 'UK'] },
    }).execute();
    console.log('✓ Search results:', searchUsers.length);

    // 12. UPDATE
    await User.where({ id: 1 }).update({ age: 26 });
    console.log('✓ Updated user');

    // 13. COUNT
    const totalUsers = await User.where({ isActive: true }).count();
    console.log('✓ Total active users:', totalUsers);

    // 14. EXISTS
    const emailExists = await User.where({ email: 'alice@example.com' }).exists();
    console.log('✓ Email exists:', emailExists);

    // 15. FIND ONE
    const user = await User.where({ id: 1 }).first();
    console.log('✓ Found user:', user?.name);

    // 16. FIND BY PRIMARY KEY
    const userById = await User.findByPk(2);
    console.log('✓ User by PK:', userById?.name);

    // 17. DELETE
    await User.where({ id: 4 }).delete();
    console.log('✓ Deleted user');

    // 18. Aggregations
    const stats = await User.aggregate({
      total: { fn: 'COUNT', field: '*' },
      avgAge: { fn: 'AVG', field: 'age' },
      minAge: { fn: 'MIN', field: 'age' },
      maxAge: { fn: 'MAX', field: 'age' },
    });
    console.log('✓ User statistics:', stats);

    // 19. GROUP BY
    const byCountry = await User.groupBy('country')
      .aggregate({
        total: { fn: 'COUNT', field: '*' },
        avgAge: { fn: 'AVG', field: 'age' },
      })
      .execute();
    console.log('✓ Users by country:', byCountry);
  } catch (error) {
    console.error('✗ Error:', error);
  } finally {
    // 20. Disconnect
    await orm.disconnect();
    console.log('✓ Disconnected from ClickHouse');
  }
}

/**
 * Example: E-commerce Product Catalog
 */
async function _ecommerceExample(): Promise<void> {
  const orm = createClickORMClient({
    host: 'http://localhost:8123',
    database: 'ecommerce',
  });

  // Define Product schema
  const ProductSchema = {
    productId: { type: DataType.UInt32, primaryKey: true },
    sku: { type: DataType.String, unique: true },
    name: { type: DataType.String },
    description: { type: DataType.String },
    price: { type: DataType.Decimal, precision: 10, scale: 2 },
    stock: { type: DataType.UInt32, default: 0 },
    category: { type: DataType.String },
    tags: { type: DataType.Array, elementType: DataType.String },
    images: { type: DataType.Array, elementType: DataType.String },
    attributes: { type: DataType.JSON },
    isPublished: { type: DataType.Boolean, default: false },
    publishedAt: { type: DataType.DateTime, nullable: true },
    createdAt: { type: DataType.DateTime, default: () => new Date() },
    updatedAt: { type: DataType.DateTime, default: () => new Date() },
  } as const;

  const Product = orm.define('products', ProductSchema);

  await orm.connect();
  await orm.sync();

  // Complex query example
  const electronics = await Product.where({
    category: 'Electronics',
    isPublished: true,
    price: { gte: 100, lte: 1000 },
    stock: { gt: 0 },
  })
    .orderBy('price', 'ASC')
    .limit(20)
    .execute();

  console.log(`Found ${electronics.length} electronic products`);

  await orm.disconnect();
}

// Run examples
main().catch(console.error);

// Uncomment to run e-commerce example
// _ecommerceExample().catch(console.error);
