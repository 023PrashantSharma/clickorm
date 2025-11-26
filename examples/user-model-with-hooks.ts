/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Example: User Model with Sequelize-style Hooks in ClickORM
 * This demonstrates how to convert your Sequelize getUserModel() to ClickORM
 */

import { createClickORMClient, DataType, HookType, type InferModel } from '../src/index.js';

// Mock bcrypt for demonstration (in production: npm install bcryptjs)
const bcrypt = {
  async hash(password: string, _saltRounds: number): Promise<string> {
    return `hashed_${password}`;
  },
  async compare(password: string, hash: string): Promise<boolean> {
    return hash === `hashed_${password}`;
  },
};

// Constants (similar to your appConstants.js)
export const USER_TYPES = {
  ADMIN: 'admin',
  SENIOR_ENGINEER: 'senior_engineer',
  JUNIOR_ENGINEER: 'junior_engineer',
  GUEST: 'guest',
} as const;

export const USER_TYPES_ENUM = Object.values(USER_TYPES);

/**
 * User schema definition for ClickORM
 * Matches your Sequelize schema structure
 */
export const UserSchema = {
  id: {
    type: DataType.UUID,
    primaryKey: true,
    default: 'generateUUIDv4()',
    comment: 'User ID',
  },
  username: {
    type: DataType.String,
    nullable: false,
  },
  password: {
    type: DataType.String,
    nullable: false,
  },
  email: {
    type: DataType.String,
    nullable: false,
  },
  firstName: {
    type: DataType.String,
    nullable: true,
  },
  lastName: {
    type: DataType.String,
    nullable: true,
  },
  phoneNumber: {
    type: DataType.String,
    nullable: true,
  },
  address: {
    type: DataType.String,
    nullable: true,
  },
  userType: {
    type: DataType.String, // Use String instead of Enum8 for flexibility
    default: USER_TYPES.JUNIOR_ENGINEER,
  },
  permissions: {
    type: DataType.String, // Store as JSON string in ClickHouse
    default: '{}',
  },
  profileImage: {
    type: DataType.String,
    nullable: true,
  },
  lastLoginAt: {
    type: DataType.DateTime,
    nullable: true,
  },
  isActive: {
    type: DataType.Boolean,
    default: false,
  },
  isDeleted: {
    type: DataType.Boolean,
    default: false,
  },
  isEmailVerified: {
    type: DataType.Boolean,
    default: false,
  },
  createdAt: {
    type: DataType.DateTime,
    default: 'now()',
  },
  updatedAt: {
    type: DataType.DateTime,
    default: 'now()',
  },
  createdBy: {
    type: DataType.UUID,
    nullable: true,
  },
  updatedBy: {
    type: DataType.UUID,
    nullable: true,
  },
} as const;

type User = InferModel<typeof UserSchema>;

/**
 * Internal model instance (singleton pattern like your Sequelize code)
 */
let UserModel: ReturnType<typeof createUserModel> | null = null;

/**
 * Get database connection (mock - replace with your actual implementation)
 */
function getDatabase(): ReturnType<typeof createClickORMClient> {
  return createClickORMClient({
    host: 'http://localhost:8123',
    database: 'default',
    username: 'default',
    password: '',
  });
}

/**
 * Create and configure the User model with hooks
 * This replaces your Sequelize db.define() call
 */
function createUserModel() {
  const db = getDatabase();
  const Model = db.define('users', UserSchema);

  // ============================================
  // HOOKS - Exactly matching your Sequelize hooks
  // ============================================

  // beforeCreate Hook - Hash password and set defaults
  Model.hooks.addListener(HookType.beforeCreate, async (record) => {
    const user = record as any; // Use 'any' to allow modification in hooks

    // Hash password if present
    if (user.password) {
      user.password = await bcrypt.hash(user.password, 8);
    }

    // Set default flags
    user.isActive = true;
    user.isDeleted = false;
    user.isEmailVerified = false;
  });

  // beforeBulkCreate Hook - Handle multiple records
  Model.hooks.addListener(HookType.beforeBulkCreate, async (records) => {
    const users = Array.isArray(records) ? records : [records];

    for (const record of users) {
      const user = record as any; // Use 'any' to allow modification in hooks

      // Hash password if present
      if (user.password) {
        user.password = await bcrypt.hash(user.password, 8);
      }

      // Set default flags
      user.isActive = true;
      user.isDeleted = false;
      user.isEmailVerified = false;
    }
  });

  // afterCreate Hook - Create related records and set permissions
  Model.hooks.addListener(HookType.afterCreate, async (record) => {
    const user = record as User;
    const db = getDatabase();

    try {
      // Create default auth settings
      await db.command(
        `
        INSERT INTO userAuthSettings (userId, createdAt)
        VALUES ({userId:UUID}, now())
      `,
        { userId: user.id }
      );

      console.log(`Created auth settings for user: ${user.id}`);
    } catch (err) {
      console.error('Error creating userAuthSettings:', err);
    }

    // Set default permissions based on user type
    if (!user.permissions || user.permissions === '{}') {
      try {
        const defaultPermissions = getDefaultPermissionsByUserType(user.userType);

        // Update user with default permissions
        await Model.updateRecords({ permissions: JSON.stringify(defaultPermissions) }, {
          id: user.id,
        } as any);

        console.log(`Set default permissions for user: ${user.id}`);
      } catch (err) {
        console.error('Error setting default permissions:', err);
      }
    }
  });

  return Model;
}

/**
 * Get or create User model (singleton pattern)
 * This is your exact getUserModel() function from Sequelize
 */
export const getUserModel = () => {
  if (!UserModel) {
    UserModel = createUserModel();
  }
  return UserModel;
};

// ============================================
// CUSTOM METHODS
// Since ClickORM doesn't support prototype methods,
// we create utility functions instead
// ============================================

export const UserMethods = {
  /**
   * Check if password matches
   * Replaces: UserModel.prototype.isPasswordMatch
   */
  async isPasswordMatch(user: User, password: string): Promise<boolean> {
    return bcrypt.compare(password, user.password);
  },

  /**
   * Get full name
   * Replaces: UserModel.prototype.getFullName
   */
  getFullName(user: User): string {
    return `${user.firstName || ''} ${user.lastName || ''}`.trim();
  },

  /**
   * Check if user has specific permission
   * Replaces: UserModel.prototype.hasPermission
   */
  hasPermission(user: User, permission: string): boolean {
    if (!user.permissions) return false;
    try {
      const perms = JSON.parse(user.permissions);
      return Boolean(perms[permission]);
    } catch {
      return false;
    }
  },

  /**
   * Convert to JSON (exclude password)
   * Replaces: UserModel.prototype.toJSON
   */
  toJSON(user: User): Omit<User, 'password'> {
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  },
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get default permissions by user type
 * This would be imported from your utils/defaultPermissions.js
 */
function getDefaultPermissionsByUserType(userType: string): Record<string, boolean> {
  const permissions: Record<string, Record<string, boolean>> = {
    [USER_TYPES.ADMIN]: {
      canRead: true,
      canWrite: true,
      canDelete: true,
      canManageUsers: true,
      canManageSettings: true,
      canViewReports: true,
    },
    [USER_TYPES.SENIOR_ENGINEER]: {
      canRead: true,
      canWrite: true,
      canDelete: true,
      canManageUsers: false,
      canManageSettings: false,
      canViewReports: true,
    },
    [USER_TYPES.JUNIOR_ENGINEER]: {
      canRead: true,
      canWrite: true,
      canDelete: false,
      canManageUsers: false,
      canManageSettings: false,
      canViewReports: false,
    },
    [USER_TYPES.GUEST]: {
      canRead: true,
      canWrite: false,
      canDelete: false,
      canManageUsers: false,
      canManageSettings: false,
      canViewReports: false,
    },
  };

  return permissions[userType] || permissions[USER_TYPES.GUEST];
}

// ============================================
// USAGE EXAMPLES
// ============================================

export async function exampleUsage() {
  // Get the User model (same as your Sequelize code)
  const User = getUserModel();

  // Example 1: Create a single user (all hooks fire automatically)
  console.log('\n=== Creating User ===');
  const newUser = await User.create({
    id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    username: 'johndoe',
    password: 'plain-password', // Will be hashed by beforeCreate hook
    email: 'john@example.com',
    firstName: 'John',
    lastName: 'Doe',
    userType: USER_TYPES.JUNIOR_ENGINEER,
    phoneNumber: '+1234567890',
    permissions: '{}',
    isActive: false, // Will be overridden by hook
    isDeleted: false,
    isEmailVerified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    profileImage: null,
    lastLoginAt: null,
    createdBy: null,
    updatedBy: null,
    address: null,
  });

  console.log('Created user:', UserMethods.toJSON(newUser as User));

  // Example 2: Bulk create users
  console.log('\n=== Bulk Creating Users ===');
  await User.bulkCreate([
    {
      id: 'a1b2c3d4-e5f6-4a5b-8c9d-1e2f3a4b5c6d',
      username: 'janesmith',
      password: 'password123',
      email: 'jane@example.com',
      firstName: 'Jane',
      lastName: 'Smith',
      userType: USER_TYPES.SENIOR_ENGINEER,
      permissions: '{}',
      isActive: false,
      isDeleted: false,
      isEmailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      phoneNumber: null,
      profileImage: null,
      lastLoginAt: null,
      createdBy: null,
      updatedBy: null,
      address: null,
    },
    {
      id: 'b2c3d4e5-f6a7-5b6c-9d0e-2f3a4b5c6d7e',
      username: 'bobadmin',
      password: 'admin123',
      email: 'bob@example.com',
      firstName: 'Bob',
      lastName: 'Admin',
      userType: USER_TYPES.ADMIN,
      permissions: '{}',
      isActive: false,
      isDeleted: false,
      isEmailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      phoneNumber: null,
      profileImage: null,
      lastLoginAt: null,
      createdBy: null,
      updatedBy: null,
      address: null,
    },
  ]);

  console.log('Bulk created users');

  // Example 3: Find user and use custom methods
  console.log('\n=== Using Custom Methods ===');
  const user = await User.findOne({ email: 'john@example.com' } as any);

  if (user) {
    // Check password (replaces: user.isPasswordMatch())
    const isValid = await UserMethods.isPasswordMatch(user as User, 'plain-password');
    console.log('Password valid:', isValid);

    // Get full name (replaces: user.getFullName())
    const fullName = UserMethods.getFullName(user as User);
    console.log('Full name:', fullName);

    // Check permission (replaces: user.hasPermission())
    const canDelete = UserMethods.hasPermission(user as User, 'canDelete');
    console.log('Can delete:', canDelete);

    // Get safe JSON (replaces: user.toJSON())
    const safeUser = UserMethods.toJSON(user as User);
    console.log('Safe user data:', safeUser);
  }

  // Example 4: Update user
  console.log('\n=== Updating User ===');
  await User.updateRecords({ isEmailVerified: true }, { email: 'john@example.com' } as any);
  console.log('User email verified');

  // Example 5: Disable hooks for specific operation
  console.log('\n=== Creating User Without Hooks ===');
  await User.create(
    {
      id: 'c3d4e5f6-a7b8-6c7d-0e1f-3a4b5c6d7e8f',
      username: 'nohooks',
      password: 'already-hashed-password',
      email: 'nohooks@example.com',
      firstName: 'No',
      lastName: 'Hooks',
      userType: USER_TYPES.GUEST,
      permissions: '{}',
      isActive: true,
      isDeleted: false,
      isEmailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      phoneNumber: null,
      profileImage: null,
      lastLoginAt: null,
      createdBy: null,
      updatedBy: null,
      address: null,
    },
    { hooks: false }
  ); // Hooks won't fire

  console.log('User created without hooks');
}

// Direct export for convenience (like your Sequelize code)
// Note: This creates a separate constant to avoid redeclaration
const UserModelInstance = getUserModel();
export { UserModelInstance as User };
export default UserModelInstance;
