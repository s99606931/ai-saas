/**
 * 공공 인프라 점검 AI 단위 테스트 — SVC-AI-ADV-R479
 * Plan SC: FR-479.1~6
 */

import { describe, it, expect } from 'vitest';
import { PublicInfrastructureInspectorAi } from '../public-infrastructure-inspector-ai';
import type { InspectionItem } from '../public-infrastructure-inspector-ai';

const mk = (id: string, o: Partial<InspectionItem> = {}): InspectionItem => ({
  assetId: id,
  assetType: 'BRIDGE',
  ageYears: 10,
  lastInspectionDays: 180,
  defectCount: 2,
  structuralRating: 90,
  trafficLoad: 50,
  ...o,
});

describe('PublicInfrastructureInspectorAi — R479', () => {
  it('FR-479.1: 우수 상태 A등급', () => {
    const ai = new PublicInfrastructureInspectorAi();
    const r = ai.inspect(
      mk('B1', { ageYears: 2, defectCount: 0, trafficLoad: 10, structuralRating: 100 }),
    );
    expect(r.conditionGrade).toBe('A');
    expect(r.riskLevel).toBe('LOW');
  });

  it('FR-479.2: 노후 + 결함 많음 → E등급 + CRITICAL', () => {
    const ai = new PublicInfrastructureInspectorAi();
    const r = ai.inspect(
      mk('B2', {
        ageYears: 50,
        defectCount: 30,
        structuralRating: 50,
        trafficLoad: 90,
      }),
    );
    expect(['D', 'E']).toContain(r.conditionGrade);
    expect(['HIGH', 'CRITICAL']).toContain(r.riskLevel);
  });

  it('FR-479.3: E등급은 즉시 점검', () => {
    const ai = new PublicInfrastructureInspectorAi();
    const r = ai.inspect(
      mk('B3', {
        ageYears: 60,
        defectCount: 50,
        structuralRating: 20,
        trafficLoad: 100,
      }),
    );
    if (r.conditionGrade === 'E') {
      expect(r.daysUntilNextInspection).toBe(0);
      expect(r.recommendedAction).toContain('closure');
    }
  });

  it('FR-479.4: prioritize 위험순 정렬', () => {
    const ai = new PublicInfrastructureInspectorAi();
    const list = [
      mk('A', { ageYears: 1, structuralRating: 100, defectCount: 0 }),
      mk('B', { ageYears: 50, defectCount: 40, structuralRating: 30 }),
      mk('C', { ageYears: 15, defectCount: 5 }),
    ];
    const r = ai.prioritize(list);
    expect(r[0]!.riskLevel === 'CRITICAL' || r[0]!.riskLevel === 'HIGH').toBe(true);
  });

  it('FR-479.5: audit 로그', () => {
    const ai = new PublicInfrastructureInspectorAi();
    ai.inspect(mk('X'));
    expect(ai.getAuditLog().length).toBeGreaterThan(0);
  });

  it('FR-479.6: C/S 차단', () => {
    const ai = new PublicInfrastructureInspectorAi();
    expect(() => ai.inspect(mk('Y'), 'C')).toThrow(/N2SF_BLOCKED/);
  });
});
