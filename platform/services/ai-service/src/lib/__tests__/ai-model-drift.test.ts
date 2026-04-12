import { describe, it, expect } from 'vitest';
import { AIModelDrift } from '../ai-model-drift';

describe('AIModelDrift', () => {
  const svc = new AIModelDrift();

  it('builds distribution', () => {
    const dist = svc.buildDistribution('age', [10, 20, 30, 40, 50, 60, 70, 80], 4);
    expect(dist.counts.reduce((s, v) => s + v, 0)).toBe(8);
  });

  it('calculates low PSI for similar distributions', () => {
    const base = svc.buildDistribution('f', [1, 2, 3, 4, 5, 6, 7, 8], 4);
    const curr = svc.buildDistribution('f', [1, 2, 3, 4, 5, 6, 7, 8], 4);
    const result = svc.calculatePSI(base, curr);
    expect(result.severity).toBe('none');
  });

  it('calculates high PSI for shifted distributions', () => {
    const base = svc.buildDistribution('f', [1, 1, 1, 2, 2, 2, 3, 3], 4);
    const curr = svc.buildDistribution('f', [7, 8, 8, 9, 9, 9, 10, 10], 4);
    const result = svc.calculatePSI(base, curr);
    expect(result.psi).toBeGreaterThan(0);
  });

  it('detects concept drift', () => {
    const result = svc.detectConceptDrift(
      'class',
      { A: 80, B: 20 },
      { A: 30, B: 70 },
    );
    expect(result.shifted).toBe(true);
  });

  it('detects performance degradation', () => {
    const windows = [
      { windowId: 'W1', accuracy: 0.9, f1: 0.88, timestamp: '' },
      { windowId: 'W2', accuracy: 0.89, f1: 0.87, timestamp: '' },
      { windowId: 'W3', accuracy: 0.75, f1: 0.72, timestamp: '' },
      { windowId: 'W4', accuracy: 0.72, f1: 0.7, timestamp: '' },
    ];
    const result = svc.detectPerformanceDegradation(windows);
    expect(result.degraded).toBe(true);
    expect(result.drop).toBeGreaterThan(0.05);
  });

  it('triggers retrain on multiple issues', () => {
    const decision = svc.shouldRetrain(
      [{ featureName: 'f1', psi: 0.5, severity: 'major' }],
      [{ labelName: 'class', klDivergence: 0.3, shifted: true }],
      true,
    );
    expect(decision.retrain).toBe(true);
    expect(decision.reasons.length).toBeGreaterThanOrEqual(3);
  });
});
