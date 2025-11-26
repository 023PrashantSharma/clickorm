/**
 * Relations Usage Example
 * Demonstrates how to define and use relationships between models
 * Similar to Sequelize's association system
 */

import {
  ClickORMClient,
  createClickORMClient,
  defineSchema,
  DataType,
  createModel,
} from '../src/index.js';

// Initialize ClickORM Client
const client: ClickORMClient = createClickORMClient({
  host: 'http://localhost:8123',
  database: 'default',
});

// Define User Schema
const userSchema = defineSchema('users', {
  id: {
    type: DataType.UInt32,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataType.String,
  },
  email: {
    type: DataType.String,
  },
  clientId: {
    type: DataType.UInt32,
    nullable: true,
  },
  createdAt: {
    type: DataType.DateTime,
    default: () => new Date(),
  },
});

// Define UserTokens Schema
const userTokensSchema = defineSchema('user_tokens', {
  id: {
    type: DataType.UInt32,
    primaryKey: true,
    autoIncrement: true,
  },
  userId: {
    type: DataType.UInt32,
  },
  token: {
    type: DataType.String,
  },
  deviceId: {
    type: DataType.String,
  },
  expiresAt: {
    type: DataType.DateTime,
  },
  createdAt: {
    type: DataType.DateTime,
    default: () => new Date(),
  },
});

// Define UserAuthSettings Schema
const userAuthSettingsSchema = defineSchema('user_auth_settings', {
  id: {
    type: DataType.UInt32,
    primaryKey: true,
    autoIncrement: true,
  },
  userId: {
    type: DataType.UInt32,
  },
  loginRetryLimit: {
    type: DataType.UInt8,
    default: 5,
  },
  loginReactiveTime: {
    type: DataType.UInt32,
    default: 300,
  },
  createdAt: {
    type: DataType.DateTime,
    default: () => new Date(),
  },
});

// Define Client Schema
const clientSchema = defineSchema('clients', {
  id: {
    type: DataType.UInt32,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataType.String,
  },
  code: {
    type: DataType.String,
  },
  isActive: {
    type: DataType.Boolean,
    default: true,
  },
  createdAt: {
    type: DataType.DateTime,
    default: () => new Date(),
  },
});

// Define Branch Schema
const branchSchema = defineSchema('branches', {
  id: {
    type: DataType.UInt32,
    primaryKey: true,
    autoIncrement: true,
  },
  clientId: {
    type: DataType.UInt32,
  },
  name: {
    type: DataType.String,
  },
  location: {
    type: DataType.String,
  },
  createdAt: {
    type: DataType.DateTime,
    default: () => new Date(),
  },
});

// Create Models
const User = createModel('users', userSchema, client);
const UserTokens = createModel('user_tokens', userTokensSchema, client);
const UserAuthSettings = createModel('user_auth_settings', userAuthSettingsSchema, client);
const Client = createModel('clients', clientSchema, client);
const Branch = createModel('branches', branchSchema, client);

// ===========================
// Define Relationships
// ===========================

// User has many UserTokens
User.hasMany(UserTokens, {
  foreignKey: 'userId',
  as: 'tokens',
  sourceKey: 'id',
});

// User has one UserAuthSettings
User.hasOne(UserAuthSettings, {
  foreignKey: 'userId',
  as: 'authSettings',
  sourceKey: 'id',
});

// UserTokens belongs to User
UserTokens.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user',
  targetKey: 'id',
});

// UserAuthSettings belongs to User
UserAuthSettings.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user',
  targetKey: 'id',
});

// Client has many Users
Client.hasMany(User, {
  foreignKey: 'clientId',
  as: 'users',
  sourceKey: 'id',
});

// Client has many Branches
Client.hasMany(Branch, {
  foreignKey: 'clientId',
  as: 'branches',
  sourceKey: 'id',
});

// Branch belongs to Client
Branch.belongsTo(Client, {
  foreignKey: 'clientId',
  as: 'client',
  targetKey: 'id',
});

// User belongs to Client
User.belongsTo(Client, {
  foreignKey: 'clientId',
  as: 'client',
  targetKey: 'id',
});

// ===========================
// Using Relations
// ===========================

/* eslint-disable @typescript-eslint/no-explicit-any */
async function demonstrateRelations(): Promise<void> {
  console.log('=== Relations Demo ===\n');

  // Get all relations defined on User model
  const userRelations = User.relations.getRelations();
  console.log('User Relations:', userRelations);

  // Get specific relation
  const tokensRelation = User.relations.getRelation('tokens');
  console.log('\nTokens Relation:', tokensRelation);

  // Example: Create a user with foreign key
  const newUser = await User.create({
    name: 'John Doe',
    email: 'john@example.com',
    clientId: 1,
  } as any);
  console.log('\nCreated User:', newUser);

  // Example: Create related tokens
  await UserTokens.create({
    userId: newUser.id,
    token: 'abc123',
    deviceId: 'device-001',
    expiresAt: new Date(Date.now() + 86400000), // 24 hours
  } as any);

  // Example: Create auth settings
  await UserAuthSettings.create({
    userId: newUser.id,
    loginRetryLimit: 3,
    loginReactiveTime: 600,
  } as any);

  console.log('\nRelated records created successfully!');

  // Note: Eager loading (with includes) would require additional implementation
  // For now, you can fetch related data manually:
  const userTokens = await UserTokens.where({ userId: newUser.id }).findAll();
  console.log('\nUser Tokens:', userTokens);

  const authSettings = await UserAuthSettings.where({ userId: newUser.id }).first();
  console.log('\nAuth Settings:', authSettings);
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// Export models and database object (Sequelize-style)
export const db = {
  client,
  User,
  UserTokens,
  UserAuthSettings,
  Client,
  Branch,
};

// Run demonstration if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstrateRelations()
    .then(() => {
      console.log('\n✅ Relations demonstration completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error:', error);
      process.exit(1);
    });
}

export default db;
