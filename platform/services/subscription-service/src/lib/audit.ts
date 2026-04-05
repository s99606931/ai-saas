// 구독 서비스 감사 로그
// Design Ref: DESIGN-MTU-P07
// Plan SC: FR-P07.5
// CSAP: D-06-01

import { createAuditLogger } from '@public-saas/audit-sdk';
import type { AuditEntry } from '@public-saas/types';

const auditLogger = createAuditLogger({
  serviceName: 'subscription-service',
  transport: async (entry: AuditEntry) => {
    // TODO: MTU-P13 구현 후 HTTP 전송으로 교체
    console.log(JSON.stringify({ level: 'audit', ...entry }));
  },
});

export async function logSubscriptionEvent(
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
    targetType: 'subscription',
    tenantId,
    ip,
    userAgent,
    metadata,
  });
}
