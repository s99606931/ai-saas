// 사용자 서비스 감사 로그
// Design Ref: DESIGN-MTU-P02
// Plan SC: FR-P02.10
// CSAP: D-06-01 침해사고 관리 — append-only 감사 로그

import { createServiceAuditLogger } from '@public-saas/audit-sdk';

/**
 * 사용자 이벤트 감사 로그 기록
 *
 * audit-sdk createServiceAuditLogger 팩토리 사용 (CSAP D-06: stdout NDJSON + HTTP 이중 기록)
 */
export const logUserEvent = createServiceAuditLogger('user-service', 'user');
