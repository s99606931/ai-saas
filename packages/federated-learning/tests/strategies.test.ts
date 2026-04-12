/**
 * FL 전략 변형 + 기여도 감사 테스트
 * Plan SC: FR-FLS.1~5, FR-FLA.1~5
 */

import {
  FedAvgStrategy,
  FedProxStrategy,
  ScaffoldStrategy,
  selectStrategy,
  StrategyBenchmark,
} from '../src/strategies/fl-variants';

import {
  FlAuditTrail,
  ContributionScorer,
  AnomalyDetector,
  RewardCalculator,
} from '../src/strategies/contribution-audit';

describe('FedAvgStrategy', () => {
  it('가중 평균 (sample 비례)', () => {
    const s = new FedAvgStrategy();
    const result = s.aggregate(
      [0, 0],
      [
        { weights: [1, 1], sampleCount: 100 },
        { weights: [3, 3], sampleCount: 100 },
      ],
    );
    expect(result).toEqual([2, 2]);
  });

  it('총 샘플 수 0 → 빈 배열', () => {
    const s = new FedAvgStrategy();
    expect(s.aggregate([0], [])).toEqual([]);
  });
});

describe('FedProxStrategy', () => {
  it('근접 정규화: μ 적용', () => {
    const s = new FedProxStrategy(0.5);
    const result = s.aggregate(
      [0, 0],
      [{ weights: [10, 10], sampleCount: 1 }],
    );
    // shrunk = w - μ*(w - g) = 10 - 0.5*10 = 5
    expect(result[0]).toBeCloseTo(5);
  });

  it('이름 FedProx', () => {
    expect(new FedProxStrategy().name).toBe('FedProx');
  });
});

describe('ScaffoldStrategy', () => {
  it('SCAFFOLD 집계 결과', () => {
    const s = new ScaffoldStrategy();
    const result = s.aggregate(
      [1, 1],
      [{ weights: [2, 2], sampleCount: 100 }],
    );
    expect(result.length).toBe(2);
  });

  it('빈 업데이트 시 글로벌 그대로', () => {
    const s = new ScaffoldStrategy();
    expect(s.aggregate([1, 2], [])).toEqual([1, 2]);
  });

  it('이름 SCAFFOLD', () => {
    expect(new ScaffoldStrategy().name).toBe('SCAFFOLD');
  });
});

describe('selectStrategy', () => {
  it.each([
    ['FedAvg', 'FedAvg'],
    ['FedProx', 'FedProx'],
    ['SCAFFOLD', 'SCAFFOLD'],
  ] as const)('이름 %s → 인스턴스 %s', (name, expected) => {
    expect(selectStrategy(name).name).toBe(expected);
  });
});

describe('StrategyBenchmark', () => {
  it('record + compare', () => {
    const b = new StrategyBenchmark();
    b.record('FedAvg', { round: 1, loss: 0.5, accuracy: 0.7, convergenceDistance: 0.1 });
    b.record('FedAvg', { round: 2, loss: 0.3, accuracy: 0.8, convergenceDistance: 0.05 });
    const cmp = b.compare();
    expect(cmp[0]?.strategy).toBe('FedAvg');
    expect(cmp[0]?.finalLoss).toBe(0.3);
    expect(cmp[0]?.rounds).toBe(2);
  });
});

describe('FlAuditTrail', () => {
  it('append + byRound', () => {
    const t = new FlAuditTrail();
    t.append({ round: 1, participantId: 'p1', action: 'update-submit' });
    t.append({ round: 2, participantId: 'p2', action: 'round-aggregate' });
    expect(t.byRound(1).length).toBe(1);
    expect(t.all().length).toBe(2);
  });
});

describe('ContributionScorer', () => {
  it('큰 sampleCount + 큰 lossReduction → 높은 점수 + 1위', () => {
    const s = new ContributionScorer();
    const result = s.score([
      { participantId: 'p1', sampleCount: 1000, lossReductions: [0.1, 0.1] },
      { participantId: 'p2', sampleCount: 100, lossReductions: [0.01] },
    ]);
    expect(result[0]?.participantId).toBe('p1');
    expect(result[0]?.rank).toBe(1);
  });

  it('빈 lossReductions 처리', () => {
    const s = new ContributionScorer();
    const result = s.score([
      { participantId: 'p1', sampleCount: 100, lossReductions: [] },
    ]);
    expect(result[0]?.contribution).toBe(0);
  });
});

describe('AnomalyDetector', () => {
  it('3σ 초과 norm 식별', () => {
    const d = new AnomalyDetector();
    const result = d.detect([
      { participantId: 'p1', normL2: 1 },
      { participantId: 'p2', normL2: 1.1 },
      { participantId: 'p3', normL2: 1.2 },
      { participantId: 'p4', normL2: 1.0 },
      { participantId: 'malicious', normL2: 100 },
    ]);
    expect(result).toContain('malicious');
  });

  it('샘플 수 부족 시 빈 배열', () => {
    const d = new AnomalyDetector();
    expect(d.detect([{ participantId: 'p1', normL2: 1 }])).toEqual([]);
  });
});

describe('RewardCalculator', () => {
  it('기여도 비율로 보상 분배', () => {
    const r = new RewardCalculator();
    const result = r.calculate(
      [
        { participantId: 'p1', contribution: 60 },
        { participantId: 'p2', contribution: 40 },
      ],
      1000,
    );
    expect(result[0]?.reward).toBeCloseTo(600);
    expect(result[1]?.reward).toBeCloseTo(400);
  });

  it('총 기여 0 시 균등 분배', () => {
    const r = new RewardCalculator();
    const result = r.calculate(
      [
        { participantId: 'p1', contribution: 0 },
        { participantId: 'p2', contribution: 0 },
      ],
      100,
    );
    expect(result[0]?.reward).toBe(50);
    expect(result[1]?.reward).toBe(50);
  });
});
