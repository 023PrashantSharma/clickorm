/**
 * ClickHouse client with connection pooling and management
 * Handles database connections, query execution, and connection lifecycle
 */

import { createClient, ClickHouseClient, ClickHouseClientConfigOptions } from '@clickhouse/client';
import { ConnectionError, QueryError } from './errors.js';
import { Logger, LogLevel, createLogger } from '../utils/logger.js';
import { TableSchema } from './schema.js';
import { SchemaDefinition } from './types.js';
import { Model } from './model.js';

/**
 * Client configuration options
 */
export interface ClickORMClientConfig {
  /** ClickHouse host URL */
  host?: string;
  /** Database name */
  database?: string;
  /** Username */
  username?: string;
  /** Password */
  password?: string;
  /** Application name for tracking */
  application?: string;
  /** Request timeout in ms */
  request_timeout?: number;
  /** Maximum number of connections */
  max_open_connections?: number;
  /** Connection idle timeout */
  idle_connection_ttl?: number;
  /** Retry configuration */
  retry?: {
    attempts?: number;
    delay?: number;
    backoff?: 'linear' | 'exponential';
  };
  /** Logger configuration */
  logging?: {
    enabled?: boolean;
    level?: LogLevel;
    queries?: boolean;
  };
  /** Compression */
  compression?: {
    request?: boolean;
    response?: boolean;
  };
  /** TLS/SSL settings */
  tls?: {
    ca_cert?: string;
    cert?: string;
    key?: string;
  };
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Partial<ClickORMClientConfig> = {
  host: 'http://localhost:8123',
  database: 'default',
  username: 'default',
  password: '',
  request_timeout: 30000,
  max_open_connections: 10,
  retry: {
    attempts: 3,
    delay: 1000,
    backoff: 'exponential',
  },
  logging: {
    enabled: true,
    level: LogLevel.INFO,
    queries: true,
  },
};

/**
 * ClickORM client class
 * Main entry point for database operations
 */
export class ClickORMClient {
  private client: ClickHouseClient;
  private config: ClickORMClientConfig;
  private logger: Logger;
  private models: Map<string, Model<SchemaDefinition>>;
  private connected: boolean;

  constructor(config: ClickORMClientConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.models = new Map();
    this.connected = false;

    // Initialize logger
    this.logger = createLogger({
      level: this.config.logging?.level || LogLevel.INFO,
      enabled: this.config.logging?.enabled !== false,
      prefix: 'ClickORM',
    });

    // Create ClickHouse client
    this.client = this.createClickHouseClient();

    this.logger.info('ClickORM client initialized', {
      host: this.config.host,
      database: this.config.database,
    });
  }

  /**
   * Create the underlying ClickHouse client
   */
  private createClickHouseClient(): ClickHouseClient {
    const options: ClickHouseClientConfigOptions = {
      host: this.config.host,
      database: this.config.database,
      username: this.config.username,
      password: this.config.password,
      application: this.config.application || 'clickorm',
      request_timeout: this.config.request_timeout,
      max_open_connections: this.config.max_open_connections,
      compression: this.config.compression,
    };

    return createClient(options);
  }

  /**
   * Connect to the database
   */
  async connect(): Promise<void> {
    try {
      this.logger.info('Connecting to ClickHouse...');

      // Test connection with a simple ping query
      await this.client.ping();

      this.connected = true;
      this.logger.info('Successfully connected to ClickHouse');
    } catch (error) {
      this.connected = false;
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        'Failed to connect to ClickHouse',
        error instanceof Error ? error : undefined
      );
      throw new ConnectionError(`Failed to connect to ClickHouse: ${message}`, {
        host: this.config.host,
        database: this.config.database,
      });
    }
  }

  /**
   * Authenticate database connection (alias for connect)
   * This method provides Sequelize-like API compatibility
   * @returns Promise that resolves when connection is authenticated
   */
  async authenticate(): Promise<void> {
    return this.connect();
  }

  /**
   * Disconnect from the database
   */
  async disconnect(): Promise<void> {
    try {
      this.logger.info('Disconnecting from ClickHouse...');
      await this.client.close();
      this.connected = false;
      this.logger.info('Disconnected from ClickHouse');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Error during disconnect', error instanceof Error ? error : undefined);
      throw new ConnectionError(`Failed to disconnect: ${message}`);
    }
  }

  /**
   * Check if client is connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Execute a raw query
   */
  async query<T = unknown>(sql: string, params?: Record<string, unknown>): Promise<T[]> {
    if (!this.connected) {
      await this.connect();
    }

    const startTime = Date.now();

    try {
      if (this.config.logging?.queries) {
        this.logger.debug('Executing query', { sql, params });
      }

      const result = await this.client.query({
        query: sql,
        query_params: params,
        format: 'JSONEachRow',
      });

      const data = await result.json<T>();
      const duration = Date.now() - startTime;

      if (this.config.logging?.queries) {
        this.logger.debug('Query executed successfully', {
          duration: `${duration}ms`,
          rows: Array.isArray(data) ? data.length : 0,
        });
      }

      return Array.isArray(data) ? data : [data];
    } catch (error) {
      const duration = Date.now() - startTime;
      const message = error instanceof Error ? error.message : String(error);

      this.logger.error('Query execution failed', error instanceof Error ? error : undefined, {
        sql,
        params,
        duration: `${duration}ms`,
      });

      throw new QueryError(message, sql, params ? Object.values(params) : undefined);
    }
  }

  /**
   * Execute a query with timeout
   * Note: Timeout handling is delegated to ClickHouse client configuration
   */
  async queryWithTimeout<T = unknown>(sql: string, params?: Record<string, unknown>): Promise<T[]> {
    // Timeout is handled by the underlying ClickHouse client via request_timeout config
    return this.query<T>(sql, params);
  }

  /**
   * Execute a command (INSERT, UPDATE, DELETE, etc.)
   */
  async command(sql: string, params?: Record<string, unknown>): Promise<void> {
    if (!this.connected) {
      await this.connect();
    }

    const startTime = Date.now();

    try {
      if (this.config.logging?.queries) {
        this.logger.debug('Executing command', { sql, params });
      }

      await this.client.command({
        query: sql,
        query_params: params,
      });

      const duration = Date.now() - startTime;

      if (this.config.logging?.queries) {
        this.logger.debug('Command executed successfully', {
          duration: `${duration}ms`,
        });
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      const message = error instanceof Error ? error.message : String(error);

      this.logger.error('Command execution failed', error instanceof Error ? error : undefined, {
        sql,
        params,
        duration: `${duration}ms`,
      });

      throw new QueryError(message, sql, params ? Object.values(params) : undefined);
    }
  }

  /**
   * Convert camelCase to snake_case
   */
  private toSnakeCase(str: string): string {
    return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
  }

  /**
   * Serialize data for ClickHouse (convert Date objects, etc.)
   */
  private serializeForClickHouse(data: Record<string, unknown>[]): Record<string, unknown>[] {
    return data.map((record) => {
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
          // Convert boolean to 0/1
          serialized[key] = value ? 1 : 0;
        } else if (value === null || value === undefined) {
          serialized[key] = null;
        } else if (typeof value === 'object' && !Array.isArray(value)) {
          // Try to stringify objects (for JSON fields)
          serialized[key] = JSON.stringify(value);
        } else {
          serialized[key] = value;
        }
      }
      return serialized;
    });
  }

  /**
   * Execute an INSERT in streaming mode
   */
  async insert(
    table: string,
    data: Record<string, unknown>[],
    options?: { format?: 'JSONEachRow' | 'JSON' | 'CSV' | 'TabSeparated' }
  ): Promise<void> {
    if (!this.connected) {
      await this.connect();
    }

    // Convert camelCase table names to snake_case
    const normalizedTable = this.toSnakeCase(table);

    // Serialize data for ClickHouse
    const serializedData = this.serializeForClickHouse(data);

    try {
      await this.client.insert({
        table: normalizedTable,
        values: serializedData,
        format: options?.format || 'JSONEachRow',
      });

      this.logger.debug('Batch insert completed', {
        table: normalizedTable,
        rows: data.length,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Insert failed', error instanceof Error ? error : undefined, {
        table: normalizedTable,
      });
      throw new QueryError(message, `INSERT INTO ${normalizedTable}`, [data]);
    }
  }

  /**
   * Ping the database
   */
  async ping(): Promise<boolean> {
    try {
      await this.client.ping();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Define a model
   */
  define<T extends SchemaDefinition>(tableName: string, schema: T): Model<T> {
    if (this.models.has(tableName)) {
      this.logger.warn(`Model '${tableName}' is being redefined`);
    }

    const tableSchema = new TableSchema(tableName, schema);
    const model = new Model(tableName, tableSchema, this);

    this.models.set(tableName, model as Model<SchemaDefinition>);

    this.logger.debug(`Model '${tableName}' defined`, {
      columns: Object.keys(schema).length,
    });

    return model;
  }

  /**
   * Get a defined model
   */
  getModel<T extends SchemaDefinition>(tableName: string): Model<T> | undefined {
    return this.models.get(tableName) as Model<T> | undefined;
  }

  /**
   * Sync all models to database (create tables)
   */
  async sync(options?: {
    force?: boolean;
    alter?: boolean;
    settings?: Record<string, unknown>;
  }): Promise<void> {
    this.logger.info('Syncing models to database...', options);

    for (const [tableName, model] of this.models) {
      try {
        if (options?.force) {
          // Drop and recreate table
          await this.command(model.schema.toDropTableSQL(true));
          await this.command(
            model.schema.toCreateTableSQL({
              ifNotExists: false,
              settings: options?.settings as Record<string, string | number | boolean> | undefined,
            })
          );
          this.logger.info(`Table '${tableName}' recreated (force)`);
        } else if (options?.alter) {
          // ——— START AUTO-MIGRATION LOGIC ———

          this.logger.info(`Checking schema differences for '${tableName}'...`);

          // 1) Get existing columns from ClickHouse
          const existingColumns = await this.query<{
            name: string;
            type: string;
            default_kind: string;
            default_expression: string;
          }>(`DESCRIBE TABLE ${tableName}`);

          const existingMap = new Map(existingColumns.map((col) => [col.name, col]));

          const schemaColumns = model.schema.getColumns();

          const statements: string[] = [];

          // 2) Find missing columns → ADD COLUMN
          for (const col of schemaColumns) {
            if (!existingMap.has(col.name)) {
              statements.push(`ADD COLUMN ${col.name} ${model.schema.getColumnSQL(col.name)}`);
            }
          }

          // 3) Find removed columns → DROP COLUMN
          for (const existing of existingColumns) {
            if (!schemaColumns.find((c) => c.name === existing.name)) {
              statements.push(`DROP COLUMN ${existing.name}`);
            }
          }

          // 4) Find changed types → MODIFY COLUMN
          for (const col of schemaColumns) {
            const existing = existingMap.get(col.name);
            if (!existing) continue;

            const expectedType = model.schema.getColumnSQL(col.name).split(' ')[1];
            const currentType = existing.type;

            if (expectedType !== currentType) {
              statements.push(`MODIFY COLUMN ${col.name} ${model.schema.getColumnSQL(col.name)}`);
            }
          }

          if (statements.length === 0) {
            this.logger.info(`No schema changes needed for '${tableName}'`);
            continue;
          }

          // Apply all ALTER TABLE operations
          const alterSQL = `
    ALTER TABLE ${tableName}
    ${statements.join(',\n    ')};
  `;

          this.logger.info(`Applying schema changes for '${tableName}'`, {
            statements,
          });

          await this.command(alterSQL);

          this.logger.info(`Schema updated for '${tableName}'`);
          // ——— END AUTO-MIGRATION LOGIC ———
        } else {
          // Create if not exists
          await this.command(
            model.schema.toCreateTableSQL({
              ifNotExists: true,
              settings: options?.settings as Record<string, string | number | boolean> | undefined,
            })
          );
          this.logger.info(`Table '${tableName}' created (if not exists)`);
        }
      } catch (error) {
        this.logger.error(
          `Failed to sync table '${tableName}'`,
          error instanceof Error ? error : undefined
        );
        throw error;
      }
    }

    this.logger.info('All models synced successfully');
  }

  /**
   * Drop all tables
   */
  async drop(): Promise<void> {
    this.logger.warn('Dropping all tables...');

    for (const [tableName, model] of this.models) {
      try {
        await this.command(model.schema.toDropTableSQL(true));
        this.logger.info(`Table '${tableName}' dropped`);
      } catch (error) {
        this.logger.error(
          `Failed to drop table '${tableName}'`,
          error instanceof Error ? error : undefined
        );
        throw error;
      }
    }

    this.logger.info('All tables dropped');
  }

  /**
   * Get the underlying ClickHouse client
   */
  getClickHouseClient(): ClickHouseClient {
    return this.client;
  }

  /**
   * Get client configuration
   */
  getConfig(): Readonly<ClickORMClientConfig> {
    return { ...this.config };
  }

  /**
   * Get logger instance
   */
  getLogger(): Logger {
    return this.logger;
  }
}

/**
 * Create a new ClickORM client
 */
export function createClickORMClient(config?: ClickORMClientConfig): ClickORMClient {
  return new ClickORMClient(config);
}
