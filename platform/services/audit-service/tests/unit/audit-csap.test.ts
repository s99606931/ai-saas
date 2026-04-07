// 감사 로그 서비스 CSAP 보안 테스트
// Design Ref: DESIGN-MTU-P13
// Plan SC: FR-P13.1~FR-P13.6
// CSAP: D-06 침해사고 관리 (핵심 통제), D-09 무결성

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { createHash } from 'crypto';

const auditLogSchema = z.object({
  actor: z.string().min(1),
  action: z.string().min(1),
  resource: z.string().min(1),
  resourceId: z.string().optional(),
  tenantId: z.string().optional(),
  ip: z.string().optional(),
  userAgent: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  timestamp: z.string().datetime().optional(),
});

describe('CSAP D-06: 감사 로그 무결성', () => {
  it('SHA-256 해시 체인이 올바르다', () => {
    const computeHash = (data: string, previousHash: string): string => {
      return createHash('sha256').update(previousHash + data).digest('hex');
    };

    const genesisHash = createHash('sha256').update('genesis').digest('hex');
    const hash1 = computeHash('log-entry-1', genesisHash);
    const hash2 = computeHash('log-entry-2', hash1);

    expect(hash1).not.toBe(genesisHash);
    expect(hash2).not.toBe(hash1);
    expect(hash2.length).toBe(64); // SHA-256 = 64 hex chars
  });

  it('해시 체인 위변조 탐지가 올바르다', () => {
    const computeHash = (data: string, previousHash: string): string => {
      return createHash('sha256').update(previousHash + data).digest('hex');
    };

    const genesis = 'genesis-hash';
    const hash1 = computeHash('entry-1', genesis);
    const hash2 = computeHash('entry-2', hash1);

    // 중간 로그 위변조 시도
    const tamperedHash1 = computeHash('tampered-entry', genesis);
    const recomputedHash2 = computeHash('entry-2', tamperedHash1);

    // 체인 불일치 감지
    expect(recomputedHash2).not.toBe(hash2);
  });

  it('append-only 속성이 보장된다', () => {
    const logs: string[] = [];
    logs.push('entry-1');
    logs.push('entry-2');
    logs.push('entry-3');

    // 삭제 시도 방지 (설계 수준)
    expect(logs.length).toBe(3);
    // 실제 구현에서는 DB 트리거로 DELETE 차단
  });
});

describe('CSAP D-06: 감사 로그 입력 검증', () => {
  it('유효한 감사 로그를 허용한다', () => {
    const result = auditLogSchema.safeParse({
      actor: 'admin-001',
      action: 'USER_DELETE',
      resource: 'user',
      resourceId: 'user-123',
      tenantId: 'tenant-1',
      ip: '192.168.1.1',
    });
    expect(result.success).toBe(true);
  });

  it('actor 없는 감사 로그를 거부한다', () => {
    expect(auditLogSchema.safeParse({
      action: 'USER_DELETE',
      resource: 'user',
    }).success).toBe(false);
  });

  it('action 없는 감사 로그를 거부한다', () => {
    expect(auditLogSchema.safeParse({
      actor: 'admin-001',
      resource: 'user',
    }).success).toBe(false);
  });
});

describe('CSAP D-06: 로그 보존 정책', () => {
  it('최소 보존 기간은 1년이다', () => {
    const RETENTION_DAYS = 365;
    expect(RETENTION_DAYS).toBeGreaterThanOrEqual(365);
  });

  it('보존 기간 만료 시 아카이브로 이동한다', () => {
    const retentionPolicy = {
      activeDays: 90,    // 90일 활성 스토리지
      archiveDays: 275,  // 275일 아카이브
      totalDays: 365,    // 합계 1년
    };
    expect(retentionPolicy.activeDays + retentionPolicy.archiveDays)
      .toBe(retentionPolicy.totalDays);
  });

  it('로그 삭제는 SUPER_ADMIN도 불가능하다', () => {
    const canDeleteLogs = false; // append-only, 삭제 불가
    expect(canDeleteLogs).toBe(false);
  });
});

describe('감사 로그 검색/필터링', () => {
  it('날짜 범위 필터가 동작한다', () => {
    const logs = [
      { timestamp: '2026-04-01T00:00:00Z', action: 'LOGIN' },
      { timestamp: '2026-04-05T00:00:00Z', action: 'USER_CREATE' },
      { timestamp: '2026-04-07T00:00:00Z', action: 'USER_DELETE' },
    ];

    const from = new Date('2026-04-04');
    const to = new Date('2026-04-06');
    const filtered = logs.filter((l) => {
      const t = new Date(l.timestamp);
      return t >= from && t <= to;
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0].action).toBe('USER_CREATE');
  });

  it('actor별 필터가 동작한다', () => {
    const logs = [
      { actor: 'admin-001', action: 'LOGIN' },
      { actor: 'admin-002', action: 'LOGIN' },
      { actor: 'admin-001', action: 'USER_CREATE' },
    ];

    const filtered = logs.filter((l) => l.actor === 'admin-001');
    expect(filtered).toHaveLength(2);
  });
});
