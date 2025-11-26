/**
 * Custom assertion helpers for ClickORM tests
 * Provides domain-specific assertions for better test readability
 */

import { ClickORMError } from '../../src/core/errors.js';
import { SchemaDefinition, DataType } from '../../src/core/types.js';

/**
 * Assert that a value is a valid ClickORM error
 */
export function assertIsClickORMError(
  error: unknown,
  expectedCode?: string
): asserts error is ClickORMError {
  expect(error).toBeInstanceOf(ClickORMError);

  if (expectedCode) {
    expect((error as ClickORMError).code).toBe(expectedCode);
  }
}

/**
 * Assert that an error has specific context
 */
export function assertErrorHasContext<T extends Record<string, unknown>>(
  error: unknown,
  expectedContext: Partial<T>
): void {
  assertIsClickORMError(error);

  const errorContext = error.context as T;
  Object.entries(expectedContext).forEach(([key, value]) => {
    expect(errorContext[key]).toEqual(value);
  });
}

/**
 * Assert that a schema is valid
 */
export function assertValidSchema(schema: SchemaDefinition): void {
  expect(schema).toBeDefined();
  expect(typeof schema).toBe('object');
  expect(Object.keys(schema).length).toBeGreaterThan(0);

  Object.entries(schema).forEach(([fieldName, definition]) => {
    expect(fieldName).toMatch(/^[a-zA-Z_][a-zA-Z0-9_]*$/);
    expect(definition.type).toBeDefined();
    expect(Object.values(DataType)).toContain(definition.type);
  });
}

/**
 * Assert that a schema has a primary key
 */
export function assertSchemaNasPrimaryKey(schema: SchemaDefinition, expectedKey?: string): void {
  const primaryKeys = Object.entries(schema)
    .filter(([, def]) => def.primaryKey)
    .map(([name]) => name);

  expect(primaryKeys.length).toBeGreaterThan(0);

  if (expectedKey) {
    expect(primaryKeys).toContain(expectedKey);
  }
}

/**
 * Assert that a value matches a ClickHouse type
 */
export function assertMatchesType(value: unknown, dataType: DataType): void {
  switch (dataType) {
    case DataType.UInt8:
    case DataType.UInt16:
    case DataType.UInt32:
    case DataType.Int8:
    case DataType.Int16:
    case DataType.Int32:
    case DataType.Float32:
    case DataType.Float64:
      expect(typeof value).toBe('number');
      break;

    case DataType.UInt64:
    case DataType.Int64:
      expect(['number', 'bigint']).toContain(typeof value);
      break;

    case DataType.String:
    case DataType.FixedString:
    case DataType.UUID:
    case DataType.IPv4:
    case DataType.IPv6:
      expect(typeof value).toBe('string');
      break;

    case DataType.Boolean:
      expect(typeof value).toBe('boolean');
      break;

    case DataType.Date:
    case DataType.Date32:
    case DataType.DateTime:
    case DataType.DateTime64:
      expect(value).toBeInstanceOf(Date);
      break;

    case DataType.Array:
      expect(Array.isArray(value)).toBe(true);
      break;

    case DataType.JSON:
    case DataType.Map:
      expect(typeof value).toBe('object');
      expect(value).not.toBeNull();
      break;
  }
}

/**
 * Assert that SQL contains specific keywords
 */
export function assertSQLContains(sql: string, ...keywords: string[]): void {
  const upperSQL = sql.toUpperCase();
  keywords.forEach((keyword) => {
    expect(upperSQL).toContain(keyword.toUpperCase());
  });
}

/**
 * Assert that SQL does not contain specific keywords
 */
export function assertSQLNotContains(sql: string, ...keywords: string[]): void {
  const upperSQL = sql.toUpperCase();
  keywords.forEach((keyword) => {
    expect(upperSQL).not.toContain(keyword.toUpperCase());
  });
}

/**
 * Assert that SQL is properly parameterized (no raw values)
 */
export function assertSQLIsParameterized(sql: string): void {
  // Check for suspicious patterns that might indicate SQL injection
  expect(sql).not.toMatch(/'\s*;\s*DROP/i);
  expect(sql).not.toMatch(/'\s*OR\s+'1'\s*=\s*'1/i);
  expect(sql).not.toMatch(/--/);

  // SQL should contain parameter placeholders
  // ClickHouse uses {paramName:Type} format
  if (sql.includes('WHERE') || sql.includes('VALUES')) {
    expect(sql).toMatch(/\{param\d+:[A-Za-z0-9]+\}/);
  }
}

/**
 * Assert that an identifier is properly escaped
 */
export function assertIdentifierEscaped(identifier: string): void {
  expect(identifier).toMatch(/^`[a-zA-Z_][a-zA-Z0-9_]*`$/);
}

/**
 * Assert that a query result has expected structure
 */
export function assertQueryResult<T>(
  result: unknown,
  expectedLength?: number
): asserts result is T[] {
  expect(Array.isArray(result)).toBe(true);

  if (expectedLength !== undefined) {
    expect((result as unknown[]).length).toBe(expectedLength);
  }
}

/**
 * Assert that two objects are deeply equal (ignoring undefined/null differences)
 */
export function assertDeepEqual(actual: unknown, expected: unknown): void {
  const normalize = (obj: unknown): unknown => {
    if (obj === null || obj === undefined) return null;
    if (typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(normalize);

    const result: Record<string, unknown> = {};
    Object.entries(obj as Record<string, unknown>).forEach(([key, value]) => {
      if (value !== undefined) {
        result[key] = normalize(value);
      }
    });
    return result;
  };

  expect(normalize(actual)).toEqual(normalize(expected));
}

/**
 * Assert that a value is within a range
 */
export function assertInRange(value: number, min: number, max: number, message?: string): void {
  expect(value).toBeGreaterThanOrEqual(min);
  expect(value).toBeLessThanOrEqual(max);

  if (message) {
    expect(value >= min && value <= max).toBe(true);
  }
}

/**
 * Assert that an array contains all expected items
 */
export function assertContainsAll<T>(array: T[], expectedItems: T[]): void {
  expectedItems.forEach((item) => {
    expect(array).toContain(item);
  });
}

/**
 * Assert that an array does not contain any of the items
 */
export function assertContainsNone<T>(array: T[], unexpectedItems: T[]): void {
  unexpectedItems.forEach((item) => {
    expect(array).not.toContain(item);
  });
}

/**
 * Assert that a string matches a pattern
 */
export function assertMatchesPattern(value: string, pattern: RegExp, message?: string): void {
  expect(value).toMatch(pattern);

  if (message && !pattern.test(value)) {
    throw new Error(message);
  }
}

/**
 * Assert that an object has all expected keys
 */
export function assertHasKeys<T extends Record<string, unknown>>(
  obj: unknown,
  expectedKeys: (keyof T)[]
): asserts obj is T {
  expect(obj).toBeDefined();
  expect(typeof obj).toBe('object');
  expect(obj).not.toBeNull();

  expectedKeys.forEach((key) => {
    expect(obj).toHaveProperty(String(key));
  });
}

/**
 * Assert that an object does not have any of the keys
 */
export function assertDoesNotHaveKeys(
  obj: Record<string, unknown>,
  unexpectedKeys: string[]
): void {
  unexpectedKeys.forEach((key) => {
    expect(obj).not.toHaveProperty(key);
  });
}

/**
 * Assert that a date is recent (within last N seconds)
 */
export function assertDateIsRecent(date: Date, maxAgeSeconds: number = 60): void {
  const now = Date.now();
  const timestamp = date.getTime();
  const ageSeconds = (now - timestamp) / 1000;

  expect(ageSeconds).toBeLessThanOrEqual(maxAgeSeconds);
  expect(ageSeconds).toBeGreaterThanOrEqual(0);
}

/**
 * Assert that execution time is within acceptable range
 */
export function assertExecutionTime(fn: () => void | Promise<void>, maxMs: number): Promise<void> {
  const start = Date.now();

  const checkTime = () => {
    const duration = Date.now() - start;
    expect(duration).toBeLessThanOrEqual(maxMs);
  };

  const result = fn();

  if (result instanceof Promise) {
    return result.then(checkTime);
  }

  checkTime();
  return Promise.resolve();
}

/**
 * Assert that a function throws a specific error type with message
 */
export function assertThrowsWithMessage<T extends Error>(
  fn: () => void,
  ErrorType: new (...args: unknown[]) => T,
  messagePattern: string | RegExp
): void {
  expect(fn).toThrow(ErrorType);
  expect(fn).toThrow(messagePattern);
}

/**
 * Assert that an async function throws a specific error type with message
 */
export async function assertAsyncThrowsWithMessage<T extends Error>(
  fn: () => Promise<void>,
  ErrorType: new (...args: unknown[]) => T,
  messagePattern: string | RegExp
): Promise<void> {
  await expect(fn()).rejects.toThrow(ErrorType);
  await expect(fn()).rejects.toThrow(messagePattern);
}

/**
 * Assert that a value is one of the expected values
 */
export function assertOneOf<T>(value: T, expectedValues: T[]): void {
  expect(expectedValues).toContain(value);
}

/**
 * Assert that all items in an array satisfy a condition
 */
export function assertAllSatisfy<T>(
  array: T[],
  predicate: (item: T) => boolean,
  message?: string
): void {
  const allSatisfy = array.every(predicate);
  expect(allSatisfy).toBe(true);

  if (message && !allSatisfy) {
    throw new Error(message);
  }
}

/**
 * Assert that at least one item in an array satisfies a condition
 */
export function assertAnySatisfies<T>(
  array: T[],
  predicate: (item: T) => boolean,
  message?: string
): void {
  const anySatisfies = array.some(predicate);
  expect(anySatisfies).toBe(true);

  if (message && !anySatisfies) {
    throw new Error(message);
  }
}
