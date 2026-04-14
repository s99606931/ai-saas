import { describe, it, expect, beforeEach } from 'vitest';
import { PublicTenderEvaluatorAIV2 } from '../public-tender-evaluator-ai-v2';

describe('PublicTenderEvaluatorAIV2', () => {
  let ev: PublicTenderEvaluatorAIV2;

  beforeEach(() => {
    ev = new PublicTenderEvaluatorAIV2();
    ev.addCriterion({ criterionId: 'price', weight: 0.5 });
    ev.addCriterion({ criterionId: 'quality', weight: 0.5 });
  });

  it('FR-R701.3: PASS when total >= 80', () => {
    const v = ev.submitBid({ bidId: 'b1', bizRegNo: '123-45-67890', scores: { price: 90, quality: 90 } });
    expect(v.grade).toBe('PASS');
    expect(v.totalScore).toBe(90);
    expect(v.maskedBizRegNo).toHaveLength(16);
    expect(v.maskedBizRegNo).not.toContain('123-45');
  });

  it('FR-R701.3: BORDER/FAIL classification', () => {
    const b1 = ev.submitBid({ bidId: 'b1', bizRegNo: 'x', scores: { price: 70, quality: 60 } });
    expect(b1.grade).toBe('BORDER');
    const b2 = ev.submitBid({ bidId: 'b2', bizRegNo: 'y', scores: { price: 40, quality: 50 } });
    expect(b2.grade).toBe('FAIL');
  });

  it('FR-R701.2: blocks C/S grade (N2SF N-05)', () => {
    expect(() =>
      ev.submitBid({ bidId: 'b', bizRegNo: 'x', scores: { price: 80, quality: 80 } }, 'C'),
    ).toThrow('BLOCKED');
    expect(() =>
      ev.submitBid({ bidId: 'b', bizRegNo: 'x', scores: { price: 80, quality: 80 } }, 'S'),
    ).toThrow('BLOCKED');
  });

  it('FR-R701.1: rejects weight overflow and invalid weight', () => {
    expect(() => ev.addCriterion({ criterionId: 'extra', weight: 0.3 })).toThrow('WEIGHT_OVERFLOW');
    const fresh = new PublicTenderEvaluatorAIV2();
    expect(() => fresh.addCriterion({ criterionId: 'x', weight: 0 })).toThrow('INVALID_WEIGHT');
  });

  it('FR-R701.2: rejects missing score and out-of-range score', () => {
    expect(() =>
      ev.submitBid({ bidId: 'b', bizRegNo: 'x', scores: { price: 50 } }),
    ).toThrow('MISSING_SCORE');
    expect(() =>
      ev.submitBid({ bidId: 'b', bizRegNo: 'x', scores: { price: 150, quality: 50 } }),
    ).toThrow('INVALID_SCORE');
  });

  it('FR-R701.4: rank returns topN sorted by totalScore desc', () => {
    ev.submitBid({ bidId: 'b1', bizRegNo: 'x', scores: { price: 60, quality: 60 } });
    ev.submitBid({ bidId: 'b2', bizRegNo: 'y', scores: { price: 90, quality: 90 } });
    ev.submitBid({ bidId: 'b3', bizRegNo: 'z', scores: { price: 70, quality: 80 } });
    const top2 = ev.rank(2);
    expect(top2.map((r) => r.bidId)).toEqual(['b2', 'b3']);
  });

  it('FR-R701.5: audit log contains masked bizRegNo and append-only', () => {
    ev.submitBid({ bidId: 'b1', bizRegNo: '123-45-67890', scores: { price: 90, quality: 90 } });
    const logs = ev.getAuditLog();
    for (const e of logs) {
      expect(JSON.stringify(e.details ?? {})).not.toContain('123-45');
    }
    const snap = ev.getAuditLog();
    snap.length = 0;
    expect(ev.getAuditLog().length).toBeGreaterThan(0);
  });
});
