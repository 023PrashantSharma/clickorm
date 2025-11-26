/**
 * Runtime validation utilities for ClickORM
 * Provides validation for schema definitions, data, and queries
 */

import { ColumnDefinition, DataType, SchemaDefinition } from '../core/types.js';
import { ValidationError } from '../core/errors.js';
import { validateValue } from './type-mapper.js';

/**
 * Validation rule interface
 */
export interface ValidationRule {
  validate: (value: unknown) => boolean;
  message: string;
}

/**
 * Validate schema definition
 */
export function validateSchema(schema: SchemaDefinition): void {
  const fields = Object.keys(schema);

  if (fields.length === 0) {
    throw new ValidationError('Schema must have at least one field');
  }

  // Check for duplicate primary keys
  const primaryKeys = fields.filter((field) => schema[field]?.primaryKey);
  if (primaryKeys.length > 1) {
    throw new ValidationError(
      `Multiple primary keys found: ${primaryKeys.join(', ')}. Only one primary key is allowed.`
    );
  }

  // Validate each column
  for (const [fieldName, column] of Object.entries(schema)) {
    validateColumnDefinition(fieldName, column);
  }
}

/**
 * Validate column definition
 */
export function validateColumnDefinition(fieldName: string, column: ColumnDefinition): void {
  if (!column.type) {
    throw new ValidationError(`Column '${fieldName}' is missing type`, fieldName);
  }

  // Validate field name
  if (!isValidIdentifier(fieldName)) {
    throw new ValidationError(
      `Invalid field name '${fieldName}'. Field names must start with a letter or underscore and contain only alphanumeric characters and underscores.`,
      fieldName
    );
  }

  // Type-specific validation
  switch (column.type) {
    case DataType.FixedString:
      if (!column.length || column.length <= 0) {
        throw new ValidationError(
          `FixedString column '${fieldName}' requires a positive length`,
          fieldName
        );
      }
      break;

    case DataType.Decimal:
      if (!column.precision || column.precision <= 0) {
        throw new ValidationError(
          `Decimal column '${fieldName}' requires a positive precision`,
          fieldName
        );
      }
      if (column.scale !== undefined && (column.scale < 0 || column.scale > column.precision)) {
        throw new ValidationError(
          `Decimal column '${fieldName}' scale must be between 0 and precision`,
          fieldName
        );
      }
      break;

    case DataType.Array:
    case DataType.LowCardinality:
      if (!column.elementType) {
        throw new ValidationError(
          `${column.type} column '${fieldName}' requires elementType`,
          fieldName
        );
      }
      break;

    case DataType.Enum8:
    case DataType.Enum16: {
      if (!column.enumValues || column.enumValues.length === 0) {
        throw new ValidationError(`Enum column '${fieldName}' requires enumValues`, fieldName);
      }
      // Check enum value count limits
      const maxValues = column.type === DataType.Enum8 ? 256 : 65536;
      if (column.enumValues.length > maxValues) {
        throw new ValidationError(
          `${column.type} column '${fieldName}' cannot have more than ${maxValues} values`,
          fieldName
        );
      }
      break;
    }
  }

  // Validate primary key constraints
  if (column.primaryKey && column.nullable) {
    throw new ValidationError(`Primary key column '${fieldName}' cannot be nullable`, fieldName);
  }

  // Validate auto increment
  if (column.autoIncrement) {
    const validTypes = [
      DataType.UInt8,
      DataType.UInt16,
      DataType.UInt32,
      DataType.UInt64,
      DataType.Int8,
      DataType.Int16,
      DataType.Int32,
      DataType.Int64,
    ];
    if (!validTypes.includes(column.type)) {
      throw new ValidationError(
        `Auto increment is only supported for integer types, but column '${fieldName}' is ${column.type}`,
        fieldName
      );
    }
  }
}

/**
 * Validate data against schema
 */
export function validateData<T extends SchemaDefinition>(
  data: Record<string, unknown>,
  schema: T
): void {
  // Check for unknown fields
  const schemaFields = new Set(Object.keys(schema));
  const dataFields = Object.keys(data);

  for (const field of dataFields) {
    if (!schemaFields.has(field)) {
      throw new ValidationError(`Unknown field '${field}'`, field, data[field]);
    }
  }

  // Validate each field
  for (const [fieldName, column] of Object.entries(schema)) {
    const value = data[fieldName];

    // Check required fields
    if (value === undefined || value === null) {
      if (!column.nullable && column.default === undefined && !column.autoIncrement) {
        throw new ValidationError(`Field '${fieldName}' is required`, fieldName, value, 'required');
      }
      continue;
    }

    // Type validation
    if (!validateValue(value, column)) {
      throw new ValidationError(
        `Invalid value for field '${fieldName}': expected ${column.type}`,
        fieldName,
        value,
        'type'
      );
    }

    // Additional validations
    if (column.unique && value !== null && value !== undefined) {
      // Unique constraint validation would require database check
      // This is just a placeholder for the validation structure
    }
  }
}

/**
 * Validate partial data for updates
 */
export function validatePartialData<T extends SchemaDefinition>(
  data: Record<string, unknown>,
  schema: T
): void {
  // Check for unknown fields
  const schemaFields = new Set(Object.keys(schema));
  const dataFields = Object.keys(data);

  for (const field of dataFields) {
    if (!schemaFields.has(field)) {
      throw new ValidationError(`Unknown field '${field}'`, field, data[field]);
    }
  }

  // Validate provided fields
  for (const [fieldName, value] of Object.entries(data)) {
    const column = schema[fieldName];
    if (!column) continue;

    // Primary key updates should be restricted
    if (column.primaryKey) {
      throw new ValidationError(
        `Cannot update primary key field '${fieldName}'`,
        fieldName,
        value,
        'primaryKey'
      );
    }

    // Type validation (skip null/undefined as they're allowed in updates)
    if (value !== null && value !== undefined) {
      if (!validateValue(value, column)) {
        throw new ValidationError(
          `Invalid value for field '${fieldName}': expected ${column.type}`,
          fieldName,
          value,
          'type'
        );
      }
    }
  }
}

/**
 * Check if string is a valid SQL identifier
 */
export function isValidIdentifier(identifier: string): boolean {
  // Must start with letter or underscore
  // Can contain letters, numbers, and underscores
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier);
}

/**
 * Validate table name
 */
export function validateTableName(tableName: string): void {
  if (!tableName || typeof tableName !== 'string') {
    throw new ValidationError('Table name must be a non-empty string');
  }

  if (!isValidIdentifier(tableName)) {
    throw new ValidationError(
      `Invalid table name '${tableName}'. Table names must start with a letter or underscore and contain only alphanumeric characters and underscores.`
    );
  }

  if (tableName.length > 64) {
    throw new ValidationError(
      `Table name '${tableName}' is too long. Maximum length is 64 characters.`
    );
  }
}

/**
 * Validate query options
 */
export function validateQueryOptions(options: {
  limit?: number;
  offset?: number;
  timeout?: number;
}): void {
  if (options.limit !== undefined) {
    if (!Number.isInteger(options.limit) || options.limit < 0) {
      throw new ValidationError('Limit must be a non-negative integer', 'limit', options.limit);
    }
  }

  if (options.offset !== undefined) {
    if (!Number.isInteger(options.offset) || options.offset < 0) {
      throw new ValidationError('Offset must be a non-negative integer', 'offset', options.offset);
    }
  }

  if (options.timeout !== undefined) {
    if (!Number.isInteger(options.timeout) || options.timeout <= 0) {
      throw new ValidationError('Timeout must be a positive integer', 'timeout', options.timeout);
    }
  }
}

/**
 * Validate WHERE condition values
 */
export function validateWhereCondition(condition: unknown): void {
  if (condition === null || condition === undefined) {
    return;
  }

  if (typeof condition !== 'object') {
    return; // Primitive values are valid
  }

  // Check for valid operators
  const validOperators = [
    'eq',
    'ne',
    'gt',
    'gte',
    'lt',
    'lte',
    'in',
    'notIn',
    'like',
    'notLike',
    'ilike',
    'between',
    'isNull',
    'notNull',
  ];

  const keys = Object.keys(condition);

  for (const key of keys) {
    if (key === 'and' || key === 'or' || key === 'not') {
      continue; // Logical operators
    }

    if (!validOperators.includes(key) && !isValidIdentifier(key)) {
      throw new ValidationError(
        `Invalid WHERE condition operator or field: '${key}'`,
        key,
        condition
      );
    }
  }
}

/**
 * Sanitize user input to prevent injection
 */
export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') {
    return String(input);
  }

  // Remove null bytes
  return input.replace(/\0/g, '');
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate UUID format
 */
export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Validate IPv4 address
 */
export function isValidIPv4(ip: string): boolean {
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!ipv4Regex.test(ip)) {
    return false;
  }

  const parts = ip.split('.').map(Number);
  return parts.every((part) => part >= 0 && part <= 255);
}

/**
 * Validate IPv6 address
 */
export function isValidIPv6(ip: string): boolean {
  const ipv6Regex =
    /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
  return ipv6Regex.test(ip);
}

/**
 * Validate URL format
 */
export function isValidURL(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Create a custom validation rule
 */
export function createValidationRule(
  validate: (value: unknown) => boolean,
  message: string
): ValidationRule {
  return { validate, message };
}

/**
 * Apply custom validation rules
 */
export function applyValidationRules(
  value: unknown,
  rules: ValidationRule[],
  fieldName?: string
): void {
  for (const rule of rules) {
    if (!rule.validate(value)) {
      throw new ValidationError(rule.message, fieldName, value, 'custom');
    }
  }
}

/**
 * Validate range
 */
export function validateRange(value: number, min: number, max: number, fieldName?: string): void {
  if (value < min || value > max) {
    throw new ValidationError(`Value must be between ${min} and ${max}`, fieldName, value, 'range');
  }
}

/**
 * Validate length
 */
export function validateLength(value: string, min: number, max: number, fieldName?: string): void {
  if (value.length < min || value.length > max) {
    throw new ValidationError(
      `Length must be between ${min} and ${max} characters`,
      fieldName,
      value,
      'length'
    );
  }
}

/**
 * Validate pattern
 */
export function validatePattern(value: string, pattern: RegExp, fieldName?: string): void {
  if (!pattern.test(value)) {
    throw new ValidationError(
      `Value does not match required pattern: ${pattern}`,
      fieldName,
      value,
      'pattern'
    );
  }
}
