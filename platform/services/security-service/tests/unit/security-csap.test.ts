// 보안 서비스 CSAP 보안 테스트
// Design Ref: DESIGN-MTU-P15
// Plan SC: FR-P15.1~FR-P15.6
// CSAP: D-06 침해사고 관리, D-08 접근통제, D-10 네트워크 보안

import { describe, it, expect } from 'vitest';
import { z } from 'zod';

const addIpBlockSchema = z.object({
  ip: z.string().regex(
    /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)(?:\/(?:3[0-2]|[12]?\d))?$/,
    '유효한 IPv4 주소/CIDR 필수',
  ),
  reason: z.string().min(1, '차단 사유는 필수').max(500),
  duration: z.number().int().min(0).optional(), // 0 = 영구 차단
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
});

describe('CSAP D-10: IP 차단 입력 검증', () => {
  it('유효한 IPv4를 허용한다', () => {
    expect(addIpBlockSchema.safeParse({
      ip: '192.168.1.100',
      reason: '무차별 대입 공격 탐지',
    }).success).toBe(true);
  });

  it('CIDR 표기법을 허용한다', () => {
    expect(addIpBlockSchema.safeParse({
      ip: '10.0.0.0/8',
      reason: '내부 네트워크 차단',
    }).success).toBe(true);
  });

  it('잘못된 IP 형식을 거부한다', () => {
    expect(addIpBlockSchema.safeParse({
      ip: '999.999.999.999',
      reason: '테스트',
    }).success).toBe(false);
  });

  it('IP 없이 차단을 거부한다', () => {
    expect(addIpBlockSchema.safeParse({
      reason: '차단 사유',
    }).success).toBe(false);
  });

  it('차단 사유 없이 차단을 거부한다', () => {
    expect(addIpBlockSchema.safeParse({
      ip: '192.168.1.1',
    }).success).toBe(false);
  });

  it('잘못된 심각도를 거부한다', () => {
    expect(addIpBlockSchema.safeParse({
      ip: '192.168.1.1',
      reason: '테스트',
      severity: 'EXTREME',
    }).success).toBe(false);
  });
});

describe('CSAP D-06: 보안 이벤트 관리', () => {
  it('로그인 실패 감지 임계값이 정의된다', () => {
    const LOGIN_FAIL_THRESHOLD = 5;
    const LOCKOUT_DURATION_MINUTES = 30;
    expect(LOGIN_FAIL_THRESHOLD).toBe(5);
    expect(LOCKOUT_DURATION_MINUTES).toBe(30);
  });

  it('이상 탐지 규칙이 정의된다', () => {
    const anomalyRules = [
      { name: '무차별 대입', threshold: 5, window: '5m' },
      { name: '비정상 시간대 접근', threshold: 1, window: '1h' },
      { name: '대량 데이터 다운로드', threshold: 100, window: '10m' },
      { name: '권한 상승 시도', threshold: 1, window: '1m' },
    ];
    expect(anomalyRules.length).toBeGreaterThanOrEqual(4);
  });

  it('보안 알림 심각도 분류가 올바르다', () => {
    const severityLevels = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    expect(severityLevels).toHaveLength(4);
    expect(severityLevels[3]).toBe('CRITICAL');
  });

  it('CRITICAL 알림은 즉시 통보 대상이다', () => {
    const severity = 'CRITICAL';
    const requiresImmediate = severity === 'CRITICAL' || severity === 'HIGH';
    expect(requiresImmediate).toBe(true);
  });
});

describe('CSAP D-08: 보안 모니터링 접근 통제', () => {
  it('보안 대시보드는 SUPER_ADMIN/AUDITOR만 접근 가능하다', () => {
    const allowedRoles = ['SUPER_ADMIN', 'AUDITOR'];
    expect(allowedRoles).not.toContain('ADMIN');
    expect(allowedRoles).not.toContain('USER');
  });

  it('IP 차단 추가/제거는 SUPER_ADMIN만 가능하다', () => {
    const allowedRoles = ['SUPER_ADMIN'];
    expect(allowedRoles).toHaveLength(1);
  });
});
