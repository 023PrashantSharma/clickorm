/**
 * Hook system for ClickORM - Sequelize-style lifecycle hooks
 * Provides event-driven lifecycle management for models
 */

import { SchemaDefinition, InferModel } from './types.js';

/**
 * Hook types enum - all available hooks
 */
export enum HookType {
  // Validation hooks
  beforeValidate = 'beforeValidate',
  afterValidate = 'afterValidate',
  validationFailed = 'validationFailed',

  // Find hooks
  beforeFind = 'beforeFind',
  beforeFindAfterExpandIncludeAll = 'beforeFindAfterExpandIncludeAll',
  beforeFindAfterOptions = 'beforeFindAfterOptions',
  afterFind = 'afterFind',

  // Count hooks
  beforeCount = 'beforeCount',

  // Instance CRUD hooks
  beforeCreate = 'beforeCreate',
  afterCreate = 'afterCreate',
  beforeUpdate = 'beforeUpdate',
  afterUpdate = 'afterUpdate',
  beforeSave = 'beforeSave',
  afterSave = 'afterSave',
  beforeDestroy = 'beforeDestroy',
  afterDestroy = 'afterDestroy',

  // Bulk operation hooks
  beforeBulkCreate = 'beforeBulkCreate',
  afterBulkCreate = 'afterBulkCreate',
  beforeBulkUpdate = 'beforeBulkUpdate',
  afterBulkUpdate = 'afterBulkUpdate',
  beforeBulkDestroy = 'beforeBulkDestroy',
  afterBulkDestroy = 'afterBulkDestroy',

  // Upsert hooks
  beforeUpsert = 'beforeUpsert',
  afterUpsert = 'afterUpsert',

  // Sync hooks
  beforeSync = 'beforeSync',
  afterSync = 'afterSync',
}

/**
 * Hook callback function type
 */
export type HookCallback<T extends SchemaDefinition> = (
  instance: InferModel<T> | InferModel<T>[],
  options: HookOptions
) => void | Promise<void>;

/**
 * Options passed to hook callbacks
 */
export interface HookOptions {
  /** Transaction object if in transaction */
  transaction?: unknown;
  /** Additional context data */
  context?: Record<string, unknown>;
  /** Validation flag */
  validate?: boolean;
  /** Fields being operated on */
  fields?: string[];
  /** Individual hooks flag */
  individualHooks?: boolean;
  /** Returning flag */
  returning?: boolean;
  /** Force flag for destroy */
  force?: boolean;
  /** Limit for operations */
  limit?: number;
  /** Where conditions */
  where?: Record<string, unknown>;
  /** Raw flag */
  raw?: boolean;
}

/**
 * Hook listener with name
 */
interface HookListener<T extends SchemaDefinition> {
  name?: string;
  callback: HookCallback<T>;
}

/**
 * Hook manager class - manages lifecycle hooks for a model
 */
export class HookManager<T extends SchemaDefinition> {
  private hooks: Map<HookType, HookListener<T>[]>;

  constructor() {
    this.hooks = new Map();
  }

  /**
   * Add a hook listener
   */
  addListener(hookType: HookType | string, callback: HookCallback<T>, name?: string): void {
    const type = typeof hookType === 'string' ? (hookType as HookType) : hookType;

    if (!this.hooks.has(type)) {
      this.hooks.set(type, []);
    }

    const listeners = this.hooks.get(type)!;
    listeners.push({ name, callback });
  }

  /**
   * Remove a hook listener by name or callback
   */
  removeListener(hookType: HookType | string, nameOrCallback: string | HookCallback<T>): boolean {
    const type = typeof hookType === 'string' ? (hookType as HookType) : hookType;
    const listeners = this.hooks.get(type);

    if (!listeners) {
      return false;
    }

    const index = listeners.findIndex((listener) => {
      if (typeof nameOrCallback === 'string') {
        return listener.name === nameOrCallback;
      }
      return listener.callback === nameOrCallback;
    });

    if (index !== -1) {
      listeners.splice(index, 1);
      return true;
    }

    return false;
  }

  /**
   * Run all hooks of a specific type
   */
  async runHooks(
    hookType: HookType | string,
    instance: InferModel<T> | InferModel<T>[],
    options: HookOptions = {}
  ): Promise<void> {
    const type = typeof hookType === 'string' ? (hookType as HookType) : hookType;
    const listeners = this.hooks.get(type);

    if (!listeners || listeners.length === 0) {
      return;
    }

    for (const listener of listeners) {
      await listener.callback(instance, options);
    }
  }

  /**
   * Check if hooks exist for a type
   */
  hasHooks(hookType: HookType | string): boolean {
    const type = typeof hookType === 'string' ? (hookType as HookType) : hookType;
    const listeners = this.hooks.get(type);
    return listeners !== undefined && listeners.length > 0;
  }

  /**
   * Clear all hooks of a specific type
   */
  clearHooks(hookType?: HookType | string): void {
    if (hookType) {
      const type = typeof hookType === 'string' ? (hookType as HookType) : hookType;
      this.hooks.delete(type);
    } else {
      this.hooks.clear();
    }
  }

  /**
   * Get all hook types that have listeners
   */
  getActiveHookTypes(): HookType[] {
    return Array.from(this.hooks.keys());
  }

  /**
   * Get listener count for a hook type
   */
  getListenerCount(hookType: HookType | string): number {
    const type = typeof hookType === 'string' ? (hookType as HookType) : hookType;
    const listeners = this.hooks.get(type);
    return listeners ? listeners.length : 0;
  }
}

/**
 * Create a new hook manager instance
 */
export function createHookManager<T extends SchemaDefinition>(): HookManager<T> {
  return new HookManager<T>();
}
