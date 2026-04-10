// 구독 관리 핸들러
// Design Ref: DESIGN-MTU-P07
// Plan SC: FR-P07.1~FR-P07.5
// CSAP: D-08 접근 통제, D-06 감사 로그

import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { logSubscriptionEvent } from '../lib/audit.js';
import { prisma } from '../lib/prisma.js';

// CSAP D-12: 입력 검증 — UUID 형식 강제
const idParamSchema = z.object({
  id: z.string().uuid('유효한 UUID 형식이 아닙니다'),
});
const tenantIdParamSchema = z.object({
  tenantId: z.string().uuid('유효한 UUID 형식이 아닙니다'),
});

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
 * CSAP D-10: 페이지네이션으로 DoS 방어 (최대 100건)
 */
export async function listPlansHandler(
  _request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  // Design Ref: DESIGN-MTU-P07 — 플랜 수는 제한적이나 방어 코딩으로 take 적용
  const plans = await prisma.plan.findMany({
    where: { isActive: true },
    include: { services: { include: { service: true } } },
    orderBy: { price: 'asc' },
    take: 100,
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

  // FR-SUB.2: 플랜 생성 감사 로그 (CSAP D-06, Design Ref: SVC-SUB-R1 DESIGN)
  const createPlanActor = (request.headers['x-user-id'] as string) || 'system';
  await logSubscriptionEvent(
    'PLAN_CREATED',
    createPlanActor,
    plan.id,
    'platform',
    request.ip,
    request.headers['user-agent'] ?? 'unknown',
    { name: plan.name, slug: plan.slug },
  );

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
  // CSAP D-12: UUID 형식 검증
  const idParse = idParamSchema.safeParse(request.params);
  if (!idParse.success) {
    await reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: idParse.error.issues.map((i) => i.message).join(', ') },
    });
    return;
  }

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
    where: { id: idParse.data.id },
    data: { ...rest, ...(maxStorage !== undefined ? { maxStorage: BigInt(maxStorage) } : {}) },
  });

  // FR-SUB.2: 플랜 수정 감사 로그 (CSAP D-06, Design Ref: SVC-SUB-R1 DESIGN)
  const updatePlanActor = (request.headers['x-user-id'] as string) || 'system';
  await logSubscriptionEvent(
    'PLAN_UPDATED',
    updatePlanActor,
    plan.id,
    'platform',
    request.ip,
    request.headers['user-agent'] ?? 'unknown',
    { fields: Object.keys(parseResult.data) },
  );

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
 * CSAP D-08-05: 테넌트 격리 — SUPER_ADMIN 제외 본인 테넌트 구독만 조회
 * Security Ref: FR-N08.5
 */
export async function getTenantSubscriptionHandler(
  request: FastifyRequest<{ Params: { tenantId: string } }>,
  reply: FastifyReply,
): Promise<void> {
  // CSAP D-12: tenantId UUID 형식 검증
  const tenantIdParse = tenantIdParamSchema.safeParse(request.params);
  if (!tenantIdParse.success) {
    await reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: tenantIdParse.error.issues.map((i) => i.message).join(', ') },
    });
    return;
  }

  // CSAP D-08-05: JWT 클레임 기반 테넌트 격리 (Security Ref: FR-N08.5)
  const jwtTenantId = request.headers['x-user-tenant-id'] as string | undefined;
  const jwtRole = request.headers['x-user-role'] as string | undefined;
  const validatedTenantId = tenantIdParse.data.tenantId;
  if (jwtRole !== 'SUPER_ADMIN' && jwtTenantId && validatedTenantId !== jwtTenantId) {
    await reply.status(403).send({
      success: false,
      error: { code: 'FORBIDDEN', message: '접근 권한이 없습니다' },
    });
    return;
  }

  // CSAP D-10: 페이지네이션으로 DoS 방어 (최대 100건)
  const subscriptions = await prisma.subscription.findMany({
    where: { tenantId: validatedTenantId },
    include: { plan: true },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  await reply.send({ success: true, data: subscriptions });
}

/**
 * 구독 업그레이드
 * Plan SC: FR-P07.4
 * CSAP D-08-05: 테넌트 격리
 * Security Ref: FR-N08.5
 */
export async function upgradeHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<void> {
  // CSAP D-12: UUID 형식 검증
  const idParse = idParamSchema.safeParse(request.params);
  if (!idParse.success) {
    await reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: idParse.error.issues.map((i) => i.message).join(', ') },
    });
    return;
  }
  const upgradeSubId = idParse.data.id;

  const schema = z.object({ newPlanId: z.string().min(1) });
  const parseResult = schema.safeParse(request.body);
  if (!parseResult.success) {
    await reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: '새 플랜 ID가 필요합니다' },
    });
    return;
  }

  // CSAP D-08-05: 구독 소유 테넌트 확인 (Security Ref: FR-N08.5)
  const existingSub = await prisma.subscription.findUnique({
    where: { id: upgradeSubId },
    select: { tenantId: true },
  });
  if (!existingSub) {
    await reply.status(404).send({
      success: false,
      error: { code: 'SUBSCRIPTION_NOT_FOUND', message: '구독을 찾을 수 없습니다' },
    });
    return;
  }
  const upgradeJwtTenantId = request.headers['x-user-tenant-id'] as string | undefined;
  const upgradeJwtRole = request.headers['x-user-role'] as string | undefined;
  if (upgradeJwtRole !== 'SUPER_ADMIN' && upgradeJwtTenantId && existingSub.tenantId !== upgradeJwtTenantId) {
    await reply.status(403).send({
      success: false,
      error: { code: 'FORBIDDEN', message: '접근 권한이 없습니다' },
    });
    return;
  }

  const subscription = await prisma.subscription.update({
    where: { id: upgradeSubId },
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
 * CSAP D-08-05: 테넌트 격리
 * Security Ref: FR-N08.5
 */
export async function downgradeHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<void> {
  // CSAP D-12: UUID 형식 검증
  const idParse = idParamSchema.safeParse(request.params);
  if (!idParse.success) {
    await reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: idParse.error.issues.map((i) => i.message).join(', ') },
    });
    return;
  }
  const downgradeSubId = idParse.data.id;

  const schema = z.object({ newPlanId: z.string().min(1) });
  const parseResult = schema.safeParse(request.body);
  if (!parseResult.success) {
    await reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: '새 플랜 ID가 필요합니다' },
    });
    return;
  }

  // CSAP D-08-05: 구독 소유 테넌트 확인 (Security Ref: FR-N08.5)
  const existingDownSub = await prisma.subscription.findUnique({
    where: { id: downgradeSubId },
    select: { tenantId: true },
  });
  if (!existingDownSub) {
    await reply.status(404).send({
      success: false,
      error: { code: 'SUBSCRIPTION_NOT_FOUND', message: '구독을 찾을 수 없습니다' },
    });
    return;
  }
  const downgradeJwtTenantId = request.headers['x-user-tenant-id'] as string | undefined;
  const downgradeJwtRole = request.headers['x-user-role'] as string | undefined;
  if (downgradeJwtRole !== 'SUPER_ADMIN' && downgradeJwtTenantId && existingDownSub.tenantId !== downgradeJwtTenantId) {
    await reply.status(403).send({
      success: false,
      error: { code: 'FORBIDDEN', message: '접근 권한이 없습니다' },
    });
    return;
  }

  const subscription = await prisma.subscription.update({
    where: { id: downgradeSubId },
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
 * CSAP D-08-05: 테넌트 격리
 * Security Ref: FR-N08.5
 */
export async function cancelHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<void> {
  // CSAP D-12: UUID 형식 검증
  const idParse = idParamSchema.safeParse(request.params);
  if (!idParse.success) {
    await reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: idParse.error.issues.map((i) => i.message).join(', ') },
    });
    return;
  }
  const cancelSubId = idParse.data.id;

  // CSAP D-08-05: 구독 소유 테넌트 확인 (Security Ref: FR-N08.5)
  const existingCancelSub = await prisma.subscription.findUnique({
    where: { id: cancelSubId },
    select: { tenantId: true },
  });
  if (!existingCancelSub) {
    await reply.status(404).send({
      success: false,
      error: { code: 'SUBSCRIPTION_NOT_FOUND', message: '구독을 찾을 수 없습니다' },
    });
    return;
  }
  const cancelJwtTenantId = request.headers['x-user-tenant-id'] as string | undefined;
  const cancelJwtRole = request.headers['x-user-role'] as string | undefined;
  if (cancelJwtRole !== 'SUPER_ADMIN' && cancelJwtTenantId && existingCancelSub.tenantId !== cancelJwtTenantId) {
    await reply.status(403).send({
      success: false,
      error: { code: 'FORBIDDEN', message: '접근 권한이 없습니다' },
    });
    return;
  }

  const subscription = await prisma.subscription.update({
    where: { id: cancelSubId },
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
