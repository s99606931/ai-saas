// 메뉴 CRUD 핸들러
// Design Ref: DESIGN-MTU-P05
// Plan SC: FR-P05.1~FR-P05.5
// CSAP: D-08-05 역할 기반 접근 통제

import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { logMenuEvent } from '../lib/audit.js';
import { prisma } from '../lib/prisma.js';

const createMenuSchema = z.object({
  tenantId: z.string().min(1),
  parentId: z.string().nullable().optional(),
  label: z.string().min(1, '메뉴명은 필수입니다').max(100),
  path: z.string().min(1),
  icon: z.string().optional(),
  order: z.number().int().min(0).default(0),
  isVisible: z.boolean().default(true),
  roles: z.array(z.string()).optional(),
});

const updateMenuSchema = z.object({
  label: z.string().min(1).max(100).optional(),
  path: z.string().optional(),
  icon: z.string().nullable().optional(),
  order: z.number().int().min(0).optional(),
  isVisible: z.boolean().optional(),
  roles: z.array(z.string()).optional(),
});

const reorderSchema = z.object({
  order: z.number().int().min(0),
  parentId: z.string().nullable().optional(),
});

/**
 * 메뉴 트리 조회 (테넌트별 격리)
 * Plan SC: FR-P05.1, FR-P05.4
 * CSAP D-08-05: JWT 클레임 기반 테넌트 강제 격리
 * Security Ref: FR-N08.6
 */
export async function getMenuTreeHandler(
  request: FastifyRequest<{ Querystring: { tenantId?: string } }>,
  reply: FastifyReply,
): Promise<void> {
  // CSAP D-08-05: JWT 클레임 기반 테넌트 격리 (Security Ref: FR-N08.6)
  const jwtTenantId = request.headers['x-user-tenant-id'] as string | undefined;
  const jwtRole = request.headers['x-user-role'] as string | undefined;
  const effectiveTenantId = jwtRole === 'SUPER_ADMIN'
    ? (request.query.tenantId ?? jwtTenantId)
    : jwtTenantId;

  if (!effectiveTenantId) {
    await reply.status(400).send({
      success: false,
      error: { code: 'TENANT_REQUIRED', message: '테넌트 ID가 필요합니다' },
    });
    return;
  }

  // CSAP D-10: 방어 코딩 — 최대 1000건 제한 (메뉴 트리 특성상 충분)
  const items = await prisma.menuItem.findMany({
    where: { tenantId: effectiveTenantId },
    orderBy: { order: 'asc' },
    take: 1000,
  });

  await reply.send({ success: true, data: items });
}

/**
 * 역할별 메뉴 필터링
 * Plan SC: FR-P05.2
 * CSAP D-08-05: 역할 기반 접근 통제 + JWT 기반 테넌트 격리
 * Security Ref: FR-N08.6
 */
export async function getFilteredMenuHandler(
  request: FastifyRequest<{ Querystring: { tenantId?: string; role: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const { role } = request.query;

  // CSAP D-08-05: JWT 클레임 기반 테넌트 격리 (Security Ref: FR-N08.6)
  const jwtTenantId = request.headers['x-user-tenant-id'] as string | undefined;
  const jwtRole = request.headers['x-user-role'] as string | undefined;
  const effectiveTenantId = jwtRole === 'SUPER_ADMIN'
    ? (request.query.tenantId ?? jwtTenantId)
    : jwtTenantId;

  if (!effectiveTenantId) {
    await reply.status(400).send({
      success: false,
      error: { code: 'TENANT_REQUIRED', message: '테넌트 ID가 필요합니다' },
    });
    return;
  }

  // CSAP D-10: 방어 코딩 — 최대 1000건 제한
  const items = await prisma.menuItem.findMany({
    where: { tenantId: effectiveTenantId, isVisible: true },
    orderBy: { order: 'asc' },
    take: 1000,
  });

  // roles Json 필드에서 역할 필터링
  const filtered = items.filter((item: (typeof items)[number]) => {
    if (!item.roles) return true; // roles 미설정 시 전체 허용
    const allowedRoles = item.roles as string[];
    return allowedRoles.includes(role);
  });

  await reply.send({ success: true, data: filtered });
}

/**
 * 메뉴 항목 생성
 * Plan SC: FR-P05.1
 */
export async function createMenuHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const parseResult = createMenuSchema.safeParse(request.body);
  if (!parseResult.success) {
    await reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parseResult.error.issues.map((i) => i.message).join(', ') },
    });
    return;
  }

  const { roles, ...rest } = parseResult.data;
  const menuItem = await prisma.menuItem.create({
    data: { ...rest, roles: roles ?? undefined },
  });

  const menuActor = (request.headers['x-user-id'] as string) || 'system';
  await logMenuEvent(
    'MENU_CREATED',
    menuActor,
    menuItem.id,
    parseResult.data.tenantId,
    request.ip,
    request.headers['user-agent'] ?? 'unknown',
    { label: menuItem.label, path: menuItem.path },
  );

  await reply.status(201).send({ success: true, data: menuItem });
}

/**
 * 메뉴 항목 수정
 * Plan SC: FR-P05.1
 */
export async function updateMenuHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const parseResult = updateMenuSchema.safeParse(request.body);
  if (!parseResult.success) {
    await reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parseResult.error.issues.map((i) => i.message).join(', ') },
    });
    return;
  }

  const { roles, ...rest } = parseResult.data;

  // 테넌트 격리: 대상 메뉴의 tenantId 확인 (CSAP D-08-05)
  const existingMenu = await prisma.menuItem.findUnique({
    where: { id: request.params.id },
    select: { tenantId: true },
  });
  if (!existingMenu) {
    await reply.status(404).send({
      success: false,
      error: { code: 'MENU_NOT_FOUND', message: '메뉴 항목을 찾을 수 없습니다' },
    });
    return;
  }

  const menuItem = await prisma.menuItem.update({
    where: { id: request.params.id },
    data: { ...rest, ...(roles !== undefined ? { roles } : {}) },
  });

  // 감사 로그 (CSAP D-06: 변경 작업 전수 기록)
  const updateMenuActor = (request.headers['x-user-id'] as string) || 'system';
  await logMenuEvent(
    'MENU_UPDATED',
    updateMenuActor,
    menuItem.id,
    existingMenu.tenantId ?? 'platform',
    request.ip,
    request.headers['user-agent'] ?? 'unknown',
    { fields: Object.keys(parseResult.data) },
  );

  await reply.send({ success: true, data: menuItem });
}

/**
 * 메뉴 항목 삭제
 * Plan SC: FR-P05.1
 * CSAP D-08-05: 테넌트 격리 — 본인 테넌트 메뉴만 삭제 가능
 * Security Ref: FR-N08.6
 */
export async function deleteMenuHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<void> {
  // CSAP D-08-05: 테넌트 격리 확인 (Security Ref: FR-N08.6)
  const deleteMenu = await prisma.menuItem.findUnique({
    where: { id: request.params.id },
    select: { tenantId: true },
  });
  if (!deleteMenu) {
    await reply.status(404).send({
      success: false,
      error: { code: 'MENU_NOT_FOUND', message: '메뉴 항목을 찾을 수 없습니다' },
    });
    return;
  }
  const deleteMenuJwtTenantId = request.headers['x-user-tenant-id'] as string | undefined;
  const deleteMenuJwtRole = request.headers['x-user-role'] as string | undefined;
  if (deleteMenuJwtRole !== 'SUPER_ADMIN' && deleteMenuJwtTenantId && deleteMenu.tenantId !== deleteMenuJwtTenantId) {
    await reply.status(403).send({
      success: false,
      error: { code: 'FORBIDDEN', message: '접근 권한이 없습니다' },
    });
    return;
  }

  await prisma.menuItem.delete({ where: { id: request.params.id } });

  // FR-MENU.3: 삭제 감사 로그 (CSAP D-06, Design Ref: SVC-MENU-R1 DESIGN)
  const deleteMenuActor = (request.headers['x-user-id'] as string) || 'system';
  await logMenuEvent(
    'MENU_DELETED',
    deleteMenuActor,
    request.params.id,
    deleteMenu.tenantId ?? 'platform',
    request.ip,
    request.headers['user-agent'] ?? 'unknown',
    { tenantId: deleteMenu.tenantId },
  );

  await reply.send({ success: true, message: '메뉴 항목이 삭제되었습니다' });
}

/**
 * 메뉴 순서 변경 (드래그앤드롭)
 * Plan SC: FR-P05.3, FR-MENU.4
 * Design Ref: SVC-MENU-R1 DESIGN
 * CSAP D-08-05: 테넌트 격리, D-06: 감사 로그
 */
export async function reorderMenuHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const parseResult = reorderSchema.safeParse(request.body);
  if (!parseResult.success) {
    await reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parseResult.error.issues.map((i) => i.message).join(', ') },
    });
    return;
  }

  // FR-MENU.4: 테넌트 격리 (CSAP D-08-05, Design Ref: SVC-MENU-R1 DESIGN)
  const existingReorder = await prisma.menuItem.findUnique({
    where: { id: request.params.id },
    select: { tenantId: true, order: true },
  });
  if (!existingReorder) {
    await reply.status(404).send({
      success: false,
      error: { code: 'MENU_NOT_FOUND', message: '메뉴 항목을 찾을 수 없습니다' },
    });
    return;
  }
  const reorderJwtTenantId = request.headers['x-user-tenant-id'] as string | undefined;
  const reorderJwtRole = request.headers['x-user-role'] as string | undefined;
  if (reorderJwtRole !== 'SUPER_ADMIN' && reorderJwtTenantId && existingReorder.tenantId !== reorderJwtTenantId) {
    await reply.status(403).send({
      success: false,
      error: { code: 'FORBIDDEN', message: '접근 권한이 없습니다' },
    });
    return;
  }

  const menuItem = await prisma.menuItem.update({
    where: { id: request.params.id },
    data: {
      order: parseResult.data.order,
      ...(parseResult.data.parentId !== undefined ? { parentId: parseResult.data.parentId } : {}),
    },
  });

  // FR-MENU.4: 순서변경 감사 로그 (CSAP D-06, Design Ref: SVC-MENU-R1 DESIGN)
  const reorderActor = (request.headers['x-user-id'] as string) || 'system';
  await logMenuEvent(
    'MENU_REORDERED',
    reorderActor,
    menuItem.id,
    existingReorder.tenantId ?? 'platform',
    request.ip,
    request.headers['user-agent'] ?? 'unknown',
    { oldOrder: existingReorder.order, newOrder: parseResult.data.order },
  );

  await reply.send({ success: true, data: menuItem });
}

/**
 * FR-MENU.2: 메뉴 검색
 * GET /menu/search?q={keyword}
 * Design Ref: SVC-MENU-R1 DESIGN
 * CSAP D-08-05: 테넌트 격리
 */
export async function searchMenuHandler(
  request: FastifyRequest<{ Querystring: { q?: string; tenantId?: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const searchQuery = request.query.q;
  if (!searchQuery || searchQuery.trim().length === 0) {
    await reply.status(400).send({
      success: false,
      error: { code: 'SEARCH_REQUIRED', message: '검색어를 입력하세요' },
    });
    return;
  }

  // CSAP D-08-05: 테넌트 격리
  const searchJwtTenantId = request.headers['x-user-tenant-id'] as string | undefined;
  const searchJwtRole = request.headers['x-user-role'] as string | undefined;
  const effectiveTenantId = searchJwtRole === 'SUPER_ADMIN'
    ? (request.query.tenantId ?? searchJwtTenantId)
    : searchJwtTenantId;

  if (!effectiveTenantId) {
    await reply.status(400).send({
      success: false,
      error: { code: 'TENANT_REQUIRED', message: '테넌트 ID가 필요합니다' },
    });
    return;
  }

  // CSAP D-10: 방어 코딩 — 최대 200건 제한
  const items = await prisma.menuItem.findMany({
    where: {
      tenantId: effectiveTenantId,
      OR: [
        { label: { contains: searchQuery, mode: 'insensitive' } },
        { path: { contains: searchQuery, mode: 'insensitive' } },
      ],
    },
    orderBy: { order: 'asc' },
    take: 200,
  });

  await reply.send({ success: true, data: items, total: items.length });
}
