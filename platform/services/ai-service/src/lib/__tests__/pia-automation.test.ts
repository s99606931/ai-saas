import { describe, it, expect, beforeEach } from 'vitest';
import { PiaAutomation, type ProcessingActivity } from '../pia-automation';

describe('PiaAutomation', () => {
  let svc: PiaAutomation;

  const activity: ProcessingActivity = {
    id: 'pa1',
    systemName: '민원 시스템',
    categories: [
      { code: 'ssn', name: '주민등록번호', sensitivityLevel: 5 },
      { code: 'name', name: '이름', sensitivityLevel: 2 },
    ],
    subjectCount: 100000,
    retentionDays: 365 * 5,
    thirdPartySharing: true,
  };

  beforeEach(() => {
    svc = new PiaAutomation();
    svc.registerLegalBasis('ssn', '개인정보보호법 §24(고유식별정보)');
  });

  it('FR-PIA.1 위험도 산정', () => {
    const risk = svc.assessRisk(activity);
    expect(risk.level).toBe('critical');
    expect(risk.factors).toContain('민감정보 포함');
    expect(risk.factors).toContain('대규모 처리(5만+)');
  });

  it('FR-PIA.2 법적 근거 매핑', () => {
    const bases = svc.mapLegalBases(activity);
    expect(bases.find((b) => b.category === 'ssn')?.basis).toContain('§24');
  });

  it('FR-PIA.3 보호대책 추천 (critical)', () => {
    const risk = svc.assessRisk(activity);
    const safeguards = svc.recommendSafeguards(risk);
    expect(safeguards).toContain('저장 암호화(AES-256)');
    expect(safeguards).toContain('가명처리');
  });

  it('FR-PIA.4 보고서 생성', () => {
    const report = svc.buildReport(activity, new Date('2026-04-11'));
    expect(report.risk.level).toBe('critical');
    expect(report.safeguards.length).toBeGreaterThan(3);
  });

  it('FR-PIA.5 재평가 주기', () => {
    const report = svc.buildReport(activity, new Date('2026-04-11'));
    // critical이므로 1년 후
    expect(report.nextReviewDate.startsWith('2027')).toBe(true);
  });
});
