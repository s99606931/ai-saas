// 서비스 카탈로그 핸들러
// Design Ref: DESIGN-MTU-P06
// Plan SC: FR-P06.1~FR-P06.5

import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { logCatalogEvent } from '../lib/audit.js';
import { prisma } from '../lib/prisma.js';

const createServiceSchema = z.object({
  name: z.string().min(1, '서비스명은 필수입니다').max(200),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/),
  description: z.string().optional(),
  category: z.string().min(1),
  version: z.string().default('1.0.0'),
  isBuiltIn: z.boolean().default(false),
  config: z.record(z.unknown()).optional(),
});

const updateServiceSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  isActive: z.boolean().optional(),
  config: z.record(z.unknown()).optional(),
});

/**
 * 서비스 목록 조회 (검색/필터 고도화)
 * Plan SC: FR-P06.1, FR-CAT.2
 * Design Ref: SVC-CAT-R1 DESIGN
 */
export async function listServicesHandler(
  request: FastifyRequest<{
    Querystring: {
      category?: string;
      search?: string;
      isActive?: string;
      page?: string;
      pageSize?: string;
    };
  }>,
  reply: FastifyReply,
): Promise<void> {
  const page = parseInt(request.query.page ?? '1', 10);
  const pageSize = Math.min(parseInt(request.query.pageSize ?? '20', 10), 100);

  // FR-CAT.2: 동적 where 조건 빌더 (Design Ref: SVC-CAT-R1 DESIGN)
  const where: Record<string, unknown> = {};

  if (request.query.category) {
    where['category'] = request.query.category;
  }

  if (request.query.isActive !== undefined) {
    where['isActive'] = request.query.isActive === 'true';
  }

  // FR-CAT.2: 검색 (name, slug, description OR 조건)
  if (request.query.search) {
    where['OR'] = [
      { name: { contains: request.query.search, mode: 'insensitive' } },
      { slug: { contains: request.query.search, mode: 'insensitive' } },
      { description: { contains: request.query.search, mode: 'insensitive' } },
    ];
  }

  const [services, total] = await Promise.all([
    prisma.service.findMany({
      where,
      include: { featureFlags: true },
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { name: 'asc' },
    }),
    prisma.service.count({ where }),
  ]);

  await reply.send({
    success: true,
    data: services,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
}

/**
 * 서비스 상세 조회
 */
export async function getServiceHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const service = await prisma.service.findUnique({
    where: { id: request.params.id },
    include: { featureFlags: true, plans: { include: { plan: true } } },
  });

  if (!service) {
    await reply.status(404).send({
      success: false,
      error: { code: 'SERVICE_NOT_FOUND', message: '서비스를 찾을 수 없습니다' },
    });
    return;
  }

  await reply.send({ success: true, data: service });
}

/**
 * 서비스 등록
 * Plan SC: FR-P06.1
 */
export async function createServiceHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const parseResult = createServiceSchema.safeParse(request.body);
  if (!parseResult.success) {
    await reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parseResult.error.issues.map((i) => i.message).join(', ') },
    });
    return;
  }

  try {
    const { config, ...rest } = parseResult.data;
    const service = await prisma.service.create({
      data: { ...rest, ...(config !== undefined ? { config: config as object } : {}) },
    });

    const createActor = (request.headers['x-user-id'] as string) || 'system';
    await logCatalogEvent(
      'SERVICE_CREATED',
      createActor,
      service.id,
      request.ip,
      request.headers['user-agent'] ?? 'unknown',
      { name: service.name, slug: service.slug },
    );

    await reply.status(201).send({ success: true, data: service });
  } catch (error: unknown) {
    const prismaError = error as { code?: string };
    if (prismaError.code === 'P2002') {
      await reply.status(409).send({
        success: false,
        error: { code: 'SERVICE_SLUG_EXISTS', message: '이미 사용 중인 slug입니다' },
      });
      return;
    }
    throw error;
  }
}

/**
 * 서비스 수정
 * Plan SC: FR-P06.1
 */
export async function updateServiceHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const parseResult = updateServiceSchema.safeParse(request.body);
  if (!parseResult.success) {
    await reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parseResult.error.issues.map((i) => i.message).join(', ') },
    });
    return;
  }

  const { config: updateConfig, ...updateRest } = parseResult.data;
  const service = await prisma.service.update({
    where: { id: request.params.id },
    data: { ...updateRest, ...(updateConfig !== undefined ? { config: updateConfig as object } : {}) },
  });

  // 감사 로그 (CSAP D-06: 변경 작업 전수 기록, Security Ref: FR-N08.7)
  const updateActor = (request.headers['x-user-id'] as string) || 'system';
  await logCatalogEvent(
    'SERVICE_UPDATED',
    updateActor,
    service.id,
    request.ip,
    request.headers['user-agent'] ?? 'unknown',
    { fields: Object.keys(parseResult.data) },
  );

  await reply.send({ success: true, data: service });
}

/**
 * 서비스 삭제
 * Plan SC: FR-P06.1
 * CSAP D-06: 삭제 작업 감사 로그 필수
 * Security Ref: FR-N08.7
 */
export async function deleteServiceHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const existing = await prisma.service.findUnique({
    where: { id: request.params.id },
    select: { id: true, name: true, slug: true },
  });
  if (!existing) {
    await reply.status(404).send({
      success: false,
      error: { code: 'SERVICE_NOT_FOUND', message: '서비스를 찾을 수 없습니다' },
    });
    return;
  }

  await prisma.service.delete({ where: { id: request.params.id } });

  // 감사 로그 (CSAP D-06: 삭제 작업 전수 기록, Security Ref: FR-N08.7)
  const deleteActor = (request.headers['x-user-id'] as string) || 'system';
  await logCatalogEvent(
    'SERVICE_DELETED',
    deleteActor,
    existing.id,
    request.ip,
    request.headers['user-agent'] ?? 'unknown',
    { name: existing.name, slug: existing.slug },
  );

  await reply.send({ success: true, message: '서비스가 삭제되었습니다' });
}

/**
 * 버전 업데이트
 * Plan SC: FR-P06.2
 */
export async function updateVersionHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const schema = z.object({ version: z.string().min(1) });
  const parseResult = schema.safeParse(request.body);
  if (!parseResult.success) {
    await reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: '버전 정보가 필요합니다' },
    });
    return;
  }

  const service = await prisma.service.update({
    where: { id: request.params.id },
    data: { version: parseResult.data.version },
  });

  const versionActor = (request.headers['x-user-id'] as string) || 'system';
  await logCatalogEvent(
    'SERVICE_VERSION_UPDATED',
    versionActor,
    service.id,
    request.ip,
    request.headers['user-agent'] ?? 'unknown',
    { version: parseResult.data.version },
  );

  await reply.send({ success: true, data: service });
}

/**
 * Feature Flag 목록
 * Plan SC: FR-P06.3
 */
export async function listFlagsHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<void> {
  // CSAP D-10: 방어 코딩 — 최대 500건 제한
  const flags = await prisma.featureFlag.findMany({
    where: { serviceId: request.params.id },
    take: 500,
  });

  await reply.send({ success: true, data: flags });
}

/**
 * Feature Flag 토글
 * Plan SC: FR-P06.3
 */
export async function toggleFlagHandler(
  request: FastifyRequest<{ Params: { id: string; key: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const schema = z.object({ enabled: z.boolean() });
  const parseResult = schema.safeParse(request.body);
  if (!parseResult.success) {
    await reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'enabled 값이 필요합니다' },
    });
    return;
  }

  const flag = await prisma.featureFlag.upsert({
    where: { serviceId_key: { serviceId: request.params.id, key: request.params.key } },
    update: { enabled: parseResult.data.enabled },
    create: { serviceId: request.params.id, key: request.params.key, enabled: parseResult.data.enabled },
  });

  // FR-CAT.4: Feature Flag 토글 감사 로그 (CSAP D-06, Design Ref: SVC-CAT-R1 DESIGN)
  const flagActor = (request.headers['x-user-id'] as string) || 'system';
  await logCatalogEvent(
    'FLAG_TOGGLED',
    flagActor,
    request.params.id,
    request.ip,
    request.headers['user-agent'] ?? 'unknown',
    { key: request.params.key, enabled: parseResult.data.enabled },
  );

  await reply.send({ success: true, data: flag });
}
