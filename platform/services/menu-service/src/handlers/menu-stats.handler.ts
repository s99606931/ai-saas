// 메뉴 통계 핸들러
// Design Ref: SVC-MENU-R1 DESIGN
// Plan SC: FR-MENU.5
// CSAP: D-08 테넌트 격리

import type { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma.js';

/**
 * FR-MENU.5: 메뉴 통계
 * GET /menu/stats
 * Design Ref: SVC-MENU-R1 DESIGN
 * CSAP D-08-05: 테넌트 격리
 */
export async function menuStatsHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  // CSAP D-08-05: 테넌트 격리
  const jwtTenantId = request.headers['x-user-tenant-id'] as string | undefined;
  const jwtRole = request.headers['x-user-role'] as string | undefined;
  const queryTenantId = (request.query as Record<string, string>)['tenantId'];
  const effectiveTenantId = jwtRole === 'SUPER_ADMIN'
    ? (queryTenantId ?? jwtTenantId)
    : jwtTenantId;

  if (!effectiveTenantId) {
    await reply.status(400).send({
      success: false,
      error: { code: 'TENANT_REQUIRED', message: '테넌트 ID가 필요합니다' },
    });
    return;
  }

  // CSAP D-10: 방어 코딩 — 최대 2000건 제한 (통계 집계용)
  const allItems = await prisma.menuItem.findMany({
    where: { tenantId: effectiveTenantId },
    select: { id: true, parentId: true, isVisible: true },
    take: 2000,
  });

  const totalMenus = allItems.length;
  const rootMenus = allItems.filter((i) => !i.parentId).length;
  const visibleMenus = allItems.filter((i) => i.isVisible).length;
  const hiddenMenus = totalMenus - visibleMenus;

  // 최대 깊이 계산
  const parentMap = new Map<string, string | null>();
  for (const item of allItems) {
    parentMap.set(item.id, item.parentId);
  }

  let maxDepth = 0;
  for (const item of allItems) {
    let depth = 0;
    let currentId: string | null = item.id;
    const visited = new Set<string>();
    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      const pid = parentMap.get(currentId);
      if (pid) {
        depth++;
        currentId = pid;
      } else {
        break;
      }
    }
    if (depth > maxDepth) maxDepth = depth;
  }

  await reply.send({
    success: true,
    data: {
      tenantId: effectiveTenantId,
      totalMenus,
      rootMenus,
      childMenus: totalMenus - rootMenus,
      visibleMenus,
      hiddenMenus,
      maxDepth,
      generatedAt: new Date().toISOString(),
    },
  });
}
