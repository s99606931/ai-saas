// 보안 모니터링 Zod 스키마 + IP 차단 로직 테스트
// Design Ref: DESIGN-MTU-P15 §2
// Plan SC: FR-P15.1~FR-P15.4
// CSAP: D-06, D-10, D-12

import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// 핸들러에서 사용하는 스키마 (모듈 격리 테스트)
const ipBlockSchema = z.object({
  ip: z.string().min(1).max(45),
  reason: z.string().min(1).max(255),
  expiresAt: z.string().optional(),
});

const loginFailuresQuerySchema = z.object({
  threshold: z.coerce.number().int().min(1).max(100).default(5),
  window: z.coerce.number().int().min(1).max(1440).default(5),
});

const alertsQuerySchema = z.object({
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  acknowledged: z.enum(['true', 'false']).optional(),
});

describe('ipBlockSchema (CSAP D-12 입력 검증)', () => {
  it('유효한 IP 차단 요청을 허용한다', () => {
    const result = ipBlockSchema.safeParse({
      ip: '192.168.1.100',
      reason: '무차별 대입 공격 탐지',
    });
    expect(result.success).toBe(true);
  });

  it('IPv6 주소를 허용한다', () => {
    const result = ipBlockSchema.safeParse({
      ip: '2001:0db8:85a3:0000:0000:8a2e:0370:7334',
      reason: '의심스러운 활동',
    });
    expect(result.success).toBe(true);
  });

  it('빈 IP를 거부한다', () => {
    const result = ipBlockSchema.safeParse({
      ip: '',
      reason: '테스트',
    });
    expect(result.success).toBe(false);
  });

  it('빈 이유를 거부한다', () => {
    const result = ipBlockSchema.safeParse({
      ip: '1.2.3.4',
      reason: '',
    });
    expect(result.success).toBe(false);
  });

  it('이유가 255자를 초과하면 거부한다', () => {
    const result = ipBlockSchema.safeParse({
      ip: '1.2.3.4',
      reason: 'a'.repeat(256),
    });
    expect(result.success).toBe(false);
  });

  it('만료 시간이 선택적이다', () => {
    const result = ipBlockSchema.safeParse({
      ip: '1.2.3.4',
      reason: '테스트',
      expiresAt: '2026-04-08T00:00:00.000Z',
    });
    expect(result.success).toBe(true);
  });
});

describe('loginFailuresQuerySchema (CSAP D-12)', () => {
  it('기본값이 적용된다 (threshold=5, window=5)', () => {
    const result = loginFailuresQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.threshold).toBe(5);
      expect(result.data.window).toBe(5);
    }
  });

  it('사용자 정의 값을 허용한다', () => {
    const result = loginFailuresQuerySchema.safeParse({
      threshold: '10',
      window: '30',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.threshold).toBe(10);
      expect(result.data.window).toBe(30);
    }
  });

  it('threshold 범위를 1~100으로 제한한다', () => {
    expect(loginFailuresQuerySchema.safeParse({ threshold: '0' }).success).toBe(false);
    expect(loginFailuresQuerySchema.safeParse({ threshold: '101' }).success).toBe(false);
    expect(loginFailuresQuerySchema.safeParse({ threshold: '50' }).success).toBe(true);
  });

  it('window 범위를 1~1440(24시간)으로 제한한다', () => {
    expect(loginFailuresQuerySchema.safeParse({ window: '0' }).success).toBe(false);
    expect(loginFailuresQuerySchema.safeParse({ window: '1441' }).success).toBe(false);
    expect(loginFailuresQuerySchema.safeParse({ window: '720' }).success).toBe(true);
  });
});

describe('alertsQuerySchema (CSAP D-12)', () => {
  it('빈 쿼리를 허용한다', () => {
    expect(alertsQuerySchema.safeParse({}).success).toBe(true);
  });

  it('유효한 severity 값을 허용한다', () => {
    for (const sev of ['low', 'medium', 'high', 'critical']) {
      expect(alertsQuerySchema.safeParse({ severity: sev }).success).toBe(true);
    }
  });

  it('잘못된 severity 값을 거부한다', () => {
    expect(alertsQuerySchema.safeParse({ severity: 'emergency' }).success).toBe(false);
  });

  it('acknowledged 필터를 허용한다', () => {
    expect(alertsQuerySchema.safeParse({ acknowledged: 'true' }).success).toBe(true);
    expect(alertsQuerySchema.safeParse({ acknowledged: 'false' }).success).toBe(true);
  });

  it('잘못된 acknowledged 값을 거부한다', () => {
    expect(alertsQuerySchema.safeParse({ acknowledged: 'yes' }).success).toBe(false);
  });
});
