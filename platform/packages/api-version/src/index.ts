// @public-saas/api-version -- API 버전 관리 공유 패키지
// Design Ref: SVC-APIVER-R9 Plan

export { ApiVersionManager, apiVersionManager, type ApiVersionConfig, type VersionedRoute } from './version-manager.js';

export { versionPlugin, registerVersionedRoutes, type VersionPluginOptions } from './version-plugin.js';
