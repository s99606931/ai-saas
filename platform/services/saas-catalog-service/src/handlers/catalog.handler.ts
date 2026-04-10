// SaaS 카탈로그 CRUD 핸들러
// Design Ref: SVC-SAASCAT-R3 DESIGN
// Plan SC: FR-SCAT.1, FR-SCAT.2, FR-SCAT.3
// CSAP: D-08-05 테넌트 격리, D-12 입력 검증

import type { FastifyRequest, FastifyReply } from 'fastify';
import {
  createCatalogSchema,
  updateCatalogSchema,
  listQuerySchema,
  CATEGORY_LIST,
} from '../schemas/catalog.schema.js';
import { createItem, getItem, listItems, updateItem, deleteItem } from '../lib/store.js';
import { recordAudit } from '../lib/audit.js';

/**
 * 테넌트 ID 추출 (CSAP D-08-05: 테넌트 격리)
 */
function extractTenantId(request: FastifyRequest): string | null {
  const tenantId = request.headers['x-tenant-id'];
  return typeof tenantId === 'string' && tenantId.length > 0 ? tenantId : null;
}

/**
 * 사용자 ID 추출 (감사 로그용)
 */
function extractUserId(request: FastifyRequest): string {
  const user = (request as FastifyRequest & { user?: { sub?: string } }).user;
  return user?.sub ?? 'anonymous';
}

/**
 * POST /saas-catalog -- 신규 항목 등록
 * Plan SC: FR-SCAT.1
 */
export async function createCatalog(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const tenantId = extractTenantId(request);
  if (!tenantId) {
    await reply.status(400).send({
      success: false,
      error: { code: 'TENANT_REQUIRED', message: 'X-Tenant-Id 헤더가 필요합니다' },
    });
    return;
  }

  const parsed = createCatalogSchema.safeParse(request.body);
  if (!parsed.success) {
    await reply.status(400).send({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: '입력 데이터 검증 실패',
        details: parsed.error.flatten().fieldErrors,
      },
    });
    return;
  }

  const userId = extractUserId(request);
  const item = createItem(tenantId, {
    ...parsed.data,
    createdBy: userId,
    updatedBy: userId,
  });

  // CSAP D-06: 감사 로그
  recordAudit({
    timestamp: new Date().toISOString(),
    actor: userId,
    tenantId,
    action: 'CATALOG_CREATE',
    target: item.id,
    details: { name: item.name, category: item.category },
  });

  await reply.status(201).send({ success: true, data: item });
}

/**
 * GET /saas-catalog -- 목록 조회
 * Plan SC: FR-SCAT.1, FR-SCAT.3
 */
export async function listCatalog(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const tenantId = extractTenantId(request);
  if (!tenantId) {
    await reply.status(400).send({
      success: false,
      error: { code: 'TENANT_REQUIRED', message: 'X-Tenant-Id 헤더가 필요합니다' },
    });
    return;
  }

  const parsed = listQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    await reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: '쿼리 파라미터 검증 실패' },
    });
    return;
  }

  const result = listItems(tenantId, parsed.data);
  await reply.send({ success: true, data: result });
}

/**
 * GET /saas-catalog/categories -- 카테고리 목록
 * Plan SC: FR-SCAT.2
 */
export async function listCategories(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await reply.send({ success: true, data: CATEGORY_LIST });
}

/**
 * GET /saas-catalog/:id -- 상세 조회
 * Plan SC: FR-SCAT.1
 */
export async function getCatalog(request: FastifyRequest, reply: FastifyReply): Promise<void> {
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

  await reply.send({ success: true, data: item });
}

/**
 * PUT /saas-catalog/:id -- 수정
 * Plan SC: FR-SCAT.1
 */
export async function updateCatalog(request: FastifyRequest, reply: FastifyReply): Promise<void> {
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

  // DRAFT 또는 REJECTED 상태에서만 수정 가능
  if (item.status !== 'DRAFT' && item.status !== 'REJECTED') {
    await reply.status(409).send({
      success: false,
      error: { code: 'INVALID_STATUS', message: `현재 상태(${item.status})에서는 수정할 수 없습니다` },
    });
    return;
  }

  const parsed = updateCatalogSchema.safeParse(request.body);
  if (!parsed.success) {
    await reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: '입력 데이터 검증 실패' },
    });
    return;
  }

  const userId = extractUserId(request);
  const updated = updateItem(id, tenantId, { ...parsed.data, updatedBy: userId });

  // CSAP D-06: 감사 로그
  recordAudit({
    timestamp: new Date().toISOString(),
    actor: userId,
    tenantId,
    action: 'CATALOG_UPDATE',
    target: id,
  });

  await reply.send({ success: true, data: updated });
}

/**
 * DELETE /saas-catalog/:id -- 삭제 (소프트 삭제, DRAFT 상태만)
 * Plan SC: FR-SCAT.1
 */
export async function deleteCatalog(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const tenantId = extractTenantId(request);
  if (!tenantId) {
    await reply.status(400).send({
      success: false,
      error: { code: 'TENANT_REQUIRED', message: 'X-Tenant-Id 헤더가 필요합니다' },
    });
    return;
  }

  const { id } = request.params as { id: string };
  const userId = extractUserId(request);
  const success = deleteItem(id, tenantId);

  if (!success) {
    await reply.status(404).send({
      success: false,
      error: { code: 'DELETE_FAILED', message: '삭제할 수 없습니다 (미존재 또는 DRAFT 상태가 아님)' },
    });
    return;
  }

  // CSAP D-06: 감사 로그
  recordAudit({
    timestamp: new Date().toISOString(),
    actor: userId,
    tenantId,
    action: 'CATALOG_DELETE',
    target: id,
  });

  await reply.send({ success: true, message: '삭제되었습니다' });
}
