/**
 * Type mapper for converting between TypeScript and ClickHouse types
 * Handles bidirectional type conversion and validation
 */

import { DataType, ColumnDefinition } from '../core/types.js';
import { TypeMappingError } from '../core/errors.js';

/**
 * TypeScript to ClickHouse type mapping
 */
export const TS_TO_CLICKHOUSE_MAP: Record<string, DataType> = {
  number: DataType.Float64,
  bigint: DataType.Int64,
  string: DataType.String,
  boolean: DataType.Boolean,
  object: DataType.JSON,
};

/**
 * ClickHouse to TypeScript type mapping for runtime conversion
 */
export const CLICKHOUSE_TO_TS_MAP: Record<DataType, string> = {
  [DataType.UInt8]: 'number',
  [DataType.UInt16]: 'number',
  [DataType.UInt32]: 'number',
  [DataType.UInt64]: 'bigint',
  [DataType.Int8]: 'number',
  [DataType.Int16]: 'number',
  [DataType.Int32]: 'number',
  [DataType.Int64]: 'bigint',
  [DataType.Float32]: 'number',
  [DataType.Float64]: 'number',
  [DataType.Decimal]: 'number',
  [DataType.String]: 'string',
  [DataType.FixedString]: 'string',
  [DataType.Date]: 'Date',
  [DataType.Date32]: 'Date',
  [DataType.DateTime]: 'Date',
  [DataType.DateTime64]: 'Date',
  [DataType.Boolean]: 'boolean',
  [DataType.UUID]: 'string',
  [DataType.Enum8]: 'string',
  [DataType.Enum16]: 'string',
  [DataType.Array]: 'Array',
  [DataType.Tuple]: 'Array',
  [DataType.Map]: 'object',
  [DataType.Nested]: 'object',
  [DataType.JSON]: 'object',
  [DataType.Nullable]: 'nullable',
  [DataType.LowCardinality]: 'string',
  [DataType.IPv4]: 'string',
  [DataType.IPv6]: 'string',
};

/**
 * Get ClickHouse type string for a column definition
 */
export function getClickHouseType(column: ColumnDefinition): string {
  let baseType = column.type;
  let typeStr = '';

  // Handle special cases
  switch (baseType) {
    case DataType.FixedString:
      typeStr = `FixedString(${column.length || 255})`;
      break;

    case DataType.Decimal:
      typeStr = `Decimal(${column.precision || 10}, ${column.scale || 2})`;
      break;

    case DataType.DateTime64:
      typeStr = `DateTime64(${column.precision || 3})`;
      break;

    case DataType.Array:
      if (!column.elementType) {
        throw new TypeMappingError('Array type requires elementType', baseType, undefined, column);
      }
      typeStr = `Array(${column.elementType})`;
      break;

    case DataType.LowCardinality:
      if (!column.elementType) {
        throw new TypeMappingError(
          'LowCardinality type requires elementType',
          baseType,
          undefined,
          column
        );
      }
      typeStr = `LowCardinality(${column.elementType})`;
      break;

    case DataType.Enum8:
    case DataType.Enum16: {
      if (!column.enumValues || column.enumValues.length === 0) {
        throw new TypeMappingError('Enum type requires enumValues', baseType, undefined, column);
      }
      const enumType = baseType === DataType.Enum8 ? 'Enum8' : 'Enum16';
      const enumDef = column.enumValues.map((v, i) => `'${v}' = ${i + 1}`).join(', ');
      typeStr = `${enumType}(${enumDef})`;
      break;
    }

    default:
      typeStr = baseType;
  }

  // Wrap in Nullable if needed
  if (column.nullable) {
    typeStr = `Nullable(${typeStr})`;
  }

  return typeStr;
}

/**
 * Convert JavaScript value to ClickHouse format
 */
export function toClickHouseValue(value: unknown, dataType: DataType): unknown {
  if (value === null || value === undefined) {
    return null;
  }

  switch (dataType) {
    case DataType.UInt8:
    case DataType.UInt16:
    case DataType.UInt32:
    case DataType.Int8:
    case DataType.Int16:
    case DataType.Int32:
    case DataType.Float32:
    case DataType.Float64:
    case DataType.Decimal:
      return Number(value);

    case DataType.UInt64:
    case DataType.Int64:
      return typeof value === 'bigint' ? value : BigInt(value as string | number);

    case DataType.Boolean:
      return Boolean(value);

    case DataType.String:
    case DataType.FixedString:
    case DataType.UUID:
    case DataType.IPv4:
    case DataType.IPv6:
      return String(value);

    case DataType.Date:
    case DataType.Date32:
    case DataType.DateTime:
    case DataType.DateTime64:
      if (value instanceof Date) {
        return value.toISOString();
      }
      return new Date(value as string | number).toISOString();

    case DataType.Array:
      if (!Array.isArray(value)) {
        throw new TypeMappingError('Expected array value', typeof value, DataType.Array, value);
      }
      return value;

    case DataType.JSON:
    case DataType.Map:
      if (typeof value !== 'object') {
        throw new TypeMappingError('Expected object value', typeof value, dataType, value);
      }
      return JSON.stringify(value);

    default:
      return value;
  }
}

/**
 * Convert ClickHouse value to JavaScript type
 */
export function fromClickHouseValue(value: unknown, dataType: DataType): unknown {
  if (value === null || value === undefined) {
    return null;
  }

  switch (dataType) {
    case DataType.UInt8:
    case DataType.UInt16:
    case DataType.UInt32:
    case DataType.Int8:
    case DataType.Int16:
    case DataType.Int32:
    case DataType.Float32:
    case DataType.Float64:
    case DataType.Decimal:
      return Number(value);

    case DataType.UInt64:
    case DataType.Int64: {
      // Return as number for compatibility, unless it's too large
      const bigintVal = typeof value === 'bigint' ? value : BigInt(value as string | number);
      if (bigintVal <= Number.MAX_SAFE_INTEGER && bigintVal >= Number.MIN_SAFE_INTEGER) {
        return Number(bigintVal);
      }
      return bigintVal;
    }

    case DataType.Boolean:
      return Boolean(value);

    case DataType.String:
    case DataType.FixedString:
    case DataType.UUID:
    case DataType.IPv4:
    case DataType.IPv6:
    case DataType.Enum8:
    case DataType.Enum16:
      return String(value);

    case DataType.Date:
    case DataType.Date32:
    case DataType.DateTime:
    case DataType.DateTime64:
      if (value instanceof Date) {
        return value;
      }
      return new Date(value as string | number);

    case DataType.Array:
      if (!Array.isArray(value)) {
        throw new TypeMappingError(
          'Expected array value from ClickHouse',
          typeof value,
          DataType.Array,
          value
        );
      }
      return value;

    case DataType.JSON:
    case DataType.Map:
      if (typeof value === 'string') {
        return JSON.parse(value);
      }
      return value;

    default:
      return value;
  }
}

/**
 * Validate value against column definition
 */
export function validateValue(value: unknown, column: ColumnDefinition): boolean {
  // Check nullable
  if (value === null || value === undefined) {
    if (!column.nullable) {
      throw new TypeMappingError(
        `Value cannot be null for non-nullable column`,
        typeof value,
        column.type,
        value
      );
    }
    return true;
  }

  // Type-specific validation
  switch (column.type) {
    case DataType.UInt8:
      return isInteger(value) && Number(value) >= 0 && Number(value) <= 255;

    case DataType.UInt16:
      return isInteger(value) && Number(value) >= 0 && Number(value) <= 65535;

    case DataType.UInt32:
      return isInteger(value) && Number(value) >= 0 && Number(value) <= 4294967295;

    case DataType.Int8:
      return isInteger(value) && Number(value) >= -128 && Number(value) <= 127;

    case DataType.Int16:
      return isInteger(value) && Number(value) >= -32768 && Number(value) <= 32767;

    case DataType.Int32:
      return isInteger(value) && Number(value) >= -2147483648 && Number(value) <= 2147483647;

    case DataType.Float32:
    case DataType.Float64:
    case DataType.Decimal:
      return typeof value === 'number' && !isNaN(value);

    case DataType.Int64:
    case DataType.UInt64:
      return typeof value === 'bigint' || typeof value === 'number';

    case DataType.Boolean:
      return typeof value === 'boolean';

    case DataType.String:
    case DataType.FixedString:
    case DataType.UUID:
    case DataType.IPv4:
    case DataType.IPv6:
      if (typeof value !== 'string') {
        return false;
      }
      if (column.type === DataType.FixedString && column.length) {
        return value.length <= column.length;
      }
      return true;

    case DataType.Date:
    case DataType.Date32:
    case DataType.DateTime:
    case DataType.DateTime64:
      return value instanceof Date || !isNaN(Date.parse(String(value)));

    case DataType.Array:
      return Array.isArray(value);

    case DataType.JSON:
    case DataType.Map:
      return typeof value === 'object' && value !== null;

    case DataType.Enum8:
    case DataType.Enum16:
      if (typeof value !== 'string') {
        return false;
      }
      if (column.enumValues) {
        return column.enumValues.includes(value);
      }
      return true;

    default:
      return true;
  }
}

/**
 * Helper to check if value is an integer
 */
function isInteger(value: unknown): boolean {
  return typeof value === 'number' && Number.isInteger(value);
}

/**
 * Infer ClickHouse type from JavaScript value
 */
export function inferClickHouseType(value: unknown): DataType {
  if (value === null || value === undefined) {
    return DataType.Nullable;
  }

  const type = typeof value;

  switch (type) {
    case 'number':
      return Number.isInteger(value) ? DataType.Int32 : DataType.Float64;

    case 'bigint':
      return DataType.Int64;

    case 'string':
      return DataType.String;

    case 'boolean':
      return DataType.Boolean;

    case 'object':
      if (value instanceof Date) {
        return DataType.DateTime;
      }
      if (Array.isArray(value)) {
        return DataType.Array;
      }
      return DataType.JSON;

    default:
      return DataType.String;
  }
}

/**
 * Get default value for a data type
 */
export function getDefaultValue(dataType: DataType): unknown {
  switch (dataType) {
    case DataType.UInt8:
    case DataType.UInt16:
    case DataType.UInt32:
    case DataType.Int8:
    case DataType.Int16:
    case DataType.Int32:
    case DataType.Float32:
    case DataType.Float64:
    case DataType.Decimal:
      return 0;

    case DataType.UInt64:
    case DataType.Int64:
      return BigInt(0);

    case DataType.Boolean:
      return false;

    case DataType.String:
    case DataType.FixedString:
    case DataType.UUID:
    case DataType.IPv4:
    case DataType.IPv6:
      return '';

    case DataType.Date:
    case DataType.Date32:
    case DataType.DateTime:
    case DataType.DateTime64:
      return new Date(0);

    case DataType.Array:
      return [];

    case DataType.JSON:
    case DataType.Map:
      return {};

    default:
      return null;
  }
}

/**
 * Check if two types are compatible
 */
export function areTypesCompatible(source: DataType, target: DataType): boolean {
  if (source === target) {
    return true;
  }

  // Numeric type compatibility
  const numericTypes = [
    DataType.UInt8,
    DataType.UInt16,
    DataType.UInt32,
    DataType.UInt64,
    DataType.Int8,
    DataType.Int16,
    DataType.Int32,
    DataType.Int64,
    DataType.Float32,
    DataType.Float64,
    DataType.Decimal,
  ];

  if (numericTypes.includes(source) && numericTypes.includes(target)) {
    return true;
  }

  // String type compatibility
  const stringTypes = [DataType.String, DataType.FixedString, DataType.UUID];
  if (stringTypes.includes(source) && stringTypes.includes(target)) {
    return true;
  }

  // Date type compatibility
  const dateTypes = [DataType.Date, DataType.Date32, DataType.DateTime, DataType.DateTime64];
  if (dateTypes.includes(source) && dateTypes.includes(target)) {
    return true;
  }

  return false;
}
