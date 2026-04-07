// AI 서비스 감사 로그
// Design Ref: DESIGN-MTU-P10
// Plan SC: FR-P10.6
// CSAP: D-06-01, N2SF N-05

import { createServiceAuditLogger } from '@public-saas/audit-sdk';

/**
 * AI 이벤트 감사 로그 기록
 */
export const logAiEvent = createServiceAuditLogger('ai-service', 'ai');
