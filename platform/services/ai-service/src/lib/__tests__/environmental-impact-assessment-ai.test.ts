import { describe, it, expect, beforeEach } from 'vitest';
import { EnvironmentalImpactAssessmentAI } from '../environmental-impact-assessment-ai';

describe('EnvironmentalImpactAssessmentAI', () => {
  let ai: EnvironmentalImpactAssessmentAI;

  beforeEach(() => {
    ai = new EnvironmentalImpactAssessmentAI();
  });

  it('프로젝트를 등록하고 목록에 반영한다', () => {
    ai.registerProject({ projectId: 'P1', name: '공원', areaHectare: 10, budgetKrw: 1e9, type: 'park' });
    expect(ai.listProjects()).toHaveLength(1);
    expect(ai.getAuditLog().some((l) => l.action === 'REGISTER_PROJECT')).toBe(true);
  });

  it('공장 프로젝트는 high/critical 수준으로 평가한다', () => {
    ai.registerProject({ projectId: 'P2', name: '공장', areaHectare: 50, budgetKrw: 1e10, type: 'plant' });
    const result = ai.assess('P2');
    expect(['high', 'critical']).toContain(result.level);
    expect(result.mitigations.length).toBeGreaterThan(0);
  });

  it('공원 프로젝트는 낮은 영향도로 평가한다', () => {
    ai.registerProject({ projectId: 'P3', name: '어린이공원', areaHectare: 2, budgetKrw: 5e8, type: 'park' });
    const result = ai.assess('P3');
    expect(result.level).toBe('low');
  });

  it('면적이 클수록 점수가 증가한다', () => {
    ai.registerProject({ projectId: 'P4', name: '소형도로', areaHectare: 1, budgetKrw: 1e9, type: 'road' });
    ai.registerProject({ projectId: 'P5', name: '대형도로', areaHectare: 150, budgetKrw: 1e11, type: 'road' });
    const small = ai.assess('P4');
    const big = ai.assess('P5');
    expect(big.totalScore).toBeGreaterThan(small.totalScore);
  });

  it('미등록 프로젝트 평가 시 오류를 던진다', () => {
    expect(() => ai.assess('UNKNOWN')).toThrow('미등록 프로젝트');
  });

  it('C등급 데이터는 차단한다', () => {
    expect(() => ai.registerProject({ projectId: 'P6', name: 'x', areaHectare: 1, budgetKrw: 1, type: 'other' }, 'C' as never)).toThrow('BLOCKED');
  });
});
