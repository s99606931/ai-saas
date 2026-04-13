import { describe, it, expect, beforeEach } from 'vitest';
import {
  PublicFoodSafetyInspectorAI,
  type InspectionReport,
} from '../public-food-safety-inspector-ai';

const report = (facility: string, over: Partial<InspectionReport> = {}): InspectionReport => ({
  facilityId: facility,
  inspectorRef: 'insp-01',
  at: '2026-04-13T10:00:00Z',
  findings: [],
  ...over,
});

describe('PublicFoodSafetyInspectorAI', () => {
  let ai: PublicFoodSafetyInspectorAI;

  beforeEach(() => {
    ai = new PublicFoodSafetyInspectorAI();
  });

  it('무결점 시설 excellent', () => {
    const r = ai.submitReport(report('f1'));
    expect(r.grade).toBe('excellent');
    expect(r.score).toBe(100);
  });

  it('온도 위반 심각도 가중 차감', () => {
    const r = ai.submitReport(
      report('f2', {
        findings: [{ category: 'temperature', severity: 4, description: '냉장고 고장' }],
      }),
    );
    expect(r.score).toBeLessThan(100);
    expect(r.criticalIssues.length).toBe(1);
  });

  it('중대 위반 3건 이상 폐쇄', () => {
    const r = ai.submitReport(
      report('f3', {
        findings: [
          { category: 'temperature', severity: 5, description: '냉장실 마비' },
          { category: 'cross-contamination', severity: 5, description: '교차오염' },
          { category: 'pest-control', severity: 4, description: '쥐 출몰' },
        ],
      }),
    );
    expect(r.grade).toBe('closure');
    expect(r.mandatoryActions.some(a => a.includes('영업 중지'))).toBe(true);
  });

  it('실패 시설 목록 조회', () => {
    ai.submitReport(report('good'));
    ai.submitReport(
      report('bad', {
        findings: [
          { category: 'hygiene', severity: 5, description: 'x' },
          { category: 'hygiene', severity: 5, description: 'y' },
          { category: 'hygiene', severity: 5, description: 'z' },
          { category: 'hygiene', severity: 5, description: 'w' },
        ],
      }),
    );
    expect(ai.listFailed().length).toBeGreaterThanOrEqual(1);
  });

  it('잘못된 심각도 거부', () => {
    expect(() =>
      ai.submitReport(
        report('f4', {
          findings: [{ category: 'hygiene', severity: 6 as 5, description: 'x' }],
        }),
      ),
    ).toThrow();
  });

  it('C등급 차단', () => {
    expect(() => ai.submitReport(report('f5'), 'C')).toThrow('BLOCKED');
  });
});
