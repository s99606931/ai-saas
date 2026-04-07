// 알림 서비스 감사 로그
// Design Ref: DESIGN-MTU-P11
// Plan SC: FR-P11.5
// CSAP: D-06-01 — append-only 감사 로그

import { createAuditLogger, createStandardTransport } from '@public-saas/audit-sdk';

// audit-sdk 표준 팩토리 사용 (CSAP D-06: stdout NDJSON + HTTP 이중 기록)
const auditLogger = createAuditLogger({
  serviceName: 'notification-service',
  transport: createStandardTransport('notification-service'),
});

/**
 * 알림 이벤트 감사 로그 기록
 *
 * @param tenantId - 테넌트 ID (CSAP D-08-05: 테넌트 격리 추적)
 */
export async function logNotificationEvent(
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
    targetType: 'notification',
    tenantId,
    ip,
    userAgent,
    metadata,
  });
}
