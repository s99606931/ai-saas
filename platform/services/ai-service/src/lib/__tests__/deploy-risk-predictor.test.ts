import { describe, it, expect } from 'vitest';
import { DeployRiskPredictor, type DeployChange } from '../deploy-risk-predictor';

describe('DeployRiskPredictor', () => {
  const svc = new DeployRiskPredictor();

  it('calculates historical fail rate', () => {
    const rate = svc.calcHistoricalFailRate([
      { deployId: 'd1', failed: false },
      { deployId: 'd2', failed: true },
      { deployId: 'd3', failed: false },
      { deployId: 'd4', failed: false },
    ]);
    expect(rate).toBe(0.25);
  });

  it('predicts low risk for small safe deploy', () => {
    const change: DeployChange = {
      deployId: 'D1',
      serviceId: 'svc',
      filesChanged: 3,
      linesChanged: 50,
      criticalPathTouched: false,
      testCoverage: 0.9,
      hasDbMigration: false,
      plannedAt: '2026-04-13T14:00:00Z',
    };
    const pred = svc.predict(change, [{ deployId: 'h', failed: false }]);
    expect(pred.riskLevel).toBe('low');
  });

  it('predicts high risk for large risky deploy', () => {
    const change: DeployChange = {
      deployId: 'D2',
      serviceId: 'svc',
      filesChanged: 100,
      linesChanged: 2000,
      criticalPathTouched: true,
      testCoverage: 0.4,
      hasDbMigration: true,
      plannedAt: '2026-04-17T22:00:00Z',
    };
    const pred = svc.predict(change, [
      { deployId: 'h1', failed: true },
      { deployId: 'h2', failed: true },
      { deployId: 'h3', failed: false },
    ]);
    expect(pred.riskLevel).toBe('high');
    expect(pred.mitigations.length).toBeGreaterThan(0);
  });

  it('includes mitigation for DB migration', () => {
    const change: DeployChange = {
      deployId: 'D3',
      serviceId: 'svc',
      filesChanged: 5,
      linesChanged: 100,
      criticalPathTouched: false,
      testCoverage: 0.85,
      hasDbMigration: true,
      plannedAt: '2026-04-14T10:00:00Z',
    };
    const pred = svc.predict(change, []);
    expect(pred.mitigations.some((m) => m.includes('마이그레이션'))).toBe(true);
  });

  it('factors contribute to score', () => {
    const change: DeployChange = {
      deployId: 'D4',
      serviceId: 'svc',
      filesChanged: 60,
      linesChanged: 500,
      criticalPathTouched: false,
      testCoverage: 0.8,
      hasDbMigration: false,
      plannedAt: '2026-04-14T10:00:00Z',
    };
    const pred = svc.predict(change, []);
    expect(pred.factors.length).toBeGreaterThan(0);
    expect(pred.factors.some((f) => f.factor === 'large-file-count')).toBe(true);
  });
});
