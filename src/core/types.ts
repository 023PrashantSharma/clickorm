/**
 * Core type utilities and inference helpers for ClickORM
 * Provides comprehensive type safety and inference throughout the library
 */
import { ValidationError } from './errors.js';
/**
 * ClickHouse data types enumeration
 * Maps to native ClickHouse column types
 */
export enum DataType {
  // Integer types
  UInt8 = 'UInt8',
  UInt16 = 'UInt16',
  UInt32 = 'UInt32',
  UInt64 = 'UInt64',
  Int8 = 'Int8',
  Int16 = 'Int16',
  Int32 = 'Int32',
  Int64 = 'Int64',

  // Floating point types
  Float32 = 'Float32',
  Float64 = 'Float64',
  Decimal = 'Decimal',

  // String types
  String = 'String',
  FixedString = 'FixedString',

  // Date and time types
  Date = 'Date',
  Date32 = 'Date32',
  DateTime = 'DateTime',
  DateTime64 = 'DateTime64',

  // Boolean type
  Boolean = 'Boolean',

  // UUID type
  UUID = 'UUID',

  // Enum types
  Enum8 = 'Enum8',
  Enum16 = 'Enum16',

  // Complex types
  Array = 'Array',
  Tuple = 'Tuple',
  Map = 'Map',
  Nested = 'Nested',
  JSON = 'JSON',

  // Special types
  Nullable = 'Nullable',
  LowCardinality = 'LowCardinality',
  IPv4 = 'IPv4',
  IPv6 = 'IPv6',
}

/**
 * Column definition interface
 * Defines the structure of a column in a table schema
 */
export interface ColumnDefinition<T = unknown> {
  type: DataType;
  nullable?: boolean;
  primaryKey?: boolean;
  unique?: boolean;
  default?: T | (() => T);
  autoIncrement?: boolean;
  comment?: string;
  // For complex types
  elementType?: DataType;
  precision?: number;
  scale?: number;
  length?: number;
  enumValues?: readonly string[];
}

/**
 * Schema definition type
 * Defines the structure of a table schema using column definitions
 */
export type SchemaDefinition = {
  [columnName: string]: ColumnDefinition;
};

/**
 * Maps ClickHouse data types to TypeScript types
 * Core type mapping for type inference
 */
export type MapClickHouseToTS<T extends DataType> = T extends
  | DataType.UInt8
  | DataType.UInt16
  | DataType.UInt32
  | DataType.Int8
  | DataType.Int16
  | DataType.Int32
  ? number
  : T extends DataType.UInt64 | DataType.Int64
    ? bigint | number // Allow both for flexibility
    : T extends DataType.Float32 | DataType.Float64 | DataType.Decimal
      ? number
      : T extends DataType.String | DataType.FixedString
        ? string
        : T extends DataType.Boolean
          ? boolean
          : T extends DataType.Date | DataType.Date32 | DataType.DateTime | DataType.DateTime64
            ? Date
            : T extends DataType.UUID
              ? string
              : T extends DataType.Enum8 | DataType.Enum16
                ? string
                : T extends DataType.Array
                  ? unknown[]
                  : T extends DataType.Tuple
                    ? unknown[]
                    : T extends DataType.Map
                      ? Record<string, unknown>
                      : T extends DataType.JSON
                        ? Record<string, unknown>
                        : T extends DataType.IPv4 | DataType.IPv6
                          ? string
                          : unknown;

/**
 * Infer the TypeScript type from a column definition
 * Handles nullable columns and default values
 */
export type InferColumnType<T extends ColumnDefinition> = T['nullable'] extends true
  ? MapClickHouseToTS<T['type']> | null
  : MapClickHouseToTS<T['type']>;

/**
 * Infer the full model type from a schema definition
 * Converts schema definition to TypeScript interface
 */
export type InferModel<T extends SchemaDefinition> = {
  -readonly [K in keyof T]: InferColumnType<T[K]>;
};

/**
 * Extract only required fields from a model
 * Fields without default values and non-nullable
 */
export type RequiredFields<T extends SchemaDefinition> = {
  [K in keyof T as T[K]['default'] extends undefined
    ? T[K]['nullable'] extends true
      ? never
      : K
    : never]: InferColumnType<T[K]>;
};

/**
 * Extract only optional fields from a model
 * Fields with default values or nullable
 */
export type OptionalFields<T extends SchemaDefinition> = {
  [K in keyof T as T[K]['default'] extends undefined
    ? T[K]['nullable'] extends true
      ? K
      : never
    : K]?: InferColumnType<T[K]>;
};

/**
 * Create input type for insert operations
 * Combines required and optional fields
 */
export type CreateInput<T extends SchemaDefinition> = RequiredFields<T> & OptionalFields<T>;

/**
 * Update input type - all fields optional
 */
export type UpdateInput<T extends SchemaDefinition> = Partial<InferModel<T>>;

/**
 * WHERE clause operators for type-safe queries
 */
export type WhereOperators<T> = {
  eq?: T;
  ne?: T;
  gt?: T;
  gte?: T;
  lt?: T;
  lte?: T;
  in?: T[];
  notIn?: T[];
  like?: T extends string ? string : never;
  notLike?: T extends string ? string : never;
  ilike?: T extends string ? string : never;
  between?: [T, T];
  isNull?: boolean;
  notNull?: boolean;
};

/**
 * Raw SQL expression type
 * Allows escape hatch for complex queries while maintaining type safety
 */
export interface RawExpression {
  readonly _brand: 'RawExpression';
  readonly sql: string;
  readonly values?: unknown[];
}

/**
 * WHERE condition builder type
 * Supports field conditions, operators, and logical combinations
 * Also supports MongoDB-style operators ($and, $or, $not) for compatibility
 */
export type WhereCondition<T> = {
  [K in keyof T]?: T[K] | WhereOperators<T[K]> | RawExpression;
} & {
  and?: WhereCondition<T>[];
  or?: WhereCondition<T>[];
  not?: WhereCondition<T>;
  $and?: WhereCondition<T>[];
  $or?: WhereCondition<T>[];
  $not?: WhereCondition<T>;
};

/**
 * SELECT field selection types
 * Enables type-safe field selection with proper inference
 */
export type SelectFields<T, K> = K extends '*'
  ? T
  : K extends keyof T
    ? Pick<T, K>
    : K extends readonly (keyof T)[]
      ? Pick<T, K[number]>
      : never;

/**
 * Aggregation function types
 */
export type AggregateFunction = 'COUNT' | 'SUM' | 'AVG' | 'MIN' | 'MAX' | 'MEDIAN' | 'STDDEV';

/**
 * Aggregate field definition
 */
export interface AggregateField<T, K extends keyof T = keyof T> {
  fn: AggregateFunction;
  field: K | '*';
  alias?: string;
  distinct?: boolean;
}

/**
 * Aggregate result type inference
 */
export type AggregateResult<T, A extends Record<string, AggregateField<T>>> = {
  [K in keyof A]: A[K]['fn'] extends 'COUNT' ? number : number;
};

/**
 * ORDER BY direction
 */
export type OrderDirection = 'ASC' | 'DESC';

/**
 * ORDER BY clause type
 */
export type OrderByClause<T> = {
  [K in keyof T]?: OrderDirection;
} & {
  _raw?: RawExpression;
};

/**
 * GROUP BY clause type
 */
export type GroupByClause<T> = keyof T | (keyof T)[] | RawExpression;

/**
 * JOIN types
 */
export type JoinType = 'INNER' | 'LEFT' | 'RIGHT' | 'FULL' | 'CROSS';

/**
 * JOIN clause definition
 */
export interface JoinClause {
  type: JoinType;
  table: string;
  on: string | RawExpression;
  alias?: string;
}

/**
 * Query options for execution
 */
export interface QueryOptions {
  timeout?: number;
  maxRows?: number;
  format?: 'JSONEachRow' | 'JSON' | 'CSV' | 'TabSeparated';
  readonly?: boolean;
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  limit?: number;
  offset?: number;
  page?: number;
  pageSize?: number;
}

/**
 * Transaction isolation levels (if supported by ClickHouse)
 */
export enum IsolationLevel {
  ReadUncommitted = 'READ UNCOMMITTED',
  ReadCommitted = 'READ COMMITTED',
  RepeatableRead = 'REPEATABLE READ',
  Serializable = 'SERIALIZABLE',
}

/**
 * Window function types
 */
export type WindowFunction =
  | 'ROW_NUMBER'
  | 'RANK'
  | 'DENSE_RANK'
  | 'LAG'
  | 'LEAD'
  | 'FIRST_VALUE'
  | 'LAST_VALUE';

/**
 * Window function definition
 */
export interface WindowFunctionDef<T> {
  fn: WindowFunction;
  partitionBy?: keyof T | (keyof T)[];
  orderBy?: OrderByClause<T>;
  alias?: string;
}

/**
 * Relation types for ORM associations
 */
export enum RelationType {
  BelongsTo = 'BelongsTo',
  HasOne = 'HasOne',
  HasMany = 'HasMany',
  ManyToMany = 'ManyToMany',
}

/**
 * Relation definition
 */
export interface RelationDefinition<T, R> {
  type: RelationType;
  target: string; // Target model name
  foreignKey: keyof T | keyof R;
  targetKey?: keyof R;
  as: string; // Alias for the relation
  through?: string; // For many-to-many
}

/**
 * Include options for eager loading
 */
export type IncludeOptions = {
  /** Association alias */
  as: string;
  /** Where conditions for the included model */
  where?: Record<string, unknown>;
  /** Attributes to select from included model */
  attributes?: string[] | { include?: string[]; exclude?: string[] };
  /** Nested includes */
  include?: IncludeOptions[];
  /** Eager load this relation (currently uses separate queries regardless) */
  eager?: boolean;
  /** Model name (optional) */
  model?: string;
  /** Required (INNER JOIN) vs optional (LEFT JOIN) */
  required?: boolean;
  /** Separate query for has-many */
  separate?: boolean;
};

/**
 * Utility type to extract keys of a specific type
 */
export type KeysOfType<T, V> = {
  [K in keyof T]: T[K] extends V ? K : never;
}[keyof T];

/**
 * Utility type for deep partial
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Utility type for readonly deep
 */
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

/**
 * Extract non-nullable type
 */
export type NonNullable<T> = T extends null | undefined ? never : T;

/**
 * Make specific keys required
 */
export type RequireKeys<T, K extends keyof T> = T & Required<Pick<T, K>>;

/**
 * Make specific keys optional
 */
export type OptionalKeys<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Type guard helper
 */
export function isRawExpression(value: unknown): value is RawExpression {
  return (
    typeof value === 'object' &&
    value !== null &&
    '_brand' in value &&
    (value as RawExpression)._brand === 'RawExpression'
  );
}

/**
 * Type predicate for checking if value is a valid where operator
 */
export function isWhereOperator<T>(value: unknown): value is WhereOperators<T> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const validKeys = [
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
  return Object.keys(value).some((key) => validKeys.includes(key));
}

/**
 * Branded type for SQL identifiers (prevents SQL injection)
 */
export interface SQLIdentifier {
  readonly _brand: 'SQLIdentifier';
  readonly value: string;
}

/**
 * Create a safe SQL identifier
 */
export function createSQLIdentifier(value: string): SQLIdentifier {
  // Basic validation - no special characters except underscore
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) {
    throw new ValidationError( // ✅ Correct
      `Invalid SQL identifier: ${value}`,
      'identifier',
      value
    );
  }
  return { _brand: 'SQLIdentifier', value };
}

/**
 * Migration interface
 */
export interface Migration {
  name: string;
  timestamp: number;
  up: () => Promise<void>;
  down: () => Promise<void>;
}

/**
 * Schema diff result
 */
export interface SchemaDiff {
  type: 'create' | 'alter' | 'drop';
  table: string;
  changes: string[];
}

/**
 * Query result metadata
 */
export interface QueryMetadata {
  rows: number;
  duration: number;
  bytesRead: number;
}

/**
 * Batch insert options
 */
export interface BatchInsertOptions {
  batchSize?: number;
  parallel?: boolean;
  onProgress?: (inserted: number, total: number) => void;
  onError?: (error: Error, batch: unknown[]) => void;
}

/**
 * Stream options
 */
export interface StreamOptions {
  highWaterMark?: number;
  encoding?:
    | 'utf8'
    | 'ascii'
    | 'utf-8'
    | 'utf16le'
    | 'ucs2'
    | 'ucs-2'
    | 'base64'
    | 'latin1'
    | 'binary'
    | 'hex';
}

/**
 * Query execution options (Sequelize-style)
 */
export interface QueryExecutionOptions {
  /** Transaction context */
  transaction?: unknown;
  /** Enable logging for this query */
  logging?: boolean;
  /** Raw query mode */
  raw?: boolean;
  /** Nest results */
  nest?: boolean;
  /** Plain output */
  plain?: boolean;
  /** Timeout in milliseconds */
  timeout?: number;
}

/**
 * Find options (Sequelize-style)
 */
export interface FindOptions<T = unknown> extends QueryExecutionOptions {
  /** WHERE conditions */
  where?: WhereCondition<T>;
  /** Attributes to select */
  attributes?: string[] | { include?: string[]; exclude?: string[] };
  /** LIMIT */
  limit?: number;
  /** OFFSET */
  offset?: number;
  /** ORDER BY */
  order?: Array<[string, 'ASC' | 'DESC']> | string;
  /** GROUP BY */
  group?: string | string[];
  /** HAVING clause */
  having?: WhereCondition<T>;
  /** Include options for eager loading */
  include?: IncludeOptions[];
  /** Subquery mode */
  subQuery?: boolean;
  /** Distinct */
  distinct?: boolean;
  /** Run hooks */
  hooks?: boolean;
}

/**
 * Create options (Sequelize-style)
 */
export interface CreateOptions extends QueryExecutionOptions {
  /** Fields to insert */
  fields?: string[];
  /** Validate before insert */
  validate?: boolean;
  /** Return inserted record */
  returning?: boolean;
  /** Ignore duplicates */
  ignoreDuplicates?: boolean;
  /** Update on duplicate */
  updateOnDuplicate?: string[];
  /** Run hooks */
  hooks?: boolean;
}

/**
 * Bulk create options
 */
export interface BulkCreateOptions extends CreateOptions {
  /** Individual hooks for each instance */
  individualHooks?: boolean;
}

/**
 * Update options (Sequelize-style)
 */
export interface UpdateOptions extends QueryExecutionOptions {
  /** WHERE conditions */
  where?: WhereCondition<unknown>;
  /** Fields to update */
  fields?: string[];
  /** Validate before update */
  validate?: boolean;
  /** Return updated records */
  returning?: boolean;
  /** LIMIT */
  limit?: number;
  /** Side effects */
  sideEffects?: boolean;
  /** Individual hooks for each instance */
  individualHooks?: boolean;
  /** Run hooks */
  hooks?: boolean;
}

/**
 * Destroy/Delete options (Sequelize-style)
 */
export interface DestroyOptions<T = unknown> extends QueryExecutionOptions {
  /** WHERE conditions */
  where?: WhereCondition<T>;
  /** Force delete (bypass soft delete) */
  force?: boolean;
  /** LIMIT */
  limit?: number;
  /** Individual hooks for each instance */
  individualHooks?: boolean;
  /** Run hooks */
  hooks?: boolean;
  /** Truncate table instead */
  truncate?: boolean;
  /** Cascade delete */
  cascade?: boolean;
}

/**
 * Count options
 */
export interface CountOptions<T = unknown> extends QueryExecutionOptions {
  /** WHERE conditions */
  where?: WhereCondition<T>;
  /** Distinct count */
  distinct?: boolean;
  /** Column to count */
  col?: string;
}
