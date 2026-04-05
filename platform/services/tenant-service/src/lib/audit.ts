// 테넌트 서비스 감사 로그
// Design Ref: DESIGN-MTU-P03
// Plan SC: FR-P03.8
// CSAP: D-06-01 침해사고 관리

import { createAuditLogger } from '@public-saas/audit-sdk';
import type { AuditEntry } from '@public-saas/types';

const auditLogger = createAuditLogger({
  serviceName: 'tenant-service',
  transport: async (entry: AuditEntry) => {
    // TODO: MTU-P13 (감사 로그 서비스) 구현 후 HTTP 전송으로 교체
    console.log(JSON.stringify({ level: 'audit', ...entry }));
  },
});

/**
 * 테넌트 이벤트 감사 로그 기록
 */
export async function logTenantEvent(
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
    targetType: 'tenant',
    tenantId,
    ip,
    userAgent,
    metadata,
  });
}
