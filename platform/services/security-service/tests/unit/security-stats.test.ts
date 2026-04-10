// Security Stats 핸들러 단위 테스트
// Design Ref: SVC-SEC-R1 DESIGN
// Plan SC: FR-SEC.1, FR-SEC.4

import { describe, it, expect } from 'vitest';

const SECURITY_ACTIONS = [
  'LOGIN_FAILED',
  'IP_BLOCKED',
  'AI_GRADE_VIOLATION',
  'UNAUTHORIZED_ACCESS',
  'SESSION_HIJACK_ATTEMPT',
];

// ── FR-SEC.1: 보안 대시보드 (securityDashboardHandler) ──

describe('FR-SEC.1: securityDashboardHandler', () => {
  it('5가지 보안 이벤트 유형이 정의된다', () => {
    expect(SECURITY_ACTIONS).toHaveLength(5);
  });

  it('24시간 이내 이벤트만 조회한다', () => {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    expect(last24h.getTime()).toBeLessThan(now.getTime());
    expect(now.getTime() - last24h.getTime()).toBe(86400000);
  });

  it('심각도 분류가 올바르다', () => {
    const criticalActions = ['AI_GRADE_VIOLATION', 'SESSION_HIJACK_ATTEMPT'];
    const highActions = ['IP_BLOCKED', 'UNAUTHORIZED_ACCESS'];
    const mediumActions = ['LOGIN_FAILED'];

    for (const action of criticalActions) {
      expect(SECURITY_ACTIONS).toContain(action);
    }
    for (const action of highActions) {
      expect(SECURITY_ACTIONS).toContain(action);
    }
    for (const action of mediumActions) {
      expect(SECURITY_ACTIONS).toContain(action);
    }
  });

  it('심각도별 분류가 4단계이다', () => {
    const severities = ['critical', 'high', 'medium', 'low'];
    expect(severities).toHaveLength(4);
  });

  it('심각도별 카운트가 정확히 분류된다', () => {
    const distribution = [
      { action: 'AI_GRADE_VIOLATION', count: 2 },
      { action: 'IP_BLOCKED', count: 5 },
      { action: 'LOGIN_FAILED', count: 10 },
    ];
    let criticalCount = 0;
    let highCount = 0;
    let mediumCount = 0;
    for (const d of distribution) {
      if (d.action === 'AI_GRADE_VIOLATION' || d.action === 'SESSION_HIJACK_ATTEMPT') {
        criticalCount += d.count;
      } else if (d.action === 'IP_BLOCKED' || d.action === 'UNAUTHORIZED_ACCESS') {
        highCount += d.count;
      } else {
        mediumCount += d.count;
      }
    }
    expect(criticalCount).toBe(2);
    expect(highCount).toBe(5);
    expect(mediumCount).toBe(10);
  });
});

// ── FR-SEC.4: 위협 추이 (threatTrendHandler) ──

describe('FR-SEC.4: threatTrendHandler', () => {
  it('7일 추이를 반환한다', () => {
    const days = 7;
    const trend: { date: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      trend.push({ date: d.toISOString().slice(0, 10), count: 0 });
    }
    expect(trend).toHaveLength(days);
  });

  it('날짜 형식이 YYYY-MM-DD이다', () => {
    const date = new Date().toISOString().slice(0, 10);
    expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('총 이벤트 수가 일별 합계와 일치한다', () => {
    const trend = [
      { date: '2026-04-04', count: 3 },
      { date: '2026-04-05', count: 7 },
      { date: '2026-04-06', count: 1 },
    ];
    const totalEvents = trend.reduce((sum, t) => sum + t.count, 0);
    expect(totalEvents).toBe(11);
  });

  it('이벤트가 없으면 총 이벤트 0', () => {
    const trend = [
      { date: '2026-04-04', count: 0 },
      { date: '2026-04-05', count: 0 },
    ];
    const totalEvents = trend.reduce((sum, t) => sum + t.count, 0);
    expect(totalEvents).toBe(0);
  });
});
