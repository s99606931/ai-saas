import { describe, it, expect } from 'vitest';
import { FedAvgVariants, type ClientUpdate } from '../fedavg-variants';

describe('FedAvgVariants', () => {
  const svc = new FedAvgVariants();
  const global = [1, 1, 1];
  const updates: ClientUpdate[] = [
    { clientId: 'c1', weights: [2, 2, 2], sampleCount: 100, controlVariate: [0.1, 0.1, 0.1] },
    { clientId: 'c2', weights: [0, 0, 0], sampleCount: 100, controlVariate: [-0.1, -0.1, -0.1] },
  ];

  it('FR-FLS.1 FedProx (μ=0.5)', () => {
    const r = svc.fedProx(global, updates, 0.5);
    expect(r.length).toBe(3);
    // avg=[1,1,1], prox=(0.5*1 + 0.5*1)=1
    expect(r[0]).toBe(1);
  });

  it('FR-FLS.2 SCAFFOLD', () => {
    const r = svc.scaffold(global, updates, [0, 0, 0]);
    expect(r.length).toBe(3);
  });

  it('FR-FLS.3 전략 자동 선택', () => {
    expect(svc.selectStrategy(0.1)).toBe('FedAvg');
    expect(svc.selectStrategy(0.3)).toBe('FedProx');
    expect(svc.selectStrategy(0.7)).toBe('SCAFFOLD');
  });

  it('FR-FLS.4 벤치마크', () => {
    const bench = svc.benchmark(['FedAvg', 'FedProx', 'SCAFFOLD'], 0.5);
    expect(bench.length).toBe(3);
    expect(bench.every((b) => b.finalLoss >= 0)).toBe(true);
  });

  it('FR-FLS.5 라운드 비교', () => {
    const bench = svc.benchmark(['FedAvg', 'FedProx', 'SCAFFOLD'], 0.5);
    const sorted = svc.compareRounds(bench);
    expect(sorted[0]!.finalLoss).toBeLessThanOrEqual(sorted[sorted.length - 1]!.finalLoss);
  });
});
