// 구독 관리 핸들러
// Design Ref: DESIGN-MTU-P07
// Plan SC: FR-P07.1~FR-P07.5
// CSAP: D-08 접근 통제, D-06 감사 로그

import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { logSubscriptionEvent } from '../lib/audit.js';
import { prisma } from '../lib/prisma.js';

const createPlanSchema = z.object({
  name: z.string().min(1, '플랜명은 필수입니다').max(100),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/),
  price: z.number().min(0),
  currency: z.string().default('KRW'),
  interval: z.enum(['monthly', 'yearly']).default('monthly'),
  maxUsers: z.number().int().min(1),
  maxStorage: z.number().int().min(0),
});

const subscribeSchema = z.object({
  tenantId: z.string().min(1),
  planId: z.string().min(1),
});

/**
 * 플랜 목록 조회
 * Plan SC: FR-P07.1
 */
export async function listPlansHandler(
  _request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const plans = await prisma.plan.findMany({
    where: { isActive: true },
    include: { services: { include: { service: true } } },
    orderBy: { price: 'asc' },
  });

  await reply.send({ success: true, data: plans });
}

/**
 * 플랜 생성
 * Plan SC: FR-P07.1
 */
export async function createPlanHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const parseResult = createPlanSchema.safeParse(request.body);
  if (!parseResult.success) {
    await reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parseResult.error.issues.map((i) => i.message).join(', ') },
    });
    return;
  }

  const plan = await prisma.plan.create({
    data: {
      ...parseResult.data,
      maxStorage: BigInt(parseResult.data.maxStorage),
    },
  });

  await reply.status(201).send({
    success: true,
    data: { ...plan, maxStorage: plan.maxStorage.toString(), price: plan.price.toString() },
  });
}

/**
 * 플랜 수정
 * Plan SC: FR-P07.1
 */
export async function updatePlanHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const schema = z.object({
    name: z.string().optional(),
    price: z.number().min(0).optional(),
    maxUsers: z.number().int().min(1).optional(),
    maxStorage: z.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
  });

  const parseResult = schema.safeParse(request.body);
  if (!parseResult.success) {
    await reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parseResult.error.issues.map((i) => i.message).join(', ') },
    });
    return;
  }

  const { maxStorage, ...rest } = parseResult.data;
  const plan = await prisma.plan.update({
    where: { id: request.params.id },
    data: { ...rest, ...(maxStorage !== undefined ? { maxStorage: BigInt(maxStorage) } : {}) },
  });

  await reply.send({
    success: true,
    data: { ...plan, maxStorage: plan.maxStorage.toString(), price: plan.price.toString() },
  });
}

/**
 * 구독 생성
 * Plan SC: FR-P07.2
 */
export async function subscribeHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const parseResult = subscribeSchema.safeParse(request.body);
  if (!parseResult.success) {
    await reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parseResult.error.issues.map((i) => i.message).join(', ') },
    });
    return;
  }

  const { tenantId, planId } = parseResult.data;
  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  const subscription = await prisma.subscription.create({
    data: {
      tenantId,
      planId,
      status: 'ACTIVE',
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
    },
  });

  // 감사 로그 (FR-P07.5, CSAP D-06)
  const subscribeActor = (request.headers['x-user-id'] as string) || 'system';
  await logSubscriptionEvent(
    'SUBSCRIPTION_CREATED',
    subscribeActor,
    subscription.id,
    tenantId,
    request.ip,
    request.headers['user-agent'] ?? 'unknown',
    { planId },
  );

  await reply.status(201).send({ success: true, data: subscription });
}

/**
 * 테넌트 구독 조회
 * Plan SC: FR-P07.2
 */
export async function getTenantSubscriptionHandler(
  request: FastifyRequest<{ Params: { tenantId: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const subscriptions = await prisma.subscription.findMany({
    where: { tenantId: request.params.tenantId },
    include: { plan: true },
    orderBy: { createdAt: 'desc' },
  });

  await reply.send({ success: true, data: subscriptions });
}

/**
 * 구독 업그레이드
 * Plan SC: FR-P07.4
 */
export async function upgradeHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const schema = z.object({ newPlanId: z.string().min(1) });
  const parseResult = schema.safeParse(request.body);
  if (!parseResult.success) {
    await reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: '새 플랜 ID가 필요합니다' },
    });
    return;
  }

  const subscription = await prisma.subscription.update({
    where: { id: request.params.id },
    data: { planId: parseResult.data.newPlanId },
  });

  const upgradeActor = (request.headers['x-user-id'] as string) || 'system';
  await logSubscriptionEvent(
    'SUBSCRIPTION_UPGRADED',
    upgradeActor,
    subscription.id,
    subscription.tenantId,
    request.ip,
    request.headers['user-agent'] ?? 'unknown',
    { newPlanId: parseResult.data.newPlanId },
  );

  await reply.send({ success: true, data: subscription });
}

/**
 * 구독 다운그레이드
 * Plan SC: FR-P07.4
 */
export async function downgradeHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const schema = z.object({ newPlanId: z.string().min(1) });
  const parseResult = schema.safeParse(request.body);
  if (!parseResult.success) {
    await reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: '새 플랜 ID가 필요합니다' },
    });
    return;
  }

  const subscription = await prisma.subscription.update({
    where: { id: request.params.id },
    data: { planId: parseResult.data.newPlanId },
  });

  const downgradeActor = (request.headers['x-user-id'] as string) || 'system';
  await logSubscriptionEvent(
    'SUBSCRIPTION_DOWNGRADED',
    downgradeActor,
    subscription.id,
    subscription.tenantId,
    request.ip,
    request.headers['user-agent'] ?? 'unknown',
    { newPlanId: parseResult.data.newPlanId },
  );

  await reply.send({ success: true, data: subscription });
}

/**
 * 구독 취소
 * Plan SC: FR-P07.2
 */
export async function cancelHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const subscription = await prisma.subscription.update({
    where: { id: request.params.id },
    data: { status: 'CANCELED', canceledAt: new Date() },
  });

  const cancelActor = (request.headers['x-user-id'] as string) || 'system';
  await logSubscriptionEvent(
    'SUBSCRIPTION_CANCELED',
    cancelActor,
    subscription.id,
    subscription.tenantId,
    request.ip,
    request.headers['user-agent'] ?? 'unknown',
  );

  await reply.send({ success: true, data: subscription });
}
