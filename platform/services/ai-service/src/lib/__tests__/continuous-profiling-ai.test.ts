import { describe, it, expect } from 'vitest';
import { ContinuousProfilingAi, type StackSample } from '../continuous-profiling-ai';

describe('ContinuousProfilingAi', () => {
  const svc = new ContinuousProfilingAi();

  const samples: StackSample[] = [
    { timestamp: 1, stack: ['main', 'handler', 'db.query'], weight: 10 },
    { timestamp: 2, stack: ['main', 'handler', 'db.query'], weight: 15 },
    { timestamp: 3, stack: ['main', 'handler', 'cache.get'], weight: 5 },
    { timestamp: 4, stack: ['main', 'mutex.lock'], weight: 30 },
  ];

  it('aggregates stack samples', () => {
    const agg = svc.aggregate(samples);
    expect(agg.get('db.query')).toBe(25);
    expect(agg.get('mutex.lock')).toBe(30);
  });

  it('returns top hot functions', () => {
    const hot = svc.topHotFunctions(samples, 3);
    expect(hot.length).toBe(3);
    expect(hot[0]?.name).toBe('main');
  });

  it('diffs profiles between versions', () => {
    const baseline: StackSample[] = [{ timestamp: 1, stack: ['fn.a'], weight: 10 }];
    const current: StackSample[] = [{ timestamp: 1, stack: ['fn.a'], weight: 30 }];
    const diffs = svc.diff(baseline, current);
    const fnA = diffs.find((d) => d.function === 'fn.a');
    expect(fnA?.regression).toBe(true);
    expect(fnA?.deltaPercent).toBe(200);
  });

  it('classifies lock contention', () => {
    const hot = svc.topHotFunctions(samples, 3);
    const kind = svc.classifyAnomaly(hot);
    expect(['lock-contention', 'cpu-spike']).toContain(kind);
  });

  it('recommends for gc storm', () => {
    const gcSamples: StackSample[] = [{ timestamp: 1, stack: ['gc.mark', 'gc.sweep'], weight: 100 }];
    const hot = svc.topHotFunctions(gcSamples, 3);
    const rec = svc.recommend(hot);
    expect(rec[0]?.kind).toBe('gc-storm');
    expect(rec[0]?.priority).toBe('high');
  });
});
