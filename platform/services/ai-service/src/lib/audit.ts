// AI 서비스 감사 로그
// Design Ref: DESIGN-MTU-P10
// Plan SC: FR-P10.6
// CSAP: D-06-01, N2SF N-05

import { createAuditLogger } from '@public-saas/audit-sdk';
import type { AuditEntry } from '@public-saas/types';

const auditLogger = createAuditLogger({
  serviceName: 'ai-service',
  transport: async (entry: AuditEntry) => {
    // TODO: MTU-P13 구현 후 HTTP 전송으로 교체
    console.log(JSON.stringify({ level: 'audit', ...entry }));
  },
});

export async function logAiEvent(
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
    targetType: 'ai',
    tenantId,
    ip,
    userAgent,
    metadata,
  });
}
