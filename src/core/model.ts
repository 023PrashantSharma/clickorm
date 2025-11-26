/**
 * Model class for ClickORM
 * Provides query builder interface for database operations
 */

import { WhereBuilder } from '../query/where.js';
import { createSQLBuilder } from '../utils/sql-builder.js';
import { ClickORMClient } from './client.js';
import { ModelError, ValidationError } from './errors.js';
import { HookManager, HookType, createHookManager } from './hooks.js';
import {
  IncludeOption,
  RelationBuilder,
  RelationOptions,
  RelationRegistry,
  createRelationBuilder,
} from './relations.js';
import { TableSchema } from './schema.js';
import {
  AggregateFunction,
  BulkCreateOptions,
  CreateInput,
  CreateOptions,
  DataType,
  DestroyOptions,
  FindOptions,
  InferModel,
  OrderDirection,
  SchemaDefinition,
  UpdateInput,
  UpdateOptions,
  WhereCondition,
} from './types.js';

/**
 * Query state for the model
 */
interface QueryState<T extends SchemaDefinition> {
  whereConditions: WhereCondition<InferModel<T>>[];
  selectFields: string[] | null;
  orderByFields: Array<{ field: string; direction: OrderDirection }>;
  limitValue: number | null;
  offsetValue: number | null;
  groupByFields: string[] | null;
  includeOptions: IncludeOption[];
}

/**
 * Model class representing a database table
 * Provides fluent query builder API
 */
export class Model<T extends SchemaDefinition> {
  public readonly schema: TableSchema<T>;
  public readonly client: ClickORMClient;
  public readonly hooks: HookManager<T>;
  public readonly relations: RelationBuilder<T>;
  private readonly tableName: string;
  private queryState: QueryState<T>;

  constructor(tableName: string, schema: TableSchema<T>, client: ClickORMClient) {
    this.tableName = tableName;
    this.schema = schema;
    this.client = client;
    this.hooks = createHookManager<T>();
    this.relations = createRelationBuilder<T>(this, tableName);
    this.queryState = this.createEmptyQueryState();
  }

  /**
   * Create empty query state
   */
  private createEmptyQueryState(): QueryState<T> {
    return {
      whereConditions: [],
      selectFields: null,
      orderByFields: [],
      limitValue: null,
      offsetValue: null,
      groupByFields: null,
      includeOptions: [],
    };
  }

  /**
   * Clone the model with current query state
   */
  private clone(): Model<T> {
    const cloned = new Model(this.tableName, this.schema, this.client);
    cloned.queryState = {
      whereConditions: [...this.queryState.whereConditions],
      selectFields: this.queryState.selectFields ? [...this.queryState.selectFields] : null,
      orderByFields: [...this.queryState.orderByFields],
      limitValue: this.queryState.limitValue,
      offsetValue: this.queryState.offsetValue,
      groupByFields: this.queryState.groupByFields ? [...this.queryState.groupByFields] : null,
      includeOptions: [...this.queryState.includeOptions],
    };
    return cloned;
  }

  /**
   * INSERT - Single record (legacy method)
   */
  async insert(data: CreateInput<T>): Promise<void> {
    await this.create(data as unknown as InferModel<T>);
  }

  /**
   * CREATE - Create a single record (Sequelize-style)
   */
  async create(data: InferModel<T>, options: CreateOptions = {}): Promise<InferModel<T>> {
    try {
      const instance = data;

      // Run beforeValidate hook
      if (options.hooks !== false) {
        await this.hooks.runHooks(HookType.beforeValidate, instance, options);
      }

      // Validate data against schema
      if (options.validate !== false) {
        this.schema.validate(data as unknown as CreateInput<T>);
      }

      // Run afterValidate hook
      if (options.hooks !== false) {
        await this.hooks.runHooks(HookType.afterValidate, instance, options);
      }

      // Run beforeCreate hook
      if (options.hooks !== false) {
        await this.hooks.runHooks(HookType.beforeCreate, instance, options);
      }

      // Run beforeSave hook
      if (options.hooks !== false) {
        await this.hooks.runHooks(HookType.beforeSave, instance, options);
      }

      // Serialize data for ClickHouse
      const serialized = this.serializeRecord(instance as Record<string, unknown>);

      // Filter fields if specified
      const fields = options.fields || Object.keys(serialized);
      const filteredData: Record<string, unknown> = {};
      fields.forEach((field) => {
        if (field in serialized) {
          filteredData[field] = serialized[field];
        }
      });

      // Use raw INSERT query for better control
      const builder = createSQLBuilder();
      builder.insertInto(this.tableName, Object.keys(filteredData));
      const values = Object.keys(filteredData).map((field) => filteredData[field]);
      builder.values([values]);

      const query = builder.build();
      await this.client.command(query.sql, this.paramsArrayToObject(query.params));

      // Run afterCreate hook
      if (options.hooks !== false) {
        await this.hooks.runHooks(HookType.afterCreate, instance, options);
      }

      // Run afterSave hook
      if (options.hooks !== false) {
        await this.hooks.runHooks(HookType.afterSave, instance, options);
      }

      return instance;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      // Run validationFailed hook if validation error
      if (error instanceof ValidationError && options.hooks !== false) {
        await this.hooks.runHooks(HookType.validationFailed, data, options);
      }

      throw new ModelError(
        `Failed to create record in ${this.tableName}: ${message}`,
        this.tableName
      );
    }
  }

  /**
   * INSERT - Multiple records (batch insert, legacy method)
   */
  async insertMany(data: CreateInput<T>[]): Promise<void> {
    await this.bulkCreate(data as unknown as InferModel<T>[]);
  }

  /**
   * BULK CREATE - Create multiple records (Sequelize-style)
   */
  async bulkCreate(
    records: InferModel<T>[],
    options: BulkCreateOptions = {}
  ): Promise<InferModel<T>[]> {
    try {
      if (records.length === 0) {
        throw new ValidationError('bulkCreate requires at least one record');
      }

      // Run beforeBulkCreate hook
      if (options.hooks !== false) {
        await this.hooks.runHooks(HookType.beforeBulkCreate, records, options);
      }

      // If individualHooks is true, run hooks for each record
      if (options.individualHooks) {
        for (const record of records) {
          // Run beforeValidate hook
          await this.hooks.runHooks(HookType.beforeValidate, record, options);

          // Validate
          if (options.validate !== false) {
            this.schema.validate(record as unknown as CreateInput<T>);
          }

          // Run afterValidate hook
          await this.hooks.runHooks(HookType.afterValidate, record, options);

          // Run beforeCreate and beforeSave hooks
          await this.hooks.runHooks(HookType.beforeCreate, record, options);
          await this.hooks.runHooks(HookType.beforeSave, record, options);
        }
      } else {
        // Validate all records
        if (options.validate !== false) {
          for (const record of records) {
            this.schema.validate(record as unknown as CreateInput<T>);
          }
        }
      }

      // Use client's insert method for batch - it handles JSONEachRow format properly
      await this.client.insert(this.tableName, records as Record<string, unknown>[]);

      // Run individual afterCreate hooks if enabled
      if (options.individualHooks) {
        for (const record of records) {
          await this.hooks.runHooks(HookType.afterCreate, record, options);
          await this.hooks.runHooks(HookType.afterSave, record, options);
        }
      }

      // Run afterBulkCreate hook
      if (options.hooks !== false) {
        await this.hooks.runHooks(HookType.afterBulkCreate, records, options);
      }

      return records;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new ModelError(
        `Failed to bulk create records in ${this.tableName}: ${message}`,
        this.tableName
      );
    }
  }

  /**
   * WHERE - Add where condition (chainable)
   */
  where(condition: WhereCondition<InferModel<T>>): Model<T> {
    const cloned = this.clone();
    cloned.queryState.whereConditions.push(condition);
    return cloned;
  }

  /**
   * SELECT - Specify fields to select (chainable)
   */
  select<K extends keyof InferModel<T>>(fields: K[]): Model<T> {
    const cloned = this.clone();
    cloned.queryState.selectFields = fields as string[];
    return cloned;
  }

  /**
   * ORDER BY - Add ordering (chainable)
   */
  orderBy(field: keyof InferModel<T> & string, direction: OrderDirection = 'ASC'): Model<T> {
    const cloned = this.clone();
    cloned.queryState.orderByFields.push({ field, direction });
    return cloned;
  }

  /**
   * LIMIT - Set result limit (chainable)
   */
  limit(count: number): Model<T> {
    if (count < 0) {
      throw new ValidationError('LIMIT must be non-negative');
    }
    const cloned = this.clone();
    cloned.queryState.limitValue = count;
    return cloned;
  }

  /**
   * OFFSET - Set result offset (chainable)
   */
  offset(count: number): Model<T> {
    if (count < 0) {
      throw new ValidationError('OFFSET must be non-negative');
    }
    const cloned = this.clone();
    cloned.queryState.offsetValue = count;
    return cloned;
  }

  /**
   * GROUP BY - Add grouping (chainable)
   */
  groupBy(...fields: (keyof InferModel<T> & string)[]): Model<T> {
    const cloned = this.clone();
    cloned.queryState.groupByFields = fields;
    return cloned;
  }

  /**
   * INCLUDE - Add eager loading for relations (chainable)
   */
  include(includeOptions: IncludeOption[]): Model<T> {
    const cloned = this.clone();
    cloned.queryState.includeOptions = [...cloned.queryState.includeOptions, ...includeOptions];
    return cloned;
  }

  /**
   * EXECUTE - Execute the query and return results
   */
  async execute<R = InferModel<T>>(): Promise<R[]> {
    try {
      const { sql, params } = this.buildSelectQuery(this.queryState.includeOptions);
      let results = await this.client.query<R>(sql, params);

      // Process includes (both eager and non-eager)
      if (this.queryState.includeOptions.length > 0) {
        results = await this.processIncludes(results, this.queryState.includeOptions);
      }

      return results;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new ModelError(
        `Failed to execute query on ${this.tableName}: ${message}`,
        this.tableName
      );
    }
  }
  /**
   * FIND ALL - Get all records (alias for execute without conditions)
   */
  async findAll<R = InferModel<T>>(options?: FindOptions<InferModel<T>>): Promise<R[]> {
    if (options) {
      let query = this as Model<T>;
      if (options.where) {
        query = query.where(options.where);
      }

      // Apply attributes (select)
      if (options.attributes) {
        if (Array.isArray(options.attributes)) {
          query = query.select(options.attributes as (keyof InferModel<T>)[]);
        } else if (typeof options.attributes === 'object') {
          // Handle include/exclude pattern
          const { include, exclude } = options.attributes;
          if (include && include.length > 0) {
            query = query.select(include as (keyof InferModel<T>)[]);
          } else if (exclude && exclude.length > 0) {
            // Get all fields except excluded ones
            const allFields = Object.keys(this.schema.schema);
            const fieldsToSelect = allFields.filter((field) => !exclude.includes(field));
            if (fieldsToSelect.length > 0) {
              query = query.select(fieldsToSelect as (keyof InferModel<T>)[]);
            }
          }
        }
      }

      if (typeof options.limit === 'number') {
        query = query.limit(options.limit);
      }
      if (typeof options.offset === 'number') {
        query = query.offset(options.offset);
      }

      if (options.order) {
        // CASE 1 → array of tuples:  [ ['field', 'ASC'], ['age', 'DESC'] ]
        if (Array.isArray(options.order)) {
          for (const item of options.order) {
            if (Array.isArray(item) && item.length === 2) {
              const [field, direction] = item as [keyof InferModel<T> & string, OrderDirection];
              query = query.orderBy(field, direction);
            }
          }
        }

        // CASE 2 → raw SQL string
        else if (typeof options.order === 'string') {
          // You can choose what to do here (ClickHouse allows ORDER BY raw)
          // But we simply ignore it for now to keep type safe.
        }
      }

      // Apply include (relations)
      if (options.include && options.include.length > 0) {
        query = query.include(options.include);
      }

      return await query.execute<R>();
    }

    return this.execute<R>();
  }

  /**
   * FIND - Find records with optional conditions
   */
  async find<R = InferModel<T>>(condition?: WhereCondition<InferModel<T>>): Promise<R[]> {
    if (condition) {
      return this.where(condition).execute<R>();
    }
    return this.execute<R>();
  }

  /**
   * FIND ONE - Get first record with optional conditions (Sequelize-style)
   */
  async findOne<R = InferModel<T>>(
    whereOrOptions?: WhereCondition<InferModel<T>> | FindOptions<InferModel<T>>
  ): Promise<R | null> {
    // If it's a FindOptions object (has properties other than where conditions)
    if (whereOrOptions && typeof whereOrOptions === 'object') {
      const options = whereOrOptions as FindOptions<InferModel<T>>;

      // Check if it's FindOptions by looking for option-specific properties
      const isFindOptions =
        'where' in options ||
        'attributes' in options ||
        'limit' in options ||
        'offset' in options ||
        'order' in options ||
        'include' in options ||
        'transaction' in options ||
        'hooks' in options;

      if (isFindOptions) {
        // Run beforeFind hook
        if (options.hooks !== false) {
          await this.hooks.runHooks(HookType.beforeFind, [] as InferModel<T>[], options);
        }

        let query = this as Model<T>;

        // Apply where conditions
        if (options.where) {
          query = query.where(options.where);
        }

        // Apply attributes (select)
        if (options.attributes) {
          if (Array.isArray(options.attributes)) {
            query = query.select(options.attributes as (keyof InferModel<T>)[]);
          }
        }

        // Apply order
        if (options.order) {
          if (Array.isArray(options.order)) {
            for (const [field, direction] of options.order) {
              query = query.orderBy(field as keyof InferModel<T> & string, direction);
            }
          }
        }

        // Apply include (relations)
        if (options.include && options.include.length > 0) {
          query = query.include(options.include);
        }

        const result = await query.first<R>();

        // Run afterFind hook
        if (options.hooks !== false && result) {
          await this.hooks.runHooks(HookType.afterFind, result as InferModel<T>, options);
        }

        return result;
      }
    }

    // Simple where condition
    if (whereOrOptions) {
      return this.where(whereOrOptions as WhereCondition<InferModel<T>>).first<R>();
    }
    return this.first<R>();
  }

  /**
   * FIRST - Get first result
   */
  async first<R = InferModel<T>>(): Promise<R | null> {
    const cloned = this.clone();
    cloned.queryState.limitValue = 1;
    const results = await cloned.execute<R>();
    return results.length > 0 ? results[0]! : null;
  }
  /**
   * COUNT - Private method to execute count query
   **/
  private async executeCount(): Promise<number> {
    const builder = createSQLBuilder();
    builder.raw('SELECT COUNT(*) as count').from(this.tableName);

    const whereParams: Record<string, unknown> = {};

    if (this.queryState.whereConditions.length > 0) {
      const whereResult = this.buildWhereClause();
      if (whereResult.sql) {
        builder.where(whereResult.sql);
        Object.assign(whereParams, whereResult.params);
      }
    }

    const query = builder.build();
    const result = await this.client.query<{ count: string }>(query.sql, whereParams);
    return parseInt(result[0]?.count ?? '0', 10);
  }

  /**
   * COUNT - Count records
   */
  async count(options?: FindOptions<InferModel<T>>): Promise<number> {
    let query = this as Model<T>;

    if (options?.where) {
      query = query.where(options.where);
    }

    return await query.executeCount();
  }

  /**
   * EXISTS - Check if records exist
   */
  async exists(): Promise<boolean> {
    const count = await this.count();
    return count > 0;
  }

  /**
   * UPDATE - Update records (legacy method with Sequelize-style options support)
   */
  async update(
    data: UpdateInput<T>,
    whereOrOptions?: WhereCondition<InferModel<T>> | UpdateOptions
  ): Promise<number> {
    return await this.updateRecords(data, whereOrOptions);
  }

  /**
   * UPDATE RECORDS - Update with direct where parameter (Sequelize-style)
   */
  async updateRecords(
    data: UpdateInput<T>,
    whereOrOptions?: WhereCondition<InferModel<T>> | UpdateOptions
  ): Promise<number> {
    try {
      if (Object.keys(data).length === 0) {
        throw new ValidationError('UPDATE requires at least one field to update');
      }

      let options: UpdateOptions = {};
      let whereCondition: WhereCondition<InferModel<T>> | undefined;

      // Parse parameters
      if (whereOrOptions) {
        const isUpdateOptions =
          'where' in whereOrOptions ||
          'transaction' in whereOrOptions ||
          'validate' in whereOrOptions ||
          'returning' in whereOrOptions ||
          'fields' in whereOrOptions ||
          'hooks' in whereOrOptions;

        if (isUpdateOptions) {
          options = whereOrOptions as UpdateOptions;
          whereCondition = options.where;
        } else {
          whereCondition = whereOrOptions as WhereCondition<InferModel<T>>;
        }
      }

      // Use existing query state if no where provided
      const hasQueryStateWhere = this.queryState.whereConditions.length > 0;
      const hasDirectWhere = whereCondition !== undefined;

      // Safety check: ClickHouse requires WHERE condition for UPDATE
      if (!hasQueryStateWhere && !hasDirectWhere) {
        throw new ValidationError(
          'UPDATE requires WHERE conditions in ClickHouse. Pass a WHERE condition to updateRecords() or use .where().update() to update specific records.'
        );
      }

      // Run beforeBulkUpdate hook
      if (options.hooks !== false) {
        await this.hooks.runHooks(HookType.beforeBulkUpdate, data as InferModel<T>, options);
      }

      // If individualHooks is enabled, fetch records first
      if (options.individualHooks) {
        let query = this as Model<T>;
        if (hasDirectWhere) {
          query = query.where(whereCondition!);
        }

        const records = await query.execute<InferModel<T>>();

        // Run beforeUpdate hook for each record
        for (const record of records) {
          const updatedRecord = { ...record, ...data } as InferModel<T>;
          await this.hooks.runHooks(HookType.beforeUpdate, updatedRecord, options);
          await this.hooks.runHooks(HookType.beforeSave, updatedRecord, options);
        }
      }

      const builder = createSQLBuilder();
      builder.update(this.tableName);

      // Filter fields if specified
      const fieldsToUpdate = options.fields
        ? Object.keys(data).filter((k) => options.fields!.includes(k))
        : Object.keys(data);

      const filteredData: Record<string, unknown> = {};
      fieldsToUpdate.forEach((field) => {
        filteredData[field] = (data as Record<string, unknown>)[field];
      });

      builder.set(filteredData);

      // Build the query so far to get current param count
      const currentQuery = builder.build();
      const currentParamCount = currentQuery.params.length;

      // Add WHERE conditions with parameters
      const whereParams: Record<string, unknown> = {};

      if (hasDirectWhere || hasQueryStateWhere) {
        let finalWhereConditions = [...this.queryState.whereConditions];
        if (hasDirectWhere) {
          finalWhereConditions = [whereCondition!];
        }

        if (finalWhereConditions.length > 0) {
          const tempModel = this.clone();
          tempModel.queryState.whereConditions = finalWhereConditions;
          const whereResult = tempModel.buildWhereClause(currentParamCount);

          if (whereResult.sql && whereResult.sql !== '1=1') {
            builder.where(whereResult.sql);
            Object.assign(whereParams, whereResult.params);
          }
        }
      }

      // Add LIMIT if specified
      if (options.limit) {
        builder.limit(options.limit);
      }

      const query = builder.build();
      const allParams = { ...this.paramsArrayToObject(query.params), ...whereParams };
      await this.client.command(query.sql, allParams);

      // Run afterBulkUpdate hook
      if (options.hooks !== false) {
        await this.hooks.runHooks(HookType.afterBulkUpdate, data as InferModel<T>, options);
      }

      // Note: ClickHouse doesn't return affected rows count easily
      return 0;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new ModelError(
        `Failed to update records in ${this.tableName}: ${message}`,
        this.tableName
      );
    }
  }

  /**
   * DELETE - Delete records (chained method, legacy)
   */
  async delete(): Promise<void> {
    await this.destroy();
  }

  /**
   * DESTROY - Delete records (Sequelize-style)
   */
  async destroy(
    whereOrOptions?: WhereCondition<InferModel<T>> | DestroyOptions<InferModel<T>>
  ): Promise<number> {
    try {
      let options: DestroyOptions<InferModel<T>> = {};
      let whereCondition: WhereCondition<InferModel<T>> | undefined;

      // Parse parameters
      if (whereOrOptions) {
        const isDestroyOptions =
          'transaction' in whereOrOptions ||
          'force' in whereOrOptions ||
          'limit' in whereOrOptions ||
          'hooks' in whereOrOptions ||
          'individualHooks' in whereOrOptions ||
          'truncate' in whereOrOptions ||
          'cascade' in whereOrOptions;

        if (isDestroyOptions) {
          options = whereOrOptions as DestroyOptions<InferModel<T>>;
          whereCondition = options.where;
        } else {
          whereCondition = whereOrOptions as WhereCondition<InferModel<T>>;
        }
      }

      // Use existing query state if no where provided
      const hasQueryStateWhere = this.queryState.whereConditions.length > 0;
      const hasDirectWhere = whereCondition !== undefined;

      // Safety check: require WHERE condition
      if (!hasQueryStateWhere && !hasDirectWhere && !options.truncate) {
        throw new ValidationError(
          'DESTROY requires WHERE conditions for safety. Use { truncate: true } to delete all records.'
        );
      }

      // Handle truncate
      if (options.truncate) {
        await this.truncate();
        return 0;
      }

      // Run beforeBulkDestroy hook
      if (options.hooks !== false) {
        await this.hooks.runHooks(HookType.beforeBulkDestroy, [] as InferModel<T>[], options);
      }

      // If individualHooks is enabled, fetch records first
      if (options.individualHooks) {
        let query = this as Model<T>;
        if (hasDirectWhere) {
          query = query.where(whereCondition!);
        }

        const records = await query.execute<InferModel<T>>();

        // Run beforeDestroy hook for each record
        for (const record of records) {
          await this.hooks.runHooks(HookType.beforeDestroy, record, options);
        }
      }

      const builder = createSQLBuilder();
      builder.deleteFrom(this.tableName);

      // Add WHERE conditions
      const whereParams: Record<string, unknown> = {};

      let finalWhereConditions = [...this.queryState.whereConditions];
      if (hasDirectWhere) {
        finalWhereConditions = [whereCondition!];
      }

      if (finalWhereConditions.length > 0) {
        const tempModel = this.clone();
        tempModel.queryState.whereConditions = finalWhereConditions;
        const whereResult = tempModel.buildWhereClause();

        if (whereResult.sql && whereResult.sql !== '1=1') {
          builder.where(whereResult.sql);
          Object.assign(whereParams, whereResult.params);
        }
      }

      // Add LIMIT if specified
      if (options.limit) {
        builder.limit(options.limit);
      }

      const query = builder.build();
      await this.client.command(query.sql, whereParams);

      // Run afterBulkDestroy hook
      if (options.hooks !== false) {
        await this.hooks.runHooks(HookType.afterBulkDestroy, [] as InferModel<T>[], options);
      }

      return 0;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new ModelError(
        `Failed to destroy records from ${this.tableName}: ${message}`,
        this.tableName
      );
    }
  }

  /**
   * TRUNCATE - Delete all records (use with caution)
   */
  async truncate(): Promise<void> {
    try {
      const sql = `TRUNCATE TABLE ${this.tableName}`;
      await this.client.command(sql);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new ModelError(
        `Failed to truncate table ${this.tableName}: ${message}`,
        this.tableName
      );
    }
  }

  /**
   * FIND BY PRIMARY KEY - Find record by primary key
   */
  async findByPk<R = InferModel<T>>(value: unknown): Promise<R | null> {
    const pkColumn = this.schema.getPrimaryKey();
    if (!pkColumn) {
      throw new ModelError(`No primary key defined for table ${this.tableName}`, this.tableName);
    }

    return this.where({ [pkColumn]: value } as WhereCondition<InferModel<T>>).first<R>();
  }

  /**
   * FIND ONE AND UPDATE - Find and update a single record, returning the updated record
   * @param whereCondition - WHERE condition to find the record
   * @param data - Data to update
   * @param options - Update options
   * @returns The updated record or null if not found
   */
  async findOneAndUpdate<R = InferModel<T>>(
    whereCondition: WhereCondition<InferModel<T>>,
    data: UpdateInput<T>,
    options: UpdateOptions & { new?: boolean } = {}
  ): Promise<R | null> {
    try {
      // First, find the record
      const existingRecord = await this.where(whereCondition).first<R>();

      if (!existingRecord) {
        return null;
      }

      // Perform the update
      await this.updateRecords(data, { where: whereCondition, ...options });

      // Return based on 'new' option (default: true = return updated record)
      if (options.new === false) {
        // Return the old record
        return existingRecord;
      } else {
        // Fetch and return the updated record
        const updatedRecord = await this.where(whereCondition).first<R>();
        return updatedRecord;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new ModelError(
        `Failed to findOneAndUpdate in ${this.tableName}: ${message}`,
        this.tableName
      );
    }
  }

  /**
   * AGGREGATE - Perform aggregation
   */
  async aggregate(
    aggregates: Record<string, { fn: AggregateFunction; field: string | '*' }>
  ): Promise<Record<string, unknown>> {
    try {
      const builder = createSQLBuilder();

      // Build SELECT with aggregations
      const selectParts: string[] = [];
      for (const [alias, agg] of Object.entries(aggregates)) {
        const aggField = agg;
        const fn = aggField.fn.toUpperCase() as AggregateFunction;
        const field = aggField.field === '*' ? '*' : builder.identifier(aggField.field as string);
        selectParts.push(`${fn}(${field}) as ${builder.identifier(alias)}`);
      }

      builder.raw(`SELECT ${selectParts.join(', ')}`);
      builder.from(this.tableName);

      // Add WHERE conditions
      if (this.queryState.whereConditions.length > 0) {
        const whereResult = this.buildWhereClause();
        if (whereResult.sql) {
          builder.where(whereResult.sql);
        }
      }

      // Add GROUP BY if specified
      if (this.queryState.groupByFields && this.queryState.groupByFields.length > 0) {
        builder.groupBy(this.queryState.groupByFields);
      }

      // Add WHERE conditions with parameters
      const whereParams: Record<string, unknown> = {};
      if (this.queryState.whereConditions.length > 0) {
        const whereResult = this.buildWhereClause();
        if (whereResult.sql && whereResult.sql !== '1=1') {
          builder.where(whereResult.sql);
          Object.assign(whereParams, whereResult.params);
        }
      }

      const query = builder.build();
      const results = await this.client.query<Record<string, unknown>>(query.sql, whereParams);

      return results.length > 0 ? results[0]! : {};
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new ModelError(
        `Failed to perform aggregation on ${this.tableName}: ${message}`,
        this.tableName
      );
    }
  }

  /**
   * Build SELECT query from current state
   */
  private buildSelectQuery(includeOptions: IncludeOption[] = []): {
    sql: string;
    params: Record<string, unknown>;
  } {
    const builder = createSQLBuilder();

    // Eager loading
    const { joins, selectFields } = this.buildEagerLoading(includeOptions);

    // FROM table
    const fields = this.queryState.selectFields || ['*'];
    builder.select([...fields, ...selectFields]);

    // FROM table
    builder.from(this.tableName);

    // Add joins
    for (const join of joins) {
      builder.raw(join);
    }

    // WHERE conditions
    if (this.queryState.whereConditions.length > 0) {
      const whereResult = this.buildWhereClause();
      if (whereResult.sql && whereResult.sql !== '1=1') {
        builder.where(whereResult.sql);
      }
    }

    // GROUP BY
    if (this.queryState.groupByFields && this.queryState.groupByFields.length > 0) {
      builder.groupBy(this.queryState.groupByFields);
    }

    // ORDER BY
    for (const { field, direction } of this.queryState.orderByFields) {
      builder.orderBy(field, direction);
    }

    // LIMIT
    if (this.queryState.limitValue !== null) {
      builder.limit(this.queryState.limitValue);
    }

    // OFFSET
    if (this.queryState.offsetValue !== null) {
      builder.offset(this.queryState.offsetValue);
    }

    const builtQuery = builder.build();

    // Merge WHERE params with any other params
    const whereParams =
      this.queryState.whereConditions.length > 0 ? this.buildWhereClause().params : {};

    return {
      sql: builtQuery.sql,
      params: whereParams,
    };
  }

  /**
   * Process includes - load related data using separate queries (lazy loading)
   * Note: Set eager: false or omit it to use this approach. eager: true with JOINs is not yet fully implemented.
   */
  private async processIncludes<R>(results: R[], includeOptions: IncludeOption[]): Promise<R[]> {
    if (results.length === 0) {
      return results;
    }

    for (const includeOption of includeOptions) {
      const relation = this.relations.getRelation(includeOption.as!);
      if (!relation) {
        continue;
      }

      // For now, always use lazy loading (separate queries) regardless of eager flag
      // This ensures relations work properly until JOIN nesting is implemented
      {
        // Lazy loading - load related data with separate queries
        const targetModel = RelationRegistry.getModel(relation.target);
        if (!targetModel) {
          continue;
        }

        // Load related records for each parent
        for (const result of results) {
          const record = result as Record<string, unknown>;

          // Build where condition based on relation type
          let relatedRecords: unknown[] = [];

          switch (relation.type) {
            case 'BelongsTo': {
              // source.foreignKey = target.targetKey
              const foreignKeyValue = record[relation.options.foreignKey];
              if (foreignKeyValue != null) {
                const targetKey = relation.options.targetKey || 'id';
                let query = targetModel.where({
                  [targetKey]: foreignKeyValue,
                } as WhereCondition<InferModel<SchemaDefinition>>);

                // Apply attributes selection if specified
                query = this.applyAttributesSelection(query, includeOption.attributes, targetModel);

                const related = await query.first();
                record[relation.options.as] = related;
              }
              break;
            }

            case 'HasOne': {
              // source.sourceKey = target.foreignKey
              const sourceKey = relation.options.sourceKey || 'id';
              const sourceKeyValue = record[sourceKey];
              if (sourceKeyValue != null) {
                let query = targetModel.where({
                  [relation.options.foreignKey]: sourceKeyValue,
                } as WhereCondition<InferModel<SchemaDefinition>>);

                // Apply attributes selection if specified
                query = this.applyAttributesSelection(query, includeOption.attributes, targetModel);

                const related = await query.first();
                record[relation.options.as] = related;
              }
              break;
            }

            case 'HasMany': {
              // source.sourceKey = target.foreignKey
              const sourceKey = relation.options.sourceKey || 'id';
              const sourceKeyValue = record[sourceKey];
              if (sourceKeyValue != null) {
                let query = targetModel.where({
                  [relation.options.foreignKey]: sourceKeyValue,
                } as WhereCondition<InferModel<SchemaDefinition>>);

                // Apply attributes selection if specified
                query = this.applyAttributesSelection(query, includeOption.attributes, targetModel);

                relatedRecords = await query.execute();
                record[relation.options.as] = relatedRecords;
              }
              break;
            }
          }
        }
      }
    }

    return results;
  }

  /**
   * Apply attributes selection to a query based on include/exclude pattern
   */
  private applyAttributesSelection<R extends SchemaDefinition>(
    query: Model<R>,
    attributes: string[] | { include?: string[]; exclude?: string[] } | undefined,
    targetModel: Model<R>
  ): Model<R> {
    if (!attributes) {
      return query; // Return all fields
    }

    // Case 1: Array format - include only these fields
    if (Array.isArray(attributes)) {
      if (attributes.length > 0) {
        return query.select(attributes as never[]);
      }
      return query;
    }

    // Case 2: Object format with include/exclude
    const { include, exclude } = attributes;

    if (include && include.length > 0) {
      // Include only specified fields
      return query.select(include as never[]);
    }

    if (exclude && exclude.length > 0) {
      // Exclude specified fields - get all fields except excluded ones
      const allFields = Object.keys(targetModel.schema.schema);
      const fieldsToSelect = allFields.filter((field) => !exclude.includes(field));
      if (fieldsToSelect.length > 0) {
        return query.select(fieldsToSelect as never[]);
      }
    }

    return query; // Return all fields if no valid selection
  }

  /**
   * Build WHERE clause from conditions
   */
  /**
   * Build eager loading joins and select fields
   * NOTE: Currently disabled - using lazy loading (separate queries) for all relations
   */
  private buildEagerLoading(_includeOptions: IncludeOption[]): {
    joins: string[];
    selectFields: string[];
  } {
    // Disabled JOIN-based eager loading to avoid duplicate data
    // All relations now use separate queries (lazy loading)
    return {
      joins: [],
      selectFields: [],
    };
  }
  private buildWhereClause(startingParamCount = 0): {
    sql: string;
    params: Record<string, unknown>;
  } {
    const builder = createSQLBuilder();
    const whereBuilder = new WhereBuilder<T>(builder, startingParamCount);

    // Combine all WHERE conditions with AND
    const combinedCondition: WhereCondition<InferModel<T>> =
      this.queryState.whereConditions.length === 1
        ? this.queryState.whereConditions[0]!
        : ({ and: this.queryState.whereConditions } as WhereCondition<InferModel<T>>);

    return whereBuilder.build(combinedCondition);
  }

  /**
   * Convert params array to object (for compatibility)
   */
  private paramsArrayToObject(params: unknown[]): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    params.forEach((value, index) => {
      result[`param${index}`] = value;
    });
    return result;
  }

  /**
   * Serialize a record for ClickHouse insertion
   * Converts Date objects, booleans, JSON objects, and other types to ClickHouse-compatible format
   */
  private serializeRecord(record: Record<string, unknown>): Record<string, unknown> {
    const serialized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(record)) {
      if (value instanceof Date) {
        // Convert Date to ClickHouse DateTime format (YYYY-MM-DD HH:mm:ss)
        const year = value.getFullYear();
        const month = String(value.getMonth() + 1).padStart(2, '0');
        const day = String(value.getDate()).padStart(2, '0');
        const hours = String(value.getHours()).padStart(2, '0');
        const minutes = String(value.getMinutes()).padStart(2, '0');
        const seconds = String(value.getSeconds()).padStart(2, '0');
        serialized[key] = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
      } else if (typeof value === 'boolean') {
        // Convert boolean to 0/1 for ClickHouse
        serialized[key] = value ? 1 : 0;
      } else if (value === null || value === undefined) {
        // Handle nulls
        serialized[key] = null;
      } else if (typeof value === 'object' && !Array.isArray(value)) {
        // Check if this field is a JSON type in schema
        const schemaField = this.schema.getColumn(key);
        if (schemaField && schemaField.type === DataType.JSON) {
          // Stringify JSON objects for ClickHouse JSON fields
          serialized[key] = JSON.stringify(value);
        } else {
          serialized[key] = value;
        }
      } else {
        serialized[key] = value;
      }
    }

    return serialized;
  }

  /**
   * Get table name
   */
  getTableName(): string {
    return this.tableName;
  }

  /**
   * Reset query state (return fresh model instance)
   */
  reset(): Model<T> {
    return new Model(this.tableName, this.schema, this.client);
  }

  /**
   * Raw query on this model's table
   */
  async raw<R = unknown>(sql: string, params?: Record<string, unknown>): Promise<R[]> {
    return this.client.query<R>(sql, params);
  }

  /**
   * Define a hasMany relationship
   * @example
   * User.hasMany(Post, { foreignKey: 'userId', as: 'posts' })
   */
  hasMany<R extends SchemaDefinition>(
    targetModel: Model<R> | string,
    options: RelationOptions
  ): void {
    this.relations.hasMany(targetModel, options);
  }

  /**
   * Define a hasOne relationship
   * @example
   * User.hasOne(Profile, { foreignKey: 'userId', as: 'profile' })
   */
  hasOne<R extends SchemaDefinition>(
    targetModel: Model<R> | string,
    options: RelationOptions
  ): void {
    this.relations.hasOne(targetModel, options);
  }

  /**
   * Define a belongsTo relationship
   * @example
   * Post.belongsTo(User, { foreignKey: 'userId', as: 'author', targetKey: 'id' })
   */
  belongsTo<R extends SchemaDefinition>(
    targetModel: Model<R> | string,
    options: RelationOptions
  ): void {
    this.relations.belongsTo(targetModel, options);
  }

  /**
   * Define a belongsToMany relationship (many-to-many)
   * @example
   * User.belongsToMany(Role, { through: 'UserRoles', foreignKey: 'userId', as: 'roles' })
   */
  belongsToMany<R extends SchemaDefinition>(
    targetModel: Model<R> | string,
    options: RelationOptions & { through: string }
  ): void {
    this.relations.belongsToMany(targetModel, options);
  }
}

/**
 * Create a new model instance
 */
export function createModel<T extends SchemaDefinition>(
  tableName: string,
  schema: TableSchema<T>,
  client: ClickORMClient
): Model<T> {
  return new Model(tableName, schema, client);
}
