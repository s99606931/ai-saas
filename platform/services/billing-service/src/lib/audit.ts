// 빌링 서비스 감사 로그
// Design Ref: DESIGN-MTU-P08
// Plan SC: FR-P08.5
// CSAP: D-06-01

import { createAuditLogger } from '@public-saas/audit-sdk';
import type { AuditEntry } from '@public-saas/types';

const auditLogger = createAuditLogger({
  serviceName: 'billing-service',
  transport: async (entry: AuditEntry) => {
    // TODO: MTU-P13 구현 후 HTTP 전송으로 교체
    console.log(JSON.stringify({ level: 'audit', ...entry }));
  },
});

export async function logBillingEvent(
  action: string,
  actor: string,
  target: string,
  tenantId: string,
  ip: string,
  userAgent: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  await auditLogger.log({
    actor,
    action,
    target,
    targetType: 'billing',
    tenantId,
    ip,
    userAgent,
    metadata,
  });
}
