/**
 * Tests for TableSchema class
 * Tests schema definition, validation, and DDL generation
 */

import {
  TableSchema,
  SchemaBuilder,
  createSchema,
  defineSchema,
  column,
} from '../../../src/core/schema.js';
import { DataType } from '../../../src/core/types.js';
import { SchemaError } from '../../../src/core/errors.js';
import { usersSchema } from '../../fixtures/test-schemas.js';

describe('TableSchema', () => {
  describe('constructor', () => {
    it('should create schema from definition', () => {
      const schema = new TableSchema('users', usersSchema);
      expect(schema.name).toBe('users');
    });

    it('should validate table name', () => {
      expect(() => new TableSchema('invalid-name', usersSchema)).toThrow();
    });

    it('should validate schema definition', () => {
      expect(() => new TableSchema('test', {})).toThrow();
    });
  });

  describe('getColumnNames()', () => {
    it('should return all column names', () => {
      const schema = new TableSchema('users', usersSchema);
      const columns = schema.getColumnNames();
      expect(columns).toContain('id');
      expect(columns).toContain('name');
      expect(columns).toContain('email');
    });
  });

  describe('getColumn()', () => {
    it('should return column definition', () => {
      const schema = new TableSchema('users', usersSchema);
      const column = schema.getColumn('id');
      expect(column).toBeDefined();
      expect(column?.type).toBe(DataType.UInt32);
    });

    it('should return undefined for non-existent column', () => {
      const schema = new TableSchema('users', usersSchema);
      expect(schema.getColumn('nonexistent')).toBeUndefined();
    });
  });

  describe('hasColumn()', () => {
    it('should return true for existing column', () => {
      const schema = new TableSchema('users', usersSchema);
      expect(schema.hasColumn('id')).toBe(true);
    });

    it('should return false for non-existent column', () => {
      const schema = new TableSchema('users', usersSchema);
      expect(schema.hasColumn('nonexistent')).toBe(false);
    });
  });

  describe('getPrimaryKey()', () => {
    it('should return primary key column', () => {
      const schema = new TableSchema('users', usersSchema);
      expect(schema.getPrimaryKey()).toBe('id');
    });

    it('should return undefined if no primary key', () => {
      const schemaWithoutPK = {
        name: { type: DataType.String },
      };
      const schema = new TableSchema('test', schemaWithoutPK);
      expect(schema.getPrimaryKey()).toBeUndefined();
    });
  });

  describe('getRequiredColumns()', () => {
    it('should return non-nullable columns without defaults', () => {
      const schema = new TableSchema('users', usersSchema);
      const required = schema.getRequiredColumns();
      expect(required).toContain('name');
      expect(required).toContain('email');
    });
  });

  describe('getOptionalColumns()', () => {
    it('should return nullable or default columns', () => {
      const schema = new TableSchema('users', usersSchema);
      const optional = schema.getOptionalColumns();
      expect(optional).toContain('age');
      expect(optional).toContain('active');
    });
  });

  describe('toCreateTableSQL()', () => {
    it('should generate CREATE TABLE statement', () => {
      const schema = new TableSchema('users', usersSchema);
      const sql = schema.toCreateTableSQL();
      expect(sql).toContain('CREATE TABLE');
      expect(sql).toContain('`users`');
      expect(sql).toContain('`id`');
      expect(sql).toContain('ENGINE =');
    });

    it('should include IF NOT EXISTS', () => {
      const schema = new TableSchema('users', usersSchema);
      const sql = schema.toCreateTableSQL({ ifNotExists: true });
      expect(sql).toContain('IF NOT EXISTS');
    });

    it('should use custom engine', () => {
      const schema = new TableSchema('users', usersSchema);
      const sql = schema.toCreateTableSQL({ engine: 'Memory' });
      expect(sql).toContain('ENGINE = Memory');
    });

    it('should include ORDER BY', () => {
      const schema = new TableSchema('users', usersSchema);
      const sql = schema.toCreateTableSQL({ orderBy: ['id', 'createdAt'] });
      expect(sql).toContain('ORDER BY');
    });

    it('should include partition by', () => {
      const schema = new TableSchema('users', usersSchema);
      const sql = schema.toCreateTableSQL({ partitionBy: 'toYYYYMM(createdAt)' });
      expect(sql).toContain('PARTITION BY');
    });
  });

  describe('toDropTableSQL()', () => {
    it('should generate DROP TABLE statement', () => {
      const schema = new TableSchema('users', usersSchema);
      const sql = schema.toDropTableSQL();
      expect(sql).toBe('DROP TABLE `users`');
    });

    it('should include IF EXISTS', () => {
      const schema = new TableSchema('users', usersSchema);
      const sql = schema.toDropTableSQL(true);
      expect(sql).toBe('DROP TABLE IF EXISTS `users`');
    });
  });

  describe('clone()', () => {
    it('should create a copy of schema', () => {
      const schema = new TableSchema('users', usersSchema);
      const cloned = schema.clone();
      expect(cloned).toBeInstanceOf(TableSchema);
      expect(cloned.name).toBe(schema.name);
    });

    it('should apply modifications', () => {
      const schema = new TableSchema('users', usersSchema);
      const cloned = schema.clone();
      expect(cloned).toBeInstanceOf(TableSchema);
      expect(cloned).not.toBe(schema);
    });
  });

  describe('addColumn()', () => {
    it('should add new column', () => {
      const schema = new TableSchema('users', usersSchema);
      const updated = schema.addColumn('phone', { type: DataType.String });
      expect(updated.hasColumn('phone')).toBe(true);
    });

    it('should throw if column exists', () => {
      const schema = new TableSchema('users', usersSchema);
      expect(() => schema.addColumn('id', { type: DataType.UInt32 })).toThrow(SchemaError);
    });
  });

  describe('removeColumn()', () => {
    it('should remove column', () => {
      const schema = new TableSchema('users', usersSchema);
      const updated = schema.removeColumn('age');
      expect(updated.hasColumn('age')).toBe(false);
    });

    it('should throw if column does not exist', () => {
      const schema = new TableSchema('users', usersSchema);
      expect(() => schema.removeColumn('nonexistent')).toThrow(SchemaError);
    });
  });

  describe('modifyColumn()', () => {
    it('should modify column definition', () => {
      const schema = new TableSchema('users', usersSchema);
      const updated = schema.modifyColumn('age', { nullable: false });
      const column = updated.getColumn('age');
      expect(column?.nullable).toBe(false);
    });

    it('should throw if column does not exist', () => {
      const schema = new TableSchema('users', usersSchema);
      expect(() => schema.modifyColumn('nonexistent', { nullable: true })).toThrow(SchemaError);
    });
  });

  describe('getDefaults()', () => {
    it('should return default values', () => {
      const schema = new TableSchema('users', usersSchema);
      const defaults = schema.getDefaults();
      expect(defaults.active).toBe(true);
    });

    it('should execute default functions', () => {
      const schema = new TableSchema('users', usersSchema);
      const defaults = schema.getDefaults();
      expect(defaults.createdAt).toBeInstanceOf(Date);
    });
  });

  describe('validate()', () => {
    it('should validate correct data', () => {
      const schema = new TableSchema('users', usersSchema);
      const data = {
        id: 1,
        name: 'Test',
        email: 'test@example.com',
      };
      expect(schema.validate(data)).toBe(true);
    });

    it('should throw on missing required fields', () => {
      const schema = new TableSchema('users', usersSchema);
      expect(() => schema.validate({ id: 1 })).toThrow(SchemaError);
    });

    it('should throw on unknown fields', () => {
      const schema = new TableSchema('users', usersSchema);
      const data = {
        id: 1,
        name: 'Test',
        email: 'test@example.com',
        unknown: 'field',
      };
      expect(() => schema.validate(data)).toThrow(SchemaError);
    });
  });

  describe('toJSON()', () => {
    it('should serialize to JSON', () => {
      const schema = new TableSchema('users', usersSchema);
      const json = schema.toJSON();
      expect(json.name).toBe('users');
      expect(json.columns).toBeDefined();
    });
  });

  describe('fromJSON()', () => {
    it('should create schema from JSON', () => {
      const json = {
        name: 'users',
        columns: usersSchema,
      };
      const schema = TableSchema.fromJSON(json);
      expect(schema).toBeInstanceOf(TableSchema);
      expect(schema.name).toBe('users');
    });
  });
});

describe('SchemaBuilder', () => {
  describe('column()', () => {
    it('should add column', () => {
      const builder = new SchemaBuilder();
      builder.column('id', { type: DataType.UInt32 });
      const schema = builder.build('test');
      expect(schema.hasColumn('id')).toBe(true);
    });
  });

  describe('Type-specific methods', () => {
    it('should add int column', () => {
      const builder = new SchemaBuilder();
      builder.int('count');
      expect(builder.getSchema()).toHaveProperty('count');
    });

    it('should add string column', () => {
      const builder = new SchemaBuilder();
      builder.string('name');
      expect(builder.getSchema()).toHaveProperty('name');
    });

    it('should add boolean column', () => {
      const builder = new SchemaBuilder();
      builder.boolean('active');
      expect(builder.getSchema()).toHaveProperty('active');
    });

    it('should add date column', () => {
      const builder = new SchemaBuilder();
      builder.date('created');
      expect(builder.getSchema()).toHaveProperty('created');
    });

    it('should add datetime column', () => {
      const builder = new SchemaBuilder();
      builder.datetime('timestamp');
      expect(builder.getSchema()).toHaveProperty('timestamp');
    });

    it('should add array column', () => {
      const builder = new SchemaBuilder();
      builder.array('tags', DataType.String);
      expect(builder.getSchema()).toHaveProperty('tags');
    });

    it('should add enum column', () => {
      const builder = new SchemaBuilder();
      builder.enum('status', ['active', 'inactive']);
      expect(builder.getSchema()).toHaveProperty('status');
    });
  });

  describe('build()', () => {
    it('should build table schema', () => {
      const builder = new SchemaBuilder();
      builder.int('id', { primaryKey: true });
      builder.string('name');
      const schema = builder.build('users');
      expect(schema).toBeInstanceOf(TableSchema);
    });
  });
});

describe('Helper functions', () => {
  describe('createSchema()', () => {
    it('should create schema builder', () => {
      const builder = createSchema();
      expect(builder).toBeInstanceOf(SchemaBuilder);
    });
  });

  describe('defineSchema()', () => {
    it('should create table schema', () => {
      const schema = defineSchema('users', usersSchema);
      expect(schema).toBeInstanceOf(TableSchema);
    });
  });

  describe('column()', () => {
    it('should create column definition', () => {
      const col = column(DataType.String, { nullable: true });
      expect(col.type).toBe(DataType.String);
      expect(col.nullable).toBe(true);
    });
  });
});
