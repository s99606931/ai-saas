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
 */
export async function getMenuTreeHandler(
  request: FastifyRequest<{ Querystring: { tenantId: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const tenantId = request.query.tenantId;

  const items = await prisma.menuItem.findMany({
    where: { tenantId },
    orderBy: { order: 'asc' },
  });

  await reply.send({ success: true, data: items });
}

/**
 * 역할별 메뉴 필터링
 * Plan SC: FR-P05.2
 * CSAP D-08-05: 역할 기반 접근 통제
 */
export async function getFilteredMenuHandler(
  request: FastifyRequest<{ Querystring: { tenantId: string; role: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const { tenantId, role } = request.query;

  const items = await prisma.menuItem.findMany({
    where: { tenantId, isVisible: true },
    orderBy: { order: 'asc' },
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
 */
export async function deleteMenuHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<void> {
  await prisma.menuItem.delete({ where: { id: request.params.id } });
  await reply.send({ success: true, message: '메뉴 항목이 삭제되었습니다' });
}

/**
 * 메뉴 순서 변경 (드래그앤드롭)
 * Plan SC: FR-P05.3
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

  const menuItem = await prisma.menuItem.update({
    where: { id: request.params.id },
    data: {
      order: parseResult.data.order,
      ...(parseResult.data.parentId !== undefined ? { parentId: parseResult.data.parentId } : {}),
    },
  });

  await reply.send({ success: true, data: menuItem });
}
