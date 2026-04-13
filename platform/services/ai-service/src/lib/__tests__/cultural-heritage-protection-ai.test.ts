import { describe, it, expect, beforeEach } from 'vitest';
import { CulturalHeritageProtectionAI } from '../cultural-heritage-protection-ai';

describe('CulturalHeritageProtectionAI', () => {
  let svc: CulturalHeritageProtectionAI;

  beforeEach(() => {
    svc = new CulturalHeritageProtectionAI();
    svc.registerItem({
      itemId: 'h1',
      name: '경복궁 근정전',
      type: 'building',
      grade: 'national',
      ageYears: 600,
      conditionScore: 80,
      environmentalRisk: 40,
      visitorPressure: 85,
    });
    svc.registerItem({
      itemId: 'h2',
      name: '향토 사찰 석탑',
      type: 'sculpture',
      grade: 'local',
      ageYears: 200,
      conditionScore: 30,
      environmentalRisk: 70,
      visitorPressure: 20,
    });
  });

  it('등록한다', () => {
    expect(svc.getAuditLog().filter(e => e.action === 'REGISTER_ITEM').length).toBe(2);
  });

  it('손상된 문화재는 더 높은 위험 점수', () => {
    const a1 = svc.assessRisk('h1');
    const a2 = svc.assessRisk('h2');
    expect(a2.riskScore).toBeGreaterThan(a1.riskScore);
  });

  it('보존 계획에 액션 포함', () => {
    const plan = svc.generateConservationPlan('h2');
    expect(plan.actions.length).toBeGreaterThan(0);
    expect(plan.estimatedCostKrw).toBeGreaterThan(0);
  });

  it('일괄 우선순위 정렬', () => {
    const ranks = svc.prioritizeBatch();
    expect(ranks.length).toBe(2);
    expect(ranks[0]?.riskScore).toBeGreaterThanOrEqual(ranks[1]?.riskScore ?? 0);
  });

  it('미등록 문화재 평가 시 오류', () => {
    expect(() => svc.assessRisk('unknown')).toThrow('미등록');
  });

  it('S등급 데이터 차단', () => {
    expect(() => svc.registerItem({
      itemId: 'h3',
      name: 'x',
      type: 'artifact',
      grade: 'local',
      ageYears: 100,
      conditionScore: 50,
      environmentalRisk: 30,
      visitorPressure: 10,
    }, 'S')).toThrow('BLOCKED');
  });
});
