// CRM 서비스 감사 로그
// Design Ref: DESIGN-MTU-P09
// Plan SC: FR-P09.5
// CSAP: D-06-01

import { createServiceAuditLogger } from '@public-saas/audit-sdk';

/**
 * CRM 이벤트 감사 로그 기록
 *
 * audit-sdk createServiceAuditLogger 팩토리 사용 (CSAP D-06: stdout NDJSON + HTTP 이중 기록)
 * tenantId 파라미터 포함 (CSAP D-08-05: 테넌트 격리 추적)
 */
export const logCrmEvent = createServiceAuditLogger('crm-service', 'crm');
