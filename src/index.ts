/**
 * ClickORM - Type-Safe ORM for ClickHouse
 * Public API exports
 * @version 0.1.5 - Added findOneAndUpdate method
 */

// Core exports
export { ClickORMClient, createClickORMClient } from './core/client.js';
export type { ClickORMClientConfig } from './core/client.js';

export { Model, createModel } from './core/model.js';

// Hooks exports
export { HookType, createHookManager } from './core/hooks.js';
export type { HookManager, HookCallback, HookOptions } from './core/hooks.js';

export { TableSchema, SchemaBuilder, createSchema, defineSchema, column } from './core/schema.js';

export {
  DataType,
  type ColumnDefinition,
  type SchemaDefinition,
  type InferModel,
  type CreateInput,
  type UpdateInput,
  type WhereCondition,
  type WhereOperators,
  type RawExpression,
  type SelectFields,
  type AggregateFunction,
  type AggregateField,
  type AggregateResult,
  type OrderDirection,
  type OrderByClause,
  type GroupByClause,
  type JoinType,
  type JoinClause,
  type QueryOptions,
  type PaginationOptions,
  type RelationType,
  type RelationDefinition,
  type IncludeOptions,
  isRawExpression,
  isWhereOperator,
  createSQLIdentifier,
  type SQLIdentifier,
  type CreateOptions,
  type BulkCreateOptions,
  type UpdateOptions,
  type DestroyOptions,
  type FindOptions,
  type CountOptions,
  type QueryExecutionOptions,
} from './core/types.js';

// Error exports
export {
  ClickORMError,
  ConnectionError,
  QueryError,
  ValidationError,
  SchemaError,
  TypeMappingError,
  ModelError,
  RelationError,
  TransactionError,
  MigrationError,
  NotFoundError,
  ConfigurationError,
  TimeoutError,
  ConstraintViolationError,
  DuplicateKeyError,
  SQLInjectionError,
  isClickORMError,
  isErrorOfType,
  handleError,
  formatError,
  assert,
  requireValue,
} from './core/errors.js';

// Relations exports
export {
  RelationBuilder,
  RelationRegistry,
  Association,
  createRelationBuilder,
  type RelationOptions,
  type RelationDefinitionInternal,
  type IncludeOption,
} from './core/relations.js';

// Common utilities
export { normalizeArray } from './utils/common.js';

// Logging exports
export {
  Logger,
  LogLevel,
  createLogger,
  defaultLogger,
  debug,
  info,
  warn,
  error,
} from './utils/logger.js';

// SQL Builder exports
export {
  SQLBuilder,
  createSQLBuilder,
  buildSelect,
  buildInsert,
  buildUpdate,
  buildDelete,
  raw,
  escapeString,
  buildCreateTable,
  buildDropTable,
} from './utils/sql-builder.js';

// Type Mapper exports
export {
  getClickHouseType,
  toClickHouseValue,
  fromClickHouseValue,
  validateValue,
  inferClickHouseType,
  getDefaultValue,
  areTypesCompatible,
} from './utils/type-mapper.js';

// Validator exports
export {
  validateSchema,
  validateColumnDefinition,
  validateData,
  validatePartialData,
  isValidIdentifier,
  validateTableName,
  validateQueryOptions,
  validateWhereCondition,
  sanitizeInput,
  isValidEmail,
  isValidUUID,
  isValidIPv4,
  isValidIPv6,
  isValidURL,
  type ValidationRule,
  createValidationRule,
  applyValidationRules,
  validateRange,
  validateLength,
  validatePattern,
} from './utils/validator.js';

// WHERE clause builder exports
export {
  WhereBuilder,
  buildWhereClause,
  eq,
  ne,
  gt,
  gte,
  lt,
  lte,
  inArray,
  notIn,
  like,
  notLike,
  ilike,
  between,
  isNull,
  isNotNull,
  and,
  or,
  not,
  // MongoDB-style operators for compatibility
  $and,
  $or,
  $not,
} from './query/where.js';

// Re-export commonly used types for convenience
export type {
  // Schema types
  ColumnDefinition as Column,
  SchemaDefinition as Schema,

  // Query types
  WhereCondition as Where,
  WhereOperators as Operators,

  // Result types
  InferModel as Infer,
  CreateInput as Create,
  UpdateInput as Update,
} from './core/types.js';

// Version
export const VERSION = '0.1.5';
