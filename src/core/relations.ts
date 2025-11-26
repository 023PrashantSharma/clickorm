/**
 * Relations module for ClickORM
 * Provides Sequelize-style relationship definitions and management
 */

import { Model } from './model.js';
import { SchemaDefinition, RelationType } from './types.js';
import { RelationError } from './errors.js';

/**
 * Relation configuration options
 */
export interface RelationOptions {
  /** Foreign key in the source or target model */
  foreignKey: string;
  /** Target key (usually primary key) */
  targetKey?: string;
  /** Source key (usually primary key) */
  sourceKey?: string;
  /** Alias for accessing the relation */
  as: string;
  /** Through table for many-to-many relations */
  through?: string;
  /** Constraints configuration */
  constraints?: boolean;
  /** On delete behavior */
  onDelete?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
  /** On update behavior */
  onUpdate?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
}

/**
 * Internal relation definition storage
 */
export interface RelationDefinitionInternal {
  type: RelationType;
  source: string;
  target: string;
  options: RelationOptions;
}

/**
 * Relation registry to store all model relations
 */
export class RelationRegistry {
  private static relations: Map<string, RelationDefinitionInternal[]> = new Map();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static models: Map<string, Model<any>> = new Map();

  /**
   * Register a model in the registry
   */
  static registerModel<T extends SchemaDefinition>(modelName: string, model: Model<T>): void {
    this.models.set(modelName, model);
  }

  /**
   * Get a registered model
   */
  static getModel<T extends SchemaDefinition>(modelName: string): Model<T> | undefined {
    return this.models.get(modelName) as Model<T> | undefined;
  }

  /**
   * Add a relation definition
   */
  static addRelation(sourceModel: string, relation: RelationDefinitionInternal): void {
    if (!this.relations.has(sourceModel)) {
      this.relations.set(sourceModel, []);
    }
    this.relations.get(sourceModel)!.push(relation);
  }

  /**
   * Get all relations for a model
   */
  static getRelations(modelName: string): RelationDefinitionInternal[] {
    return this.relations.get(modelName) || [];
  }

  /**
   * Get a specific relation by alias
   */
  static getRelation(modelName: string, alias: string): RelationDefinitionInternal | undefined {
    const relations = this.getRelations(modelName);
    return relations.find((rel) => rel.options.as === alias);
  }

  /**
   * Check if a relation exists
   */
  static hasRelation(modelName: string, alias: string): boolean {
    return this.getRelation(modelName, alias) !== undefined;
  }

  /**
   * Clear all relations (useful for testing)
   */
  static clear(): void {
    this.relations.clear();
    this.models.clear();
  }
}

/**
 * Relation builder for fluent API
 */
export class RelationBuilder<T extends SchemaDefinition> {
  constructor(
    private model: Model<T>,
    private modelName: string
  ) {
    RelationRegistry.registerModel(modelName, model);
  }

  /**
   * Define a hasMany relationship
   * Example: User.hasMany(Post, { foreignKey: 'userId', as: 'posts' })
   */
  hasMany<R extends SchemaDefinition>(
    targetModel: Model<R> | string,
    options: RelationOptions
  ): void {
    const targetName = typeof targetModel === 'string' ? targetModel : targetModel.getTableName();

    // Set default sourceKey to primary key if not provided
    if (!options.sourceKey) {
      const pkColumn = this.model.schema.getPrimaryKey();
      if (pkColumn) {
        options.sourceKey = pkColumn;
      }
    }

    const relation: RelationDefinitionInternal = {
      type: RelationType.HasMany,
      source: this.modelName,
      target: targetName,
      options,
    };

    RelationRegistry.addRelation(this.modelName, relation);

    // Register target model if it's a Model instance
    if (typeof targetModel !== 'string') {
      RelationRegistry.registerModel(targetName, targetModel);
    }
  }

  /**
   * Define a hasOne relationship
   * Example: User.hasOne(Profile, { foreignKey: 'userId', as: 'profile' })
   */
  hasOne<R extends SchemaDefinition>(
    targetModel: Model<R> | string,
    options: RelationOptions
  ): void {
    const targetName = typeof targetModel === 'string' ? targetModel : targetModel.getTableName();

    // Set default sourceKey to primary key if not provided
    if (!options.sourceKey) {
      const pkColumn = this.model.schema.getPrimaryKey();
      if (pkColumn) {
        options.sourceKey = pkColumn;
      }
    }

    const relation: RelationDefinitionInternal = {
      type: RelationType.HasOne,
      source: this.modelName,
      target: targetName,
      options,
    };

    RelationRegistry.addRelation(this.modelName, relation);

    // Register target model if it's a Model instance
    if (typeof targetModel !== 'string') {
      RelationRegistry.registerModel(targetName, targetModel);
    }
  }

  /**
   * Define a belongsTo relationship
   * Example: Post.belongsTo(User, { foreignKey: 'userId', as: 'author' })
   */
  belongsTo<R extends SchemaDefinition>(
    targetModel: Model<R> | string,
    options: RelationOptions
  ): void {
    const targetName = typeof targetModel === 'string' ? targetModel : targetModel.getTableName();

    // Set default targetKey to primary key if not provided
    if (!options.targetKey) {
      // If targetModel is a Model instance, get its primary key
      if (typeof targetModel !== 'string') {
        const pkColumn = targetModel.schema.getPrimaryKey();
        if (pkColumn) {
          options.targetKey = pkColumn;
        }
      } else {
        // Default to 'id' if we don't have the model instance
        options.targetKey = 'id';
      }
    }

    const relation: RelationDefinitionInternal = {
      type: RelationType.BelongsTo,
      source: this.modelName,
      target: targetName,
      options,
    };

    RelationRegistry.addRelation(this.modelName, relation);

    // Register target model if it's a Model instance
    if (typeof targetModel !== 'string') {
      RelationRegistry.registerModel(targetName, targetModel);
    }
  }

  /**
   * Define a belongsToMany relationship (many-to-many)
   * Example: User.belongsToMany(Role, { through: 'UserRoles', foreignKey: 'userId', as: 'roles' })
   */
  belongsToMany<R extends SchemaDefinition>(
    targetModel: Model<R> | string,
    options: RelationOptions & { through: string }
  ): void {
    const targetName = typeof targetModel === 'string' ? targetModel : targetModel.getTableName();

    if (!options.through) {
      throw new RelationError(
        'belongsToMany requires a "through" option specifying the join table'
      );
    }

    const relation: RelationDefinitionInternal = {
      type: RelationType.ManyToMany,
      source: this.modelName,
      target: targetName,
      options,
    };

    RelationRegistry.addRelation(this.modelName, relation);

    // Register target model if it's a Model instance
    if (typeof targetModel !== 'string') {
      RelationRegistry.registerModel(targetName, targetModel);
    }
  }

  /**
   * Get all relations defined on this model
   */
  getRelations(): RelationDefinitionInternal[] {
    return RelationRegistry.getRelations(this.modelName);
  }

  /**
   * Get a specific relation by alias
   */
  getRelation(alias: string): RelationDefinitionInternal | undefined {
    return RelationRegistry.getRelation(this.modelName, alias);
  }
}

/**
 * Create a relation builder for a model
 */
export function createRelationBuilder<T extends SchemaDefinition>(
  model: Model<T>,
  modelName: string
): RelationBuilder<T> {
  return new RelationBuilder(model, modelName);
}

/**
 * Association helper class for managing model associations
 */
export class Association {
  /**
   * Build JOIN clause for a relation
   */
  static buildJoinClause(
    relation: RelationDefinitionInternal,
    sourceAlias: string = '',
    targetAlias: string = ''
  ): string {
    const sourceTable = sourceAlias || relation.source;
    const targetTable = targetAlias || relation.target;

    let joinType = 'LEFT JOIN';
    let onClause = '';

    switch (relation.type) {
      case RelationType.HasMany:
      case RelationType.HasOne:
        // source.sourceKey = target.foreignKey
        onClause = `${sourceTable}.${relation.options.sourceKey || 'id'} = ${targetTable}.${relation.options.foreignKey}`;
        break;

      case RelationType.BelongsTo:
        // source.foreignKey = target.targetKey
        onClause = `${sourceTable}.${relation.options.foreignKey} = ${targetTable}.${relation.options.targetKey || 'id'}`;
        break;

      case RelationType.ManyToMany: {
        const throughTable = relation.options.through;
        if (!throughTable) {
          throw new RelationError('ManyToMany relation must specify a through table');
        }
        const sourceKey = relation.options.sourceKey || 'id';
        const targetKey = relation.options.targetKey || 'id';
        const foreignKey = relation.options.foreignKey;

        // sourceTable JOIN throughTable ON sourceTable.sourceKey = throughTable.foreignKey
        // JOIN targetTable ON throughTable.targetKey = targetTable.targetKey
        const joinClause = `
LEFT JOIN ${throughTable} ON ${sourceTable}.${sourceKey} = ${throughTable}.${foreignKey}
LEFT JOIN ${targetTable} ON ${throughTable}.${relation.target}_${targetKey} = ${targetTable}.${targetKey}
`;
        return joinClause;
      }

      default:
        throw new RelationError(`Unknown relation type: ${relation.type}`);
    }

    return `${joinType} ${targetTable} ON ${onClause}`;
  }

  /**
   * Validate relation configuration
   */
  static validateRelation(relation: RelationDefinitionInternal): void {
    if (!relation.options.foreignKey) {
      throw new RelationError('Relation must specify a foreignKey');
    }

    if (!relation.options.as) {
      throw new RelationError('Relation must specify an alias (as)');
    }

    if (relation.type === RelationType.ManyToMany && !relation.options.through) {
      throw new RelationError('ManyToMany relation must specify a through table');
    }
  }
}

/**
 * Helper type for include options in queries
 */
export interface IncludeOption {
  /** Model or association alias to include */
  model?: string;
  /** Association alias */
  as?: string;
  /** Where conditions for the included model */
  where?: Record<string, unknown>;
  /** Attributes to select from included model */
  attributes?: string[] | { include?: string[]; exclude?: string[] };
  /** Nested includes */
  include?: IncludeOption[];
  /** Required (INNER JOIN) vs optional (LEFT JOIN) */
  required?: boolean;
  /** Separate query for has-many */
  separate?: boolean;
  /** Eager load this relation */
  eager?: boolean;
}
