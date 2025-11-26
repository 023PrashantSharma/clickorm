/**
 * Type-safe WHERE clause builder for ClickORM
 * Provides fluent API for building complex WHERE conditions
 */

import {
  WhereCondition,
  WhereOperators,
  RawExpression,
  SchemaDefinition,
  InferModel,
} from '../core/types.js';
import { SQLBuilder } from '../utils/sql-builder.js';
import { ValidationError } from '../core/errors.js';
import { isRawExpression, isWhereOperator } from '../core/types.js';

/**
 * WHERE clause builder class
 * Converts typed WHERE conditions to SQL
 */
export class WhereBuilder<T extends SchemaDefinition> {
  private params: Record<string, unknown> = {};
  private paramCounter = 0;
  private startingParamCount = 0;
  private sqlBuilder: SQLBuilder;

  constructor(sqlBuilder: SQLBuilder, startingParamCount = 0) {
    this.sqlBuilder = sqlBuilder;
    this.paramCounter = startingParamCount;
    this.startingParamCount = startingParamCount;
  }

  /**
   * Build WHERE clause from condition object
   */
  build(condition: WhereCondition<InferModel<T>>): {
    sql: string;
    params: Record<string, unknown>;
  } {
    this.params = {};
    this.paramCounter = this.startingParamCount; // Use starting count, not 0!

    const sql = this.processCondition(condition);

    return {
      sql: sql || '1=1', // Default to always true if no conditions
      params: this.params,
    };
  }

  /**
   * Process a condition (recursive)
   */
  private processCondition(condition: WhereCondition<InferModel<T>>): string {
    const parts: string[] = [];

    for (const [key, value] of Object.entries(condition)) {
      // Support both 'and'/'$and', 'or'/'$or', 'not'/'$not' for MongoDB compatibility
      if (key === 'and' || key === '$and') {
        const andConditions = (value as WhereCondition<InferModel<T>>[])
          .map((c) => this.processCondition(c))
          .filter(Boolean);
        if (andConditions.length > 0) {
          parts.push(`(${andConditions.join(' AND ')})`);
        }
      } else if (key === 'or' || key === '$or') {
        const orConditions = (value as WhereCondition<InferModel<T>>[])
          .map((c) => this.processCondition(c))
          .filter(Boolean);
        if (orConditions.length > 0) {
          parts.push(`(${orConditions.join(' OR ')})`);
        }
      } else if (key === 'not' || key === '$not') {
        const notCondition = this.processCondition(value as WhereCondition<InferModel<T>>);
        if (notCondition) {
          parts.push(`NOT (${notCondition})`);
        }
      } else {
        // Field condition
        const fieldCondition = this.processFieldCondition(key, value);
        if (fieldCondition) {
          parts.push(fieldCondition);
        }
      }
    }

    return parts.join(' AND ');
  }

  /**
   * Process a field condition
   */
  private processFieldCondition(field: string, value: unknown): string {
    const fieldName = this.sqlBuilder.identifier(field);

    // Handle raw expressions
    if (isRawExpression(value)) {
      return (value as RawExpression).sql;
    }

    // Handle null/undefined
    if (value === null || value === undefined) {
      return `${fieldName} IS NULL`;
    }

    // Handle operators
    if (isWhereOperator(value)) {
      return this.processOperators(fieldName, value as WhereOperators<unknown>);
    }

    // Simple equality
    const paramName = this.addParam(value);
    return `${fieldName} = ${paramName}`;
  }

  /**
   * Process operators for a field
   */
  private processOperators(fieldName: string, operators: WhereOperators<unknown>): string {
    const parts: string[] = [];

    for (const [op, value] of Object.entries(operators)) {
      switch (op) {
        case 'eq':
          if (value === null) {
            parts.push(`${fieldName} IS NULL`);
          } else {
            parts.push(`${fieldName} = ${this.addParam(value)}`);
          }
          break;

        case 'ne':
          if (value === null) {
            parts.push(`${fieldName} IS NOT NULL`);
          } else {
            parts.push(`${fieldName} != ${this.addParam(value)}`);
          }
          break;

        case 'gt':
          parts.push(`${fieldName} > ${this.addParam(value)}`);
          break;

        case 'gte':
          parts.push(`${fieldName} >= ${this.addParam(value)}`);
          break;

        case 'lt':
          parts.push(`${fieldName} < ${this.addParam(value)}`);
          break;

        case 'lte':
          parts.push(`${fieldName} <= ${this.addParam(value)}`);
          break;

        case 'in':
          if (!Array.isArray(value)) {
            throw new ValidationError('IN operator requires an array', undefined, value);
          }
          if (value.length === 0) {
            parts.push('1=0'); // Always false for empty IN
          } else {
            const params = value.map((v) => this.addParam(v));
            parts.push(`${fieldName} IN (${params.join(', ')})`);
          }
          break;

        case 'notIn':
          if (!Array.isArray(value)) {
            throw new ValidationError('NOT IN operator requires an array', undefined, value);
          }
          if (value.length === 0) {
            parts.push('1=1'); // Always true for empty NOT IN
          } else {
            const params = value.map((v) => this.addParam(v));
            parts.push(`${fieldName} NOT IN (${params.join(', ')})`);
          }
          break;

        case 'like':
          parts.push(`${fieldName} LIKE ${this.addParam(value)}`);
          break;

        case 'notLike':
          parts.push(`${fieldName} NOT LIKE ${this.addParam(value)}`);
          break;

        case 'ilike':
          parts.push(`${fieldName} ILIKE ${this.addParam(value)}`);
          break;

        case 'between':
          if (!Array.isArray(value) || value.length !== 2) {
            throw new ValidationError(
              'BETWEEN operator requires an array of 2 values',
              undefined,
              value
            );
          }
          parts.push(
            `${fieldName} BETWEEN ${this.addParam(value[0])} AND ${this.addParam(value[1])}`
          );
          break;

        case 'isNull':
          if (value) {
            parts.push(`${fieldName} IS NULL`);
          } else {
            parts.push(`${fieldName} IS NOT NULL`);
          }
          break;

        case 'notNull':
          if (value) {
            parts.push(`${fieldName} IS NOT NULL`);
          } else {
            parts.push(`${fieldName} IS NULL`);
          }
          break;

        default:
          throw new ValidationError(`Unknown operator: ${op}`);
      }
    }

    return parts.join(' AND ');
  }

  /**
   * Add a parameter and return placeholder
   */
  private addParam(value: unknown): string {
    const paramName = `param${this.paramCounter++}`;
    this.params[paramName] = value;
    return `{${paramName}:${this.inferParamType(value)}}`;
  }

  /**
   * Infer ClickHouse parameter type
   */
  private inferParamType(value: unknown): string {
    if (value === null || value === undefined) {
      return 'Nullable(String)';
    }

    const type = typeof value;

    switch (type) {
      case 'number':
        return Number.isInteger(value) ? 'Int32' : 'Float64';
      case 'bigint':
        return 'Int64';
      case 'string':
        return 'String';
      case 'boolean':
        return 'UInt8';
      case 'object':
        if (value instanceof Date) {
          return 'DateTime';
        }
        if (Array.isArray(value)) {
          return 'Array(String)';
        }
        return 'String';
      default:
        return 'String';
    }
  }

  /**
   * Get current parameters
   */
  getParams(): Record<string, unknown> {
    return { ...this.params };
  }

  /**
   * Reset builder state
   */
  reset(): void {
    this.params = {};
    this.paramCounter = 0;
  }
}

/**
 * Helper function to build WHERE clause
 */
export function buildWhereClause<T extends SchemaDefinition>(
  condition: WhereCondition<InferModel<T>>,
  sqlBuilder: SQLBuilder
): { sql: string; params: Record<string, unknown> } {
  const whereBuilder = new WhereBuilder<T>(sqlBuilder);
  return whereBuilder.build(condition);
}

/**
 * Helper to create simple equality conditions
 */
export function eq<T>(value: T): WhereOperators<T> {
  return { eq: value };
}

/**
 * Helper to create not equal conditions
 */
export function ne<T>(value: T): WhereOperators<T> {
  return { ne: value };
}

/**
 * Helper to create greater than conditions
 */
export function gt<T>(value: T): WhereOperators<T> {
  return { gt: value };
}

/**
 * Helper to create greater than or equal conditions
 */
export function gte<T>(value: T): WhereOperators<T> {
  return { gte: value };
}

/**
 * Helper to create less than conditions
 */
export function lt<T>(value: T): WhereOperators<T> {
  return { lt: value };
}

/**
 * Helper to create less than or equal conditions
 */
export function lte<T>(value: T): WhereOperators<T> {
  return { lte: value };
}

/**
 * Helper to create IN conditions
 */
export function inArray<T>(values: T[]): WhereOperators<T> {
  return { in: values };
}

/**
 * Helper to create NOT IN conditions
 */
export function notIn<T>(values: T[]): WhereOperators<T> {
  return { notIn: values };
}

/**
 * Helper to create LIKE conditions
 */
export function like(pattern: string): WhereOperators<string> {
  return { like: pattern };
}

/**
 * Helper to create NOT LIKE conditions
 */
export function notLike(pattern: string): WhereOperators<string> {
  return { notLike: pattern };
}

/**
 * Helper to create ILIKE conditions (case-insensitive)
 */
export function ilike(pattern: string): WhereOperators<string> {
  return { ilike: pattern };
}

/**
 * Helper to create BETWEEN conditions
 */
export function between<T>(min: T, max: T): WhereOperators<T> {
  return { between: [min, max] };
}

/**
 * Helper to create IS NULL conditions
 */
export function isNull(): WhereOperators<unknown> {
  return { isNull: true };
}

/**
 * Helper to create IS NOT NULL conditions
 */
export function isNotNull(): WhereOperators<unknown> {
  return { notNull: true };
}

/**
 * Helper to combine conditions with AND
 */
export function and<T>(...conditions: WhereCondition<T>[]): WhereCondition<T> {
  return { and: conditions } as WhereCondition<T>;
}

/**
 * Helper to combine conditions with OR
 */
export function or<T>(...conditions: WhereCondition<T>[]): WhereCondition<T> {
  return { or: conditions } as WhereCondition<T>;
}

/**
 * Helper to negate a condition
 */
export function not<T>(condition: WhereCondition<T>): WhereCondition<T> {
  return { not: condition } as WhereCondition<T>;
}

/**
 * MongoDB-style helper to combine conditions with AND
 */
export function $and<T>(...conditions: WhereCondition<T>[]): WhereCondition<T> {
  return { $and: conditions } as WhereCondition<T>;
}

/**
 * MongoDB-style helper to combine conditions with OR
 */
export function $or<T>(...conditions: WhereCondition<T>[]): WhereCondition<T> {
  return { $or: conditions } as WhereCondition<T>;
}

/**
 * MongoDB-style helper to negate a condition
 */
export function $not<T>(condition: WhereCondition<T>): WhereCondition<T> {
  return { $not: condition } as WhereCondition<T>;
}
