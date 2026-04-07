// 카탈로그 서비스 감사 로그
// Design Ref: DESIGN-MTU-P06
// CSAP: D-06-01

import { createAuditLogger, createStandardTransport } from '@public-saas/audit-sdk';

const auditLogger = createAuditLogger({
  serviceName: 'catalog-service',
  transport: createStandardTransport('catalog-service'),
});

export async function logCatalogEvent(
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
    targetType: 'service',
    tenantId: 'platform',
    ip,
    userAgent,
    metadata,
  });
}
