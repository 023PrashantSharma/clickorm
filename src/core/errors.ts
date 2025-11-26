/**
 * Custom error classes for ClickORM
 * Provides meaningful error messages and proper error handling
 */

/**
 * Base error class for all ClickORM errors
 * Extends native Error with additional context
 */
export class ClickORMError extends Error {
  public readonly code: string;
  public readonly context?: Record<string, unknown>;

  constructor(message: string, code: string, context?: Record<string, unknown>) {
    super(message);
    this.name = 'ClickORMError';
    this.code = code;
    this.context = context;

    // Maintains proper stack trace for where error was thrown (V8 only)
    if ('captureStackTrace' in Error && typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, this.constructor);
    }

    // Set the prototype explicitly to maintain instanceof checks
    Object.setPrototypeOf(this, ClickORMError.prototype);
  }

  /**
   * Serialize error to JSON
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      stack: this.stack,
    };
  }
}

/**
 * Connection errors
 * Thrown when database connection fails
 */
export class ConnectionError extends ClickORMError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'CONNECTION_ERROR', context);
    this.name = 'ConnectionError';
    Object.setPrototypeOf(this, ConnectionError.prototype);
  }
}

/**
 * Query errors
 * Thrown when query execution fails
 */
export class QueryError extends ClickORMError {
  public readonly query?: string;
  public readonly params?: unknown[];

  constructor(
    message: string,
    query?: string,
    params?: unknown[],
    context?: Record<string, unknown>
  ) {
    super(message, 'QUERY_ERROR', { ...context, query, params });
    this.name = 'QueryError';
    this.query = query;
    this.params = params;
    Object.setPrototypeOf(this, QueryError.prototype);
  }
}

/**
 * Validation errors
 * Thrown when data validation fails
 */
export class ValidationError extends ClickORMError {
  public readonly field?: string;
  public readonly value?: unknown;
  public readonly constraint?: string;

  constructor(
    message: string,
    field?: string,
    value?: unknown,
    constraint?: string,
    context?: Record<string, unknown>
  ) {
    super(message, 'VALIDATION_ERROR', { ...context, field, value, constraint });
    this.name = 'ValidationError';
    this.field = field;
    this.value = value;
    this.constraint = constraint;
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Schema errors
 * Thrown when schema definition or manipulation fails
 */
export class SchemaError extends ClickORMError {
  public readonly tableName?: string;
  public readonly columnName?: string;

  constructor(
    message: string,
    tableName?: string,
    columnName?: string,
    context?: Record<string, unknown>
  ) {
    super(message, 'SCHEMA_ERROR', { ...context, tableName, columnName });
    this.name = 'SchemaError';
    this.tableName = tableName;
    this.columnName = columnName;
    Object.setPrototypeOf(this, SchemaError.prototype);
  }
}

/**
 * Type mapping errors
 * Thrown when type conversion fails
 */
export class TypeMappingError extends ClickORMError {
  public readonly sourceType?: string;
  public readonly targetType?: string;
  public readonly value?: unknown;

  constructor(
    message: string,
    sourceType?: string,
    targetType?: string,
    value?: unknown,
    context?: Record<string, unknown>
  ) {
    super(message, 'TYPE_MAPPING_ERROR', { ...context, sourceType, targetType, value });
    this.name = 'TypeMappingError';
    this.sourceType = sourceType;
    this.targetType = targetType;
    this.value = value;
    Object.setPrototypeOf(this, TypeMappingError.prototype);
  }
}

/**
 * Model errors
 * Thrown when model operations fail
 */
export class ModelError extends ClickORMError {
  public readonly modelName?: string;

  constructor(message: string, modelName?: string, context?: Record<string, unknown>) {
    super(message, 'MODEL_ERROR', { ...context, modelName });
    this.name = 'ModelError';
    this.modelName = modelName;
    Object.setPrototypeOf(this, ModelError.prototype);
  }
}

/**
 * Relation errors
 * Thrown when relation operations fail
 */
export class RelationError extends ClickORMError {
  public readonly sourceModel?: string;
  public readonly targetModel?: string;
  public readonly relationType?: string;

  constructor(
    message: string,
    sourceModel?: string,
    targetModel?: string,
    relationType?: string,
    context?: Record<string, unknown>
  ) {
    super(message, 'RELATION_ERROR', { ...context, sourceModel, targetModel, relationType });
    this.name = 'RelationError';
    this.sourceModel = sourceModel;
    this.targetModel = targetModel;
    this.relationType = relationType;
    Object.setPrototypeOf(this, RelationError.prototype);
  }
}

/**
 * Transaction errors
 * Thrown when transaction operations fail
 */
export class TransactionError extends ClickORMError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'TRANSACTION_ERROR', context);
    this.name = 'TransactionError';
    Object.setPrototypeOf(this, TransactionError.prototype);
  }
}

/**
 * Migration errors
 * Thrown when migration operations fail
 */
export class MigrationError extends ClickORMError {
  public readonly migrationName?: string;

  constructor(message: string, migrationName?: string, context?: Record<string, unknown>) {
    super(message, 'MIGRATION_ERROR', { ...context, migrationName });
    this.name = 'MigrationError';
    this.migrationName = migrationName;
    Object.setPrototypeOf(this, MigrationError.prototype);
  }
}

/**
 * Not found errors
 * Thrown when requested resource is not found
 */
export class NotFoundError extends ClickORMError {
  public readonly resourceType?: string;
  public readonly identifier?: unknown;

  constructor(
    message: string,
    resourceType?: string,
    identifier?: unknown,
    context?: Record<string, unknown>
  ) {
    super(message, 'NOT_FOUND_ERROR', { ...context, resourceType, identifier });
    this.name = 'NotFoundError';
    this.resourceType = resourceType;
    this.identifier = identifier;
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

/**
 * Configuration errors
 * Thrown when configuration is invalid or missing
 */
export class ConfigurationError extends ClickORMError {
  public readonly configKey?: string;

  constructor(message: string, configKey?: string, context?: Record<string, unknown>) {
    super(message, 'CONFIGURATION_ERROR', { ...context, configKey });
    this.name = 'ConfigurationError';
    this.configKey = configKey;
    Object.setPrototypeOf(this, ConfigurationError.prototype);
  }
}

/**
 * Timeout errors
 * Thrown when operation exceeds timeout limit
 */
export class TimeoutError extends ClickORMError {
  public readonly timeout?: number;
  public readonly operation?: string;

  constructor(
    message: string,
    timeout?: number,
    operation?: string,
    context?: Record<string, unknown>
  ) {
    super(message, 'TIMEOUT_ERROR', { ...context, timeout, operation });
    this.name = 'TimeoutError';
    this.timeout = timeout;
    this.operation = operation;
    Object.setPrototypeOf(this, TimeoutError.prototype);
  }
}

/**
 * Constraint violation errors
 * Thrown when database constraints are violated
 */
export class ConstraintViolationError extends ClickORMError {
  public readonly constraintType?: string;
  public readonly constraintName?: string;

  constructor(
    message: string,
    constraintType?: string,
    constraintName?: string,
    context?: Record<string, unknown>
  ) {
    super(message, 'CONSTRAINT_VIOLATION_ERROR', { ...context, constraintType, constraintName });
    this.name = 'ConstraintViolationError';
    this.constraintType = constraintType;
    this.constraintName = constraintName;
    Object.setPrototypeOf(this, ConstraintViolationError.prototype);
  }
}

/**
 * Duplicate key errors
 * Thrown when unique constraint is violated
 */
export class DuplicateKeyError extends ConstraintViolationError {
  public readonly key?: string;
  public readonly value?: unknown;

  constructor(message: string, key?: string, value?: unknown, context?: Record<string, unknown>) {
    super(message, 'UNIQUE', key, { ...context, key, value });
    this.name = 'DuplicateKeyError';
    this.key = key;
    this.value = value;
    Object.setPrototypeOf(this, DuplicateKeyError.prototype);
  }
}

/**
 * SQL injection attempt error
 * Thrown when potential SQL injection is detected
 */
export class SQLInjectionError extends ClickORMError {
  public readonly suspiciousInput?: string;

  constructor(message: string, suspiciousInput?: string, context?: Record<string, unknown>) {
    super(message, 'SQL_INJECTION_ERROR', { ...context, suspiciousInput });
    this.name = 'SQLInjectionError';
    this.suspiciousInput = suspiciousInput;
    Object.setPrototypeOf(this, SQLInjectionError.prototype);
  }
}

/**
 * Type guard to check if error is a ClickORM error
 */
export function isClickORMError(error: unknown): error is ClickORMError {
  return error instanceof ClickORMError;
}

/**
 * Type guard to check if error is a specific ClickORM error type
 */
export function isErrorOfType<T extends ClickORMError>(
  error: unknown,
  errorClass: new (..._args: never[]) => T
): error is T {
  return error instanceof errorClass;
}

/**
 * Error handler utility
 * Wraps async operations with proper error handling
 */
export async function handleError<T>(
  operation: () => Promise<T>,
  errorHandler?: (_error: unknown) => ClickORMError
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (errorHandler) {
      throw errorHandler(error);
    }
    if (isClickORMError(error)) {
      throw error;
    }
    // Wrap unknown errors
    throw new ClickORMError(
      error instanceof Error ? error.message : String(error),
      'UNKNOWN_ERROR',
      { originalError: error }
    );
  }
}

/**
 * Format error for logging
 */
export function formatError(error: unknown): string {
  if (isClickORMError(error)) {
    const parts = [
      `[${error.code}] ${error.message}`,
      error.context ? `Context: ${JSON.stringify(error.context, null, 2)}` : null,
      error.stack,
    ].filter(Boolean);
    return parts.join('\n');
  }

  if (error instanceof Error) {
    return `[ERROR] ${error.message}\n${error.stack}`;
  }

  return `[UNKNOWN] ${String(error)}`;
}

/**
 * Assert helper that throws ValidationError
 */
export function assert(
  condition: boolean,
  message: string,
  field?: string,
  value?: unknown
): asserts condition {
  if (!condition) {
    throw new ValidationError(message, field, value);
  }
}

/**
 * Require helper that throws if value is null/undefined
 */
export function requireValue<T>(
  value: T | null | undefined,
  fieldName: string
): asserts value is T {
  if (value === null || value === undefined) {
    throw new ValidationError(`${fieldName} is required`, fieldName, value);
  }
}
