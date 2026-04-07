// Append-only 감사 로그 테스트
// Design Ref: DESIGN-MTU-P13
// Plan SC: FR-P13.1
// CSAP: D-06 감사 로그 수정/삭제 불가

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Prisma 모킹
const mockPrisma = {
  auditLog: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
};

vi.mock('../../src/lib/prisma.js', () => ({
  prisma: mockPrisma,
}));

describe('appendAuditLog (CSAP D-06)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('첫 번째 로그의 previousHash는 0으로 채워진다', async () => {
    mockPrisma.auditLog.findFirst.mockResolvedValueOnce(null);
    mockPrisma.auditLog.create.mockResolvedValueOnce({});

    const { appendAuditLog } = await import('../../src/lib/append-only.js');

    await appendAuditLog({
      actorId: 'user-1',
      action: 'TEST_ACTION',
      target: 'resource-1',
      tenantId: 'tenant-1',
    });

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        previousHash: '0'.repeat(64),
        hash: expect.any(String),
        action: 'TEST_ACTION',
        actorId: 'user-1',
      }),
    });
  });

  it('연속 로그는 이전 로그의 해시를 참조한다', async () => {
    const previousHash = 'abc123'.padEnd(64, '0');
    mockPrisma.auditLog.findFirst.mockResolvedValueOnce({ hash: previousHash });
    mockPrisma.auditLog.create.mockResolvedValueOnce({});

    const { appendAuditLog } = await import('../../src/lib/append-only.js');

    await appendAuditLog({
      actorId: 'user-2',
      action: 'SECOND_ACTION',
      tenantId: 'tenant-1',
    });

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        previousHash,
        hash: expect.any(String),
        action: 'SECOND_ACTION',
      }),
    });
  });

  it('해시는 SHA-256 형식(64자 hex)이다', async () => {
    mockPrisma.auditLog.findFirst.mockResolvedValueOnce(null);
    let createdData: Record<string, unknown> = {};
    mockPrisma.auditLog.create.mockImplementationOnce(({ data }: { data: Record<string, unknown> }) => {
      createdData = data;
      return {};
    });

    const { appendAuditLog } = await import('../../src/lib/append-only.js');

    await appendAuditLog({
      action: 'HASH_TEST',
      tenantId: 'tenant-1',
    });

    expect(createdData['hash']).toMatch(/^[0-9a-f]{64}$/);
  });

  it('선택적 필드 없이도 동작한다', async () => {
    mockPrisma.auditLog.findFirst.mockResolvedValueOnce(null);
    mockPrisma.auditLog.create.mockResolvedValueOnce({});

    const { appendAuditLog } = await import('../../src/lib/append-only.js');

    await appendAuditLog({ action: 'MINIMAL' });

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'MINIMAL',
      }),
    });
  });
});
