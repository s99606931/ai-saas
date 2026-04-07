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
 * 서비스 목록 조회
 * Plan SC: FR-P06.1
 */
export async function listServicesHandler(
  request: FastifyRequest<{ Querystring: { category?: string; page?: string; pageSize?: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const page = parseInt(request.query.page ?? '1', 10);
  const pageSize = Math.min(parseInt(request.query.pageSize ?? '20', 10), 100);
  const where = request.query.category ? { category: request.query.category } : {};

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
    const service = await prisma.service.create({ data: parseResult.data });

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

  const service = await prisma.service.update({
    where: { id: request.params.id },
    data: parseResult.data,
  });

  await reply.send({ success: true, data: service });
}

/**
 * 서비스 삭제
 * Plan SC: FR-P06.1
 */
export async function deleteServiceHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<void> {
  await prisma.service.delete({ where: { id: request.params.id } });
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
  const flags = await prisma.featureFlag.findMany({
    where: { serviceId: request.params.id },
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

  await reply.send({ success: true, data: flag });
}
