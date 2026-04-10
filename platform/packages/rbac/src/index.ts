// @public-saas/rbac -- RBAC 자원별 권한 매트릭스
// Design Ref: SVC-RBAC-R8 Plan
// CSAP: D-08 접근 통제

export {
  RESOURCES,
  ACTIONS,
  ROLES,
  ROLE_PERMISSIONS,
  type Resource,
  type Action,
  type Permission,
  type Role,
  type PermissionValue,
} from './permissions.js';

export {
  RBACEngine,
  rbac,
  type UserContext,
  type PermissionCheckResult,
} from './rbac-engine.js';

export {
  rbacPlugin,
  requirePermission,
  requireAnyPermission,
  type RBACPluginOptions,
} from './rbac-plugin.js';
