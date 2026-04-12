// @public-saas/event-schema-registry

export {
  validate,
  EventSchemaError,
  type Schema,
  type ObjectSchema,
  type PrimitiveSchema,
  type ValidationError,
} from './schema-validator.js';

export {
  parse,
  compare,
  isMajorBump,
  type SemVer,
} from './semver.js';

export {
  isBackwardCompatible,
  type CompatibilityResult,
} from './compatibility.js';

export {
  SchemaRegistry,
  type RegistryOptions,
} from './registry.js';
