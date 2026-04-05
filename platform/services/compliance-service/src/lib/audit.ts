// 준수 현황 서비스 감사 로깅
// Design Ref: DESIGN-MTU-P14
// CSAP: D-06

import { createAuditLogger } from '@public-saas/audit-sdk';
import type { AuditEntry } from '@public-saas/types';

const auditLogger = createAuditLogger({
  serviceName: 'compliance-service',
  transport: async (entry: AuditEntry) => {
    // Design Ref: DESIGN-MTU-P13 — HTTP POST 감사 로그 전송
    const auditUrl = process.env['AUDIT_SERVICE_URL'] ?? 'http://localhost:3012';
    try {
      await fetch(`${auditUrl}/audit/logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      });
    } catch {
      console.error('감사 로그 전송 실패 — fallback 로컬 로깅');
      console.log(JSON.stringify({ level: 'audit', ...entry }));
    }
  },
});

export async function logComplianceEvent(
  action: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  await auditLogger.log({ action, metadata });
}
