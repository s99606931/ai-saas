// 공공기관 SaaS 플랫폼 — 인증 SDK
// Design Ref: D-P00.3 인증 SDK
// Plan SC: FR-P00.3
// CSAP: D-08 접근 통제

export { verifyToken, type VerifyTokenOptions } from './verify-token.js';
export { hasPermission, requirePermissions } from './rbac.js';
export { AUTH_CONSTANTS } from './constants.js';
