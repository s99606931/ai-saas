import { describe, it, expect, beforeEach } from 'vitest';
import { PublicInstitutionRiskScorer } from '../public-institution-risk-scorer';

describe('PublicInstitutionRiskScorer', () => {
  let scorer: PublicInstitutionRiskScorer;

  beforeEach(() => {
    scorer = new PublicInstitutionRiskScorer();
  });

  it('기관을 등록한다', () => {
    scorer.registerInstitution('inst-1', '행정안전부', 'large', 'central');
    expect(scorer.getAuditLog().some(l => l.action === 'REGISTER_INSTITUTION')).toBe(true);
  });

  it('리스크 지표를 기록한다', () => {
    scorer.registerInstitution('inst-1', '행안부', 'large', 'central');
    scorer.recordRiskMetrics('inst-1', 3, 30, 80);
    expect(scorer.getAuditLog().some(l => l.action === 'RECORD_RISK_METRICS')).toBe(true);
  });

  it('높은 위험 지표에서 높은 리스크 점수를 반환한다', () => {
    scorer.registerInstitution('inst-1', '행안부', 'large', 'central');
    scorer.recordRiskMetrics('inst-1', 10, 80, 20);
    const result = scorer.calculateRiskScore('inst-1');
    expect(result.totalRisk).toBeGreaterThan(60);
    expect(['D', 'F']).toContain(result.grade);
  });

  it('지표 없으면 totalRisk=0, 등급A를 반환한다', () => {
    scorer.registerInstitution('inst-1', '행안부', 'large', 'central');
    const result = scorer.calculateRiskScore('inst-1');
    expect(result.totalRisk).toBe(0);
    expect(result.grade).toBe('A');
  });

  it('고위험 기관 목록을 반환한다', () => {
    scorer.registerInstitution('inst-1', '고위험', 'large', 'central');
    scorer.registerInstitution('inst-2', '저위험', 'small', 'local');
    scorer.recordRiskMetrics('inst-1', 10, 80, 20);
    scorer.recordRiskMetrics('inst-2', 1, 10, 95);
    const highRisk = scorer.getHighRiskInstitutions(60);
    expect(highRisk.some(r => r.institutionId === 'inst-1')).toBe(true);
    expect(highRisk.every(r => r.institutionId !== 'inst-2')).toBe(true);
  });

  it('C등급 지표 기록을 차단한다', () => {
    scorer.registerInstitution('inst-1', '행안부', 'large', 'central');
    expect(() => scorer.recordRiskMetrics('inst-1', 3, 30, 80, 'C' as never)).toThrow('BLOCKED');
  });

  it('미등록 기관 지표 기록 시 오류를 던진다', () => {
    expect(() => scorer.recordRiskMetrics('unknown', 3, 30, 80)).toThrow('기관 미등록');
  });
});
