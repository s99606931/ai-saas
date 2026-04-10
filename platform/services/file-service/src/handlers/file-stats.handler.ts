// 파일 통계 및 저장 용량 핸들러
// Design Ref: SVC-FILE-R1 DESIGN
// Plan SC: FR-FILE.4, FR-FILE.5
// CSAP: D-08 테넌트 격리, D-06 감사 로그

import type { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma.js';

/** 테넌트별 저장 용량 한도 (MB) */
const TENANT_STORAGE_LIMIT_MB = parseInt(process.env['TENANT_STORAGE_LIMIT_MB'] ?? '1024', 10);

/**
 * FR-FILE.4: 테넌트별 저장 용량 조회
 * GET /file/storage-usage
 * Design Ref: SVC-FILE-R1 DESIGN
 * CSAP D-08-05: 테넌트 격리
 */
export async function storageUsageHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  // CSAP D-08-05: 테넌트 격리
  const jwtTenantId = request.headers['x-user-tenant-id'] as string | undefined;
  const jwtRole = request.headers['x-user-role'] as string | undefined;
  const queryTenantId = (request.query as Record<string, string>)['tenantId'];
  const effectiveTenantId = jwtRole === 'SUPER_ADMIN' ? (queryTenantId ?? jwtTenantId) : jwtTenantId;

  if (!effectiveTenantId) {
    await reply.status(400).send({
      success: false,
      error: { code: 'TENANT_REQUIRED', message: '테넌트 ID가 필요합니다' },
    });
    return;
  }

  const result = await prisma.file.aggregate({
    where: { tenantId: effectiveTenantId },
    _count: { id: true },
    _sum: { size: true },
  });

  const totalFiles = result._count.id;
  const totalSizeBytes = Number(result._sum.size ?? 0n);
  const totalSizeMB = Math.round((totalSizeBytes / (1024 * 1024)) * 100) / 100;
  const limitMB = TENANT_STORAGE_LIMIT_MB;
  const usagePercent = Math.round((totalSizeMB / limitMB) * 10000) / 100;

  await reply.send({
    success: true,
    data: {
      tenantId: effectiveTenantId,
      totalFiles,
      totalSizeBytes: totalSizeBytes.toString(),
      totalSizeMB,
      limitMB,
      usagePercent,
      remaining: Math.max(0, limitMB - totalSizeMB),
      warning: usagePercent >= 90 ? '저장 용량이 90%를 초과했습니다' : null,
    },
  });
}

/**
 * FR-FILE.5: 파일 통계
 * GET /file/stats
 * Design Ref: SVC-FILE-R1 DESIGN
 * CSAP D-08-05: 테넌트 격리
 */
export async function fileStatsHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  // CSAP D-08-05: 테넌트 격리
  const jwtTenantId = request.headers['x-user-tenant-id'] as string | undefined;
  const jwtRole = request.headers['x-user-role'] as string | undefined;
  const queryTenantId = (request.query as Record<string, string>)['tenantId'];
  const effectiveTenantId = jwtRole === 'SUPER_ADMIN' ? (queryTenantId ?? jwtTenantId) : jwtTenantId;

  if (!effectiveTenantId) {
    await reply.status(400).send({
      success: false,
      error: { code: 'TENANT_REQUIRED', message: '테넌트 ID가 필요합니다' },
    });
    return;
  }

  // MIME 타입별 분포
  const mimeDistribution = await prisma.file.groupBy({
    by: ['mimeType'],
    where: { tenantId: effectiveTenantId },
    _count: { id: true },
    _sum: { size: true },
  });

  // 최근 7일 일별 업로드 카운트
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // CSAP D-10: 방어 코딩 — 7일 내 최대 10000건 제한
  const recentFiles = await prisma.file.findMany({
    where: {
      tenantId: effectiveTenantId,
      createdAt: { gte: sevenDaysAgo },
    },
    select: { createdAt: true },
    orderBy: { createdAt: 'asc' },
    take: 10000,
  });

  // 일별 집계
  const dailyUploads: Record<string, number> = {};
  for (let i = 0; i < 7; i++) {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    const key = date.toISOString().slice(0, 10);
    dailyUploads[key] = 0;
  }
  for (const file of recentFiles) {
    const key = file.createdAt.toISOString().slice(0, 10);
    if (dailyUploads[key] !== undefined) {
      dailyUploads[key]++;
    }
  }

  await reply.send({
    success: true,
    data: {
      tenantId: effectiveTenantId,
      mimeDistribution: mimeDistribution.map((m) => ({
        mimeType: m.mimeType,
        count: m._count.id,
        totalSize: (m._sum.size ?? 0n).toString(),
      })),
      dailyUploads: Object.entries(dailyUploads).map(([date, count]) => ({ date, count })),
      generatedAt: new Date().toISOString(),
    },
  });
}
