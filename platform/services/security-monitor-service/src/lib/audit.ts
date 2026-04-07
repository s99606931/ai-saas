// 보안 모니터링 서비스 감사 로깅
// Design Ref: DESIGN-MTU-P15
// CSAP: D-06

import { createAuditLogger, createStandardTransport } from '@public-saas/audit-sdk';

const auditLogger = createAuditLogger({
  serviceName: 'security-monitor-service',
  transport: createStandardTransport('security-monitor-service'),
});

export async function logSecurityEvent(
  action: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  await auditLogger.log({
    actor: 'system:security-monitor',
    action,
    target: 'security',
    targetType: 'security',
    tenantId: 'system',
    ip: '127.0.0.1',
    userAgent: 'security-monitor-service/1.0',
    metadata,
  });
}
