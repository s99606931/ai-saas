import { describe, it, expect, beforeEach } from 'vitest';
import { RealtimeAuditReporter, type AuditEvent } from '../realtime-audit-reporter';

describe('RealtimeAuditReporter', () => {
  let reporter: RealtimeAuditReporter;
  const now = new Date().toISOString();

  const makeEvent = (overrides: Partial<AuditEvent> & { id: string }): AuditEvent => ({
    category: 'ACCESS',
    actor: 'user-1',
    tenantId: 'tenant-1',
    action: 'READ',
    resource: '/api/data',
    outcome: 'SUCCESS',
    timestamp: now,
    ...overrides,
  });

  beforeEach(() => {
    reporter = new RealtimeAuditReporter();
  });

  const from = '2024-01-01T00:00:00Z';
  const to = '2030-12-31T23:59:59Z';

  // FR-R178.1 이벤트 기록 (append-only)
  it('FR-R178.1 이벤트 기록 및 총 카운트', () => {
    reporter.record(makeEvent({ id: 'e1' }));
    reporter.record(makeEvent({ id: 'e2' }));
    expect(reporter.totalEventCount()).toBe(2);
  });

  // FR-R178.2 기간별 조회
  it('FR-R178.2 테넌트별 기간 조회', () => {
    reporter.record(makeEvent({ id: 'e1', tenantId: 'T1' }));
    reporter.record(makeEvent({ id: 'e2', tenantId: 'T2' }));
    const events = reporter.query('T1', from, to);
    expect(events).toHaveLength(1);
    expect(events[0]!.tenantId).toBe('T1');
  });

  it('FR-R178.2 기간 외 이벤트 제외', () => {
    reporter.record(makeEvent({ id: 'e1', timestamp: '2020-01-01T00:00:00Z' }));
    const events = reporter.query('tenant-1', '2024-01-01T00:00:00Z', to);
    expect(events).toHaveLength(0);
  });

  // FR-R178.3 요약 생성
  it('FR-R178.3 카테고리별 카운트', () => {
    reporter.record(makeEvent({ id: 'e1', category: 'AUTH' }));
    reporter.record(makeEvent({ id: 'e2', category: 'ACCESS' }));
    reporter.record(makeEvent({ id: 'e3', category: 'AUTH' }));
    const summary = reporter.summarize('tenant-1', from, to);
    expect(summary.byCategory.AUTH).toBe(2);
    expect(summary.byCategory.ACCESS).toBe(1);
    expect(summary.totalEvents).toBe(3);
  });

  it('FR-R178.3 결과별 카운트', () => {
    reporter.record(makeEvent({ id: 'e1', outcome: 'SUCCESS' }));
    reporter.record(makeEvent({ id: 'e2', outcome: 'FAILURE' }));
    reporter.record(makeEvent({ id: 'e3', outcome: 'BLOCKED' }));
    const summary = reporter.summarize('tenant-1', from, to);
    expect(summary.byOutcome.SUCCESS).toBe(1);
    expect(summary.byOutcome.FAILURE).toBe(1);
    expect(summary.byOutcome.BLOCKED).toBe(1);
  });

  it('FR-R178.3 이상 탐지 — 차단 비율 높음', () => {
    // 11건 중 2건 BLOCKED > 10%
    for (let i = 0; i < 11; i++) {
      reporter.record(makeEvent({ id: `e${i}`, outcome: i < 2 ? 'BLOCKED' : 'SUCCESS' }));
    }
    const summary = reporter.summarize('tenant-1', from, to);
    expect(summary.anomalies.some((a) => a.includes('차단'))).toBe(true);
  });

  // FR-R178.4 CSAP 준수 검사
  it('FR-R178.4 감사 로그 보존 준수', () => {
    reporter.record(makeEvent({ id: 'e1' }));
    const checks = reporter.checkCompliance('tenant-1', from, to);
    const d06 = checks.find((c) => c.rule.includes('D-06'));
    expect(d06?.passed).toBe(true);
  });

  it('FR-R178.4 인증 실패 5회 미만 준수', () => {
    for (let i = 0; i < 3; i++) {
      reporter.record(makeEvent({ id: `e${i}`, category: 'AUTH', outcome: 'FAILURE' }));
    }
    const checks = reporter.checkCompliance('tenant-1', from, to);
    const d08 = checks.find((c) => c.rule.includes('D-08'));
    expect(d08?.passed).toBe(true);
  });

  it('FR-R178.4 인증 실패 5회 이상 미준수', () => {
    for (let i = 0; i < 6; i++) {
      reporter.record(makeEvent({ id: `e${i}`, category: 'AUTH', outcome: 'FAILURE' }));
    }
    const checks = reporter.checkCompliance('tenant-1', from, to);
    const d08 = checks.find((c) => c.rule.includes('D-08'));
    expect(d08?.passed).toBe(false);
  });

  // FR-R178.5 전체 감사 보고서
  it('FR-R178.5 보고서 생성 구조 확인', () => {
    reporter.record(makeEvent({ id: 'e1' }));
    const report = reporter.generateReport('tenant-1', from, to);
    expect(report.reportId).toMatch(/RPT-\d+/);
    expect(report).toHaveProperty('summary');
    expect(report).toHaveProperty('complianceChecks');
    expect(report.riskScore).toBeGreaterThanOrEqual(0);
    expect(report.riskScore).toBeLessThanOrEqual(100);
  });

  it('FR-R178.5 고위험 이벤트로 리스크 스코어 상승', () => {
    for (let i = 0; i < 6; i++) {
      reporter.record(makeEvent({ id: `e${i}`, category: 'AUTH', outcome: 'FAILURE' }));
    }
    const report = reporter.generateReport('tenant-1', from, to);
    expect(report.riskScore).toBeGreaterThan(0);
  });
});
