import { describe, it, expect } from 'vitest';
import { PlatformMetrics } from '../platform-metrics-space.js';

describe('PlatformMetrics', () => {
  const metrics = new PlatformMetrics();

  it('DORA elite 분류', () => {
    const r = metrics.computeDora({
      deployments: 30,
      leadTimeHours: [2, 4, 6],
      changeFailureCount: 2,
      mttrMinutes: [15, 30, 45],
      days: 30,
    });
    expect(r.level).toBe('elite');
  });

  it('DORA low 분류', () => {
    const r = metrics.computeDora({
      deployments: 1,
      leadTimeHours: [1000],
      changeFailureCount: 1,
      mttrMinutes: [600],
      days: 30,
    });
    expect(r.level).toBe('low');
  });

  it('SPACE 점수 계산', () => {
    const r = metrics.computeSpace({
      satisfactionSurvey: 4,
      prsMerged: 50,
      incidentsResolved: 5,
      codeReviewsGiven: 100,
      focusHours: 400,
      teamSize: 5,
      days: 30,
    });
    expect(r.overall).toBeGreaterThan(0);
    expect(r.overall).toBeLessThanOrEqual(1);
  });

  it('DX 인덱스 통합', () => {
    const dora = metrics.computeDora({
      deployments: 30,
      leadTimeHours: [5],
      changeFailureCount: 2,
      mttrMinutes: [20],
      days: 30,
    });
    const space = metrics.computeSpace({
      satisfactionSurvey: 5,
      prsMerged: 40,
      incidentsResolved: 3,
      codeReviewsGiven: 80,
      focusHours: 300,
      teamSize: 4,
      days: 30,
    });
    const dx = metrics.computeDxIndex(space, dora);
    expect(dx).toBeGreaterThan(0.5);
  });

  it('잘못된 days 거부', () => {
    expect(() =>
      metrics.computeDora({ deployments: 1, leadTimeHours: [], changeFailureCount: 0, mttrMinutes: [], days: 0 }),
    ).toThrow('METRICS_INVALID_DAYS');
  });
});
