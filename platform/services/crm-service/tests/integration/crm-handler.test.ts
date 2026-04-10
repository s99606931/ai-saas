// CRM 핸들러 통합 테스트
// Design Ref: DESIGN-MTU-P09
// Plan SC: FR-P09.1~FR-P09.5
// CSAP: D-08 접근 통제, D-06 감사 로그, D-12 입력 검증

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Prisma 모킹
vi.mock('../../src/lib/prisma.js', () => ({
  prisma: {
    customer: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'cust-1', name: 'Test', tenantId: 'tenant-1' }),
      update: vi.fn().mockResolvedValue({ id: 'cust-1', name: 'Updated' }),
      count: vi.fn().mockResolvedValue(0),
    },
    contact: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id: 'contact-1', name: 'Kim', customerId: 'cust-1' }),
    },
    contract: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({
        id: 'contract-1', title: 'Contract 1', customerId: 'cust-1',
        value: 1000000, startDate: new Date(), endDate: new Date(),
      }),
      update: vi.fn().mockResolvedValue({ id: 'contract-1', title: 'Updated', status: 'active' }),
      count: vi.fn().mockResolvedValue(0),
    },
  },
}));

vi.mock('../../src/lib/audit.js', () => ({
  logCrmEvent: vi.fn().mockResolvedValue(undefined),
}));

import {
  listCustomersHandler,
  getCustomerHandler,
  createCustomerHandler,
  updateCustomerHandler,
  listContactsHandler,
  createContactHandler,
  listContractsHandler,
  createContractHandler,
  updateContractHandler,
  pipelineHandler,
} from '../../src/handlers/crm.handler.js';
import { prisma } from '../../src/lib/prisma.js';

function createMockRequest(overrides: Record<string, unknown> = {}) {
  return {
    query: {},
    params: {},
    body: {},
    headers: { 'x-user-id': 'user-1', 'x-user-tenant-id': 'tenant-1', 'x-user-role': 'ADMIN' },
    ip: '127.0.0.1',
    ...overrides,
  } as never;
}

function createMockReply() {
  const reply = {
    statusCode: 200,
    body: null as unknown,
    status: vi.fn().mockImplementation(function(this: typeof reply, code: number) {
      this.statusCode = code;
      return this;
    }),
    send: vi.fn().mockImplementation(function(this: typeof reply, data: unknown) {
      this.body = data;
      return this;
    }),
  };
  return reply as never;
}

describe('CRM 핸들러 통합 테스트', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('FR-P09.1: 고객사 목록 조회', () => {
    it('페이지네이션이 기본값으로 동작한다', async () => {
      vi.mocked(prisma.customer.findMany).mockResolvedValue([]);
      vi.mocked(prisma.customer.count).mockResolvedValue(0);

      const req = createMockRequest({ query: {} });
      const reply = createMockReply();
      await listCustomersHandler(req, reply);

      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          pagination: expect.objectContaining({ page: 1, pageSize: 20 }),
        }),
      );
    });

    it('pageSize 최대 100으로 제한된다', async () => {
      vi.mocked(prisma.customer.findMany).mockResolvedValue([]);
      vi.mocked(prisma.customer.count).mockResolvedValue(0);

      const req = createMockRequest({ query: { pageSize: '999' } });
      const reply = createMockReply();
      await listCustomersHandler(req, reply);

      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          pagination: expect.objectContaining({ pageSize: 100 }),
        }),
      );
    });

    it('CSAP D-08-05: 일반 사용자는 자기 테넌트만 조회한다', async () => {
      vi.mocked(prisma.customer.findMany).mockResolvedValue([]);
      vi.mocked(prisma.customer.count).mockResolvedValue(0);

      const req = createMockRequest({
        query: { tenantId: 'other-tenant' },
        headers: { 'x-user-tenant-id': 'my-tenant', 'x-user-role': 'USER' },
      });
      const reply = createMockReply();
      await listCustomersHandler(req, reply);

      // 일반 사용자가 다른 테넌트 요청해도 자기 테넌트로 강제됨
      expect(prisma.customer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: 'my-tenant' }),
        }),
      );
    });
  });

  describe('FR-P09.1: 고객사 상세 조회', () => {
    it('존재하지 않는 고객사를 404로 처리한다', async () => {
      vi.mocked(prisma.customer.findUnique).mockResolvedValue(null);

      const req = createMockRequest({ params: { id: 'non-existent' } });
      const reply = createMockReply();
      await getCustomerHandler(req, reply);

      expect(reply.status).toHaveBeenCalledWith(404);
    });

    it('CSAP D-08-05: 타 테넌트 고객 접근 시 403 반환', async () => {
      vi.mocked(prisma.customer.findUnique).mockResolvedValue({
        id: 'cust-1', tenantId: 'other-tenant', contacts: [], contracts: [],
      } as never);

      const req = createMockRequest({
        params: { id: 'cust-1' },
        headers: { 'x-user-tenant-id': 'my-tenant', 'x-user-role': 'USER' },
      });
      const reply = createMockReply();
      await getCustomerHandler(req, reply);

      expect(reply.status).toHaveBeenCalledWith(403);
    });
  });

  describe('FR-P09.1: 고객사 등록', () => {
    it('유효한 데이터로 고객사를 생성한다', async () => {
      const req = createMockRequest({
        body: { name: '(주)테스트공공기관', industry: 'government' },
      });
      const reply = createMockReply();
      await createCustomerHandler(req, reply);

      expect(reply.send).toHaveBeenCalled();
    });

    it('CSAP D-12: 유효하지 않은 데이터를 400으로 거부한다', async () => {
      const req = createMockRequest({ body: { name: '' } });
      const reply = createMockReply();
      await createCustomerHandler(req, reply);

      expect(reply.status).toHaveBeenCalledWith(400);
    });
  });

  describe('FR-P09.1: 고객사 수정', () => {
    it('존재하지 않는 고객사 수정 시 404 반환', async () => {
      vi.mocked(prisma.customer.findUnique).mockResolvedValue(null);

      const req = createMockRequest({
        params: { id: 'non-existent' },
        body: { name: 'Updated' },
      });
      const reply = createMockReply();
      await updateCustomerHandler(req, reply);

      expect(reply.status).toHaveBeenCalledWith(404);
    });
  });

  describe('FR-P09.2: 담당자 CRUD', () => {
    it('담당자 목록을 최대 200건 제한으로 조회한다', async () => {
      vi.mocked(prisma.contact.findMany).mockResolvedValue([]);

      const req = createMockRequest({ params: { id: 'cust-1' } });
      const reply = createMockReply();
      await listContactsHandler(req, reply);

      expect(prisma.contact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 200 }),
      );
    });

    it('CSAP D-12: 잘못된 이메일로 담당자 등록 시 400 반환', async () => {
      const req = createMockRequest({
        params: { id: 'cust-1' },
        body: { name: 'Kim', email: 'invalid-email' },
      });
      const reply = createMockReply();
      await createContactHandler(req, reply);

      expect(reply.status).toHaveBeenCalledWith(400);
    });
  });

  describe('FR-P09.3: 계약 CRUD', () => {
    it('계약 목록 페이지네이션이 동작한다', async () => {
      vi.mocked(prisma.contract.findMany).mockResolvedValue([]);
      vi.mocked(prisma.contract.count).mockResolvedValue(0);

      const req = createMockRequest({ query: { page: '2', pageSize: '10' } });
      const reply = createMockReply();
      await listContractsHandler(req, reply);

      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          pagination: expect.objectContaining({ page: 2, pageSize: 10 }),
        }),
      );
    });

    it('CSAP D-12: 잘못된 계약 데이터를 400으로 거부한다', async () => {
      const req = createMockRequest({
        body: { customerId: '', title: '', value: -1, startDate: 'invalid', endDate: 'invalid' },
      });
      const reply = createMockReply();
      await createContractHandler(req, reply);

      expect(reply.status).toHaveBeenCalledWith(400);
    });

    it('유효한 계약을 생성한다', async () => {
      const req = createMockRequest({
        body: {
          customerId: 'cust-1',
          title: 'SaaS 구독 계약',
          value: 50000000,
          startDate: '2026-01-01T00:00:00.000Z',
          endDate: '2026-12-31T23:59:59.000Z',
        },
      });
      const reply = createMockReply();
      await createContractHandler(req, reply);

      expect(prisma.contract.create).toHaveBeenCalled();
    });
  });

  describe('FR-P09.4: 파이프라인', () => {
    it('6개 영업 단계별 카운트를 반환한다', async () => {
      vi.mocked(prisma.customer.count).mockResolvedValue(0);

      const req = createMockRequest();
      const reply = createMockReply();
      await pipelineHandler(req, reply);

      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.arrayContaining([
            expect.objectContaining({ stage: 'prospect' }),
            expect.objectContaining({ stage: 'closed_won' }),
          ]),
        }),
      );
    });
  });
});
