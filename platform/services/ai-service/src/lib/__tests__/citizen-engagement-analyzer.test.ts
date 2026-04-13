import { describe, it, expect } from 'vitest';
import { CitizenEngagementAnalyzer } from '../citizen-engagement-analyzer.js';

describe('SVC-AI-ADV-R428 CitizenEngagementAnalyzer', () => {
  const svc = new CitizenEngagementAnalyzer();

  it('FR-428.4: 낮은 참여 → LOW', () => {
    const r = svc.analyze({
      policyId: 'pol1',
      participants: 10,
      targetPopulation: 1000,
      satisfaction: 50,
    });
    // rate=0.01, responseScore=1, index=0.5+25=25.5 < 40
    expect(r.grade).toBe('LOW');
  });

  it('FR-428.4: 중간 참여 → MID', () => {
    const r = svc.analyze({
      policyId: 'pol2',
      participants: 500,
      targetPopulation: 1000,
      satisfaction: 60,
    });
    // responseScore=50, index=25+30=55
    expect(r.grade).toBe('MID');
  });

  it('FR-428.4: 높은 참여 → HIGH', () => {
    const r = svc.analyze({
      policyId: 'pol3',
      participants: 800,
      targetPopulation: 1000,
      satisfaction: 80,
    });
    // responseScore=80, index=40+40=80
    expect(r.grade).toBe('HIGH');
  });

  it('FR-428.2: participationRate 상한 1', () => {
    const r = svc.analyze({
      policyId: 'pol4',
      participants: 2000,
      targetPopulation: 1000,
      satisfaction: 50,
    });
    expect(r.participationRate).toBe(1);
    expect(r.responseScore).toBe(100);
  });

  it('FR-428.5: C 등급 차단', () => {
    expect(() =>
      svc.analyze(
        { policyId: 'p', participants: 1, targetPopulation: 10, satisfaction: 50 },
        'C',
      ),
    ).toThrow('N2SF_BLOCKED');
  });

  it('감사 로그', () => {
    svc.analyze({ policyId: 'p9', participants: 100, targetPopulation: 1000, satisfaction: 70 });
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
