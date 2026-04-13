import { describe, it, expect, beforeEach } from 'vitest';
import { PublicGriefSupportAI, type SupportCase } from '../public-grief-support-ai';

const sampleCase = (id: string, overrides: Partial<SupportCase> = {}): SupportCase => ({
  caseId: id,
  disasterType: 'earthquake',
  severityScore: 50,
  daysSinceIncident: 10,
  hasFamilySupport: true,
  region: '서울',
  ...overrides,
});

describe('PublicGriefSupportAI', () => {
  let ai: PublicGriefSupportAI;

  beforeEach(() => {
    ai = new PublicGriefSupportAI();
  });

  it('지원 케이스를 등록한다', () => {
    ai.registerCase(sampleCase('k1'));
    expect(ai.listCasesByRegion('서울').length).toBe(1);
  });

  it('긴급도에 따라 트리아지를 수행한다', () => {
    ai.registerCase(sampleCase('k1', { severityScore: 85 }));
    const plan = ai.triage('k1');
    expect(plan.urgencyLevel).toBe('critical');
    expect(plan.recommendedSupports).toContain('hotline');
  });

  it('가족 지원이 없으면 community를 추가한다', () => {
    ai.registerCase(sampleCase('k1', { severityScore: 20, hasFamilySupport: false }));
    const plan = ai.triage('k1');
    expect(plan.recommendedSupports).toContain('community');
  });

  it('재난 유형별 통계를 반환한다', () => {
    ai.registerCase(sampleCase('k1', { disasterType: 'fire' }));
    ai.registerCase(sampleCase('k2', { disasterType: 'flood' }));
    const stats = ai.statsByDisaster();
    expect(stats.fire).toBe(1);
    expect(stats.flood).toBe(1);
  });

  it('잘못된 심각도 점수는 거부한다', () => {
    expect(() => ai.registerCase(sampleCase('k1', { severityScore: 150 }))).toThrow('스트레스');
  });

  it('S등급 데이터는 차단한다', () => {
    expect(() => ai.registerCase(sampleCase('k1'), 'S')).toThrow('BLOCKED');
  });
});
