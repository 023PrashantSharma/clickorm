/**
 * Comprehensive tests for ClickORM error classes
 * Tests all error types, inheritance, context handling, and utilities
 */

import {
  ClickORMError,
  ConnectionError,
  QueryError,
  ValidationError,
  SchemaError,
  TypeMappingError,
  ModelError,
  RelationError,
  TransactionError,
  MigrationError,
  NotFoundError,
  ConfigurationError,
  TimeoutError,
  ConstraintViolationError,
  DuplicateKeyError,
  SQLInjectionError,
  isClickORMError,
  isErrorOfType,
  handleError,
  formatError,
  assert,
  requireValue,
} from '../../../src/core/errors.js';

describe('ClickORMError', () => {
  describe('constructor', () => {
    it('should create error with message and code', () => {
      const error = new ClickORMError('Test error', 'TEST_CODE');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ClickORMError);
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.name).toBe('ClickORMError');
    });

    it('should store context data', () => {
      const context = { field: 'test', value: 123 };
      const error = new ClickORMError('Test error', 'TEST_CODE', context);

      expect(error.context).toEqual(context);
    });

    it('should have a stack trace', () => {
      const error = new ClickORMError('Test error', 'TEST_CODE');

      expect(error.stack).toBeDefined();
      expect(typeof error.stack).toBe('string');
    });

    it('should maintain instanceof checks', () => {
      const error = new ClickORMError('Test error', 'TEST_CODE');

      expect(error instanceof Error).toBe(true);
      expect(error instanceof ClickORMError).toBe(true);
    });
  });

  describe('toJSON()', () => {
    it('should serialize error to JSON', () => {
      const error = new ClickORMError('Test error', 'TEST_CODE', { key: 'value' });
      const json = error.toJSON();

      expect(json).toEqual({
        name: 'ClickORMError',
        message: 'Test error',
        code: 'TEST_CODE',
        context: { key: 'value' },
        stack: error.stack,
      });
    });

    it('should include stack trace', () => {
      const error = new ClickORMError('Test error', 'TEST_CODE');
      const json = error.toJSON();

      expect(json.stack).toBeDefined();
    });

    it('should handle missing context', () => {
      const error = new ClickORMError('Test error', 'TEST_CODE');
      const json = error.toJSON();

      expect(json.context).toBeUndefined();
    });
  });
});

describe('ConnectionError', () => {
  it('should extend ClickORMError', () => {
    const error = new ConnectionError('Connection failed');

    expect(error).toBeInstanceOf(ClickORMError);
    expect(error).toBeInstanceOf(ConnectionError);
  });

  it('should have correct code', () => {
    const error = new ConnectionError('Connection failed');

    expect(error.code).toBe('CONNECTION_ERROR');
    expect(error.name).toBe('ConnectionError');
  });

  it('should store connection details in context', () => {
    const context = { host: 'localhost', port: 8123 };
    const error = new ConnectionError('Connection failed', context);

    expect(error.context).toEqual(context);
  });
});

describe('QueryError', () => {
  it('should extend ClickORMError', () => {
    const error = new QueryError('Query failed');

    expect(error).toBeInstanceOf(ClickORMError);
    expect(error).toBeInstanceOf(QueryError);
  });

  it('should store query and params', () => {
    const query = 'SELECT * FROM users';
    const params = [1, 'test'];
    const error = new QueryError('Query failed', query, params);

    expect(error.query).toBe(query);
    expect(error.params).toEqual(params);
    expect(error.code).toBe('QUERY_ERROR');
  });

  it('should include query in context', () => {
    const query = 'SELECT * FROM users';
    const params = [1];
    const error = new QueryError('Query failed', query, params);

    expect(error.context).toMatchObject({ query, params });
  });
});

describe('ValidationError', () => {
  it('should extend ClickORMError', () => {
    const error = new ValidationError('Validation failed');

    expect(error).toBeInstanceOf(ClickORMError);
    expect(error).toBeInstanceOf(ValidationError);
  });

  it('should store field, value, and constraint', () => {
    const error = new ValidationError('Invalid email', 'email', 'invalid', 'email_format');

    expect(error.field).toBe('email');
    expect(error.value).toBe('invalid');
    expect(error.constraint).toBe('email_format');
    expect(error.code).toBe('VALIDATION_ERROR');
  });

  it('should work without optional parameters', () => {
    const error = new ValidationError('Validation failed');

    expect(error.field).toBeUndefined();
    expect(error.value).toBeUndefined();
    expect(error.constraint).toBeUndefined();
  });
});

describe('SchemaError', () => {
  it('should extend ClickORMError', () => {
    const error = new SchemaError('Schema error');

    expect(error).toBeInstanceOf(ClickORMError);
    expect(error).toBeInstanceOf(SchemaError);
  });

  it('should store table and column names', () => {
    const error = new SchemaError('Invalid column', 'users', 'email');

    expect(error.tableName).toBe('users');
    expect(error.columnName).toBe('email');
    expect(error.code).toBe('SCHEMA_ERROR');
  });
});

describe('TypeMappingError', () => {
  it('should extend ClickORMError', () => {
    const error = new TypeMappingError('Type mapping failed');

    expect(error).toBeInstanceOf(ClickORMError);
    expect(error).toBeInstanceOf(TypeMappingError);
  });

  it('should store source type, target type, and value', () => {
    const error = new TypeMappingError('Cannot convert', 'string', 'number', '123');

    expect(error.sourceType).toBe('string');
    expect(error.targetType).toBe('number');
    expect(error.value).toBe('123');
    expect(error.code).toBe('TYPE_MAPPING_ERROR');
  });
});

describe('ModelError', () => {
  it('should extend ClickORMError', () => {
    const error = new ModelError('Model error');

    expect(error).toBeInstanceOf(ClickORMError);
    expect(error).toBeInstanceOf(ModelError);
  });

  it('should store model name', () => {
    const error = new ModelError('Model not found', 'User');

    expect(error.modelName).toBe('User');
    expect(error.code).toBe('MODEL_ERROR');
  });
});

describe('RelationError', () => {
  it('should extend ClickORMError', () => {
    const error = new RelationError('Relation error');

    expect(error).toBeInstanceOf(ClickORMError);
    expect(error).toBeInstanceOf(RelationError);
  });

  it('should store source model, target model, and relation type', () => {
    const error = new RelationError('Invalid relation', 'User', 'Post', 'hasMany');

    expect(error.sourceModel).toBe('User');
    expect(error.targetModel).toBe('Post');
    expect(error.relationType).toBe('hasMany');
    expect(error.code).toBe('RELATION_ERROR');
  });
});

describe('TransactionError', () => {
  it('should extend ClickORMError', () => {
    const error = new TransactionError('Transaction failed');

    expect(error).toBeInstanceOf(ClickORMError);
    expect(error).toBeInstanceOf(TransactionError);
    expect(error.code).toBe('TRANSACTION_ERROR');
  });
});

describe('MigrationError', () => {
  it('should extend ClickORMError', () => {
    const error = new MigrationError('Migration failed');

    expect(error).toBeInstanceOf(ClickORMError);
    expect(error).toBeInstanceOf(MigrationError);
  });

  it('should store migration name', () => {
    const error = new MigrationError('Migration failed', '20240101_create_users');

    expect(error.migrationName).toBe('20240101_create_users');
    expect(error.code).toBe('MIGRATION_ERROR');
  });
});

describe('NotFoundError', () => {
  it('should extend ClickORMError', () => {
    const error = new NotFoundError('Not found');

    expect(error).toBeInstanceOf(ClickORMError);
    expect(error).toBeInstanceOf(NotFoundError);
  });

  it('should store resource type and identifier', () => {
    const error = new NotFoundError('User not found', 'User', 123);

    expect(error.resourceType).toBe('User');
    expect(error.identifier).toBe(123);
    expect(error.code).toBe('NOT_FOUND_ERROR');
  });
});

describe('ConfigurationError', () => {
  it('should extend ClickORMError', () => {
    const error = new ConfigurationError('Config error');

    expect(error).toBeInstanceOf(ClickORMError);
    expect(error).toBeInstanceOf(ConfigurationError);
  });

  it('should store config key', () => {
    const error = new ConfigurationError('Invalid config', 'database.host');

    expect(error.configKey).toBe('database.host');
    expect(error.code).toBe('CONFIGURATION_ERROR');
  });
});

describe('TimeoutError', () => {
  it('should extend ClickORMError', () => {
    const error = new TimeoutError('Timeout');

    expect(error).toBeInstanceOf(ClickORMError);
    expect(error).toBeInstanceOf(TimeoutError);
  });

  it('should store timeout and operation', () => {
    const error = new TimeoutError('Query timeout', 5000, 'SELECT');

    expect(error.timeout).toBe(5000);
    expect(error.operation).toBe('SELECT');
    expect(error.code).toBe('TIMEOUT_ERROR');
  });
});

describe('ConstraintViolationError', () => {
  it('should extend ClickORMError', () => {
    const error = new ConstraintViolationError('Constraint violated');

    expect(error).toBeInstanceOf(ClickORMError);
    expect(error).toBeInstanceOf(ConstraintViolationError);
  });

  it('should store constraint type and name', () => {
    const error = new ConstraintViolationError('Unique constraint', 'UNIQUE', 'email_unique');

    expect(error.constraintType).toBe('UNIQUE');
    expect(error.constraintName).toBe('email_unique');
    expect(error.code).toBe('CONSTRAINT_VIOLATION_ERROR');
  });
});

describe('DuplicateKeyError', () => {
  it('should extend ConstraintViolationError', () => {
    const error = new DuplicateKeyError('Duplicate key');

    expect(error).toBeInstanceOf(ConstraintViolationError);
    expect(error).toBeInstanceOf(DuplicateKeyError);
  });

  it('should store key and value', () => {
    const error = new DuplicateKeyError('Duplicate email', 'email', 'test@example.com');

    expect(error.key).toBe('email');
    expect(error.value).toBe('test@example.com');
    expect(error.constraintType).toBe('UNIQUE');
  });
});

describe('SQLInjectionError', () => {
  it('should extend ClickORMError', () => {
    const error = new SQLInjectionError('SQL injection detected');

    expect(error).toBeInstanceOf(ClickORMError);
    expect(error).toBeInstanceOf(SQLInjectionError);
  });

  it('should store suspicious input', () => {
    const suspiciousInput = "'; DROP TABLE users--";
    const error = new SQLInjectionError('SQL injection detected', suspiciousInput);

    expect(error.suspiciousInput).toBe(suspiciousInput);
    expect(error.code).toBe('SQL_INJECTION_ERROR');
  });
});

describe('isClickORMError()', () => {
  it('should identify ClickORM errors', () => {
    const error = new ClickORMError('Test', 'TEST');

    expect(isClickORMError(error)).toBe(true);
  });

  it('should identify subclass errors', () => {
    expect(isClickORMError(new ConnectionError('Test'))).toBe(true);
    expect(isClickORMError(new QueryError('Test'))).toBe(true);
    expect(isClickORMError(new ValidationError('Test'))).toBe(true);
  });

  it('should return false for generic Error', () => {
    const error = new Error('Generic error');

    expect(isClickORMError(error)).toBe(false);
  });

  it('should return false for non-errors', () => {
    expect(isClickORMError('string')).toBe(false);
    expect(isClickORMError(null)).toBe(false);
    expect(isClickORMError(undefined)).toBe(false);
    expect(isClickORMError({})).toBe(false);
  });
});

describe('isErrorOfType()', () => {
  it('should identify specific error type', () => {
    const error = new ValidationError('Test');

    expect(isErrorOfType(error, ValidationError)).toBe(true);
  });

  it('should return false for different error type', () => {
    const error = new ValidationError('Test');

    expect(isErrorOfType(error, ConnectionError)).toBe(false);
  });

  it('should return false for generic Error', () => {
    const error = new Error('Test');

    expect(isErrorOfType(error, ValidationError)).toBe(false);
  });
});

describe('handleError()', () => {
  it('should execute operation successfully', async () => {
    const result = await handleError(async () => 'success');

    expect(result).toBe('success');
  });

  it('should preserve ClickORM errors', async () => {
    const originalError = new ValidationError('Test error');

    await expect(
      handleError(async () => {
        throw originalError;
      })
    ).rejects.toThrow(ValidationError);
  });

  it('should wrap unknown errors', async () => {
    await expect(
      handleError(async () => {
        throw new Error('Generic error');
      })
    ).rejects.toThrow(ClickORMError);
  });

  it('should use custom error handler', async () => {
    const customError = new ConnectionError('Custom error');

    await expect(
      handleError(
        async () => {
          throw new Error('Original');
        },
        () => customError
      )
    ).rejects.toThrow(ConnectionError);
  });

  it('should wrap non-Error throws', async () => {
    await expect(
      handleError(async () => {
        throw 'string error';
      })
    ).rejects.toThrow(ClickORMError);
  });
});

describe('formatError()', () => {
  it('should format ClickORM error', () => {
    const error = new ValidationError('Test error', 'field', 'value');
    const formatted = formatError(error);

    expect(formatted).toContain('[VALIDATION_ERROR]');
    expect(formatted).toContain('Test error');
    expect(formatted).toContain('Context:');
    expect(formatted).toContain('field');
  });

  it('should format generic Error', () => {
    const error = new Error('Generic error');
    const formatted = formatError(error);

    expect(formatted).toContain('[ERROR]');
    expect(formatted).toContain('Generic error');
  });

  it('should format unknown errors', () => {
    const formatted = formatError('string error');

    expect(formatted).toContain('[UNKNOWN]');
    expect(formatted).toContain('string error');
  });

  it('should include stack trace for ClickORM errors', () => {
    const error = new ClickORMError('Test', 'TEST');
    const formatted = formatError(error);

    expect(formatted).toContain('at ');
  });
});

describe('assert()', () => {
  it('should not throw when condition is true', () => {
    expect(() => assert(true, 'Should not throw')).not.toThrow();
  });

  it('should throw ValidationError when condition is false', () => {
    expect(() => assert(false, 'Assertion failed')).toThrow(ValidationError);
  });

  it('should include field and value in error', () => {
    try {
      assert(false, 'Invalid value', 'email', 'invalid');
      throw new Error('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).field).toBe('email');
      expect((error as ValidationError).value).toBe('invalid');
    }
  });
});

describe('requireValue()', () => {
  it('should not throw for defined values', () => {
    expect(() => requireValue('value', 'field')).not.toThrow();
    expect(() => requireValue(0, 'field')).not.toThrow();
    expect(() => requireValue(false, 'field')).not.toThrow();
  });

  it('should throw for null', () => {
    expect(() => requireValue(null, 'field')).toThrow(ValidationError);
  });

  it('should throw for undefined', () => {
    expect(() => requireValue(undefined, 'field')).toThrow(ValidationError);
  });

  it('should include field name in error message', () => {
    try {
      requireValue(null, 'email');
      throw new Error('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).message).toContain('email');
    }
  });
});
