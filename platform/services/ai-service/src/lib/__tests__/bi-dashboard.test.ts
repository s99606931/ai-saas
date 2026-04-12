import { describe, it, expect, beforeEach } from 'vitest';
import { BiDashboard } from '../bi-dashboard';

describe('BiDashboard', () => {
  let svc: BiDashboard;

  beforeEach(() => {
    svc = new BiDashboard();
    svc.registerKpi({
      id: 'k1',
      name: '일일 민원 수',
      unit: '건',
      aggregation: 'count',
      source: 'complaints',
      threshold: { warning: 100, critical: 200 },
    });
    svc.registerKpi({ id: 'k2', name: '평균 처리 시간', unit: '분', aggregation: 'avg', source: 'tickets' });
  });

  it('FR-BI.1 KPI 등록', () => {
    expect(() => svc.ingest({ kpiId: 'k1', value: 1, timestamp: '' })).not.toThrow();
  });

  it('FR-BI.2 데이터 인제스트 (미등록 거부)', () => {
    expect(() => svc.ingest({ kpiId: 'unknown', value: 1, timestamp: '' })).toThrow();
  });

  it('FR-BI.3 집계 (count/avg)', () => {
    svc.ingest({ kpiId: 'k1', value: 1, timestamp: '' });
    svc.ingest({ kpiId: 'k1', value: 1, timestamp: '' });
    expect(svc.aggregate('k1')).toBe(2);
    svc.ingest({ kpiId: 'k2', value: 10, timestamp: '' });
    svc.ingest({ kpiId: 'k2', value: 20, timestamp: '' });
    expect(svc.aggregate('k2')).toBe(15);
  });

  it('FR-BI.4 레이아웃', () => {
    const layout = svc.generateLayout('운영 현황', ['k1', 'k2']);
    expect(layout.rows.length).toBe(2);
  });

  it('FR-BI.5 알림 (critical)', () => {
    for (let i = 0; i < 250; i++) svc.ingest({ kpiId: 'k1', value: 1, timestamp: '' });
    const alerts = svc.checkAlerts();
    expect(alerts.find((a) => a.level === 'critical')).toBeDefined();
  });
});
