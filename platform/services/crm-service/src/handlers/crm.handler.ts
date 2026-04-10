// CRM 핸들러
// Design Ref: DESIGN-MTU-P09
// Plan SC: FR-P09.1~FR-P09.5
// CSAP: D-08 접근 통제, D-06 감사 로그

import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { logCrmEvent } from '../lib/audit.js';
import { prisma } from '../lib/prisma.js';

const createCustomerSchema = z.object({
  name: z.string().min(1, '고객사명은 필수입니다').max(200),
  industry: z.string().optional(),
  size: z.string().optional(),
  tenantId: z.string().nullable().optional(),
});

const createContactSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  phone: z.string().optional(),
  role: z.string().optional(),
  isPrimary: z.boolean().default(false),
});

const createContractSchema = z.object({
  customerId: z.string().min(1),
  title: z.string().min(1).max(200),
  value: z.number().min(0),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
});

/**
 * 고객사 목록 조회
 * Plan SC: FR-P09.1
 * CSAP D-08-05: 테넌트 격리 — SUPER_ADMIN은 전체 조회, 그 외 JWT 테넌트 강제
 * Security Ref: FR-N08.3
 */
export async function listCustomersHandler(
  request: FastifyRequest<{
    Querystring: {
      status?: string;
      search?: string;
      industry?: string;
      page?: string;
      pageSize?: string;
      tenantId?: string;
    };
  }>,
  reply: FastifyReply,
): Promise<void> {
  const page = parseInt(request.query.page ?? '1', 10);
  const pageSize = Math.min(parseInt(request.query.pageSize ?? '20', 10), 100);

  // CSAP D-08-05: JWT 클레임 기반 테넌트 격리
  const jwtTenantId = request.headers['x-user-tenant-id'] as string | undefined;
  const jwtRole = request.headers['x-user-role'] as string | undefined;
  const effectiveTenantId = jwtRole === 'SUPER_ADMIN'
    ? (request.query.tenantId ?? jwtTenantId)
    : jwtTenantId;

  // FR-CRM.1: 검색/필터 (Design Ref: SVC-CRM-R1 DESIGN)
  const where: Record<string, unknown> = {};
  if (request.query.status) where['status'] = request.query.status;
  if (effectiveTenantId) where['tenantId'] = effectiveTenantId;
  if (request.query.industry) where['industry'] = request.query.industry;

  // FR-CRM.1: 이름 검색 (부분 일치)
  if (request.query.search) {
    where['name'] = { contains: request.query.search, mode: 'insensitive' };
  }

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      include: { _count: { select: { contacts: true, contracts: true } } },
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.customer.count({ where }),
  ]);

  await reply.send({
    success: true,
    data: customers,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
}

/**
 * 고객사 상세 조회
 * Plan SC: FR-P09.1
 * CSAP D-08-05: 테넌트 격리 — SUPER_ADMIN 제외 타 테넌트 고객 조회 차단
 * Security Ref: FR-N08.3
 */
export async function getCustomerHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const customer = await prisma.customer.findUnique({
    where: { id: request.params.id },
    include: { contacts: true, contracts: true },
  });

  if (!customer) {
    await reply.status(404).send({
      success: false,
      error: { code: 'CUSTOMER_NOT_FOUND', message: '고객사를 찾을 수 없습니다' },
    });
    return;
  }

  // CSAP D-08-05: 테넌트 격리 (Security Ref: FR-N08.3)
  const jwtTenantId = request.headers['x-user-tenant-id'] as string | undefined;
  const jwtRole = request.headers['x-user-role'] as string | undefined;
  if (jwtRole !== 'SUPER_ADMIN' && jwtTenantId && customer.tenantId && customer.tenantId !== jwtTenantId) {
    await reply.status(403).send({
      success: false,
      error: { code: 'FORBIDDEN', message: '접근 권한이 없습니다' },
    });
    return;
  }

  await reply.send({ success: true, data: customer });
}

/**
 * 고객사 등록
 * Plan SC: FR-P09.1
 */
export async function createCustomerHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const parseResult = createCustomerSchema.safeParse(request.body);
  if (!parseResult.success) {
    await reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parseResult.error.issues.map((i) => i.message).join(', ') },
    });
    return;
  }

  const customer = await prisma.customer.create({ data: parseResult.data });

  const customerActor = (request.headers['x-user-id'] as string) || 'system';
  const customerTenantId = (request.headers['x-user-tenant-id'] as string) || parseResult.data.tenantId || 'platform';
  await logCrmEvent(
    'CUSTOMER_CREATED',
    customerActor,
    customer.id,
    customerTenantId,
    request.ip,
    request.headers['user-agent'] ?? 'unknown',
    { name: customer.name },
  );

  await reply.status(201).send({ success: true, data: customer });
}

/**
 * 고객사 수정
 * Plan SC: FR-P09.1
 * CSAP D-08-05: 테넌트 격리
 * Security Ref: FR-N08.3
 */
export async function updateCustomerHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const schema = z.object({
    name: z.string().min(1).max(200).optional(),
    industry: z.string().optional(),
    size: z.string().optional(),
    status: z.string().optional(),
  });

  const parseResult = schema.safeParse(request.body);
  if (!parseResult.success) {
    await reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parseResult.error.issues.map((i) => i.message).join(', ') },
    });
    return;
  }

  // CSAP D-08-05: 테넌트 격리 확인 (Security Ref: FR-N08.3)
  const jwtTenantId = request.headers['x-user-tenant-id'] as string | undefined;
  const jwtRole = request.headers['x-user-role'] as string | undefined;
  const existing = await prisma.customer.findUnique({
    where: { id: request.params.id },
    select: { tenantId: true },
  });
  if (!existing) {
    await reply.status(404).send({
      success: false,
      error: { code: 'CUSTOMER_NOT_FOUND', message: '고객사를 찾을 수 없습니다' },
    });
    return;
  }
  if (jwtRole !== 'SUPER_ADMIN' && jwtTenantId && existing.tenantId && existing.tenantId !== jwtTenantId) {
    await reply.status(403).send({
      success: false,
      error: { code: 'FORBIDDEN', message: '접근 권한이 없습니다' },
    });
    return;
  }

  const customer = await prisma.customer.update({
    where: { id: request.params.id },
    data: parseResult.data,
  });

  // 감사 로그 (CSAP D-06: 변경 작업 전수 기록)
  const updateActor = (request.headers['x-user-id'] as string) || 'system';
  const updateTenantId = (request.headers['x-user-tenant-id'] as string) || 'platform';
  await logCrmEvent(
    'CUSTOMER_UPDATED',
    updateActor,
    customer.id,
    updateTenantId,
    request.ip,
    request.headers['user-agent'] ?? 'unknown',
    { fields: Object.keys(parseResult.data) },
  );

  await reply.send({ success: true, data: customer });
}

/**
 * 담당자 목록
 * Plan SC: FR-P09.2
 */
export async function listContactsHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<void> {
  // CSAP D-10: 방어 코딩 — 최대 200건 제한
  const contacts = await prisma.contact.findMany({
    where: { customerId: request.params.id },
    orderBy: { isPrimary: 'desc' },
    take: 200,
  });

  await reply.send({ success: true, data: contacts });
}

/**
 * 담당자 등록
 * Plan SC: FR-P09.2
 */
export async function createContactHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const parseResult = createContactSchema.safeParse(request.body);
  if (!parseResult.success) {
    await reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parseResult.error.issues.map((i) => i.message).join(', ') },
    });
    return;
  }

  const contact = await prisma.contact.create({
    data: { ...parseResult.data, customerId: request.params.id },
  });

  // 감사 로그 (CSAP D-06: 변경 작업 전수 기록)
  const contactActor = (request.headers['x-user-id'] as string) || 'system';
  const contactTenantId = (request.headers['x-user-tenant-id'] as string) || 'platform';
  await logCrmEvent(
    'CONTACT_CREATED',
    contactActor,
    contact.id,
    contactTenantId,
    request.ip,
    request.headers['user-agent'] ?? 'unknown',
    { customerId: request.params.id, name: contact.name },
  );

  await reply.status(201).send({ success: true, data: contact });
}

/**
 * 계약 목록
 * Plan SC: FR-P09.3, FR-CRM.4
 * CSAP D-08-05: 테넌트 격리 (Design Ref: SVC-CRM-R1 DESIGN)
 */
export async function listContractsHandler(
  request: FastifyRequest<{ Querystring: { status?: string; page?: string; pageSize?: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const page = parseInt(request.query.page ?? '1', 10);
  const pageSize = Math.min(parseInt(request.query.pageSize ?? '20', 10), 100);

  // FR-CRM.4: 테넌트 격리 (CSAP D-08-05, Design Ref: SVC-CRM-R1 DESIGN)
  const contractJwtTenantId = request.headers['x-user-tenant-id'] as string | undefined;
  const contractJwtRole = request.headers['x-user-role'] as string | undefined;

  const where: Record<string, unknown> = {};
  if (request.query.status) where['status'] = request.query.status;

  // SUPER_ADMIN이 아닌 경우 본인 테넌트의 고객 계약만 조회
  if (contractJwtRole !== 'SUPER_ADMIN' && contractJwtTenantId) {
    where['customer'] = { is: { tenantId: contractJwtTenantId } };
  }

  const [contracts, total] = await Promise.all([
    prisma.contract.findMany({
      where,
      include: { customer: true },
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { startDate: 'desc' },
    }),
    prisma.contract.count({ where }),
  ]);

  await reply.send({
    success: true,
    data: contracts,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
}

/**
 * 계약 등록
 * Plan SC: FR-P09.3
 */
export async function createContractHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const parseResult = createContractSchema.safeParse(request.body);
  if (!parseResult.success) {
    await reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parseResult.error.issues.map((i) => i.message).join(', ') },
    });
    return;
  }

  const contract = await prisma.contract.create({
    data: {
      ...parseResult.data,
      startDate: new Date(parseResult.data.startDate),
      endDate: new Date(parseResult.data.endDate),
    },
  });

  // 감사 로그 (FR-P09.5, CSAP D-06)
  const contractActor = (request.headers['x-user-id'] as string) || 'system';
  const contractTenantId = (request.headers['x-user-tenant-id'] as string) || 'platform';
  await logCrmEvent(
    'CONTRACT_CREATED',
    contractActor,
    contract.id,
    contractTenantId,
    request.ip,
    request.headers['user-agent'] ?? 'unknown',
    { title: contract.title, customerId: contract.customerId },
  );

  await reply.status(201).send({ success: true, data: contract });
}

/**
 * 계약 수정
 * Plan SC: FR-P09.3
 */
export async function updateContractHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const schema = z.object({
    title: z.string().optional(),
    value: z.number().min(0).optional(),
    status: z.string().optional(),
  });

  const parseResult = schema.safeParse(request.body);
  if (!parseResult.success) {
    await reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parseResult.error.issues.map((i) => i.message).join(', ') },
    });
    return;
  }

  const contract = await prisma.contract.update({
    where: { id: request.params.id },
    data: parseResult.data,
  });

  // 감사 로그 (CSAP D-06: 변경 작업 전수 기록)
  const contractUpdateActor = (request.headers['x-user-id'] as string) || 'system';
  const contractUpdateTenantId = (request.headers['x-user-tenant-id'] as string) || 'platform';
  await logCrmEvent(
    'CONTRACT_UPDATED',
    contractUpdateActor,
    contract.id,
    contractUpdateTenantId,
    request.ip,
    request.headers['user-agent'] ?? 'unknown',
    { fields: Object.keys(parseResult.data) },
  );

  await reply.send({ success: true, data: contract });
}

/**
 * 영업 파이프라인 조회
 * Plan SC: FR-P09.4, FR-CRM.5
 * CSAP D-08-05: 테넌트 격리 (Design Ref: SVC-CRM-R1 DESIGN)
 */
export async function pipelineHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const stages = ['prospect', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost'];

  // FR-CRM.5: 테넌트 격리 (CSAP D-08-05, Design Ref: SVC-CRM-R1 DESIGN)
  const pipelineJwtTenantId = request.headers['x-user-tenant-id'] as string | undefined;
  const pipelineJwtRole = request.headers['x-user-role'] as string | undefined;

  const pipeline = await Promise.all(
    stages.map(async (status) => {
      const where: Record<string, unknown> = { status };
      if (pipelineJwtRole !== 'SUPER_ADMIN' && pipelineJwtTenantId) {
        where['tenantId'] = pipelineJwtTenantId;
      }
      const count = await prisma.customer.count({ where });
      return { stage: status, count };
    }),
  );

  await reply.send({ success: true, data: pipeline });
}
