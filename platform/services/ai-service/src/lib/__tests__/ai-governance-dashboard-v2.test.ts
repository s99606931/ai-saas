import { describe, it, expect, beforeEach } from 'vitest';
import { AIGovernanceDashboardV2 } from '../ai-governance-dashboard-v2';

describe('AIGovernanceDashboardV2', () => {
  let dash: AIGovernanceDashboardV2;

  beforeEach(() => {
    dash = new AIGovernanceDashboardV2();
    dash.registerKpi({ kpiId: 'k1', target: 100, weight: 0.5 });
    dash.registerKpi({ kpiId: 'k2', target: 100, weight: 0.5 });
  });

  it('returns ON_TRACK when attainment is high', () => {
    dash.reportMetric({ kpiId: 'k1', reporterId: '900101-1', actual: 95 });
    const v = dash.reportMetric({ kpiId: 'k2', reporterId: 'r', actual: 95 });
    expect(v.overallScore).toBe(95);
    expect(v.status).toBe('ON_TRACK');
    expect(v.maskedReporterId).toHaveLength(16);
    expect(v.maskedReporterId).not.toContain('900101');
  });

  it('returns MONITOR in mid range', () => {
    dash.reportMetric({ kpiId: 'k1', reporterId: 'r', actual: 85 });
    const v = dash.reportMetric({ kpiId: 'k2', reporterId: 'r', actual: 80 });
    expect(v.status).toBe('MONITOR');
  });

  it('returns AT_RISK when overall low', () => {
    dash.reportMetric({ kpiId: 'k1', reporterId: 'r', actual: 50 });
    const v = dash.reportMetric({ kpiId: 'k2', reporterId: 'r', actual: 60 });
    expect(v.status).toBe('AT_RISK');
  });

  it('caps attainment at 150', () => {
    const v = dash.reportMetric({ kpiId: 'k1', reporterId: 'r', actual: 500 });
    expect(v.overallScore).toBe(150);
  });

  it('blocks C/S grade (N2SF N-05)', () => {
    expect(() =>
      dash.reportMetric({ kpiId: 'k1', reporterId: 'r', actual: 1 }, 'C'),
    ).toThrow('BLOCKED');
    expect(() =>
      dash.reportMetric({ kpiId: 'k1', reporterId: 'r', actual: 1 }, 'S'),
    ).toThrow('BLOCKED');
  });

  it('rejects unknown kpi, invalid weight/target/actual', () => {
    expect(() =>
      dash.reportMetric({ kpiId: 'missing', reporterId: 'r', actual: 1 }),
    ).toThrow('UNKNOWN_KPI');
    expect(() => dash.registerKpi({ kpiId: 'x', target: 10, weight: 2 })).toThrow(
      'INVALID_WEIGHT',
    );
    expect(() => dash.registerKpi({ kpiId: 'y', target: 0, weight: 0.1 })).toThrow(
      'INVALID_TARGET',
    );
    expect(() =>
      dash.reportMetric({ kpiId: 'k1', reporterId: 'r', actual: -5 }),
    ).toThrow('INVALID_ACTUAL');
  });

  it('audit log masks reporter id', () => {
    dash.reportMetric({ kpiId: 'k1', reporterId: '900101-1234567', actual: 90 });
    const log = dash.getAuditLog();
    expect(log.some((e) => e.action === 'REPORT_METRIC')).toBe(true);
    for (const entry of log) {
      expect(JSON.stringify(entry.details ?? {})).not.toContain('900101');
    }
  });
});
