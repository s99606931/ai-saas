import { describe, it, expect } from 'vitest';
import { AIEnergyEfficiency, type ModelEnergyProfile } from '../ai-energy-efficiency';

describe('AIEnergyEfficiency', () => {
  const svc = new AIEnergyEfficiency();
  const profiles: ModelEnergyProfile[] = [
    { modelId: 'opus-4', tokensPerKwh: 10_000, inferenceLatencyMs: 800, qualityScore: 0.95 },
    { modelId: 'sonnet-4', tokensPerKwh: 50_000, inferenceLatencyMs: 400, qualityScore: 0.9 },
    { modelId: 'haiku-4', tokensPerKwh: 200_000, inferenceLatencyMs: 100, qualityScore: 0.8 },
  ];

  it('calculates carbon footprint', () => {
    const log = { modelId: 'opus-4', tokens: 1_000_000, requests: 100, period: '2026-04' };
    const report = svc.calculateCarbon(log, profiles[0]!);
    expect(report.kwh).toBeGreaterThan(0);
    expect(report.gramsCO2).toBeGreaterThan(0);
  });

  it('compares efficiency ranking', () => {
    const ranked = svc.compareEfficiency(profiles);
    expect(ranked[0]!.modelId).toBe('haiku-4');
    expect(ranked[0]!.rank).toBe(1);
  });

  it('recommends high quality model under constraints', () => {
    const rec = svc.recommend(profiles, { minQuality: 0.92, maxLatencyMs: 1000 });
    expect(rec?.modelId).toBe('opus-4');
  });

  it('returns null when no model fits constraints', () => {
    const rec = svc.recommend(profiles, { minQuality: 0.99 });
    expect(rec).toBeNull();
  });

  it('measures progress to reduction goal', () => {
    const baseline = { modelId: 'b', tokens: 0, kwh: 0, gramsCO2: 1000, treeEquivalent: 0 };
    const current = { modelId: 'c', tokens: 0, kwh: 0, gramsCO2: 700, treeEquivalent: 0 };
    const progress = svc.progressToGoal(baseline, current, 20);
    expect(progress.reducedPct).toBe(30);
    expect(progress.achieved).toBe(true);
  });
});
