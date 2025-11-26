/**
 * Tests for core type utilities
 * Tests type guards, type inference helpers, and utility functions
 */

import {
  DataType,
  isRawExpression,
  isWhereOperator,
  createSQLIdentifier,
  RawExpression,
  WhereOperators,
  ColumnDefinition,
} from '../../../src/core/types.js';
import { ValidationError } from '../../../src/core/errors.js';

describe('Type Utilities', () => {
  describe('isRawExpression()', () => {
    it('should identify valid raw expressions', () => {
      const expr: RawExpression = {
        _brand: 'RawExpression',
        sql: 'NOW()',
      };

      expect(isRawExpression(expr)).toBe(true);
    });

    it('should reject objects without _brand', () => {
      expect(isRawExpression({ sql: 'NOW()' })).toBe(false);
    });

    it('should reject objects with wrong _brand', () => {
      expect(isRawExpression({ _brand: 'Other', sql: 'NOW()' })).toBe(false);
    });

    it('should reject non-objects', () => {
      expect(isRawExpression('string')).toBe(false);
      expect(isRawExpression(123)).toBe(false);
      expect(isRawExpression(null)).toBe(false);
      expect(isRawExpression(undefined)).toBe(false);
    });

    it('should handle raw expressions with values', () => {
      const expr: RawExpression = {
        _brand: 'RawExpression',
        sql: 'id IN (?, ?)',
        values: [1, 2],
      };

      expect(isRawExpression(expr)).toBe(true);
    });
  });

  describe('isWhereOperator()', () => {
    it('should identify valid where operators', () => {
      expect(isWhereOperator({ eq: 5 })).toBe(true);
      expect(isWhereOperator({ ne: 5 })).toBe(true);
      expect(isWhereOperator({ gt: 10 })).toBe(true);
      expect(isWhereOperator({ gte: 10 })).toBe(true);
      expect(isWhereOperator({ lt: 100 })).toBe(true);
      expect(isWhereOperator({ lte: 100 })).toBe(true);
    });

    it('should identify array operators', () => {
      expect(isWhereOperator({ in: [1, 2, 3] })).toBe(true);
      expect(isWhereOperator({ notIn: [1, 2] })).toBe(true);
    });

    it('should identify string operators', () => {
      expect(isWhereOperator({ like: '%test%' })).toBe(true);
      expect(isWhereOperator({ notLike: '%spam%' })).toBe(true);
      expect(isWhereOperator({ ilike: '%TEST%' })).toBe(true);
    });

    it('should identify null operators', () => {
      expect(isWhereOperator({ isNull: true })).toBe(true);
      expect(isWhereOperator({ notNull: true })).toBe(true);
    });

    it('should identify between operator', () => {
      expect(isWhereOperator({ between: [1, 10] })).toBe(true);
    });

    it('should reject non-objects', () => {
      expect(isWhereOperator(null)).toBe(false);
      expect(isWhereOperator(undefined)).toBe(false);
      expect(isWhereOperator('string')).toBe(false);
      expect(isWhereOperator(123)).toBe(false);
    });

    it('should reject objects with non-operator keys', () => {
      expect(isWhereOperator({ invalidKey: 5 })).toBe(false);
      expect(isWhereOperator({ name: 'test' })).toBe(false);
    });

    it('should handle multiple operators', () => {
      expect(isWhereOperator({ gt: 0, lt: 100 })).toBe(true);
    });
  });

  describe('createSQLIdentifier()', () => {
    it('should create valid SQL identifiers', () => {
      const identifier = createSQLIdentifier('users');

      expect(identifier._brand).toBe('SQLIdentifier');
      expect(identifier.value).toBe('users');
    });

    it('should allow underscores', () => {
      const identifier = createSQLIdentifier('user_name');

      expect(identifier.value).toBe('user_name');
    });

    it('should allow numbers after first character', () => {
      const identifier = createSQLIdentifier('user123');

      expect(identifier.value).toBe('user123');
    });

    it('should allow identifiers starting with underscore', () => {
      const identifier = createSQLIdentifier('_private');

      expect(identifier.value).toBe('_private');
    });

    it('should throw on invalid identifiers', () => {
      expect(() => createSQLIdentifier('user-name')).toThrow(ValidationError);
      expect(() => createSQLIdentifier('123user')).toThrow(ValidationError);
      expect(() => createSQLIdentifier('user.name')).toThrow(ValidationError);
      expect(() => createSQLIdentifier('')).toThrow(ValidationError);
    });

    it('should prevent SQL injection attempts', () => {
      expect(() => createSQLIdentifier('user; DROP TABLE users--')).toThrow(ValidationError);
      expect(() => createSQLIdentifier("user' OR 1=1--")).toThrow(ValidationError);
      expect(() => createSQLIdentifier('user`name')).toThrow(ValidationError);
    });

    it('should throw with descriptive error message', () => {
      try {
        createSQLIdentifier('invalid-name');
        throw new Error('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect((error as ValidationError).message).toContain('Invalid SQL identifier');
        expect((error as ValidationError).value).toBe('invalid-name');
      }
    });
  });

  describe('DataType enum', () => {
    it('should have integer types', () => {
      expect(DataType.UInt8).toBe('UInt8');
      expect(DataType.UInt16).toBe('UInt16');
      expect(DataType.UInt32).toBe('UInt32');
      expect(DataType.UInt64).toBe('UInt64');
      expect(DataType.Int8).toBe('Int8');
      expect(DataType.Int16).toBe('Int16');
      expect(DataType.Int32).toBe('Int32');
      expect(DataType.Int64).toBe('Int64');
    });

    it('should have floating point types', () => {
      expect(DataType.Float32).toBe('Float32');
      expect(DataType.Float64).toBe('Float64');
      expect(DataType.Decimal).toBe('Decimal');
    });

    it('should have string types', () => {
      expect(DataType.String).toBe('String');
      expect(DataType.FixedString).toBe('FixedString');
    });

    it('should have date and time types', () => {
      expect(DataType.Date).toBe('Date');
      expect(DataType.Date32).toBe('Date32');
      expect(DataType.DateTime).toBe('DateTime');
      expect(DataType.DateTime64).toBe('DateTime64');
    });

    it('should have boolean type', () => {
      expect(DataType.Boolean).toBe('Boolean');
    });

    it('should have UUID type', () => {
      expect(DataType.UUID).toBe('UUID');
    });

    it('should have enum types', () => {
      expect(DataType.Enum8).toBe('Enum8');
      expect(DataType.Enum16).toBe('Enum16');
    });

    it('should have complex types', () => {
      expect(DataType.Array).toBe('Array');
      expect(DataType.Tuple).toBe('Tuple');
      expect(DataType.Map).toBe('Map');
      expect(DataType.Nested).toBe('Nested');
      expect(DataType.JSON).toBe('JSON');
    });

    it('should have special types', () => {
      expect(DataType.Nullable).toBe('Nullable');
      expect(DataType.LowCardinality).toBe('LowCardinality');
      expect(DataType.IPv4).toBe('IPv4');
      expect(DataType.IPv6).toBe('IPv6');
    });
  });

  describe('Type inference', () => {
    it('should infer types correctly for column definitions', () => {
      // This is compile-time type checking, but we can verify runtime behavior
      const stringCol: ColumnDefinition = {
        type: DataType.String,
      };
      expect(stringCol.type).toBe(DataType.String);

      const numberCol: ColumnDefinition = {
        type: DataType.UInt32,
      };
      expect(numberCol.type).toBe(DataType.UInt32);

      const boolCol: ColumnDefinition = {
        type: DataType.Boolean,
      };
      expect(boolCol.type).toBe(DataType.Boolean);
    });

    it('should handle nullable columns', () => {
      const nullableCol: ColumnDefinition = {
        type: DataType.String,
        nullable: true,
      };

      expect(nullableCol.nullable).toBe(true);
    });

    it('should handle columns with defaults', () => {
      const colWithDefault: ColumnDefinition = {
        type: DataType.Boolean,
        default: true,
      };

      expect(colWithDefault.default).toBe(true);
    });

    it('should handle columns with default functions', () => {
      const colWithDefaultFn: ColumnDefinition = {
        type: DataType.DateTime,
        default: () => new Date(),
      };

      expect(typeof colWithDefaultFn.default).toBe('function');
    });
  });

  describe('Column definition options', () => {
    it('should support primary key flag', () => {
      const col: ColumnDefinition = {
        type: DataType.UInt32,
        primaryKey: true,
      };

      expect(col.primaryKey).toBe(true);
    });

    it('should support unique flag', () => {
      const col: ColumnDefinition = {
        type: DataType.String,
        unique: true,
      };

      expect(col.unique).toBe(true);
    });

    it('should support auto increment', () => {
      const col: ColumnDefinition = {
        type: DataType.UInt32,
        autoIncrement: true,
      };

      expect(col.autoIncrement).toBe(true);
    });

    it('should support comments', () => {
      const col: ColumnDefinition = {
        type: DataType.String,
        comment: 'User email address',
      };

      expect(col.comment).toBe('User email address');
    });

    it('should support element type for arrays', () => {
      const col: ColumnDefinition = {
        type: DataType.Array,
        elementType: DataType.String,
      };

      expect(col.elementType).toBe(DataType.String);
    });

    it('should support precision and scale for decimals', () => {
      const col: ColumnDefinition = {
        type: DataType.Decimal,
        precision: 10,
        scale: 2,
      };

      expect(col.precision).toBe(10);
      expect(col.scale).toBe(2);
    });

    it('should support length for fixed strings', () => {
      const col: ColumnDefinition = {
        type: DataType.FixedString,
        length: 10,
      };

      expect(col.length).toBe(10);
    });

    it('should support enum values', () => {
      const col: ColumnDefinition = {
        type: DataType.Enum8,
        enumValues: ['active', 'inactive', 'deleted'],
      };

      expect(col.enumValues).toEqual(['active', 'inactive', 'deleted']);
    });
  });

  describe('RawExpression interface', () => {
    it('should have required properties', () => {
      const expr: RawExpression = {
        _brand: 'RawExpression',
        sql: 'NOW()',
      };

      expect(expr._brand).toBe('RawExpression');
      expect(expr.sql).toBe('NOW()');
    });

    it('should support optional values', () => {
      const expr: RawExpression = {
        _brand: 'RawExpression',
        sql: 'id IN (?, ?)',
        values: [1, 2],
      };

      expect(expr.values).toEqual([1, 2]);
    });

    it('should be readonly', () => {
      const expr: RawExpression = {
        _brand: 'RawExpression',
        sql: 'NOW()',
      };

      // TypeScript compile-time check - attempting to modify would fail
      // expr._brand = 'other'; // Would cause TypeScript error
      expect(expr._brand).toBe('RawExpression');
    });
  });

  describe('WhereOperators interface', () => {
    it('should support comparison operators', () => {
      const ops: WhereOperators<number> = {
        eq: 5,
        ne: 10,
        gt: 0,
        gte: 1,
        lt: 100,
        lte: 99,
      };

      expect(ops.eq).toBe(5);
      expect(ops.ne).toBe(10);
      expect(ops.gt).toBe(0);
      expect(ops.gte).toBe(1);
      expect(ops.lt).toBe(100);
      expect(ops.lte).toBe(99);
    });

    it('should support array operators', () => {
      const ops: WhereOperators<number> = {
        in: [1, 2, 3],
        notIn: [4, 5, 6],
      };

      expect(ops.in).toEqual([1, 2, 3]);
      expect(ops.notIn).toEqual([4, 5, 6]);
    });

    it('should support string operators for string types', () => {
      const ops: WhereOperators<string> = {
        like: '%test%',
        notLike: '%spam%',
        ilike: '%TEST%',
      };

      expect(ops.like).toBe('%test%');
      expect(ops.notLike).toBe('%spam%');
      expect(ops.ilike).toBe('%TEST%');
    });

    it('should support between operator', () => {
      const ops: WhereOperators<number> = {
        between: [1, 10],
      };

      expect(ops.between).toEqual([1, 10]);
    });

    it('should support null operators', () => {
      const ops: WhereOperators<number> = {
        isNull: true,
        notNull: false,
      };

      expect(ops.isNull).toBe(true);
      expect(ops.notNull).toBe(false);
    });
  });
});
