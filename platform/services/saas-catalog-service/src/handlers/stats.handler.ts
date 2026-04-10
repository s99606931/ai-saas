// SaaS 카탈로그 통계 핸들러
// Design Ref: SVC-SAASCAT-R3 DESIGN
// Plan SC: FR-SCAT.5

import type { FastifyRequest, FastifyReply } from 'fastify';
import { getStats } from '../lib/store.js';

function extractTenantId(request: FastifyRequest): string | null {
  const tenantId = request.headers['x-tenant-id'];
  return typeof tenantId === 'string' && tenantId.length > 0 ? tenantId : null;
}

/**
 * GET /saas-catalog/stats -- 통계 API
 * Plan SC: FR-SCAT.5
 */
export async function getCatalogStats(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const tenantId = extractTenantId(request);
  if (!tenantId) {
    await reply.status(400).send({
      success: false,
      error: { code: 'TENANT_REQUIRED', message: 'X-Tenant-Id 헤더가 필요합니다' },
    });
    return;
  }

  const stats = getStats(tenantId);
  await reply.send({ success: true, data: stats });
}
