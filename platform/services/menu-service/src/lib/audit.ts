// 메뉴 서비스 감사 로그
// Design Ref: DESIGN-MTU-P05
// CSAP: D-06-01

import { createServiceAuditLogger } from '@public-saas/audit-sdk';

/**
 * 메뉴 이벤트 감사 로그 기록
 */
export const logMenuEvent = createServiceAuditLogger('menu-service', 'menu');
