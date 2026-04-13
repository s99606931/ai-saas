import { describe, it, expect, beforeEach } from 'vitest';
import {
  BorderControlRiskAnalyzer,
  type TravelerRequest,
} from '../ai-border-control-risk-analyzer';

const req = (overrides: Partial<TravelerRequest> = {}): TravelerRequest => ({
  requestId: 'r1',
  nationalityCode: 'KR',
  purpose: 'tourism',
  stayDays: 14,
  priorVisits: 0,
  overstayHistory: 0,
  watchListHit: false,
  sponsorVerified: true,
  ...overrides,
});

describe('BorderControlRiskAnalyzer', () => {
  let ai: BorderControlRiskAnalyzer;

  beforeEach(() => {
    ai = new BorderControlRiskAnalyzer();
  });

  it('정상 관광객은 allow 판정', () => {
    const r = ai.assess(req());
    expect(r.level).toBe('allow');
  });

  it('감시대상자는 deny 판정', () => {
    const r = ai.assess(req({ watchListHit: true, overstayHistory: 1 }));
    expect(r.level).toBe('deny');
    expect(r.reasons).toContain('감시대상 명단 일치');
  });

  it('고위험 국적 등록 후 점수 가산', () => {
    ai.registerHighRisk('XX');
    const r = ai.assess(req({ nationalityCode: 'XX' }));
    expect(r.score).toBeGreaterThanOrEqual(20);
  });

  it('수준별 집계', () => {
    ai.assess(req({ requestId: 'a' }));
    ai.assess(req({ requestId: 'b', watchListHit: true, overstayHistory: 2 }));
    const s = ai.summarizeByLevel();
    expect(s.allow + s.review + s.enhanced + s.deny).toBe(2);
    expect(s.allow).toBe(1);
    expect(s.deny).toBe(1);
  });

  it('C등급 데이터는 차단', () => {
    expect(() => ai.assess(req(), 'C')).toThrow('BLOCKED');
  });

  it('감사 로그 기록', () => {
    ai.registerHighRisk('YY');
    ai.assess(req());
    expect(ai.getAuditLog().length).toBeGreaterThanOrEqual(2);
  });
});
