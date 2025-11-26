/**
 * Comprehensive tests for type mapper utility
 * Tests type conversion between ClickHouse and TypeScript
 */

import {
  getClickHouseType,
  toClickHouseValue,
  fromClickHouseValue,
  validateValue,
  inferClickHouseType,
  getDefaultValue,
  areTypesCompatible,
  CLICKHOUSE_TO_TS_MAP,
  TS_TO_CLICKHOUSE_MAP,
} from '../../../src/utils/type-mapper.js';
import { DataType } from '../../../src/core/types.js';
import { TypeMappingError } from '../../../src/core/errors.js';

describe('getClickHouseType()', () => {
  it('should return basic types', () => {
    expect(getClickHouseType({ type: DataType.String })).toBe('String');
    expect(getClickHouseType({ type: DataType.UInt32 })).toBe('UInt32');
    expect(getClickHouseType({ type: DataType.Boolean })).toBe('Boolean');
  });

  it('should handle FixedString with length', () => {
    expect(getClickHouseType({ type: DataType.FixedString, length: 10 })).toBe('FixedString(10)');
  });

  it('should handle Decimal with precision and scale', () => {
    expect(getClickHouseType({ type: DataType.Decimal, precision: 10, scale: 2 })).toBe(
      'Decimal(10, 2)'
    );
  });

  it('should handle DateTime64 with precision', () => {
    expect(getClickHouseType({ type: DataType.DateTime64, precision: 3 })).toBe('DateTime64(3)');
  });

  it('should handle Array with element type', () => {
    expect(getClickHouseType({ type: DataType.Array, elementType: DataType.String })).toBe(
      'Array(String)'
    );
  });

  it('should handle LowCardinality', () => {
    expect(getClickHouseType({ type: DataType.LowCardinality, elementType: DataType.String })).toBe(
      'LowCardinality(String)'
    );
  });

  it('should handle Enum8', () => {
    expect(
      getClickHouseType({
        type: DataType.Enum8,
        enumValues: ['active', 'inactive'],
      })
    ).toBe("Enum8('active' = 1, 'inactive' = 2)");
  });

  it('should handle Nullable types', () => {
    expect(getClickHouseType({ type: DataType.String, nullable: true })).toBe('Nullable(String)');
  });

  it('should throw on Array without elementType', () => {
    expect(() => getClickHouseType({ type: DataType.Array })).toThrow(TypeMappingError);
  });
});

describe('toClickHouseValue()', () => {
  it('should convert numbers', () => {
    expect(toClickHouseValue(42, DataType.Int32)).toBe(42);
    expect(toClickHouseValue(3.14, DataType.Float64)).toBe(3.14);
  });

  it('should convert bigints', () => {
    expect(toClickHouseValue(BigInt(123), DataType.Int64)).toBe(BigInt(123));
    expect(toClickHouseValue(123, DataType.Int64)).toBe(BigInt(123));
  });

  it('should convert booleans', () => {
    expect(toClickHouseValue(true, DataType.Boolean)).toBe(true);
    expect(toClickHouseValue(false, DataType.Boolean)).toBe(false);
  });

  it('should convert strings', () => {
    expect(toClickHouseValue('test', DataType.String)).toBe('test');
  });

  it('should convert dates to ISO string', () => {
    const date = new Date('2024-01-01T00:00:00.000Z');
    const result = toClickHouseValue(date, DataType.DateTime);
    expect(result).toBe('2024-01-01T00:00:00.000Z');
  });

  it('should convert arrays', () => {
    expect(toClickHouseValue([1, 2, 3], DataType.Array)).toEqual([1, 2, 3]);
  });

  it('should stringify JSON objects', () => {
    const obj = { key: 'value' };
    expect(toClickHouseValue(obj, DataType.JSON)).toBe(JSON.stringify(obj));
  });

  it('should handle null values', () => {
    expect(toClickHouseValue(null, DataType.String)).toBeNull();
    expect(toClickHouseValue(undefined, DataType.String)).toBeNull();
  });

  it('should throw on invalid array value', () => {
    expect(() => toClickHouseValue('not array', DataType.Array)).toThrow(TypeMappingError);
  });
});

describe('fromClickHouseValue()', () => {
  it('should convert numbers', () => {
    expect(fromClickHouseValue(42, DataType.Int32)).toBe(42);
    expect(fromClickHouseValue('42', DataType.Int32)).toBe(42);
  });

  it('should convert bigints', () => {
    expect(fromClickHouseValue(BigInt(123), DataType.Int64)).toBe(123);
    const largeBigInt = BigInt(Number.MAX_SAFE_INTEGER) + 1n;
    expect(fromClickHouseValue(largeBigInt, DataType.Int64)).toBe(largeBigInt);
  });

  it('should convert strings', () => {
    expect(fromClickHouseValue('test', DataType.String)).toBe('test');
  });

  it('should convert dates', () => {
    const dateStr = '2024-01-01T00:00:00.000Z';
    const result = fromClickHouseValue(dateStr, DataType.DateTime);
    expect(result).toBeInstanceOf(Date);
    expect((result as Date).toISOString()).toBe(dateStr);
  });

  it('should parse JSON', () => {
    const json = '{"key":"value"}';
    expect(fromClickHouseValue(json, DataType.JSON)).toEqual({ key: 'value' });
  });

  it('should handle null values', () => {
    expect(fromClickHouseValue(null, DataType.String)).toBeNull();
  });
});

describe('validateValue()', () => {
  it('should validate UInt8 range', () => {
    expect(validateValue(0, { type: DataType.UInt8 })).toBe(true);
    expect(validateValue(255, { type: DataType.UInt8 })).toBe(true);
    expect(validateValue(256, { type: DataType.UInt8 })).toBe(false);
    expect(validateValue(-1, { type: DataType.UInt8 })).toBe(false);
  });

  it('should validate Int8 range', () => {
    expect(validateValue(-128, { type: DataType.Int8 })).toBe(true);
    expect(validateValue(127, { type: DataType.Int8 })).toBe(true);
    expect(validateValue(128, { type: DataType.Int8 })).toBe(false);
  });

  it('should validate strings', () => {
    expect(validateValue('test', { type: DataType.String })).toBe(true);
    expect(validateValue(123, { type: DataType.String })).toBe(false);
  });

  it('should validate FixedString length', () => {
    expect(validateValue('test', { type: DataType.FixedString, length: 10 })).toBe(true);
    expect(validateValue('toolongstring', { type: DataType.FixedString, length: 5 })).toBe(false);
  });

  it('should validate dates', () => {
    expect(validateValue(new Date(), { type: DataType.DateTime })).toBe(true);
    expect(validateValue('2024-01-01', { type: DataType.DateTime })).toBe(true);
    expect(validateValue('invalid', { type: DataType.DateTime })).toBe(false);
  });

  it('should validate arrays', () => {
    expect(validateValue([1, 2, 3], { type: DataType.Array })).toBe(true);
    expect(validateValue('not array', { type: DataType.Array })).toBe(false);
  });

  it('should validate enum values', () => {
    expect(
      validateValue('active', {
        type: DataType.Enum8,
        enumValues: ['active', 'inactive'],
      })
    ).toBe(true);
    expect(
      validateValue('unknown', {
        type: DataType.Enum8,
        enumValues: ['active', 'inactive'],
      })
    ).toBe(false);
  });

  it('should handle nullable columns', () => {
    expect(validateValue(null, { type: DataType.String, nullable: true })).toBe(true);
    expect(() => validateValue(null, { type: DataType.String, nullable: false })).toThrow(
      TypeMappingError
    );
  });
});

describe('inferClickHouseType()', () => {
  it('should infer from integers', () => {
    expect(inferClickHouseType(42)).toBe(DataType.Int32);
  });

  it('should infer from floats', () => {
    expect(inferClickHouseType(3.14)).toBe(DataType.Float64);
  });

  it('should infer from bigints', () => {
    expect(inferClickHouseType(BigInt(123))).toBe(DataType.Int64);
  });

  it('should infer from strings', () => {
    expect(inferClickHouseType('test')).toBe(DataType.String);
  });

  it('should infer from booleans', () => {
    expect(inferClickHouseType(true)).toBe(DataType.Boolean);
  });

  it('should infer from dates', () => {
    expect(inferClickHouseType(new Date())).toBe(DataType.DateTime);
  });

  it('should infer from arrays', () => {
    expect(inferClickHouseType([1, 2, 3])).toBe(DataType.Array);
  });

  it('should infer from objects', () => {
    expect(inferClickHouseType({ key: 'value' })).toBe(DataType.JSON);
  });

  it('should infer Nullable from null', () => {
    expect(inferClickHouseType(null)).toBe(DataType.Nullable);
  });
});

describe('getDefaultValue()', () => {
  it('should return default for numeric types', () => {
    expect(getDefaultValue(DataType.Int32)).toBe(0);
    expect(getDefaultValue(DataType.Float64)).toBe(0);
  });

  it('should return default for string types', () => {
    expect(getDefaultValue(DataType.String)).toBe('');
  });

  it('should return default for boolean', () => {
    expect(getDefaultValue(DataType.Boolean)).toBe(false);
  });

  it('should return default for dates', () => {
    const result = getDefaultValue(DataType.DateTime);
    expect(result).toBeInstanceOf(Date);
  });

  it('should return default for arrays', () => {
    expect(getDefaultValue(DataType.Array)).toEqual([]);
  });

  it('should return default for objects', () => {
    expect(getDefaultValue(DataType.JSON)).toEqual({});
  });
});

describe('areTypesCompatible()', () => {
  it('should return true for same types', () => {
    expect(areTypesCompatible(DataType.Int32, DataType.Int32)).toBe(true);
  });

  it('should return true for compatible numeric types', () => {
    expect(areTypesCompatible(DataType.Int32, DataType.Float64)).toBe(true);
    expect(areTypesCompatible(DataType.UInt8, DataType.Int32)).toBe(true);
  });

  it('should return true for compatible string types', () => {
    expect(areTypesCompatible(DataType.String, DataType.FixedString)).toBe(true);
  });

  it('should return true for compatible date types', () => {
    expect(areTypesCompatible(DataType.Date, DataType.DateTime)).toBe(true);
  });

  it('should return false for incompatible types', () => {
    expect(areTypesCompatible(DataType.String, DataType.Int32)).toBe(false);
    expect(areTypesCompatible(DataType.Boolean, DataType.String)).toBe(false);
  });
});

describe('Type mapping constants', () => {
  it('should have TS to ClickHouse mappings', () => {
    expect(TS_TO_CLICKHOUSE_MAP['number']).toBe(DataType.Float64);
    expect(TS_TO_CLICKHOUSE_MAP['string']).toBe(DataType.String);
    expect(TS_TO_CLICKHOUSE_MAP['boolean']).toBe(DataType.Boolean);
  });

  it('should have ClickHouse to TS mappings', () => {
    expect(CLICKHOUSE_TO_TS_MAP[DataType.Int32]).toBe('number');
    expect(CLICKHOUSE_TO_TS_MAP[DataType.String]).toBe('string');
    expect(CLICKHOUSE_TO_TS_MAP[DataType.Boolean]).toBe('boolean');
  });
});
