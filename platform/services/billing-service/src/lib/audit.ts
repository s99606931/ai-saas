// 빌링 서비스 감사 로그
// Design Ref: DESIGN-MTU-P08
// Plan SC: FR-P08.5
// CSAP: D-06-01

import { createServiceAuditLogger } from '@public-saas/audit-sdk';

/**
 * 빌링 이벤트 감사 로그 기록
 *
 * createServiceAuditLogger 팩토리로 보일러플레이트 제거
 */
export const logBillingEvent = createServiceAuditLogger('billing-service', 'billing');
