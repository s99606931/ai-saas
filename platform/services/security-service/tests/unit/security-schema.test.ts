// 보안 서비스 Zod 스키마 테스트
// Design Ref: DESIGN-MTU-P15
// Plan SC: FR-P15.1~FR-P15.4
// CSAP: D-06, D-10, D-12

import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// 핸들러에서 사용하는 실제 스키마 복제 (모듈 격리 테스트)
const ipBlockSchema = z.object({
  ip: z.string().min(1, 'IP 주소는 필수입니다'),
  reason: z.string().min(1, '차단 사유는 필수입니다'),
  durationMinutes: z.number().int().positive().optional(),
});

const loginFailuresQuerySchema = z.object({
  minutes: z.coerce.number().int().min(1).max(1440).default(5),
  threshold: z.coerce.number().int().min(1).max(100).default(5),
});

const anomaliesQuerySchema = z.object({
  hours: z.coerce.number().int().min(1).max(168).default(1),
});

const alertsQuerySchema = z.object({
  severity: z.enum(['critical', 'high', 'medium', 'low']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

describe('ipBlockSchema (CSAP D-12 입력 검증, D-10 네트워크 보안)', () => {
  it('유효한 IPv4 차단 요청을 허용한다', () => {
    const result = ipBlockSchema.safeParse({
      ip: '192.168.1.100',
      reason: '무차별 대입 공격 탐지',
    });
    expect(result.success).toBe(true);
  });

  it('유효한 IPv6 차단 요청을 허용한다', () => {
    const result = ipBlockSchema.safeParse({
      ip: '2001:0db8:85a3::8a2e:0370:7334',
      reason: '의심스러운 활동',
    });
    expect(result.success).toBe(true);
  });

  it('빈 IP를 거부한다', () => {
    expect(
      ipBlockSchema.safeParse({
        ip: '',
        reason: '테스트',
      }).success,
    ).toBe(false);
  });

  it('빈 사유를 거부한다', () => {
    expect(
      ipBlockSchema.safeParse({
        ip: '1.2.3.4',
        reason: '',
      }).success,
    ).toBe(false);
  });

  it('차단 기간을 선택적으로 허용한다 (분 단위)', () => {
    const result = ipBlockSchema.safeParse({
      ip: '1.2.3.4',
      reason: '테스트',
      durationMinutes: 60,
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.durationMinutes).toBe(60);
  });

  it('기간 없으면 영구 차단 (undefined)', () => {
    const result = ipBlockSchema.safeParse({
      ip: '1.2.3.4',
      reason: '테스트',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.durationMinutes).toBeUndefined();
  });

  it('음수 기간을 거부한다', () => {
    expect(
      ipBlockSchema.safeParse({
        ip: '1.2.3.4',
        reason: '테스트',
        durationMinutes: -30,
      }).success,
    ).toBe(false);
  });

  it('0분 기간을 거부한다', () => {
    expect(
      ipBlockSchema.safeParse({
        ip: '1.2.3.4',
        reason: '테스트',
        durationMinutes: 0,
      }).success,
    ).toBe(false);
  });
});

describe('loginFailuresQuerySchema (FR-P15.1 로그인 실패 탐지)', () => {
  it('기본값이 적용된다 (minutes=5, threshold=5)', () => {
    const result = loginFailuresQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.minutes).toBe(5);
      expect(result.data.threshold).toBe(5);
    }
  });

  it('문자열 숫자를 coerce로 변환한다', () => {
    const result = loginFailuresQuerySchema.safeParse({
      minutes: '30',
      threshold: '10',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.minutes).toBe(30);
      expect(result.data.threshold).toBe(10);
    }
  });

  it('minutes 범위를 1~1440(24시간)으로 제한한다', () => {
    expect(loginFailuresQuerySchema.safeParse({ minutes: '0' }).success).toBe(false);
    expect(loginFailuresQuerySchema.safeParse({ minutes: '1441' }).success).toBe(false);
    expect(loginFailuresQuerySchema.safeParse({ minutes: '720' }).success).toBe(true);
  });

  it('threshold 범위를 1~100으로 제한한다', () => {
    expect(loginFailuresQuerySchema.safeParse({ threshold: '0' }).success).toBe(false);
    expect(loginFailuresQuerySchema.safeParse({ threshold: '101' }).success).toBe(false);
  });
});

describe('anomaliesQuerySchema (FR-P15.2 이상 패턴 탐지)', () => {
  it('기본값 1시간이 적용된다', () => {
    const result = anomaliesQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.hours).toBe(1);
  });

  it('최대 168시간(7일)까지 허용한다', () => {
    expect(anomaliesQuerySchema.safeParse({ hours: '168' }).success).toBe(true);
    expect(anomaliesQuerySchema.safeParse({ hours: '169' }).success).toBe(false);
  });

  it('0시간을 거부한다', () => {
    expect(anomaliesQuerySchema.safeParse({ hours: '0' }).success).toBe(false);
  });
});

describe('alertsQuerySchema (FR-P15.4 보안 알림)', () => {
  it('기본값 limit=20이 적용된다', () => {
    const result = alertsQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.limit).toBe(20);
  });

  it('유효한 severity 값을 허용한다', () => {
    for (const sev of ['critical', 'high', 'medium', 'low']) {
      expect(alertsQuerySchema.safeParse({ severity: sev }).success).toBe(true);
    }
  });

  it('잘못된 severity를 거부한다', () => {
    expect(alertsQuerySchema.safeParse({ severity: 'emergency' }).success).toBe(false);
  });

  it('limit 범위를 1~100으로 제한한다', () => {
    expect(alertsQuerySchema.safeParse({ limit: '0' }).success).toBe(false);
    expect(alertsQuerySchema.safeParse({ limit: '101' }).success).toBe(false);
    expect(alertsQuerySchema.safeParse({ limit: '50' }).success).toBe(true);
  });
});
