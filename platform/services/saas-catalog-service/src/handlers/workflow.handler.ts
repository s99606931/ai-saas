// SaaS 카탈로그 승인 워크플로 핸들러
// Design Ref: SVC-SAASCAT-R3 DESIGN -- 상태 전이 다이어그램
// Plan SC: FR-SCAT.4
// CSAP: D-06 감사 로그, D-08 접근 통제

import type { FastifyRequest, FastifyReply } from 'fastify';
import { rejectSchema } from '../schemas/catalog.schema.js';
import { getItem, updateItem } from '../lib/store.js';
import { recordAudit } from '../lib/audit.js';

function extractTenantId(request: FastifyRequest): string | null {
  const tenantId = request.headers['x-tenant-id'];
  return typeof tenantId === 'string' && tenantId.length > 0 ? tenantId : null;
}

function extractUserId(request: FastifyRequest): string {
  const user = (request as FastifyRequest & { user?: { sub?: string } }).user;
  return user?.sub ?? 'anonymous';
}

/**
 * POST /saas-catalog/:id/submit -- DRAFT -> PENDING
 * Plan SC: FR-SCAT.4
 */
export async function submitCatalog(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const tenantId = extractTenantId(request);
  if (!tenantId) {
    await reply.status(400).send({
      success: false,
      error: { code: 'TENANT_REQUIRED', message: 'X-Tenant-Id 헤더가 필요합니다' },
    });
    return;
  }

  const { id } = request.params as { id: string };
  const item = getItem(id, tenantId);
  if (!item) {
    await reply.status(404).send({
      success: false,
      error: { code: 'NOT_FOUND', message: '카탈로그 항목을 찾을 수 없습니다' },
    });
    return;
  }

  if (item.status !== 'DRAFT') {
    await reply.status(409).send({
      success: false,
      error: { code: 'INVALID_STATUS', message: `DRAFT 상태에서만 제출할 수 있습니다 (현재: ${item.status})` },
    });
    return;
  }

  const userId = extractUserId(request);
  const updated = updateItem(id, tenantId, { status: 'PENDING', updatedBy: userId });

  recordAudit({
    timestamp: new Date().toISOString(),
    actor: userId,
    tenantId,
    action: 'CATALOG_SUBMIT',
    target: id,
    details: { from: 'DRAFT', to: 'PENDING' },
  });

  await reply.send({ success: true, data: updated });
}

/**
 * POST /saas-catalog/:id/approve -- PENDING -> APPROVED
 * Plan SC: FR-SCAT.4
 */
export async function approveCatalog(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const tenantId = extractTenantId(request);
  if (!tenantId) {
    await reply.status(400).send({
      success: false,
      error: { code: 'TENANT_REQUIRED', message: 'X-Tenant-Id 헤더가 필요합니다' },
    });
    return;
  }

  const { id } = request.params as { id: string };
  const item = getItem(id, tenantId);
  if (!item) {
    await reply.status(404).send({
      success: false,
      error: { code: 'NOT_FOUND', message: '카탈로그 항목을 찾을 수 없습니다' },
    });
    return;
  }

  if (item.status !== 'PENDING') {
    await reply.status(409).send({
      success: false,
      error: { code: 'INVALID_STATUS', message: `PENDING 상태에서만 승인할 수 있습니다 (현재: ${item.status})` },
    });
    return;
  }

  const userId = extractUserId(request);
  const updated = updateItem(id, tenantId, { status: 'APPROVED', updatedBy: userId });

  recordAudit({
    timestamp: new Date().toISOString(),
    actor: userId,
    tenantId,
    action: 'CATALOG_APPROVE',
    target: id,
    details: { from: 'PENDING', to: 'APPROVED' },
  });

  await reply.send({ success: true, data: updated });
}

/**
 * POST /saas-catalog/:id/reject -- PENDING -> REJECTED
 * Plan SC: FR-SCAT.4
 */
export async function rejectCatalog(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const tenantId = extractTenantId(request);
  if (!tenantId) {
    await reply.status(400).send({
      success: false,
      error: { code: 'TENANT_REQUIRED', message: 'X-Tenant-Id 헤더가 필요합니다' },
    });
    return;
  }

  const { id } = request.params as { id: string };
  const item = getItem(id, tenantId);
  if (!item) {
    await reply.status(404).send({
      success: false,
      error: { code: 'NOT_FOUND', message: '카탈로그 항목을 찾을 수 없습니다' },
    });
    return;
  }

  if (item.status !== 'PENDING') {
    await reply.status(409).send({
      success: false,
      error: { code: 'INVALID_STATUS', message: `PENDING 상태에서만 거절할 수 있습니다 (현재: ${item.status})` },
    });
    return;
  }

  const parsed = rejectSchema.safeParse(request.body);
  if (!parsed.success) {
    await reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: '거절 사유는 필수입니다' },
    });
    return;
  }

  const userId = extractUserId(request);
  const updated = updateItem(id, tenantId, {
    status: 'REJECTED',
    rejectionReason: parsed.data.reason,
    updatedBy: userId,
  });

  recordAudit({
    timestamp: new Date().toISOString(),
    actor: userId,
    tenantId,
    action: 'CATALOG_REJECT',
    target: id,
    details: { from: 'PENDING', to: 'REJECTED', reason: parsed.data.reason },
  });

  await reply.send({ success: true, data: updated });
}

/**
 * POST /saas-catalog/:id/deprecate -- APPROVED -> DEPRECATED
 * Plan SC: FR-SCAT.4
 */
export async function deprecateCatalog(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const tenantId = extractTenantId(request);
  if (!tenantId) {
    await reply.status(400).send({
      success: false,
      error: { code: 'TENANT_REQUIRED', message: 'X-Tenant-Id 헤더가 필요합니다' },
    });
    return;
  }

  const { id } = request.params as { id: string };
  const item = getItem(id, tenantId);
  if (!item) {
    await reply.status(404).send({
      success: false,
      error: { code: 'NOT_FOUND', message: '카탈로그 항목을 찾을 수 없습니다' },
    });
    return;
  }

  if (item.status !== 'APPROVED') {
    await reply.status(409).send({
      success: false,
      error: { code: 'INVALID_STATUS', message: `APPROVED 상태에서만 폐기할 수 있습니다 (현재: ${item.status})` },
    });
    return;
  }

  const userId = extractUserId(request);
  const updated = updateItem(id, tenantId, { status: 'DEPRECATED', updatedBy: userId });

  recordAudit({
    timestamp: new Date().toISOString(),
    actor: userId,
    tenantId,
    action: 'CATALOG_DEPRECATE',
    target: id,
    details: { from: 'APPROVED', to: 'DEPRECATED' },
  });

  await reply.send({ success: true, data: updated });
}
