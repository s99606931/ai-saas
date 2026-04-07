// 구독 서비스 감사 로그
// Design Ref: DESIGN-MTU-P07
// Plan SC: FR-P07.5
// CSAP: D-06-01

import { createServiceAuditLogger } from '@public-saas/audit-sdk';

/**
 * 구독 이벤트 감사 로그 기록
 */
export const logSubscriptionEvent = createServiceAuditLogger('subscription-service', 'subscription');
