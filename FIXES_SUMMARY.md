# ClickORM Fixes Summary

## Issues Fixed

### 1. Seeding Error - Invalid SQL Query Generation ✅

**Problem:**
The `findOne` method was generating invalid SQL queries like:

```sql
SELECT * FROM `users` WHERE `where` = {param0:String} LIMIT 1
```

**Root Cause:**
The `findOne` method wasn't properly detecting `FindOptions` when only the `where` property was present. It was treating `{ where: {...} }` as a direct where condition instead of as a `FindOptions` object.

**Solution:**
Updated the detection logic in [`src/core/model.ts:356`](src/core/model.ts:356) to include `'where'` in the `isFindOptions` check:

```typescript
const isFindOptions =
  'where' in options || // ← Added this line
  'attributes' in options ||
  'limit' in options ||
  'offset' in options ||
  'order' in options ||
  'transaction' in options ||
  'hooks' in options;
```

### 2. JSON Field Serialization Error ✅

**Problem:**
ClickHouse was throwing errors when inserting JSON objects:

```
Cannot parse JSON object here: {'system.manage':TRUE,'users.create':TRUE,...}
```

**Root Cause:**
JSON fields were being passed as JavaScript objects instead of stringified JSON. ClickHouse requires JSON fields to be properly serialized strings.

**Solution:**
Enhanced the `serializeRecord` method in [`src/core/model.ts:875`](src/core/model.ts:875) to detect JSON type fields and stringify them:

```typescript
else if (typeof value === 'object' && !Array.isArray(value)) {
  // Check if this field is a JSON type in schema
  const schemaField = this.schema.getColumn(key);
  if (schemaField && schemaField.type === DataType.JSON) {
    // Stringify JSON objects for ClickHouse JSON fields
    serialized[key] = JSON.stringify(value);
  } else {
    serialized[key] = value;
  }
}
```

### 3. Log Formatting and Color Coding ✅

**Problem:**
Logs were plain text without proper formatting or colors, making them hard to read and distinguish between different log levels.

**Solution:**
Enhanced the logger in [`src/utils/logger.ts`](src/utils/logger.ts) with:

- **ANSI color codes** for terminal output (no external dependencies needed!)
- **Color-coded log levels:**
  - 🔵 **INFO** - Blue
  - 🟡 **WARN** - Yellow
  - 🔴 **ERROR** - Red
  - ⚫ **DEBUG** - Dimmed/Gray
- **Better formatting:**
  - Timestamps in gray
  - Context objects with proper indentation
  - Stack traces with proper formatting
  - Prefix/module names in cyan

### 4. Table Name Convention Mismatch ✅

**Problem:**
Tables were created with snake_case names (`user_auth_settings`) but code was using camelCase (`userAuthSettings`), causing errors:

```
Table default.userAuthSettings does not exist. Maybe you meant default.user_auth_settings?
```

**Root Cause:**
ClickHouse prefers snake_case table names, but JavaScript/TypeScript typically uses camelCase.

**Solution:**
Added automatic camelCase to snake_case conversion in [`src/core/client.ts:285`](src/core/client.ts:285):

```typescript
private toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}
```

Now the `insert()` method automatically converts table names:

```typescript
const normalizedTable = this.toSnakeCase(table);
await this.client.insert({
  table: normalizedTable,
  values: data,
  format: options?.format || 'JSONEachRow',
});
```

## Additional Fix Required in Your Code

### Hook Type Error

Your `afterCreate` hook needs to handle both single records AND arrays. See [`HOOK_FIX.md`](HOOK_FIX.md) for the complete fix.

**Quick Fix:**
Change your hook parameter from:

```typescript
async (record: User) => {
  // ...
};
```

To:

```typescript
async (instance: User | User[]) => {
  const records = Array.isArray(instance) ? instance : [instance];
  for (const record of records) {
    // ... your existing logic
  }
};
```

## Expected Output

After these fixes, your application will:

1. **Successfully seed data** - Superadmin user created without errors
2. **Beautiful colored logs**:
   ```
   [timestamp in gray] [INFO]  [ClickORM in cyan] ClickORM client initialized
     Context:
     {
       "host": "http://172.40.8.22:8123",
       "database": "default"
     }
   ```
3. **Automatic table name conversion** - Use camelCase in code, snake_case in database
4. **Proper JSON serialization** - JSON fields automatically stringified

## No Additional Dependencies Required

All fixes use built-in functionality - no new npm packages needed!
