// 보안 모니터링 핸들러 통합 테스트
// Design Ref: DESIGN-MTU-P15 §2
// Plan SC: FR-P15.1~FR-P15.4
// CSAP: D-06 감사, D-10 네트워크 보안, D-12 입력 검증

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/lib/prisma.js', () => ({
  prisma: {
    auditLog: {
      groupBy: vi.fn().mockResolvedValue([]),
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

vi.mock('../../src/lib/audit.js', () => ({
  logSecurityEvent: vi.fn().mockResolvedValue(undefined),
}));

import {
  loginFailuresHandler,
  anomaliesHandler,
  getIpBlocklistHandler,
  addIpBlocklistHandler,
  removeIpBlocklistHandler,
  securityAlertsHandler,
} from '../../src/handlers/security.handler.js';
import { prisma } from '../../src/lib/prisma.js';

function createMockRequest(overrides: Record<string, unknown> = {}) {
  return {
    query: {},
    params: {},
    body: {},
    headers: { 'x-user-id': 'admin-1', 'x-user-role': 'SUPER_ADMIN' },
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

describe('FR-P15.1: 로그인 실패 패턴 탐지', () => {
  beforeEach(() => vi.clearAllMocks());

  it('기본 5분/5회 기준으로 로그인 실패를 탐지한다', async () => {
    vi.mocked(prisma.auditLog.groupBy).mockResolvedValue([]);

    const req = createMockRequest({ query: {} });
    const reply = createMockReply();
    await loginFailuresHandler(req, reply);

    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({
        totalAlerts: 0,
        period: expect.objectContaining({ minutes: 5, threshold: 5 }),
      }),
    );
  });

  it('실패 10회 이상은 critical 등급이다', async () => {
    vi.mocked(prisma.auditLog.groupBy).mockResolvedValue([
      { actorId: 'user-1', ip: '1.2.3.4', _count: { id: 12 } },
    ] as never);

    const req = createMockRequest({ query: {} });
    const reply = createMockReply();
    await loginFailuresHandler(req, reply);

    const response = (reply.send as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as {
      alerts: { severity: string }[];
    };
    expect(response.alerts[0]?.severity).toBe('critical');
  });

  it('CSAP D-12: 잘못된 minutes 파라미터를 400으로 거부한다', async () => {
    const req = createMockRequest({ query: { minutes: '-1' } });
    const reply = createMockReply();
    await loginFailuresHandler(req, reply);

    expect(reply.status).toHaveBeenCalledWith(400);
  });

  it('CSAP D-12: minutes 최대값 1440(24시간)을 초과하면 거부한다', async () => {
    const req = createMockRequest({ query: { minutes: '9999' } });
    const reply = createMockReply();
    await loginFailuresHandler(req, reply);

    expect(reply.status).toHaveBeenCalledWith(400);
  });
});

describe('FR-P15.2: 이상 접근 패턴 탐지', () => {
  beforeEach(() => vi.clearAllMocks());

  it('기본 1시간 기준으로 이상 패턴을 탐지한다', async () => {
    vi.mocked(prisma.auditLog.groupBy).mockResolvedValue([]);

    const req = createMockRequest({ query: {} });
    const reply = createMockReply();
    await anomaliesHandler(req, reply);

    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({
        totalAnomalies: 0,
        period: expect.objectContaining({ hours: 1 }),
      }),
    );
  });

  it('CSAP D-12: 잘못된 hours 파라미터를 400으로 거부한다', async () => {
    const req = createMockRequest({ query: { hours: '0' } });
    const reply = createMockReply();
    await anomaliesHandler(req, reply);

    expect(reply.status).toHaveBeenCalledWith(400);
  });
});

describe('FR-P15.3: IP 차단 목록 관리', () => {
  beforeEach(() => vi.clearAllMocks());

  it('IP를 차단 목록에 추가한다', async () => {
    const req = createMockRequest({
      body: { ip: '192.168.1.100', reason: '무차별 대입 공격' },
    });
    const reply = createMockReply();
    await addIpBlocklistHandler(req, reply);

    expect(reply.status).toHaveBeenCalledWith(201);
    expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({ success: true, ip: '192.168.1.100' }));
  });

  it('CSAP D-12: IP 없이 차단 요청 시 400 반환', async () => {
    const req = createMockRequest({ body: { reason: '차단 사유' } });
    const reply = createMockReply();
    await addIpBlocklistHandler(req, reply);

    expect(reply.status).toHaveBeenCalledWith(400);
  });

  it('차단 목록을 조회한다', async () => {
    const req = createMockRequest();
    const reply = createMockReply();
    await getIpBlocklistHandler(req, reply);

    expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({ total: expect.any(Number) }));
  });

  it('존재하지 않는 IP 해제 시 404 반환', async () => {
    const req = createMockRequest({ params: { ip: '10.0.0.1' } });
    const reply = createMockReply();
    await removeIpBlocklistHandler(req, reply);

    expect(reply.status).toHaveBeenCalledWith(404);
  });
});

describe('FR-P15.4: 보안 이벤트 알림', () => {
  beforeEach(() => vi.clearAllMocks());

  it('보안 이벤트 알림 목록을 반환한다', async () => {
    vi.mocked(prisma.auditLog.findMany).mockResolvedValue([
      {
        id: 'log-1',
        action: 'LOGIN_FAILED',
        actorId: 'user-1',
        ip: '1.2.3.4',
        metadata: {},
        createdAt: new Date(),
      },
    ] as never);

    const req = createMockRequest({ query: {} });
    const reply = createMockReply();
    await securityAlertsHandler(req, reply);

    expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({ total: 1 }));
  });

  it('AI_GRADE_VIOLATION은 critical 등급이다', async () => {
    vi.mocked(prisma.auditLog.findMany).mockResolvedValue([
      {
        id: 'log-2',
        action: 'AI_GRADE_VIOLATION',
        actorId: null,
        ip: null,
        metadata: {},
        createdAt: new Date(),
      },
    ] as never);

    const req = createMockRequest({ query: {} });
    const reply = createMockReply();
    await securityAlertsHandler(req, reply);

    const response = (reply.send as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as {
      alerts: { severity: string }[];
    };
    expect(response.alerts[0]?.severity).toBe('critical');
  });

  it('CSAP D-12: limit 최대 100 초과 시 400 반환', async () => {
    const req = createMockRequest({ query: { limit: '999' } });
    const reply = createMockReply();
    await securityAlertsHandler(req, reply);

    expect(reply.status).toHaveBeenCalledWith(400);
  });
});
