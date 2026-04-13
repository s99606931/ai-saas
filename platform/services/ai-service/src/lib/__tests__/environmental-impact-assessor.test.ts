import { describe, it, expect } from 'vitest';
import { EnvironmentalImpactAssessor } from '../environmental-impact-assessor.js';

describe('SVC-AI-ADV-R424 EnvironmentalImpactAssessor', () => {
  const svc = new EnvironmentalImpactAssessor();

  it('FR-424.5: 낮은 영향 → A 등급', () => {
    const r = svc.assess({ projectId: 'p1', emissionsTon: 1, noiseDb: 41, wastewaterTon: 0.5 });
    expect(r.grade).toBe('A');
    expect(r.totalImpact).toBeLessThan(20);
  });

  it('FR-424.5: 높은 영향 → E 등급', () => {
    const r = svc.assess({ projectId: 'p2', emissionsTon: 60, noiseDb: 100, wastewaterTon: 30 });
    expect(r.grade).toBe('E');
  });

  it('FR-424.1~3: 점수 상한 100', () => {
    const r = svc.assess({ projectId: 'p3', emissionsTon: 1000, noiseDb: 200, wastewaterTon: 100 });
    expect(r.ghgScore).toBe(100);
    expect(r.noiseScore).toBe(100);
    expect(r.waterScore).toBe(100);
  });

  it('FR-424.6: S 등급 차단', () => {
    expect(() =>
      svc.assess({ projectId: 'p', emissionsTon: 0, noiseDb: 40, wastewaterTon: 0 }, 'S'),
    ).toThrow('N2SF_BLOCKED');
  });

  it('음수 입력 → 오류', () => {
    expect(() =>
      svc.assess({ projectId: 'p', emissionsTon: -1, noiseDb: 40, wastewaterTon: 0 }),
    ).toThrow('INVALID_NEGATIVE');
  });

  it('감사 로그', () => {
    svc.assess({ projectId: 'p99', emissionsTon: 5, noiseDb: 50, wastewaterTon: 2 });
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
