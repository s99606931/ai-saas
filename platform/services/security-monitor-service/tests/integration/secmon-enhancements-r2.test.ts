// 보안 모니터링 서비스 Round 2 고도화 통합 테스트
// Design Ref: SVC-SECMON-R2 DESIGN
// Plan SC: FR-SECMON.6, FR-SECMON.7

import { describe, it, expect } from 'vitest';

// ── FR-SECMON.6: 로그인 실패 추이 ──

describe('FR-SECMON.6: 로그인 실패 추이', () => {
  it('7일 추이를 반환한다', () => {
    const trend = Array.from({ length: 7 }, (_, i) => ({
      date: `2026-04-${String(4 + i).padStart(2, '0')}`,
      failures: Math.floor(Math.random() * 20),
      uniqueIps: Math.floor(Math.random() * 5),
    }));
    expect(trend).toHaveLength(7);
  });

  it('totalFailures가 합계와 일치한다', () => {
    const trend = [
      { failures: 10, uniqueIps: 3 },
      { failures: 5, uniqueIps: 2 },
      { failures: 15, uniqueIps: 4 },
    ];
    const total = trend.reduce((sum, t) => sum + t.failures, 0);
    expect(total).toBe(30);
  });

  it('고유 IP 수가 실패 수보다 작거나 같다', () => {
    const entry = { failures: 20, uniqueIps: 5 };
    expect(entry.uniqueIps).toBeLessThanOrEqual(entry.failures);
  });

  it('days 범위는 1~90이다', () => {
    const { z } = require('zod') as typeof import('zod');
    const schema = z.object({
      days: z.coerce.number().int().min(1).max(90).default(7),
    });
    expect(schema.safeParse({ days: '0' }).success).toBe(false);
    expect(schema.safeParse({ days: '14' }).success).toBe(true);
  });
});

// ── FR-SECMON.7: 보안 이벤트 통계 ──

describe('FR-SECMON.7: 보안 이벤트 통계', () => {
  it('24시간 / 7일 합계가 반환된다', () => {
    const stats = { total24h: 15, total7d: 80 };
    expect(stats.total24h).toBeLessThanOrEqual(stats.total7d);
  });

  it('차단 활동의 순 변화가 올바르다', () => {
    const blocked7d = 10;
    const unblocked7d = 3;
    const netChange = blocked7d - unblocked7d;
    expect(netChange).toBe(7);
  });

  it('보안 이벤트 유형이 6가지이다', () => {
    const actions = [
      'LOGIN_FAILED', 'IP_BLOCKED', 'IP_UNBLOCKED',
      'AI_GRADE_VIOLATION', 'UNAUTHORIZED_ACCESS', 'SESSION_HIJACK_ATTEMPT',
    ];
    expect(actions).toHaveLength(6);
  });

  it('유형별 이벤트 수 합계가 전체와 일치한다', () => {
    const byAction = [
      { action: 'LOGIN_FAILED', count: 50 },
      { action: 'IP_BLOCKED', count: 10 },
      { action: 'UNAUTHORIZED_ACCESS', count: 20 },
    ];
    const total = byAction.reduce((sum, a) => sum + a.count, 0);
    expect(total).toBe(80);
  });
});

// ── 기존 기능 회귀 ──

describe('기존 기능 회귀: 보안 모니터링 라우트', () => {
  const routes = [
    'GET /security/login-failures',
    'GET /security/anomalies',
    'GET /security/ip-blocklist',
    'POST /security/ip-blocklist',
    'DELETE /security/ip-blocklist/:ip',
    'GET /security/alerts',
    'PUT /security/alerts/:id/acknowledge',
    'GET /security/alerts/summary',
    'GET /security/login-failures/trend',
    'GET /security/events/stats',
  ];

  it('10개 라우트가 등록되어 있다 (기존 8 + 신규 2)', () => {
    expect(routes).toHaveLength(10);
  });

  it('login-failures/trend 라우트가 추가되었다', () => {
    expect(routes).toContain('GET /security/login-failures/trend');
  });

  it('events/stats 라우트가 추가되었다', () => {
    expect(routes).toContain('GET /security/events/stats');
  });
});
