# Hook TypeScript Error Fix

## Problem

The `afterCreate` hook is receiving a TypeScript error because the hook callback type expects to handle both single records and arrays:

```typescript
HookCallback<T> = (instance: InferModel<T> | InferModel<T>[], options: HookOptions) => void | Promise<void>
```

## Solution

Update your hook in the User model to handle both cases:

### Before (Incorrect):

```typescript
Model.hooks.addListener(HookType.afterCreate, async (record: User) => {
  // This only handles single records
});
```

### After (Correct):

```typescript
Model.hooks.addListener(HookType.afterCreate, async (instance: User | User[]) => {
  // Handle both single records and arrays
  const records = Array.isArray(instance) ? instance : [instance];

  for (const record of records) {
    const db = getDatabase();

    /** Create auth settings row */
    try {
      await db.insert('userAuthSettings', [
        {
          userId: record.id,
          createdAt: new Date(),
        },
      ]);
    } catch (err) {
      console.error('Error creating userAuthSettings:', err);
    }

    /** Set default permissions */
    try {
      if (!record.permissions || Object.keys(record.permissions).length === 0) {
        const defaultPermissions = getDefaultPermissionsByUserType(record.userType as any);

        await Model.updateRecords({ permissions: defaultPermissions as any }, {
          id: record.id,
        } as any);
      }
    } catch (err) {
      console.error('Error setting default permissions:', err);
    }
  }
});
```

## Key Changes:

1. **Parameter type**: `instance: User | User[]` instead of `record: User`
2. **Normalize to array**: `const records = Array.isArray(instance) ? instance : [instance];`
3. **Loop through records**: Handle both single and bulk creates

This ensures your hook works correctly whether `create()` or `bulkCreate()` is called!
