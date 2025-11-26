/**
 * Comprehensive tests for WHERE clause builder
 * Tests query condition building and parameterization
 */

import {
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
  $and,
  $or,
  $not,
} from '../../../src/query/where.js';
import { SQLBuilder } from '../../../src/utils/sql-builder.js';
import { ValidationError } from '../../../src/core/errors.js';
import { usersSchema } from '../../fixtures/test-schemas.js';

describe('WhereBuilder', () => {
  let sqlBuilder: SQLBuilder;
  let whereBuilder: WhereBuilder<typeof usersSchema>;

  beforeEach(() => {
    sqlBuilder = new SQLBuilder();
    whereBuilder = new WhereBuilder(sqlBuilder);
  });

  describe('build()', () => {
    it('should build simple equality condition', () => {
      const result = whereBuilder.build({ id: 1 });

      expect(result.sql).toContain('`id` = {param0:Int32}');
      expect(result.params).toEqual({ param0: 1 });
    });

    it('should build multiple conditions with AND', () => {
      const result = whereBuilder.build({ id: 1, name: 'Test' });

      expect(result.sql).toContain('AND');
      expect(result.params.param0).toBe(1);
      expect(result.params.param1).toBe('Test');
    });

    it('should handle null values as IS NULL', () => {
      const result = whereBuilder.build({ age: null });

      expect(result.sql).toContain('`age` IS NULL');
    });

    it('should handle undefined values as IS NULL', () => {
      const result = whereBuilder.build({ age: undefined });

      expect(result.sql).toContain('`age` IS NULL');
    });

    it('should default to 1=1 for empty conditions', () => {
      const result = whereBuilder.build({});

      expect(result.sql).toBe('1=1');
    });
  });

  describe('Comparison operators', () => {
    it('should build eq (equals) condition', () => {
      const result = whereBuilder.build({ id: { eq: 5 } });

      expect(result.sql).toContain('`id` = {param0:Int32}');
      expect(result.params.param0).toBe(5);
    });

    it('should build ne (not equals) condition', () => {
      const result = whereBuilder.build({ id: { ne: 5 } });

      expect(result.sql).toContain('`id` != {param0:Int32}');
      expect(result.params.param0).toBe(5);
    });

    it('should build gt (greater than) condition', () => {
      const result = whereBuilder.build({ age: { gt: 18 } });

      expect(result.sql).toContain('`age` > {param0:Int32}');
      expect(result.params.param0).toBe(18);
    });

    it('should build gte (greater than or equal) condition', () => {
      const result = whereBuilder.build({ age: { gte: 18 } });

      expect(result.sql).toContain('`age` >= {param0:Int32}');
    });

    it('should build lt (less than) condition', () => {
      const result = whereBuilder.build({ age: { lt: 65 } });

      expect(result.sql).toContain('`age` < {param0:Int32}');
    });

    it('should build lte (less than or equal) condition', () => {
      const result = whereBuilder.build({ age: { lte: 65 } });

      expect(result.sql).toContain('`age` <= {param0:Int32}');
    });
  });

  describe('IN operator', () => {
    it('should build IN condition', () => {
      const result = whereBuilder.build({ id: { in: [1, 2, 3] } });

      expect(result.sql).toContain('`id` IN');
      expect(Object.values(result.params)).toEqual([1, 2, 3]);
    });

    it('should build NOT IN condition', () => {
      const result = whereBuilder.build({ id: { notIn: [1, 2] } });

      expect(result.sql).toContain('`id` NOT IN');
      expect(Object.values(result.params)).toEqual([1, 2]);
    });

    it('should handle empty IN array as always false', () => {
      const result = whereBuilder.build({ id: { in: [] } });

      expect(result.sql).toContain('1=0');
    });

    it('should handle empty NOT IN array as always true', () => {
      const result = whereBuilder.build({ id: { notIn: [] } });

      expect(result.sql).toContain('1=1');
    });

    it('should throw if IN operator receives non-array', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(() => whereBuilder.build({ id: { in: 'invalid' as any } })).toThrow(ValidationError);
    });
  });

  describe('LIKE operators', () => {
    it('should build LIKE condition', () => {
      const result = whereBuilder.build({ name: { like: '%test%' } });

      expect(result.sql).toContain('`name` LIKE {param0:String}');
      expect(result.params.param0).toBe('%test%');
    });

    it('should build NOT LIKE condition', () => {
      const result = whereBuilder.build({ name: { notLike: '%spam%' } });

      expect(result.sql).toContain('`name` NOT LIKE');
    });

    it('should build ILIKE condition (case-insensitive)', () => {
      const result = whereBuilder.build({ name: { ilike: '%TEST%' } });

      expect(result.sql).toContain('`name` ILIKE');
    });
  });

  describe('BETWEEN operator', () => {
    it('should build BETWEEN condition', () => {
      const result = whereBuilder.build({ age: { between: [18, 65] } });

      expect(result.sql).toContain('`age` BETWEEN');
      expect(result.sql).toContain('AND');
      expect(Object.values(result.params)).toEqual([18, 65]);
    });

    it('should throw if BETWEEN receives invalid array', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(() => whereBuilder.build({ age: { between: [18] as any } })).toThrow(ValidationError);
    });

    it('should throw if BETWEEN receives non-array', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(() => whereBuilder.build({ age: { between: 18 as any } })).toThrow(ValidationError);
    });
  });

  describe('NULL operators', () => {
    it('should build IS NULL condition', () => {
      const result = whereBuilder.build({ age: { isNull: true } });

      expect(result.sql).toContain('`age` IS NULL');
    });

    it('should build IS NOT NULL condition when isNull is false', () => {
      const result = whereBuilder.build({ age: { isNull: false } });

      expect(result.sql).toContain('`age` IS NOT NULL');
    });

    it('should build IS NOT NULL condition with notNull true', () => {
      const result = whereBuilder.build({ age: { notNull: true } });

      expect(result.sql).toContain('`age` IS NOT NULL');
    });

    it('should build IS NULL condition when notNull is false', () => {
      const result = whereBuilder.build({ age: { notNull: false } });

      expect(result.sql).toContain('`age` IS NULL');
    });

    it('should handle eq with null as IS NULL', () => {
      const result = whereBuilder.build({ age: { eq: null } });

      expect(result.sql).toContain('`age` IS NULL');
    });

    it('should handle ne with null as IS NOT NULL', () => {
      const result = whereBuilder.build({ age: { ne: null } });

      expect(result.sql).toContain('`age` IS NOT NULL');
    });
  });

  describe('Logical operators', () => {
    it('should handle AND conditions', () => {
      const result = whereBuilder.build({
        and: [{ id: { gt: 1 } }, { id: { lt: 10 } }],
      });

      expect(result.sql).toContain('AND');
      expect(result.sql).toContain('`id` >');
      expect(result.sql).toContain('`id` <');
    });

    it('should handle OR conditions', () => {
      const result = whereBuilder.build({
        or: [{ id: 1 }, { id: 2 }],
      });

      expect(result.sql).toContain('OR');
    });

    it('should handle NOT condition', () => {
      const result = whereBuilder.build({
        not: { id: 1 },
      });

      expect(result.sql).toContain('NOT');
    });

    it('should handle nested AND/OR', () => {
      const result = whereBuilder.build({
        and: [{ id: { gt: 0 } }, { or: [{ name: 'Alice' }, { name: 'Bob' }] }],
      });

      expect(result.sql).toContain('AND');
      expect(result.sql).toContain('OR');
    });
  });

  describe('Multiple operators on one field', () => {
    it('should combine multiple operators with AND', () => {
      const result = whereBuilder.build({
        age: { gt: 18, lt: 65 },
      });

      expect(result.sql).toContain('`age` > {param0:Int32} AND `age` < {param1:Int32}');
    });
  });

  describe('getParams()', () => {
    it('should return copy of parameters', () => {
      whereBuilder.build({ id: 1 });
      const params = whereBuilder.getParams();

      expect(params).toEqual({ param0: 1 });
    });
  });

  describe('reset()', () => {
    it('should reset builder state', () => {
      whereBuilder.build({ id: 1 });
      whereBuilder.reset();

      expect(whereBuilder.getParams()).toEqual({});
    });
  });
});

describe('buildWhereClause()', () => {
  it('should build WHERE clause using helper', () => {
    const sqlBuilder = new SQLBuilder();
    const result = buildWhereClause({ id: 1 }, sqlBuilder);

    expect(result.sql).toContain('`id` =');
    expect(result.params.param0).toBe(1);
  });
});

describe('Operator helper functions', () => {
  describe('eq()', () => {
    it('should create equality operator', () => {
      const op = eq(5);
      expect(op).toEqual({ eq: 5 });
    });
  });

  describe('ne()', () => {
    it('should create not equal operator', () => {
      const op = ne(5);
      expect(op).toEqual({ ne: 5 });
    });
  });

  describe('gt()', () => {
    it('should create greater than operator', () => {
      const op = gt(10);
      expect(op).toEqual({ gt: 10 });
    });
  });

  describe('gte()', () => {
    it('should create greater than or equal operator', () => {
      const op = gte(10);
      expect(op).toEqual({ gte: 10 });
    });
  });

  describe('lt()', () => {
    it('should create less than operator', () => {
      const op = lt(100);
      expect(op).toEqual({ lt: 100 });
    });
  });

  describe('lte()', () => {
    it('should create less than or equal operator', () => {
      const op = lte(100);
      expect(op).toEqual({ lte: 100 });
    });
  });

  describe('inArray()', () => {
    it('should create IN operator', () => {
      const op = inArray([1, 2, 3]);
      expect(op).toEqual({ in: [1, 2, 3] });
    });
  });

  describe('notIn()', () => {
    it('should create NOT IN operator', () => {
      const op = notIn([1, 2]);
      expect(op).toEqual({ notIn: [1, 2] });
    });
  });

  describe('like()', () => {
    it('should create LIKE operator', () => {
      const op = like('%test%');
      expect(op).toEqual({ like: '%test%' });
    });
  });

  describe('notLike()', () => {
    it('should create NOT LIKE operator', () => {
      const op = notLike('%spam%');
      expect(op).toEqual({ notLike: '%spam%' });
    });
  });

  describe('ilike()', () => {
    it('should create ILIKE operator', () => {
      const op = ilike('%TEST%');
      expect(op).toEqual({ ilike: '%TEST%' });
    });
  });

  describe('between()', () => {
    it('should create BETWEEN operator', () => {
      const op = between(1, 10);
      expect(op).toEqual({ between: [1, 10] });
    });
  });

  describe('isNull()', () => {
    it('should create IS NULL operator', () => {
      const op = isNull();
      expect(op).toEqual({ isNull: true });
    });
  });

  describe('isNotNull()', () => {
    it('should create IS NOT NULL operator', () => {
      const op = isNotNull();
      expect(op).toEqual({ notNull: true });
    });
  });

  describe('and()', () => {
    it('should create AND condition', () => {
      const condition = and({ id: 1 }, { id: 2 });
      expect(condition).toEqual({ and: [{ id: 1 }, { id: 2 }] });
    });
  });

  describe('or()', () => {
    it('should create OR condition', () => {
      const condition = or({ id: 1 }, { id: 2 });
      expect(condition).toEqual({ or: [{ id: 1 }, { id: 2 }] });
    });
  });

  describe('not()', () => {
    it('should create NOT condition', () => {
      const condition = not({ id: 1 });
      expect(condition).toEqual({ not: { id: 1 } });
    });
  });

  describe('MongoDB-style operators', () => {
    describe('$and()', () => {
      it('should create $and condition', () => {
        const condition = $and({ id: 1 }, { id: 2 });
        expect(condition).toEqual({ $and: [{ id: 1 }, { id: 2 }] });
      });
    });

    describe('$or()', () => {
      it('should create $or condition', () => {
        const condition = $or({ id: 1 }, { id: 2 });
        expect(condition).toEqual({ $or: [{ id: 1 }, { id: 2 }] });
      });
    });

    describe('$not()', () => {
      it('should create $not condition', () => {
        const condition = $not({ id: 1 });
        expect(condition).toEqual({ $not: { id: 1 } });
      });
    });
  });
});

describe('Complex query scenarios', () => {
  let sqlBuilder: SQLBuilder;
  let whereBuilder: WhereBuilder<typeof usersSchema>;

  beforeEach(() => {
    sqlBuilder = new SQLBuilder();
    whereBuilder = new WhereBuilder(sqlBuilder);
  });

  it('should build age range query', () => {
    const result = whereBuilder.build({
      age: { gte: 18, lte: 65 },
    });

    expect(result.sql).toContain('`age` >=');
    expect(result.sql).toContain('`age` <=');
  });

  it('should build search query with LIKE', () => {
    const result = whereBuilder.build({
      or: [{ name: { like: '%John%' } }, { email: { like: '%john%' } }],
    });

    expect(result.sql).toContain('LIKE');
    expect(result.sql).toContain('OR');
  });

  it('should build status filter with IN', () => {
    const result = whereBuilder.build({
      active: true,
      id: { in: [1, 2, 3, 4, 5] },
    });

    expect(result.sql).toContain('IN');
    expect(result.sql).toContain('`active`');
  });

  describe('MongoDB-style operators in where conditions', () => {
    it('should handle $and conditions', () => {
      const result = whereBuilder.build({
        $and: [{ id: { gt: 1 } }, { id: { lt: 10 } }],
      });

      expect(result.sql).toContain('AND');
      expect(result.sql).toContain('`id` >');
      expect(result.sql).toContain('`id` <');
    });

    it('should handle $or conditions', () => {
      const result = whereBuilder.build({
        $or: [{ id: 1 }, { id: 2 }],
      });

      expect(result.sql).toContain('OR');
    });

    it('should handle $not condition', () => {
      const result = whereBuilder.build({
        $not: { id: 1 },
      });

      expect(result.sql).toContain('NOT');
    });

    it('should handle nested $and/$or', () => {
      const result = whereBuilder.build({
        $and: [{ id: { gt: 0 } }, { $or: [{ name: 'Alice' }, { name: 'Bob' }] }],
      });

      expect(result.sql).toContain('AND');
      expect(result.sql).toContain('OR');
    });

    it('should handle mixed standard and MongoDB-style operators', () => {
      const result = whereBuilder.build({
        and: [{ id: { gt: 0 } }],
        $or: [{ name: 'Alice' }, { name: 'Bob' }],
      });

      expect(result.sql).toContain('AND');
      expect(result.sql).toContain('OR');
    });
  });
});
