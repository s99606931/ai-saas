// 준수 현황 서비스 감사 로깅
// Design Ref: DESIGN-MTU-P14
// CSAP: D-06

import { createAuditLogger, createStandardTransport } from '@public-saas/audit-sdk';

const auditLogger = createAuditLogger({
  serviceName: 'compliance-service',
  transport: createStandardTransport('compliance-service'),
});

export async function logComplianceEvent(action: string, metadata?: Record<string, unknown>): Promise<void> {
  await auditLogger.log({
    actor: 'system:compliance-service',
    action,
    target: 'compliance',
    targetType: 'compliance',
    tenantId: 'system',
    ip: process.env.SERVICE_IP || '0.0.0.0',
    userAgent: 'compliance-service/1.0',
    metadata,
  });
}
