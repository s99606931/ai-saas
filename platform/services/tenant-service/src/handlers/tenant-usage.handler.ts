// 테넌트 리소스 사용량 조회 핸들러
// Design Ref: SVC-TENANT-R1 DESIGN §1
// Plan SC: FR-TENANT.1
// CSAP: N2SF N-03 테넌트 격리 — 리소스 사용량 추적

import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { logTenantEvent } from '../lib/audit.js';

// CSAP D-12: 입력 검증 — UUID 형식 강제 (SQL 주입 방어)
const tenantIdParamSchema = z.object({
  id: z.string().uuid('유효한 UUID 형식이 아닙니다'),
});

/**
 * 테넌트 리소스 사용량 조회
 *
 * GET /tenants/:id/usage
 *
 * 반환:
 * - 사용자 수 (현재/최대)
 * - 스토리지 사용량 (바이트, 최대)
 * - 활성 구독 수
 */
export async function getTenantUsageHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<void> {
  // CSAP D-12: 입력 검증 — tenantId UUID 형식 확인
  const parseResult = tenantIdParamSchema.safeParse(request.params);
  if (!parseResult.success) {
    await reply.status(400).send({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: parseResult.error.issues.map((i) => i.message).join(', '),
      },
    });
    return;
  }
  const tenantId = parseResult.data.id;

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      name: true,
      maxUsers: true,
      maxStorage: true,
      _count: {
        select: {
          users: true,
          subscriptions: true,
        },
      },
    },
  });

  if (!tenant) {
    await reply.status(404).send({
      success: false,
      error: { code: 'TENANT_NOT_FOUND', message: '테넌트를 찾을 수 없습니다' },
    });
    return;
  }

  // 스토리지 사용량 집계 (파일 서비스 연동)
  // NOTE: 파일 테이블이 아직 존재하지 않을 수 있으므로 안전 처리
  let storageUsed = BigInt(0);
  try {
    const storageResult = await prisma.$queryRaw<Array<{ total: bigint | null }>>`
      SELECT COALESCE(SUM("size"), 0) as total
      FROM "File"
      WHERE "tenantId" = ${tenantId}
    `;
    storageUsed = storageResult[0]?.total ?? BigInt(0);
  } catch {
    // 파일 테이블 미존재 시 0으로 처리
    storageUsed = BigInt(0);
  }

  await logTenantEvent(
    'TENANT_USAGE_QUERIED',
    (request.headers['x-user-id'] as string) || 'system',
    tenantId,
    tenantId,
    request.ip,
    request.headers['user-agent'] ?? 'unknown',
  );

  await reply.send({
    success: true,
    data: {
      tenantId: tenant.id,
      tenantName: tenant.name,
      users: {
        current: tenant._count.users,
        max: tenant.maxUsers,
        utilizationPercent: tenant.maxUsers > 0
          ? Math.round((tenant._count.users / tenant.maxUsers) * 100)
          : 0,
      },
      storage: {
        usedBytes: storageUsed.toString(),
        maxBytes: tenant.maxStorage.toString(),
        utilizationPercent: tenant.maxStorage > BigInt(0)
          ? Math.round(Number((storageUsed * BigInt(100)) / tenant.maxStorage))
          : 0,
      },
      subscriptions: {
        active: tenant._count.subscriptions,
      },
    },
  });
}
