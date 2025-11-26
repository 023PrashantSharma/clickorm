/**
 * Comprehensive tests for validator utilities
 * Tests schema validation, data validation, and input sanitization
 */

import {
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
  createValidationRule,
  applyValidationRules,
  validateRange,
  validateLength,
  validatePattern,
} from '../../../src/utils/validator.js';
import { DataType } from '../../../src/core/types.js';
import { ValidationError } from '../../../src/core/errors.js';
import { usersSchema } from '../../fixtures/test-schemas.js';

describe('validateSchema()', () => {
  it('should validate correct schema', () => {
    expect(() => validateSchema(usersSchema)).not.toThrow();
  });

  it('should throw on empty schema', () => {
    expect(() => validateSchema({})).toThrow(ValidationError);
  });

  it('should throw on duplicate primary keys', () => {
    const invalidSchema = {
      id: { type: DataType.UInt32, primaryKey: true },
      userId: { type: DataType.UInt32, primaryKey: true },
    };

    expect(() => validateSchema(invalidSchema)).toThrow(ValidationError);
    expect(() => validateSchema(invalidSchema)).toThrow(/multiple primary keys/i);
  });

  it('should allow schema without primary key', () => {
    const schema = {
      name: { type: DataType.String },
      age: { type: DataType.UInt8 },
    };

    expect(() => validateSchema(schema)).not.toThrow();
  });

  it('should validate all columns', () => {
    const invalidSchema = {
      id: { type: DataType.UInt32 },
      'invalid-name': { type: DataType.String },
    };

    expect(() => validateSchema(invalidSchema)).toThrow(ValidationError);
  });
});

describe('validateColumnDefinition()', () => {
  it('should validate correct column definition', () => {
    expect(() => validateColumnDefinition('name', { type: DataType.String })).not.toThrow();
  });

  it('should throw on missing type', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => validateColumnDefinition('name', {} as any)).toThrow(ValidationError);
  });

  it('should throw on invalid field name', () => {
    expect(() => validateColumnDefinition('invalid-name', { type: DataType.String })).toThrow(
      ValidationError
    );
    expect(() => validateColumnDefinition('1invalid', { type: DataType.String })).toThrow(
      ValidationError
    );
  });

  it('should allow underscores in field name', () => {
    expect(() => validateColumnDefinition('user_name', { type: DataType.String })).not.toThrow();
  });

  it('should validate FixedString requires length', () => {
    expect(() =>
      validateColumnDefinition('code', {
        type: DataType.FixedString,
      })
    ).toThrow(ValidationError);

    expect(() =>
      validateColumnDefinition('code', {
        type: DataType.FixedString,
        length: 10,
      })
    ).not.toThrow();
  });

  it('should validate Decimal requires precision', () => {
    expect(() =>
      validateColumnDefinition('price', {
        type: DataType.Decimal,
      })
    ).toThrow(ValidationError);

    expect(() =>
      validateColumnDefinition('price', {
        type: DataType.Decimal,
        precision: 10,
        scale: 2,
      })
    ).not.toThrow();
  });

  it('should validate Decimal scale within precision', () => {
    expect(() =>
      validateColumnDefinition('price', {
        type: DataType.Decimal,
        precision: 10,
        scale: 15,
      })
    ).toThrow(ValidationError);
  });

  it('should validate Array requires elementType', () => {
    expect(() =>
      validateColumnDefinition('tags', {
        type: DataType.Array,
      })
    ).toThrow(ValidationError);

    expect(() =>
      validateColumnDefinition('tags', {
        type: DataType.Array,
        elementType: DataType.String,
      })
    ).not.toThrow();
  });

  it('should validate Enum requires enumValues', () => {
    expect(() =>
      validateColumnDefinition('status', {
        type: DataType.Enum8,
      })
    ).toThrow(ValidationError);

    expect(() =>
      validateColumnDefinition('status', {
        type: DataType.Enum8,
        enumValues: ['active', 'inactive'],
      })
    ).not.toThrow();
  });

  it('should validate Enum8 value count limit', () => {
    const tooManyValues = Array(257)
      .fill(0)
      .map((_, i) => `value${i}`);

    expect(() =>
      validateColumnDefinition('status', {
        type: DataType.Enum8,
        enumValues: tooManyValues,
      })
    ).toThrow(ValidationError);
  });

  it('should validate primary key cannot be nullable', () => {
    expect(() =>
      validateColumnDefinition('id', {
        type: DataType.UInt32,
        primaryKey: true,
        nullable: true,
      })
    ).toThrow(ValidationError);
  });

  it('should validate autoIncrement only for integer types', () => {
    expect(() =>
      validateColumnDefinition('id', {
        type: DataType.String,
        autoIncrement: true,
      })
    ).toThrow(ValidationError);

    expect(() =>
      validateColumnDefinition('id', {
        type: DataType.UInt32,
        autoIncrement: true,
      })
    ).not.toThrow();
  });
});

describe('validateData()', () => {
  it('should validate correct data', () => {
    const data = {
      id: 1,
      name: 'Test User',
      email: 'test@example.com',
      age: 25,
      active: true,
      createdAt: new Date(),
    };

    expect(() => validateData(data, usersSchema)).not.toThrow();
  });

  it('should throw on unknown fields', () => {
    const data = {
      id: 1,
      name: 'Test',
      email: 'test@example.com',
      unknownField: 'value',
    };

    expect(() => validateData(data, usersSchema)).toThrow(ValidationError);
  });

  it('should throw on missing required fields', () => {
    const data = {
      id: 1,
    };

    expect(() => validateData(data, usersSchema)).toThrow(ValidationError);
  });

  it('should allow nullable fields to be null', () => {
    const data = {
      id: 1,
      name: 'Test',
      email: 'test@example.com',
      age: null,
      active: true,
      createdAt: new Date(),
    };

    expect(() => validateData(data, usersSchema)).not.toThrow();
  });

  it('should allow fields with defaults to be missing', () => {
    const data = {
      id: 1,
      name: 'Test',
      email: 'test@example.com',
    };

    expect(() => validateData(data, usersSchema)).not.toThrow();
  });

  it('should validate field types', () => {
    const data = {
      id: 1,
      name: 'Test',
      email: 'test@example.com',
      age: 'invalid',
    };

    expect(() => validateData(data, usersSchema)).toThrow(ValidationError);
  });
});

describe('validatePartialData()', () => {
  it('should validate partial data', () => {
    const data = {
      name: 'Updated Name',
    };

    expect(() => validatePartialData(data, usersSchema)).not.toThrow();
  });

  it('should throw on unknown fields', () => {
    const data = {
      unknownField: 'value',
    };

    expect(() => validatePartialData(data, usersSchema)).toThrow(ValidationError);
  });

  it('should throw on primary key update', () => {
    const data = {
      id: 2,
    };

    expect(() => validatePartialData(data, usersSchema)).toThrow(ValidationError);
  });

  it('should validate provided field types', () => {
    const data = {
      age: 'invalid',
    };

    expect(() => validatePartialData(data, usersSchema)).toThrow(ValidationError);
  });

  it('should allow null/undefined in partial updates', () => {
    const data = {
      age: null,
    };

    expect(() => validatePartialData(data, usersSchema)).not.toThrow();
  });
});

describe('isValidIdentifier()', () => {
  it('should accept valid identifiers', () => {
    expect(isValidIdentifier('users')).toBe(true);
    expect(isValidIdentifier('user_name')).toBe(true);
    expect(isValidIdentifier('user123')).toBe(true);
    expect(isValidIdentifier('_private')).toBe(true);
    expect(isValidIdentifier('CamelCase')).toBe(true);
  });

  it('should reject invalid identifiers', () => {
    expect(isValidIdentifier('user-name')).toBe(false);
    expect(isValidIdentifier('123user')).toBe(false);
    expect(isValidIdentifier('user name')).toBe(false);
    expect(isValidIdentifier('user.name')).toBe(false);
    expect(isValidIdentifier('')).toBe(false);
  });

  it('should reject SQL keywords (implicit)', () => {
    // Basic validation doesn't explicitly check for keywords
    // but special characters would be rejected
    expect(isValidIdentifier('user;DROP')).toBe(false);
  });
});

describe('validateTableName()', () => {
  it('should validate correct table names', () => {
    expect(() => validateTableName('users')).not.toThrow();
    expect(() => validateTableName('user_accounts')).not.toThrow();
  });

  it('should throw on empty table name', () => {
    expect(() => validateTableName('')).toThrow(ValidationError);
  });

  it('should throw on invalid table name', () => {
    expect(() => validateTableName('user-name')).toThrow(ValidationError);
    expect(() => validateTableName('123users')).toThrow(ValidationError);
  });

  it('should throw on too long table name', () => {
    const longName = 'a'.repeat(65);
    expect(() => validateTableName(longName)).toThrow(ValidationError);
  });

  it('should accept table name of exactly 64 characters', () => {
    const name = 'a'.repeat(64);
    expect(() => validateTableName(name)).not.toThrow();
  });
});

describe('validateQueryOptions()', () => {
  it('should validate correct options', () => {
    expect(() =>
      validateQueryOptions({
        limit: 10,
        offset: 0,
        timeout: 5000,
      })
    ).not.toThrow();
  });

  it('should throw on negative limit', () => {
    expect(() => validateQueryOptions({ limit: -1 })).toThrow(ValidationError);
  });

  it('should throw on non-integer limit', () => {
    expect(() => validateQueryOptions({ limit: 3.14 })).toThrow(ValidationError);
  });

  it('should throw on negative offset', () => {
    expect(() => validateQueryOptions({ offset: -1 })).toThrow(ValidationError);
  });

  it('should throw on negative timeout', () => {
    expect(() => validateQueryOptions({ timeout: -1 })).toThrow(ValidationError);
  });

  it('should throw on zero timeout', () => {
    expect(() => validateQueryOptions({ timeout: 0 })).toThrow(ValidationError);
  });

  it('should allow zero limit and offset', () => {
    expect(() =>
      validateQueryOptions({
        limit: 0,
        offset: 0,
      })
    ).not.toThrow();
  });
});

describe('validateWhereCondition()', () => {
  it('should validate simple conditions', () => {
    expect(() => validateWhereCondition({ id: 1 })).not.toThrow();
  });

  it('should validate null/undefined', () => {
    expect(() => validateWhereCondition(null)).not.toThrow();
    expect(() => validateWhereCondition(undefined)).not.toThrow();
  });

  it('should validate operator conditions', () => {
    expect(() => validateWhereCondition({ gt: 5 })).not.toThrow();
    expect(() => validateWhereCondition({ in: [1, 2, 3] })).not.toThrow();
  });

  it('should validate logical operators', () => {
    expect(() => validateWhereCondition({ and: [{ id: 1 }] })).not.toThrow();
    expect(() => validateWhereCondition({ or: [{ id: 1 }] })).not.toThrow();
  });

  it('should validate field-like operators', () => {
    // validateWhereCondition accepts valid field names, even if they look like operators
    // This is expected behavior as it validates the structure, not field existence
    expect(() => validateWhereCondition({ customField: 5 })).not.toThrow();
  });
});

describe('sanitizeInput()', () => {
  it('should remove null bytes', () => {
    const input = 'test\0data';
    const sanitized = sanitizeInput(input);

    expect(sanitized).toBe('testdata');
  });

  it('should preserve normal strings', () => {
    const input = 'normal string';
    const sanitized = sanitizeInput(input);

    expect(sanitized).toBe(input);
  });

  it('should convert non-strings', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(sanitizeInput(123 as any)).toBe('123');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(sanitizeInput(true as any)).toBe('true');
  });
});

describe('isValidEmail()', () => {
  it('should validate correct emails', () => {
    expect(isValidEmail('test@example.com')).toBe(true);
    expect(isValidEmail('user.name@domain.co.uk')).toBe(true);
    expect(isValidEmail('user+tag@example.com')).toBe(true);
  });

  it('should reject invalid emails', () => {
    expect(isValidEmail('invalid')).toBe(false);
    expect(isValidEmail('@example.com')).toBe(false);
    expect(isValidEmail('user@')).toBe(false);
    expect(isValidEmail('user @example.com')).toBe(false);
  });
});

describe('isValidUUID()', () => {
  it('should validate correct UUIDs', () => {
    expect(isValidUUID('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
    expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
  });

  it('should reject invalid UUIDs', () => {
    expect(isValidUUID('invalid-uuid')).toBe(false);
    expect(isValidUUID('123e4567-e89b-12d3-a456')).toBe(false);
    expect(isValidUUID('123e4567-e89b-72d3-a456-426614174000')).toBe(false); // Invalid version
  });

  it('should be case insensitive', () => {
    expect(isValidUUID('123E4567-E89B-12D3-A456-426614174000')).toBe(true);
  });
});

describe('isValidIPv4()', () => {
  it('should validate correct IPv4 addresses', () => {
    expect(isValidIPv4('192.168.1.1')).toBe(true);
    expect(isValidIPv4('0.0.0.0')).toBe(true);
    expect(isValidIPv4('255.255.255.255')).toBe(true);
  });

  it('should reject invalid IPv4 addresses', () => {
    expect(isValidIPv4('256.1.1.1')).toBe(false);
    expect(isValidIPv4('192.168.1')).toBe(false);
    expect(isValidIPv4('192.168.1.1.1')).toBe(false);
    expect(isValidIPv4('abc.def.ghi.jkl')).toBe(false);
  });
});

describe('isValidIPv6()', () => {
  it('should validate correct IPv6 addresses', () => {
    expect(isValidIPv6('2001:0db8:85a3:0000:0000:8a2e:0370:7334')).toBe(true);
    expect(isValidIPv6('2001:db8:85a3::8a2e:370:7334')).toBe(true);
    expect(isValidIPv6('::1')).toBe(true);
    expect(isValidIPv6('::')).toBe(true);
  });

  it('should reject invalid IPv6 addresses', () => {
    expect(isValidIPv6('invalid')).toBe(false);
    expect(isValidIPv6('gggg::1')).toBe(false);
  });
});

describe('isValidURL()', () => {
  it('should validate correct URLs', () => {
    expect(isValidURL('https://example.com')).toBe(true);
    expect(isValidURL('http://localhost:8080')).toBe(true);
    expect(isValidURL('ftp://files.example.com')).toBe(true);
  });

  it('should reject invalid URLs', () => {
    expect(isValidURL('not a url')).toBe(false);
    expect(isValidURL('example.com')).toBe(false); // Missing protocol
  });
});

describe('createValidationRule()', () => {
  it('should create validation rule', () => {
    const rule = createValidationRule((v) => typeof v === 'string', 'Must be string');

    expect(rule.validate('test')).toBe(true);
    expect(rule.validate(123)).toBe(false);
    expect(rule.message).toBe('Must be string');
  });
});

describe('applyValidationRules()', () => {
  it('should pass when all rules pass', () => {
    const rules = [
      createValidationRule((v) => typeof v === 'number', 'Must be number'),
      createValidationRule((v) => (v as number) > 0, 'Must be positive'),
    ];

    expect(() => applyValidationRules(5, rules)).not.toThrow();
  });

  it('should throw when a rule fails', () => {
    const rules = [
      createValidationRule((v) => typeof v === 'number', 'Must be number'),
      createValidationRule((v) => (v as number) > 0, 'Must be positive'),
    ];

    expect(() => applyValidationRules(-5, rules)).toThrow(ValidationError);
  });

  it('should include field name in error', () => {
    const rules = [createValidationRule((v) => typeof v === 'number', 'Must be number')];

    try {
      applyValidationRules('invalid', rules, 'age');
      throw new Error('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).field).toBe('age');
    }
  });
});

describe('validateRange()', () => {
  it('should pass for values in range', () => {
    expect(() => validateRange(5, 0, 10)).not.toThrow();
    expect(() => validateRange(0, 0, 10)).not.toThrow();
    expect(() => validateRange(10, 0, 10)).not.toThrow();
  });

  it('should throw for values out of range', () => {
    expect(() => validateRange(-1, 0, 10)).toThrow(ValidationError);
    expect(() => validateRange(11, 0, 10)).toThrow(ValidationError);
  });

  it('should include field name in error', () => {
    try {
      validateRange(15, 0, 10, 'age');
      throw new Error('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).field).toBe('age');
    }
  });
});

describe('validateLength()', () => {
  it('should pass for strings in length range', () => {
    expect(() => validateLength('test', 1, 10)).not.toThrow();
    expect(() => validateLength('a', 1, 10)).not.toThrow();
    expect(() => validateLength('1234567890', 1, 10)).not.toThrow();
  });

  it('should throw for strings out of length range', () => {
    expect(() => validateLength('', 1, 10)).toThrow(ValidationError);
    expect(() => validateLength('12345678901', 1, 10)).toThrow(ValidationError);
  });

  it('should include field name in error', () => {
    try {
      validateLength('toolongstring', 1, 5, 'name');
      throw new Error('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).field).toBe('name');
    }
  });
});

describe('validatePattern()', () => {
  it('should pass for matching patterns', () => {
    const pattern = /^[A-Z]{3}$/;
    expect(() => validatePattern('ABC', pattern)).not.toThrow();
  });

  it('should throw for non-matching patterns', () => {
    const pattern = /^[A-Z]{3}$/;
    expect(() => validatePattern('abc', pattern)).toThrow(ValidationError);
    expect(() => validatePattern('ABCD', pattern)).toThrow(ValidationError);
  });

  it('should include field name in error', () => {
    const pattern = /^[0-9]+$/;
    try {
      validatePattern('abc', pattern, 'code');
      throw new Error('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).field).toBe('code');
    }
  });
});
