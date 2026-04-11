// @public-saas/secret-manager 패키지 엔트리포인트
// Design Ref: SVC-SECRETMGR-R24 Plan
// Plan SC: FR-SM.1

export {
  SecretManager,
  type SecretManagerOptions,
  type SecretManagerStats,
  type SecretAuditEntry,
} from './secret-manager.js';
export {
  secretPlugin,
  type SecretPluginOptions,
} from './secret-plugin.js';
