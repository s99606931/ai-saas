// 테넌트 서비스 감사 로그
// Design Ref: DESIGN-MTU-P03
// Plan SC: FR-P03.8
// CSAP: D-06-01 침해사고 관리

import { createServiceAuditLogger } from '@public-saas/audit-sdk';

/**
 * 테넌트 이벤트 감사 로그 기록
 */
export const logTenantEvent = createServiceAuditLogger('tenant-service', 'tenant');
