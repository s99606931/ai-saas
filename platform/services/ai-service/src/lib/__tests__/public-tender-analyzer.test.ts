import { describe, it, expect } from 'vitest';
import { PublicTenderAnalyzer, type TenderRecord } from '../public-tender-analyzer.js';

describe('SVC-AI-ADV-R360 PublicTenderAnalyzer', () => {
  const svc = new PublicTenderAnalyzer();

  it('FR-360.1: 평균/분산 계산', () => {
    const tenders: TenderRecord[] = [
      { id: 't1', winner: 'A', bidAmount: 100 },
      { id: 't2', winner: 'B', bidAmount: 200 },
      { id: 't3', winner: 'C', bidAmount: 300 },
    ];
    const r = svc.analyze(tenders);
    expect(r.count).toBe(3);
    expect(r.avgBid).toBeCloseTo(200, 1);
    expect(r.variance).toBeGreaterThan(0);
  });

  it('FR-360.2: 담합 의심 (반복 낙찰자 + 낮은 분산)', () => {
    const tenders: TenderRecord[] = [
      { id: 't1', winner: 'A', bidAmount: 100 },
      { id: 't2', winner: 'A', bidAmount: 101 },
      { id: 't3', winner: 'A', bidAmount: 99 },
      { id: 't4', winner: 'A', bidAmount: 100 },
    ];
    const r = svc.analyze(tenders);
    expect(r.collusionScore).toBeGreaterThan(0.5);
    expect(r.suspect).toBe(true);
  });

  it('FR-360.3: S등급 차단', () => {
    expect(() =>
      svc.analyze([{ id: 't1', winner: 'A', bidAmount: 100 }], 'S'),
    ).toThrow('N2SF_BLOCKED');
  });

  it('FR-360.4: 감사 로그', () => {
    svc.analyze([{ id: 't1', winner: 'A', bidAmount: 100 }]);
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });

  it('빈 배열 예외', () => {
    expect(() => svc.analyze([])).toThrow('INVALID_PARAMS');
  });
});
