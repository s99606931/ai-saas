// 보안 모니터링 서비스 감사 로깅
// Design Ref: DESIGN-MTU-P15
// CSAP: D-06

import { createAuditLogger, createStandardTransport } from '@public-saas/audit-sdk';

const auditLogger = createAuditLogger({
  serviceName: 'security-service',
  transport: createStandardTransport('security-service'),
});

export async function logSecurityEvent(action: string, metadata?: Record<string, unknown>): Promise<void> {
  await auditLogger.log({
    actor: 'system:security-service',
    action,
    target: 'security',
    targetType: 'security',
    tenantId: 'system',
    ip: process.env.SERVICE_IP || '0.0.0.0',
    userAgent: 'security-service/1.0',
    metadata,
  });
}
