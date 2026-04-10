// CRM 통계 및 계약 만료 핸들러
// Design Ref: SVC-CRM-R1 DESIGN
// Plan SC: FR-CRM.2, FR-CRM.3
// CSAP: D-08-05 테넌트 격리, D-12 입력 검증

import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';

// C6-02: Zod 검증 스키마 (Design Ref: SVC-CRM-R1 DESIGN)
const expiringQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});

/**
 * FR-CRM.2: 계약 만료 임박 조회
 * GET /crm/contracts/expiring?days=30
 * Design Ref: SVC-CRM-R1 DESIGN
 * CSAP D-08-05: 테넌트 격리
 * CSAP D-12: Zod 입력 검증
 */
export async function expiringContractsHandler(
  request: FastifyRequest<{ Querystring: { days?: string } }>,
  reply: FastifyReply,
): Promise<void> {
  // C6-02: Zod 검증 (CSAP D-12)
  const parseResult = expiringQuerySchema.safeParse(request.query);
  if (!parseResult.success) {
    await reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parseResult.error.issues.map((i) => i.message).join(', ') },
    });
    return;
  }
  const { days } = parseResult.data;

  const now = new Date();
  const threshold = new Date();
  threshold.setDate(threshold.getDate() + days);

  // CSAP D-08-05: 테넌트 격리 (Design Ref: SVC-CRM-R1 DESIGN)
  const jwtTenantId = request.headers['x-user-tenant-id'] as string | undefined;
  const jwtRole = request.headers['x-user-role'] as string | undefined;

  const where: Record<string, unknown> = {
    endDate: { gte: now, lte: threshold },
    status: { not: 'closed_lost' },
  };

  // SUPER_ADMIN이 아닌 경우 본인 테넌트의 고객 계약만 조회
  if (jwtRole !== 'SUPER_ADMIN' && jwtTenantId) {
    where['customer'] = { is: { tenantId: jwtTenantId } };
  }

  // CSAP D-10: 방어 코딩 -- 최대 500건
  const expiring = await prisma.contract.findMany({
    where,
    include: { customer: { select: { name: true, tenantId: true } } },
    orderBy: { endDate: 'asc' },
    take: 500,
  });

  await reply.send({
    success: true,
    data: {
      contracts: expiring,
      total: expiring.length,
      thresholdDays: days,
      generatedAt: new Date().toISOString(),
    },
  });
}

/**
 * FR-CRM.3: CRM 통계
 * GET /crm/stats
 * Design Ref: SVC-CRM-R1 DESIGN
 * CSAP D-08-05: 테넌트 격리
 */
export async function crmStatsHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  // CSAP D-08-05: 테넌트 격리 (Design Ref: SVC-CRM-R1 DESIGN)
  const jwtTenantId = request.headers['x-user-tenant-id'] as string | undefined;
  const jwtRole = request.headers['x-user-role'] as string | undefined;

  const customerWhere: Record<string, unknown> = {};
  const contractWhere: Record<string, unknown> = {};
  const contactWhere: Record<string, unknown> = {};

  if (jwtRole !== 'SUPER_ADMIN' && jwtTenantId) {
    customerWhere['tenantId'] = jwtTenantId;
    contractWhere['customer'] = { is: { tenantId: jwtTenantId } };
    contactWhere['customer'] = { is: { tenantId: jwtTenantId } };
  }

  const [
    totalCustomers,
    customersByStatus,
    totalContracts,
    contractValue,
    totalContacts,
  ] = await Promise.all([
    prisma.customer.count({ where: customerWhere }),
    prisma.customer.groupBy({
      by: ['status'],
      _count: { id: true },
      where: customerWhere,
    }),
    prisma.contract.count({ where: contractWhere }),
    prisma.contract.aggregate({
      _sum: { value: true },
      _avg: { value: true },
      where: contractWhere,
    }),
    prisma.contact.count({ where: contactWhere }),
  ]);

  await reply.send({
    success: true,
    data: {
      totalCustomers,
      totalContracts,
      totalContacts,
      totalContractValue: (contractValue._sum.value ?? 0).toString(),
      avgContractValue: (contractValue._avg.value ?? 0).toString(),
      customersByStatus: customersByStatus.map((s) => ({
        status: s.status,
        count: s._count.id,
      })),
      generatedAt: new Date().toISOString(),
    },
  });
}
