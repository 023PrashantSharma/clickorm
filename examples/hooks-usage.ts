/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/**
 * ClickORM - Hooks and Sequelize-Style API Examples
 * Demonstrates the new hooks system and direct parameter methods
 */

import {
  createClickORMClient,
  DataType,
  HookType,
  type CreateOptions,
  type UpdateOptions,
  type DestroyOptions,
} from '../src/index.js';

// Create client
const client = createClickORMClient({
  host: 'http://localhost:8123',
  database: 'default',
  logging: { enabled: true, queries: true },
});

// Define User model
const User = client.define('users', {
  id: {
    type: DataType.UInt32,
    primaryKey: true,
    autoIncrement: true,
  },
  email: {
    type: DataType.String,
  },
  name: {
    type: DataType.String,
  },
  status: {
    type: DataType.String,
    default: 'pending',
  },
  createdAt: {
    type: DataType.DateTime,
  },
  updatedAt: {
    type: DataType.DateTime,
    nullable: true,
  },
});

async function demonstrateHooks() {
  console.log('=== HOOKS DEMONSTRATION ===\n');

  // 1. Add beforeCreate hook
  User.hooks.addListener(
    HookType.beforeCreate,
    async (user, _options) => {
      if (Array.isArray(user)) return;
      console.log('🎣 beforeCreate hook fired');
      user.createdAt = new Date();
      console.log(`   Setting createdAt: ${user.createdAt}`);
    },
    'setCreatedAt'
  );

  // 2. Add afterCreate hook
  User.hooks.addListener(HookType.afterCreate, async (user, _options) => {
    if (Array.isArray(user)) return;
    console.log('🎣 afterCreate hook fired');
    console.log(`   User created with ID: ${user.id}`);
  });

  // 3. Add beforeUpdate hook
  User.hooks.addListener(HookType.beforeUpdate, async (user, _options) => {
    if (Array.isArray(user)) return;
    console.log('🎣 beforeUpdate hook fired');
    user.updatedAt = new Date();
  });

  // 4. Add validation hook
  User.hooks.addListener(HookType.beforeValidate, async (user, _options) => {
    if (Array.isArray(user)) return;
    console.log('🎣 beforeValidate hook fired');
    console.log(`   Validating: ${user.email}`);
  });

  // 5. Add bulk hooks
  User.hooks.addListener(HookType.beforeBulkCreate, async (users, _options) => {
    console.log('🎣 beforeBulkCreate hook fired');
    const count = Array.isArray(users) ? users.length : 1;
    console.log(`   Creating ${count} users`);
  });

  User.hooks.addListener(HookType.afterBulkUpdate, async (_data, _options) => {
    console.log('🎣 afterBulkUpdate hook fired');
    console.log('   Bulk update completed');
  });

  console.log('✅ Hooks registered successfully\n');
}

async function demonstrateCreate() {
  console.log('=== CREATE OPERATIONS ===\n');

  // 1. Simple create (triggers hooks)
  console.log('1. Creating user with hooks...');
  const user1 = await User.create({
    id: 1,
    email: 'john@example.com',
    name: 'John Doe',
    status: 'active',
    createdAt: new Date(),
    updatedAt: null,
  });
  console.log(`✅ Created: ${user1.name}\n`);

  // 2. Create with options
  console.log('2. Creating user with custom options...');
  const user2 = await User.create(
    {
      id: 2,
      email: 'jane@example.com',
      name: 'Jane Smith',
      status: 'active',
      createdAt: new Date(),
      updatedAt: null,
    },
    {
      fields: ['email', 'name', 'status'], // Only insert these fields
      validate: true,
      hooks: true,
    } as CreateOptions
  );
  console.log(`✅ Created: ${user2.name}\n`);

  // 3. Bulk create
  console.log('3. Bulk creating users...');
  const users = await User.bulkCreate([
    {
      id: 3,
      email: 'user1@example.com',
      name: 'User 1',
      status: 'pending',
      createdAt: new Date(),
      updatedAt: null,
    },
    {
      id: 4,
      email: 'user2@example.com',
      name: 'User 2',
      status: 'pending',
      createdAt: new Date(),
      updatedAt: null,
    },
    {
      id: 5,
      email: 'user3@example.com',
      name: 'User 3',
      status: 'pending',
      createdAt: new Date(),
      updatedAt: null,
    },
  ]);
  console.log(`✅ Created ${users.length} users\n`);

  // 4. Bulk create with individual hooks
  console.log('4. Bulk creating with individual hooks...');
  await User.bulkCreate(
    [
      {
        id: 6,
        email: 'vip1@example.com',
        name: 'VIP User 1',
        status: 'active',
        createdAt: new Date(),
        updatedAt: null,
      },
      {
        id: 7,
        email: 'vip2@example.com',
        name: 'VIP User 2',
        status: 'active',
        createdAt: new Date(),
        updatedAt: null,
      },
    ],
    {
      individualHooks: true, // Run hooks for each record
      validate: true,
    }
  );
  console.log('✅ VIP users created with individual hooks\n');
}

async function demonstrateFindOne() {
  console.log('=== FIND ONE OPERATIONS ===\n');

  // 1. Simple findOne with direct where
  console.log('1. Finding user by email...');
  const user1 = await User.findOne({ email: 'john@example.com' });
  if (user1) {
    console.log(`✅ Found: ${user1.name}\n`);
  }

  // 2. FindOne with full options
  console.log('2. Finding user with options...');
  const user2 = await User.findOne({
    where: { status: 'active' },
    attributes: ['id', 'name', 'email'],
    order: [['createdAt', 'DESC']],
    limit: 1,
    hooks: true,
  });
  if (user2) {
    console.log(`✅ Found: ${user2.name}\n`);
  }

  // 3. FindOne with chained methods (legacy style)
  console.log('3. Finding user with chained methods...');
  const user3 = await User.where({ status: 'pending' }).orderBy('id', 'ASC').first();
  if (user3) {
    console.log(`✅ Found: ${user3.name}\n`);
  }
}

async function demonstrateUpdate() {
  console.log('=== UPDATE OPERATIONS ===\n');

  // 1. Update with direct where (Sequelize-style)
  console.log('1. Updating users with direct where...');
  await User.updateRecords({ status: 'verified' }, { email: 'john@example.com' });
  console.log('✅ User updated\n');

  // 2. Update with full options
  console.log('2. Updating users with options...');
  await User.updateRecords({ status: 'active' }, {
    where: { status: 'pending' },
    fields: ['status'], // Only update status field
    validate: false,
    hooks: true,
    limit: 5,
  } as UpdateOptions);
  console.log('✅ Users updated with options\n');

  // 3. Update with individual hooks
  console.log('3. Updating with individual hooks...');
  await User.updateRecords({ status: 'premium' }, {
    where: { email: { like: 'vip%' } },
    individualHooks: true, // Run hooks for each record
    hooks: true,
  } as UpdateOptions);
  console.log('✅ VIP users updated with individual hooks\n');

  // 4. Update with chained methods (legacy style)
  console.log('4. Updating with chained methods...');
  await User.where({ status: 'verified' }).limit(1).update({ status: 'confirmed' });
  console.log('✅ User updated with chained methods\n');
}

async function demonstrateDestroy() {
  console.log('=== DESTROY OPERATIONS ===\n');

  // 1. Destroy with direct where
  console.log('1. Destroying users with direct where...');
  await User.destroy({ status: 'pending' });
  console.log('✅ Pending users destroyed\n');

  // 2. Destroy with full options
  console.log('2. Destroying with options...');
  await User.destroy({
    where: { status: 'inactive' },
    limit: 10,
    hooks: true,
    force: true,
  } as DestroyOptions);
  console.log('✅ Inactive users destroyed\n');

  // 3. Destroy with individual hooks
  console.log('3. Destroying with individual hooks...');
  await User.destroy({
    where: { email: { like: 'test%' } },
    individualHooks: true,
    hooks: true,
  } as DestroyOptions);
  console.log('✅ Test users destroyed with individual hooks\n');

  // 4. Destroy with chained methods (legacy style)
  console.log('4. Destroying with chained methods...');
  await User.where({ id: { lt: 100 } })
    .limit(5)
    .delete();
  console.log('✅ Users destroyed with chained methods\n');
}

async function demonstrateAdvancedHooks() {
  console.log('=== ADVANCED HOOKS ===\n');

  // 1. Hook with transaction context
  User.hooks.addListener(
    HookType.afterCreate,
    async (user, options) => {
      if (options.transaction) {
        console.log('🎣 Hook executing within transaction context');
      }
    },
    'transactionAwareHook'
  );

  // 2. Conditional hook
  User.hooks.addListener(HookType.beforeUpdate, async (user, _options) => {
    if (Array.isArray(user)) return;
    if (user.status === 'deleted') {
      throw new Error('Cannot update deleted user');
    }
  });

  // 3. Hook that modifies data based on rules
  User.hooks.addListener(HookType.beforeCreate, async (user, _options) => {
    if (Array.isArray(user)) return;
    // Auto-generate status if not provided
    if (!user.status) {
      user.status = 'pending';
    }

    // Normalize email
    if (user.email) {
      user.email = user.email.toLowerCase().trim();
    }
  });

  // 4. Remove a hook
  console.log('Removing transactionAwareHook...');
  User.hooks.removeListener(HookType.afterCreate, 'transactionAwareHook');
  console.log('✅ Hook removed\n');
}

async function main() {
  try {
    // Connect to database
    await client.connect();
    console.log('✅ Connected to ClickHouse\n');

    // Sync schema
    await client.sync({ force: true });
    console.log('✅ Schema synced\n');

    // Demonstrate features
    await demonstrateHooks();
    await demonstrateCreate();
    await demonstrateFindOne();
    await demonstrateUpdate();
    await demonstrateDestroy();
    await demonstrateAdvancedHooks();

    console.log('\n=== ALL DEMONSTRATIONS COMPLETED ===');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.disconnect();
    console.log('\n✅ Disconnected from ClickHouse');
  }
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export {
  demonstrateHooks,
  demonstrateCreate,
  demonstrateFindOne,
  demonstrateUpdate,
  demonstrateDestroy,
};
