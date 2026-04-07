// 파일 서비스 감사 로그
// Design Ref: DESIGN-MTU-P12
// Plan SC: FR-P12.5
// CSAP: D-06-01

import { createServiceAuditLogger } from '@public-saas/audit-sdk';

/**
 * 파일 이벤트 감사 로그 기록
 */
export const logFileEvent = createServiceAuditLogger('file-service', 'file');
