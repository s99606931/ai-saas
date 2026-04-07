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
 */
export async function listCustomersHandler(
  request: FastifyRequest<{ Querystring: { status?: string; page?: string; pageSize?: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const page = parseInt(request.query.page ?? '1', 10);
  const pageSize = Math.min(parseInt(request.query.pageSize ?? '20', 10), 100);
  const where = request.query.status ? { status: request.query.status } : {};

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
  const contacts = await prisma.contact.findMany({
    where: { customerId: request.params.id },
    orderBy: { isPrimary: 'desc' },
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
 * Plan SC: FR-P09.3
 */
export async function listContractsHandler(
  request: FastifyRequest<{ Querystring: { status?: string; page?: string; pageSize?: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const page = parseInt(request.query.page ?? '1', 10);
  const pageSize = Math.min(parseInt(request.query.pageSize ?? '20', 10), 100);
  const where = request.query.status ? { status: request.query.status } : {};

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
 * Plan SC: FR-P09.4
 */
export async function pipelineHandler(
  _request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const stages = ['prospect', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost'];

  const pipeline = await Promise.all(
    stages.map(async (status) => {
      const count = await prisma.customer.count({ where: { status } });
      return { stage: status, count };
    }),
  );

  await reply.send({ success: true, data: pipeline });
}
