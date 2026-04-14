import { describe, it, expect, beforeEach } from 'vitest';
import { PublicProcurementFraudDetectorV3 } from '../public-procurement-fraud-detector-v3';

describe('PublicProcurementFraudDetectorV3', () => {
  let detector: PublicProcurementFraudDetectorV3;

  beforeEach(() => {
    detector = new PublicProcurementFraudDetectorV3();
  });

  const baseBids = [
    { bidder: 'Co1', amount: 100, ip: '1.1.1.1', wins: 1 },
    { bidder: 'Co2', amount: 102, ip: '1.1.1.2', wins: 2 },
    { bidder: 'Co3', amount: 98, ip: '1.1.1.3', wins: 1 },
  ];

  it('returns empty for empty bids', () => {
    expect(detector.analyze([])).toEqual([]);
  });

  it('flags HIGH for suspicious bidder (price + ip + wins)', () => {
    const r = detector.analyze([
      ...baseBids,
      { bidder: 'Bad', amount: 500, ip: '1.1.1.1', wins: 9 },
    ]);
    const bad = r[r.length - 1]!;
    expect(bad.risk).toBe('HIGH');
    expect(bad.suspicionScore).toBeGreaterThanOrEqual(0.7);
  });

  it('masks bidder identifier', () => {
    const r = detector.analyze(baseBids);
    expect(r[0]!.maskedBidder).toMatch(/^[0-9a-f]{16}$/);
    expect(r[0]!.maskedBidder).not.toContain('Co1');
  });

  it('blocks C/S grade (N2SF N-05)', () => {
    expect(() => detector.analyze(baseBids, 'C')).toThrow('BLOCKED');
    expect(() => detector.analyze(baseBids, 'S')).toThrow('BLOCKED');
  });

  it('returns LOW for normal competitive bids', () => {
    const r = detector.analyze(baseBids);
    expect(r.every((x) => x.risk === 'LOW')).toBe(true);
  });

  it('records audit log', () => {
    detector.analyze(baseBids);
    expect(detector.getAuditLog().some((e) => e.action === 'ANALYZE_BIDS')).toBe(true);
  });
});
