// @public-saas/config-vault 패키지 엔트리포인트
// Design Ref: SVC-CONFIG-R16 Plan
// Plan SC: FR-CFG.1

export {
  ConfigLoader,
  ConfigError,
  type ConfigSource,
  type ConfigChangeEvent,
  type ConfigChangeListener,
} from './config-loader.js';
export {
  ConfigValidator,
  type ConfigSchema,
  type SchemaField,
  type FieldType,
  type ValidationResult,
  type ValidationError,
} from './config-validator.js';
export {
  SecretResolver,
  type SecretResolutionResult,
} from './secret-resolver.js';
export {
  configPlugin,
  type ConfigPluginOptions,
  type ConfigDecorator,
} from './config-plugin.js';
