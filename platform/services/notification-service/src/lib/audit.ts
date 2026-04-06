// 알림 서비스 감사 로그
// Design Ref: DESIGN-MTU-P11
// Plan SC: FR-P11.5
// CSAP: D-06-01 — append-only 감사 로그

import { createAuditLogger } from '@public-saas/audit-sdk';
import type { AuditEntry } from '@public-saas/types';
import { appendFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/** 감사 로그 디렉토리 (append-only 파일 기반, CSAP D-06 준수) */
const AUDIT_LOG_DIR = process.env['AUDIT_LOG_DIR'] ?? '/var/log/saas-platform/audit';

/** 감사 로그 디렉토리 초기화 */
function ensureAuditDir(): void {
  if (!existsSync(AUDIT_LOG_DIR)) {
    mkdirSync(AUDIT_LOG_DIR, { recursive: true });
  }
}

const auditLogger = createAuditLogger({
  serviceName: 'notification-service',
  transport: async (entry: AuditEntry) => {
    ensureAuditDir();
    const logLine = JSON.stringify({ level: 'audit', ...entry }) + '\n';
    // append-only 파일 기록 (CSAP D-06-01: 수정/삭제 불가 구조)
    const logFile = join(AUDIT_LOG_DIR, `notification-service-${new Date().toISOString().slice(0, 10)}.jsonl`);
    appendFileSync(logFile, logLine, { flag: 'a' });

    // 감사 로그 서비스(MTU-P13)로 HTTP 전송 (가용 시)
    const auditServiceUrl = process.env['AUDIT_SERVICE_URL'];
    if (auditServiceUrl) {
      try {
        await fetch(`${auditServiceUrl}/audit/log`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entry),
        });
      } catch {
        // 감사 서비스 불가 시 파일 로그만 유지 (이미 기록됨)
      }
    }
  },
});

export async function logNotificationEvent(
  action: string,
  actor: string,
  target: string,
  ip: string,
  userAgent: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  await auditLogger.log({
    actor,
    action,
    target,
    targetType: 'notification',
    tenantId: 'platform',
    ip,
    userAgent,
    metadata,
  });
}
