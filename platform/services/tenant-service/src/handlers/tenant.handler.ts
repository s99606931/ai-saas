// 테넌트 CRUD 핸들러
// Design Ref: DESIGN-MTU-P03
// Plan SC: FR-P03.1~FR-P03.6
// CSAP: N2SF N-03 격리

import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { logTenantEvent } from '../lib/audit.js';
import { prisma } from '../lib/prisma.js';

// BigInt → string 변환 (JSON 직렬화)
function serializeTenant<T extends { maxStorage: bigint }>(t: T) {
  return { ...t, maxStorage: t.maxStorage.toString() };
}

const createTenantSchema = z.object({
  name: z.string().min(1, '테넌트명은 필수입니다').max(200),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/, 'slug는 소문자, 숫자, 하이픈만 허용'),
  maxUsers: z.number().int().min(1).max(10000).default(10),
  maxStorage: z.number().int().min(0).default(1073741824), // 1GB
});

const updateTenantSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  maxUsers: z.number().int().min(1).max(10000).optional(),
  maxStorage: z.number().int().min(0).optional(),
  config: z.record(z.unknown()).optional(),
  theme: z.object({
    primaryColor: z.string().optional(),
    logoUrl: z.string().url().optional(),
    faviconUrl: z.string().url().optional(),
    sidebarVariant: z.enum(['default', 'compact', 'floating']).optional(),
  }).optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED', 'ARCHIVED']),
  reason: z.string().optional(),
});

/**
 * 테넌트 목록 조��� (슈퍼 어드민 전용)
 */
export async function listTenantsHandler(
  request: FastifyRequest<{ Querystring: { page?: string; pageSize?: string; status?: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const page = parseInt(request.query.page ?? '1', 10);
  const pageSize = Math.min(parseInt(request.query.pageSize ?? '20', 10), 100);
  const status = request.query.status;

  const where = status ? { status: status as 'ACTIVE' | 'SUSPENDED' | 'TRIAL' | 'ARCHIVED' } : {};

  const [tenants, total] = await Promise.all([
    prisma.tenant.findMany({
      where,
      include: {
        _count: { select: { users: true, subscriptions: true } },
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.tenant.count({ where }),
  ]);

  await reply.send({
    success: true,
    data: tenants.map(serializeTenant),
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
}

/**
 * 테넌트 상세 조회
 */
export async function getTenantHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: request.params.id },
    include: {
      _count: { select: { users: true, subscriptions: true } },
    },
  });

  if (!tenant) {
    await reply.status(404).send({
      success: false,
      error: { code: 'TENANT_NOT_FOUND', message: '테넌트를 찾을 수 없습니다' },
    });
    return;
  }

  await reply.send({ success: true, data: serializeTenant(tenant) });
}

/**
 * 테넌트 생성
 * Plan SC: FR-P03.1
 */
export async function createTenantHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const parseResult = createTenantSchema.safeParse(request.body);
  if (!parseResult.success) {
    await reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parseResult.error.issues.map((i) => i.message).join(', ') },
    });
    return;
  }

  try {
    const tenant = await prisma.tenant.create({
      data: {
        ...parseResult.data,
        maxStorage: BigInt(parseResult.data.maxStorage),
      },
    });

    // 감사 로그 기록 (FR-P03.8, CSAP D-06)
    const createActor = (request.headers['x-user-id'] as string) || 'system';
    await logTenantEvent(
      'TENANT_CREATED',
      createActor,
      tenant.id,
      tenant.id,
      request.ip,
      request.headers['user-agent'] ?? 'unknown',
      { name: tenant.name, slug: tenant.slug },
    );

    await reply.status(201).send({
      success: true,
      data: { ...tenant, maxStorage: tenant.maxStorage.toString() },
    });
  } catch (error: unknown) {
    const prismaError = error as { code?: string };
    if (prismaError.code === 'P2002') {
      await reply.status(409).send({
        success: false,
        error: { code: 'TENANT_SLUG_EXISTS', message: '이미 사용 ��인 slug입니다' },
      });
      return;
    }
    throw error;
  }
}

/**
 * 테넌트 수정
 * Plan SC: FR-P03.3, FR-P03.7
 */
export async function updateTenantHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const parseResult = updateTenantSchema.safeParse(request.body);
  if (!parseResult.success) {
    await reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parseResult.error.issues.map((i) => i.message).join(', ') },
    });
    return;
  }

  const { maxStorage, ...rest } = parseResult.data;

  const tenant = await prisma.tenant.update({
    where: { id: request.params.id },
    data: {
      ...rest,
      ...(maxStorage !== undefined ? { maxStorage: BigInt(maxStorage) } : {}),
    } as Parameters<typeof prisma.tenant.update>[0]['data'],
  });

  // 감사 로그 기록 (CSAP D-06: 테넌트 설정 변경 추적)
  const updateActor = (request.headers['x-user-id'] as string) || 'system';
  await logTenantEvent(
    'TENANT_UPDATED',
    updateActor,
    request.params.id,
    request.params.id,
    request.ip,
    request.headers['user-agent'] ?? 'unknown',
    { fields: Object.keys(parseResult.data) },
  );

  await reply.send({
    success: true,
    data: { ...tenant, maxStorage: tenant.maxStorage.toString() },
  });
}

/**
 * 테넌트 상태 변경
 * Plan SC: FR-P03.4
 */
export async function updateTenantStatusHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const parseResult = updateStatusSchema.safeParse(request.body);
  if (!parseResult.success) {
    await reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: '유효한 상태를 선택하세요' },
    });
    return;
  }

  const tenant = await prisma.tenant.update({
    where: { id: request.params.id },
    data: { status: parseResult.data.status },
  });

  // 감사 로그 기록 (FR-P03.8, CSAP D-06)
  const statusActor = (request.headers['x-user-id'] as string) || 'system';
  await logTenantEvent(
    'TENANT_STATUS_CHANGED',
    statusActor,
    request.params.id,
    request.params.id,
    request.ip,
    request.headers['user-agent'] ?? 'unknown',
    { newStatus: parseResult.data.status, reason: parseResult.data.reason },
  );

  // NOTE: SUSPENDED 시 테넌트 내 모든 세션 무효화는 auth-service Redis 연동 필요 (Phase P4)

  await reply.send({
    success: true,
    data: { ...tenant, maxStorage: tenant.maxStorage.toString() },
  });
}
