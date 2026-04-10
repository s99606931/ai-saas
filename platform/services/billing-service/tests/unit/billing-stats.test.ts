// 빌링 통계 핸들러 테스트
// Design Ref: SVC-BILL-R1 DESIGN
// Plan SC: FR-BILL.2, FR-BILL.3

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Prisma 모킹
vi.mock('../../src/lib/prisma.js', () => ({
  prisma: {
    invoice: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    payment: {
      aggregate: vi.fn().mockResolvedValue({
        _sum: { amount: 0 },
        _count: { id: 0 },
      }),
    },
  },
}));

import { overdueInvoicesHandler, revenueTrendHandler } from '../../src/handlers/billing-stats.handler.js';
import { prisma } from '../../src/lib/prisma.js';

function createMockRequest(overrides: Record<string, unknown> = {}) {
  return {
    query: {},
    params: {},
    headers: { 'x-user-id': 'user-1', 'x-user-tenant-id': 'tenant-1' },
    ip: '127.0.0.1',
    ...overrides,
  } as never;
}

function createMockReply() {
  const reply = {
    statusCode: 200,
    body: null as unknown,
    status: vi.fn().mockImplementation(function (this: typeof reply, code: number) {
      this.statusCode = code;
      return this;
    }),
    send: vi.fn().mockImplementation(function (this: typeof reply, data: unknown) {
      this.body = data;
      return this;
    }),
  };
  return reply as never;
}

describe('FR-BILL.2: 연체 인보이스 조회', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('연체 인보이스 목록을 반환한다', async () => {
    const overdueInvoice = {
      id: 'inv-1',
      amount: 100000,
      status: 'issued',
      dueDate: new Date('2025-01-01'),
      subscription: { tenantId: 'tenant-1', tenant: { name: '공공기관A' } },
    };
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([overdueInvoice] as never);

    const req = createMockRequest();
    const reply = createMockReply();
    await overdueInvoicesHandler(req, reply);

    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          total: 1,
          totalOverdueAmount: '100000',
        }),
      }),
    );
  });

  it('연체 인보이스가 없으면 빈 목록을 반환한다', async () => {
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([]);

    const req = createMockRequest();
    const reply = createMockReply();
    await overdueInvoicesHandler(req, reply);

    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({ total: 0, totalOverdueAmount: '0' }),
      }),
    );
  });

  it('CSAP D-10: 최대 500건으로 제한한다', async () => {
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([]);

    const req = createMockRequest();
    const reply = createMockReply();
    await overdueInvoicesHandler(req, reply);

    expect(prisma.invoice.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 500 }));
  });
});

describe('FR-BILL.3: 월별 수익 추이', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('기본 6개월 수익 추이를 반환한다', async () => {
    const req = createMockRequest({ query: {} });
    const reply = createMockReply();
    await revenueTrendHandler(req, reply);

    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          months: 6,
          trend: expect.any(Array),
        }),
      }),
    );
    // 6개월 데이터가 반환되어야 함
    const responseData = (reply.send as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as { data: { trend: unknown[] } };
    expect(responseData.data.trend.length).toBe(6);
  });

  it('months 파라미터를 최대 24로 제한한다 (Zod)', async () => {
    const req = createMockRequest({ query: { months: '24' } });
    const reply = createMockReply();
    await revenueTrendHandler(req, reply);

    const responseData = (reply.send as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as { data: { months: number } };
    expect(responseData.data.months).toBe(24);
  });

  it('잘못된 months 값은 400 검증 오류 (Zod)', async () => {
    const req = createMockRequest({ query: { months: 'abc' } });
    const reply = createMockReply();
    await revenueTrendHandler(req, reply);

    expect(reply.status).toHaveBeenCalledWith(400);
  });

  it('수익 데이터의 월별 합계가 정확하다', async () => {
    vi.mocked(prisma.payment.aggregate).mockResolvedValue({
      _sum: { amount: 5000000 },
      _count: { id: 3 },
    } as never);

    const req = createMockRequest({ query: { months: '1' } });
    const reply = createMockReply();
    await revenueTrendHandler(req, reply);

    const responseData = (reply.send as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as {
      data: { trend: { revenue: number; count: number }[] };
    };
    expect(responseData.data.trend[0]?.revenue).toBe(5000000);
    expect(responseData.data.trend[0]?.count).toBe(3);
  });
});
