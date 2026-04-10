// 테넌트 CRUD 핸들러
// Design Ref: DESIGN-MTU-P03
// Plan SC: FR-P03.1~FR-P03.6
// CSAP: N2SF N-03 격리

import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import crypto from 'node:crypto';
import { logTenantEvent } from '../lib/audit.js';
import { prisma } from '../lib/prisma.js';

// BigInt → string 변환 (JSON 직렬화)
function serializeTenant<T extends { maxStorage: bigint }>(t: T) {
  return { ...t, maxStorage: t.maxStorage.toString() };
}

// CSAP D-12: 입력 검증 — UUID 형식 강제 (SQL 주입 방어)
const tenantIdParamSchema = z.object({
  id: z.string().uuid('유효한 UUID 형식이 아닙니다'),
});

const createTenantSchema = z.object({
  name: z.string().min(1, '테넌트명은 필수입니다').max(200),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'slug는 소문자, 숫자, 하이픈만 허용'),
  maxUsers: z.number().int().min(1).max(10000).default(10),
  maxStorage: z.number().int().min(0).default(1073741824), // 1GB
});

const updateTenantSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  maxUsers: z.number().int().min(1).max(10000).optional(),
  maxStorage: z.number().int().min(0).optional(),
  config: z.record(z.unknown()).optional(),
  theme: z
    .object({
      primaryColor: z.string().optional(),
      logoUrl: z.string().url().optional(),
      faviconUrl: z.string().url().optional(),
      sidebarVariant: z.enum(['default', 'compact', 'floating']).optional(),
    })
    .optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED', 'ARCHIVED']),
  reason: z.string().optional(),
});

// FR-TENANT.5: 정렬 가능 필드 (Design Ref: SVC-TENANT-R2 DESIGN)
const VALID_SORT_FIELDS = ['name', 'createdAt', 'status', 'maxUsers'] as const;

/**
 * 테넌트 목록 조회 (슈퍼 어드민 전용)
 * Design Ref: SVC-TENANT-R2 DESIGN — 향상된 목록 조회
 * CSAP D-12: Zod 입력 검증, sortBy/sortOrder 지원
 */
export async function listTenantsHandler(
  request: FastifyRequest<{
    Querystring: {
      page?: string;
      pageSize?: string;
      status?: string;
      sortBy?: string;
      sortOrder?: string;
      search?: string;
    };
  }>,
  reply: FastifyReply,
): Promise<void> {
  const page = parseInt(request.query.page ?? '1', 10);
  const pageSize = Math.min(parseInt(request.query.pageSize ?? '20', 10), 100);
  const status = request.query.status;
  const sortBy = (VALID_SORT_FIELDS as readonly string[]).includes(request.query.sortBy ?? '')
    ? (request.query.sortBy as (typeof VALID_SORT_FIELDS)[number])
    : 'createdAt';
  const sortOrder = request.query.sortOrder === 'asc' ? 'asc' : 'desc';

  const where: Record<string, unknown> = {};
  if (status) {
    where['status'] = status as 'ACTIVE' | 'SUSPENDED' | 'TRIAL' | 'ARCHIVED';
  }
  // Round 2: 인라인 검색 지원
  if (request.query.search) {
    where['OR'] = [
      { name: { contains: request.query.search, mode: 'insensitive' } },
      { slug: { contains: request.query.search, mode: 'insensitive' } },
    ];
  }

  const [tenants, total] = await Promise.all([
    prisma.tenant.findMany({
      where,
      include: {
        _count: { select: { users: true, subscriptions: true } },
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { [sortBy]: sortOrder },
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
  // CSAP D-12: UUID 형식 검증
  const idParse = tenantIdParamSchema.safeParse(request.params);
  if (!idParse.success) {
    await reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: idParse.error.issues.map((i) => i.message).join(', ') },
    });
    return;
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: idParse.data.id },
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
export async function createTenantHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
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
        error: { code: 'TENANT_SLUG_EXISTS', message: '이미 사용 중인 slug입니다' },
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
  // CSAP D-12: UUID 형식 검증
  const idParse = tenantIdParamSchema.safeParse(request.params);
  if (!idParse.success) {
    await reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: idParse.error.issues.map((i) => i.message).join(', ') },
    });
    return;
  }

  const parseResult = updateTenantSchema.safeParse(request.body);
  if (!parseResult.success) {
    await reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parseResult.error.issues.map((i) => i.message).join(', ') },
    });
    return;
  }

  const { maxStorage, ...rest } = parseResult.data;

  const validatedTenantId = idParse.data.id;
  const tenant = await prisma.tenant.update({
    where: { id: validatedTenantId },
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
    validatedTenantId,
    validatedTenantId,
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
  // CSAP D-12: UUID 형식 검증
  const idParse = tenantIdParamSchema.safeParse(request.params);
  if (!idParse.success) {
    await reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: idParse.error.issues.map((i) => i.message).join(', ') },
    });
    return;
  }
  const statusTenantId = idParse.data.id;

  const parseResult = updateStatusSchema.safeParse(request.body);
  if (!parseResult.success) {
    await reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: '유효한 상태를 선택하세요' },
    });
    return;
  }

  const tenant = await prisma.tenant.update({
    where: { id: statusTenantId },
    data: { status: parseResult.data.status },
  });

  // 감사 로그 기록 (FR-P03.8, CSAP D-06)
  const statusActor = (request.headers['x-user-id'] as string) || 'system';
  await logTenantEvent(
    'TENANT_STATUS_CHANGED',
    statusActor,
    statusTenantId,
    statusTenantId,
    request.ip,
    request.headers['user-agent'] ?? 'unknown',
    { newStatus: parseResult.data.status, reason: parseResult.data.reason },
  );

  // FR-TENANT.2: SUSPENDED 시 테넌트 내 모든 사용자 세션 무효화
  // Design Ref: SVC-TENANT-R1 DESIGN §2
  if (parseResult.data.status === 'SUSPENDED') {
    await invalidateTenantSessions(statusTenantId, request.ip);
  }

  await reply.send({
    success: true,
    data: { ...tenant, maxStorage: tenant.maxStorage.toString() },
  });
}

/**
 * 테넌트 소프트 삭제
 * Design Ref: SVC-TENANT-R1 DESIGN §3
 * Plan SC: FR-TENANT.3
 *
 * DELETE /tenants/:id → status=ARCHIVED + archivedAt 설정
 */
export async function deleteTenantHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<void> {
  // CSAP D-12: UUID 형식 검증
  const idParse = tenantIdParamSchema.safeParse(request.params);
  if (!idParse.success) {
    await reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: idParse.error.issues.map((i) => i.message).join(', ') },
    });
    return;
  }
  const tenantId = idParse.data.id;

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
  });

  if (!tenant) {
    await reply.status(404).send({
      success: false,
      error: { code: 'TENANT_NOT_FOUND', message: '테넌트를 찾을 수 없습니다' },
    });
    return;
  }

  if (tenant.status === 'ARCHIVED') {
    await reply.status(409).send({
      success: false,
      error: { code: 'TENANT_ALREADY_ARCHIVED', message: '이미 아카이브된 테넌트입니다' },
    });
    return;
  }

  // 소프트 삭제: ARCHIVED 상태로 변경
  const updated = await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      status: 'ARCHIVED',
    },
  });

  // 세션 무효화
  await invalidateTenantSessions(tenantId, request.ip);

  const deleteActor = (request.headers['x-user-id'] as string) || 'system';
  await logTenantEvent(
    'TENANT_ARCHIVED',
    deleteActor,
    tenantId,
    tenantId,
    request.ip,
    request.headers['user-agent'] ?? 'unknown',
    { previousStatus: tenant.status },
  );

  await reply.send({
    success: true,
    data: { ...updated, maxStorage: updated.maxStorage.toString() },
    message: '테넌트가 아카이브되었습니다. 90일 후 자동 삭제됩니다.',
  });
}

/**
 * 테넌트 설정 조회
 * Design Ref: SVC-TENANT-R1 DESIGN §4
 * Plan SC: FR-TENANT.4
 */
export async function getTenantConfigHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<void> {
  // CSAP D-12: UUID 형식 검증
  const idParse = tenantIdParamSchema.safeParse(request.params);
  if (!idParse.success) {
    await reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: idParse.error.issues.map((i) => i.message).join(', ') },
    });
    return;
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: idParse.data.id },
    select: { id: true, name: true, config: true, theme: true },
  });

  if (!tenant) {
    await reply.status(404).send({
      success: false,
      error: { code: 'TENANT_NOT_FOUND', message: '테넌트를 찾을 수 없습니다' },
    });
    return;
  }

  await reply.send({
    success: true,
    data: {
      tenantId: tenant.id,
      tenantName: tenant.name,
      config: tenant.config ?? {},
      theme: tenant.theme ?? {},
    },
  });
}

/**
 * 테넌트 설정 수정
 * Design Ref: SVC-TENANT-R1 DESIGN §4
 * Plan SC: FR-TENANT.4
 */
export async function updateTenantConfigHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<void> {
  // CSAP D-12: UUID 형식 검증
  const idParse = tenantIdParamSchema.safeParse(request.params);
  if (!idParse.success) {
    await reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: idParse.error.issues.map((i) => i.message).join(', ') },
    });
    return;
  }
  const configTenantId = idParse.data.id;

  const configSchema = z.object({
    config: z.record(z.unknown()).optional(),
    theme: z
      .object({
        primaryColor: z.string().optional(),
        logoUrl: z.string().url().optional(),
        faviconUrl: z.string().url().optional(),
        sidebarVariant: z.enum(['default', 'compact', 'floating']).optional(),
      })
      .optional(),
  });

  const parseResult = configSchema.safeParse(request.body);
  if (!parseResult.success) {
    await reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parseResult.error.issues.map((i) => i.message).join(', ') },
    });
    return;
  }

  const updateData: Record<string, unknown> = {};
  if (parseResult.data.config) updateData['config'] = parseResult.data.config;
  if (parseResult.data.theme) updateData['theme'] = parseResult.data.theme;

  const tenant = await prisma.tenant.update({
    where: { id: configTenantId },
    data: updateData as Parameters<typeof prisma.tenant.update>[0]['data'],
    select: { id: true, name: true, config: true, theme: true },
  });

  const configActor = (request.headers['x-user-id'] as string) || 'system';
  await logTenantEvent(
    'TENANT_CONFIG_UPDATED',
    configActor,
    configTenantId,
    configTenantId,
    request.ip,
    request.headers['user-agent'] ?? 'unknown',
    { updatedFields: Object.keys(parseResult.data) },
  );

  await reply.send({
    success: true,
    data: {
      tenantId: tenant.id,
      config: tenant.config ?? {},
      theme: tenant.theme ?? {},
    },
  });
}

/**
 * 테넌트 내 모든 사용자 세션 무효화
 * Design Ref: SVC-TENANT-R1 DESIGN §2
 * Plan SC: FR-TENANT.2
 *
 * auth-service의 /auth/sessions/invalidate 엔드포인트를 호출하여
 * 해당 테넌트의 모든 사용자 세션을 무효화합니다.
 */
async function invalidateTenantSessions(tenantId: string, _callerIp: string): Promise<void> {
  const authServiceUrl = process.env['AUTH_SVC_URL'] ?? 'http://auth-service:3001';
  const serviceKey = process.env['INTERNAL_SERVICE_KEY'];

  if (!serviceKey) {
    // 서비스 키 미설정 시 건너뜀 (개발 환경)
    return;
  }

  // 테넌트 내 모든 사용자 조회 (CSAP D-10: 방어 코딩 — 최대 10000건)
  const users = await prisma.user.findMany({
    where: { tenantId },
    select: { id: true },
    take: 10000,
  });

  // 각 사용자의 세션 무효화 (HMAC 서비스 토큰 사용)
  for (const user of users) {
    try {
      const timestamp = Math.floor(Date.now() / 1000);
      const path = '/auth/sessions/invalidate';
      const message = `tenant-service:${timestamp}:${path}`;
      const hmac = crypto.createHmac('sha256', serviceKey).update(message).digest('hex');
      const serviceToken = `tenant-service:${timestamp}:${hmac}`;

      await fetch(`${authServiceUrl}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Service-Token': serviceToken,
        },
        body: JSON.stringify({
          userId: user.id,
          tenantId,
          reason: 'ACCOUNT_LOCKED',
        }),
        signal: AbortSignal.timeout(10000), // CSAP D-07: 서비스 간 통신 타임아웃 10초
      });
    } catch {
      // 개별 사용자 세션 무효화 실패 시 건너뜀 (전체 중단 방지)
    }
  }
}
