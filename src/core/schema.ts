/**
 * Schema definition and validation for ClickORM
 * Handles table schema creation, validation, and management
 */

import { ColumnDefinition, SchemaDefinition, DataType, InferModel, CreateInput } from './types.js';
import { SchemaError } from './errors.js';
import { validateSchema, validateColumnDefinition, validateTableName } from '../utils/validator.js';
import { getClickHouseType } from '../utils/type-mapper.js';

/**
 * Table schema class
 * Represents a database table schema with type-safe operations
 */
export class TableSchema<T extends SchemaDefinition> {
  public readonly name: string;
  public readonly schema: T;
  private readonly columnNames: string[];
  private readonly primaryKeyColumn?: string;

  constructor(name: string, schema: T) {
    validateTableName(name);
    validateSchema(schema);

    this.name = name;
    this.schema = schema;
    this.columnNames = Object.keys(schema);

    // Find primary key
    const primaryKeys = this.columnNames.filter((col) => schema[col]?.primaryKey);
    if (primaryKeys.length > 0) {
      this.primaryKeyColumn = primaryKeys[0];
    }
  }

  /**
   * Get all column names
   */
  getColumnNames(): string[] {
    return [...this.columnNames];
  }

  /**
   * Get column definition
   */
  getColumn(name: string): ColumnDefinition | undefined {
    return this.schema[name];
  }

  /**
   * Get column list definition
   */
  getColumns(): Array<{ name: string; def: ColumnDefinition }> {
    return Object.entries(this.schema).map(([name, def]) => ({
      name,
      def,
    }));
  }

  /**
   * Check if column exists
   */
  hasColumn(name: string): boolean {
    return name in this.schema;
  }

  /**
   * Get primary key column name
   */
  getPrimaryKey(): string | undefined {
    return this.primaryKeyColumn;
  }

  /**
   * Get required columns (non-nullable without defaults)
   */
  getRequiredColumns(): string[] {
    return this.columnNames.filter((col) => {
      const column = this.schema[col];
      return (
        column &&
        !column.nullable &&
        column.default === undefined &&
        !column.autoIncrement &&
        !column.primaryKey
      );
    });
  }

  /**
   * Get optional columns (nullable or with defaults)
   */
  getOptionalColumns(): string[] {
    return this.columnNames.filter((col) => {
      const column = this.schema[col];
      return column && (column.nullable || column.default !== undefined || column.autoIncrement);
    });
  }

  /**
   * Generate CREATE TABLE SQL
   */
  toCreateTableSQL(options?: {
    engine?: string;
    orderBy?: string[];
    partitionBy?: string;
    ifNotExists?: boolean;
    settings?: Record<string, string | number | boolean>;
  }): string {
    const parts: string[] = [];

    // CREATE TABLE
    parts.push('CREATE TABLE');
    if (options?.ifNotExists) {
      parts.push('IF NOT EXISTS');
    }
    parts.push(`\`${this.name}\``);

    // Column definitions
    const columnDefs: string[] = [];
    for (const [colName, colDef] of Object.entries(this.schema)) {
      const colType = getClickHouseType(colDef);
      let def = `\`${colName}\` ${colType}`;

      if (colDef.comment) {
        def += ` COMMENT '${colDef.comment.replace(/'/g, "''")}'`;
      }

      columnDefs.push(def);
    }

    parts.push(`(\n  ${columnDefs.join(',\n  ')}\n)`);

    // ENGINE
    const engine = options?.engine || 'MergeTree()';
    parts.push(`ENGINE = ${engine}`);

    // ORDER BY (required for MergeTree)
    if (options?.orderBy && options.orderBy.length > 0) {
      const orderCols = options.orderBy.map((col) => `\`${col}\``).join(', ');
      parts.push(`ORDER BY (${orderCols})`);
    } else if (this.primaryKeyColumn) {
      parts.push(`ORDER BY \`${this.primaryKeyColumn}\``);
    } else {
      // Default ordering by first column
      parts.push(`ORDER BY \`${this.columnNames[0]!}\``);
    }

    // PARTITION BY
    if (options?.partitionBy) {
      parts.push(`PARTITION BY ${options.partitionBy}`);
    }

    // SETTINGS
    if (options?.settings && Object.keys(options.settings).length > 0) {
      const settings: string[] = [];
      for (const [key, value] of Object.entries(options.settings)) {
        const formattedValue = typeof value === 'string' ? `'${value}'` : value;
        settings.push(`${key} = ${formattedValue}`);
      }
      parts.push(`SETTINGS ${settings.join(', ')}`);
    }

    return parts.join('\n');
  }

  /**
   * Generate DROP TABLE SQL
   */
  toDropTableSQL(ifExists = false): string {
    const parts: string[] = ['DROP TABLE'];
    if (ifExists) {
      parts.push('IF EXISTS');
    }
    parts.push(`\`${this.name}\``);
    return parts.join(' ');
  }

  /**
   * Clone schema with modifications
   */
  clone(modifications?: Partial<T>): TableSchema<T> {
    const newSchema = { ...this.schema, ...modifications } as T;
    return new TableSchema(this.name, newSchema);
  }

  /**
   * Add a column to the schema
   */
  addColumn(name: string, definition: ColumnDefinition): TableSchema<T> {
    if (this.hasColumn(name)) {
      throw new SchemaError(
        `Column '${name}' already exists in table '${this.name}'`,
        this.name,
        name
      );
    }

    validateColumnDefinition(name, definition);

    const newSchema = {
      ...this.schema,
      [name]: definition,
    } as T;

    return new TableSchema(this.name, newSchema);
  }

  /**
   * Remove a column from the schema
   */
  removeColumn(name: string): TableSchema<T> {
    if (!this.hasColumn(name)) {
      throw new SchemaError(
        `Column '${name}' does not exist in table '${this.name}'`,
        this.name,
        name
      );
    }

    const newSchema = { ...this.schema };
    delete newSchema[name];

    return new TableSchema(this.name, newSchema as T);
  }

  /**
   * Modify a column definition
   */
  modifyColumn(name: string, definition: Partial<ColumnDefinition>): TableSchema<T> {
    if (!this.hasColumn(name)) {
      throw new SchemaError(
        `Column '${name}' does not exist in table '${this.name}'`,
        this.name,
        name
      );
    }

    const currentDef = this.schema[name]!;
    const newDef = { ...currentDef, ...definition };
    validateColumnDefinition(name, newDef);

    const newSchema = {
      ...this.schema,
      [name]: newDef,
    } as T;

    return new TableSchema(this.name, newSchema);
  }

  /**
   * Get column types as a map
   */
  getColumnTypes(): Record<string, DataType> {
    const types: Record<string, DataType> = {};
    for (const [name, def] of Object.entries(this.schema)) {
      types[name] = def.type;
    }
    return types;
  }

  /**
   * Get default values for all columns
   */
  getDefaults(): Partial<InferModel<T>> {
    const defaults: Record<string, unknown> = {};

    for (const [name, def] of Object.entries(this.schema)) {
      if (def.default !== undefined) {
        defaults[name] = typeof def.default === 'function' ? def.default() : def.default;
      }
    }

    return defaults as Partial<InferModel<T>>;
  }

  /**
   * Validate data against this schema
   */
  validate(data: unknown): data is CreateInput<T> {
    if (typeof data !== 'object' || data === null) {
      throw new SchemaError(`Expected object, got ${typeof data}`, this.name);
    }

    const record = data as Record<string, unknown>;

    // Check required fields
    for (const required of this.getRequiredColumns()) {
      if (!(required in record) || record[required] === undefined) {
        throw new SchemaError(`Missing required field '${required}'`, this.name, required);
      }
    }

    // Validate each field
    for (const [key, value] of Object.entries(record)) {
      if (!this.hasColumn(key)) {
        throw new SchemaError(`Unknown field '${key}'`, this.name, key);
      }

      const column = this.schema[key]!;

      // Check nullable
      if (value === null || value === undefined) {
        if (!column.nullable && column.default === undefined) {
          throw new SchemaError(`Field '${key}' cannot be null`, this.name, key);
        }
        continue;
      }

      // Type validation would go here (using type-mapper)
    }

    return true;
  }

  /**
   * Generate full ClickHouse column SQL for ALTER TABLE operations
   */
  getColumnSQL(columnName: string): string {
    const col = this.schema[columnName];
    if (!col) {
      throw new SchemaError(
        `Column '${columnName}' does not exist in table '${this.name}'`,
        this.name,
        columnName
      );
    }

    const typeSQL = getClickHouseType(col);
    const notNullSQL = col.nullable ? '' : ' NOT NULL';

    let defaultSQL = '';
    if (col.default !== undefined) {
      const val = typeof col.default === 'function' ? col.default() : col.default;

      if (typeof val === 'string') {
        defaultSQL = ` DEFAULT '${val.replace(/'/g, "''")}'`;
      } else if (typeof val === 'number' || typeof val === 'boolean') {
        defaultSQL = ` DEFAULT ${val}`;
      } else {
        defaultSQL = ` DEFAULT '${JSON.stringify(val).replace(/'/g, "''")}'`;
      }
    }
    const commentSQL = col.comment ? ` COMMENT '${col.comment.replace(/'/g, "''")}'` : '';
    return `\`${columnName}\` ${typeSQL}${notNullSQL}${defaultSQL}${commentSQL}`;
  }

  /**
   * Convert to JSON representation
   */
  toJSON(): {
    name: string;
    columns: Record<string, ColumnDefinition>;
    primaryKey?: string;
  } {
    return {
      name: this.name,
      columns: this.schema,
      primaryKey: this.primaryKeyColumn,
    };
  }

  /**
   * Create a table schema from JSON
   */
  static fromJSON<T extends SchemaDefinition>(json: { name: string; columns: T }): TableSchema<T> {
    return new TableSchema(json.name, json.columns);
  }
}

/**
 * Schema builder for fluent schema definition
 */
export class SchemaBuilder<T extends SchemaDefinition = SchemaDefinition> {
  private columns: SchemaDefinition = {};

  /**
   * Add a column to the schema
   */
  column(name: string, definition: ColumnDefinition): this {
    validateColumnDefinition(name, definition);
    this.columns[name] = definition;
    return this;
  }

  /**
   * Add an integer column
   */
  int(name: string, options?: Partial<Omit<ColumnDefinition, 'type'>>): this {
    return this.column(name, { type: DataType.Int32, ...options });
  }

  /**
   * Add an unsigned integer column
   */
  uint(name: string, options?: Partial<Omit<ColumnDefinition, 'type'>>): this {
    return this.column(name, { type: DataType.UInt32, ...options });
  }

  /**
   * Add a bigint column
   */
  bigint(name: string, options?: Partial<Omit<ColumnDefinition, 'type'>>): this {
    return this.column(name, { type: DataType.Int64, ...options });
  }

  /**
   * Add a float column
   */
  float(name: string, options?: Partial<Omit<ColumnDefinition, 'type'>>): this {
    return this.column(name, { type: DataType.Float64, ...options });
  }

  /**
   * Add a string column
   */
  string(name: string, options?: Partial<Omit<ColumnDefinition, 'type'>>): this {
    return this.column(name, { type: DataType.String, ...options });
  }

  /**
   * Add a boolean column
   */
  boolean(name: string, options?: Partial<Omit<ColumnDefinition, 'type'>>): this {
    return this.column(name, { type: DataType.Boolean, ...options });
  }

  /**
   * Add a date column
   */
  date(name: string, options?: Partial<Omit<ColumnDefinition, 'type'>>): this {
    return this.column(name, { type: DataType.Date, ...options });
  }

  /**
   * Add a datetime column
   */
  datetime(name: string, options?: Partial<Omit<ColumnDefinition, 'type'>>): this {
    return this.column(name, { type: DataType.DateTime, ...options });
  }

  /**
   * Add a UUID column
   */
  uuid(name: string, options?: Partial<Omit<ColumnDefinition, 'type'>>): this {
    return this.column(name, { type: DataType.UUID, ...options });
  }

  /**
   * Add a JSON column
   */
  json(name: string, options?: Partial<Omit<ColumnDefinition, 'type'>>): this {
    return this.column(name, { type: DataType.JSON, ...options });
  }

  /**
   * Add an array column
   */
  array(
    name: string,
    elementType: DataType,
    options?: Partial<Omit<ColumnDefinition, 'type' | 'elementType'>>
  ): this {
    return this.column(name, {
      type: DataType.Array,
      elementType,
      ...options,
    });
  }

  /**
   * Add an enum column
   */
  enum(
    name: string,
    values: readonly string[],
    options?: Partial<Omit<ColumnDefinition, 'type' | 'enumValues'>>
  ): this {
    return this.column(name, {
      type: values.length <= 256 ? DataType.Enum8 : DataType.Enum16,
      enumValues: values,
      ...options,
    });
  }

  /**
   * Build the schema
   */
  build(tableName: string): TableSchema<T> {
    return new TableSchema<T>(tableName, this.columns as T);
  }

  /**
   * Get the raw schema definition
   */
  getSchema(): T {
    return this.columns as T;
  }
}

/**
 * Create a new schema builder
 */
export function createSchema(): SchemaBuilder {
  return new SchemaBuilder();
}

/**
 * Define a table schema
 */
export function defineSchema<T extends SchemaDefinition>(name: string, schema: T): TableSchema<T> {
  return new TableSchema(name, schema);
}

/**
 * Helper to create a column definition
 */
export function column<T extends DataType>(
  type: T,
  options?: Partial<Omit<ColumnDefinition, 'type'>>
): ColumnDefinition {
  return { type, ...options };
}
