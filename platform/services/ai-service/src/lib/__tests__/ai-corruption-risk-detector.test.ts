import { describe, it, expect, beforeEach } from 'vitest';
import { AICorruptionRiskDetector } from '../ai-corruption-risk-detector';

describe('AICorruptionRiskDetector', () => {
  let det: AICorruptionRiskDetector;

  beforeEach(() => {
    det = new AICorruptionRiskDetector();
  });

  it('거래를 기록한다', () => {
    det.recordTransaction({
      id: 't1', officerId: 'o1', type: 'contract', amountKRW: 10_000_000,
      vendorId: 'v1', submittedAt: '2026-04-14T09:00:00Z', approverCount: 3, bidCompetitorCount: 5,
    });
    expect(det.getAuditLog().some(l => l.action === 'RECORD_TX')).toBe(true);
  });

  it('단일 입찰 + 고액 + 결재자 1인은 고위험', () => {
    det.recordTransaction({
      id: 't1', officerId: 'o1', type: 'contract', amountKRW: 200_000_000,
      vendorId: 'v1', submittedAt: '2026-04-14T09:00:00Z', approverCount: 1, bidCompetitorCount: 1,
    });
    const r = det.assess('t1');
    expect(r.level).toBe('high_risk');
    expect(r.triggeredIndicators).toContain('SINGLE_BID');
  });

  it('정상 거래는 clear', () => {
    det.recordTransaction({
      id: 't1', officerId: 'o1', type: 'grant', amountKRW: 5_000_000,
      vendorId: 'v1', submittedAt: '2026-04-14T09:00:00Z', approverCount: 3, bidCompetitorCount: 5,
    });
    const r = det.assess('t1');
    expect(r.level).toBe('clear');
  });

  it('동일 업체 반복 시 플래그', () => {
    for (let i = 0; i < 4; i++) {
      det.recordTransaction({
        id: `t${i}`, officerId: 'o1', type: 'procurement', amountKRW: 10_000_000,
        vendorId: 'vREP', submittedAt: '2026-04-14T09:00:00Z', approverCount: 2, bidCompetitorCount: 3,
      });
    }
    expect(det.getVendorTransactionCount('vREP')).toBe(4);
    const r = det.assess('t3');
    expect(r.triggeredIndicators).toContain('REPEATED_VENDOR');
  });

  it('고위험 목록을 조회한다', () => {
    det.recordTransaction({
      id: 't1', officerId: 'o1', type: 'contract', amountKRW: 300_000_000,
      vendorId: 'v1', submittedAt: '2026-04-14T09:00:00Z', approverCount: 1, bidCompetitorCount: 1,
    });
    const list = det.listHighRisk();
    expect(list.length).toBeGreaterThan(0);
  });

  it('S등급을 차단한다', () => {
    expect(() => det.recordTransaction({
      id: 't1', officerId: 'o1', type: 'contract', amountKRW: 1_000_000,
      vendorId: 'v1', submittedAt: '2026-04-14T09:00:00Z', approverCount: 2, bidCompetitorCount: 2,
    }, 'S' as unknown as never)).toThrow(/BLOCKED/);
  });
});
