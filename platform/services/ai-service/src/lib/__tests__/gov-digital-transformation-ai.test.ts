/**
 * 정부 디지털 전환 AI 단위 테스트 — SVC-AI-ADV-R490
 * Plan SC: FR-490.1~6
 */

import { describe, it, expect } from 'vitest';
import { GovDigitalTransformationAi } from '../gov-digital-transformation-ai';
import type { AgencyMaturity } from '../gov-digital-transformation-ai';

const mk = (over: Partial<AgencyMaturity> = {}): AgencyMaturity => ({
  agencyId: 'G1',
  legacySystemsCount: 3,
  cloudAdoptionPct: 60,
  apiCoveragePct: 70,
  dataDigitizationPct: 75,
  staffDigitalLiteracy: 70,
  citizenOnlineServicesPct: 80,
  ...over,
});

describe('GovDigitalTransformationAi — R490', () => {
  it('FR-490.1: 중간 성숙도 레벨 3~4', () => {
    const ai = new GovDigitalTransformationAi();
    const r = ai.assess(mk());
    expect([3, 4]).toContain(r.maturityLevel);
  });

  it('FR-490.2: 낮은 성숙도 → 다수 액션', () => {
    const ai = new GovDigitalTransformationAi();
    const r = ai.assess(
      mk({
        legacySystemsCount: 15,
        cloudAdoptionPct: 10,
        apiCoveragePct: 10,
        dataDigitizationPct: 20,
        staffDigitalLiteracy: 30,
        citizenOnlineServicesPct: 20,
      }),
    );
    expect(r.maturityLevel).toBeLessThanOrEqual(2);
    expect(r.priorityActions.length).toBeGreaterThanOrEqual(4);
    expect(r.riskFactors.length).toBeGreaterThan(0);
  });

  it('FR-490.3: 높은 성숙도 → innovation_labs', () => {
    const ai = new GovDigitalTransformationAi();
    const r = ai.assess(
      mk({
        legacySystemsCount: 0,
        cloudAdoptionPct: 95,
        apiCoveragePct: 95,
        dataDigitizationPct: 95,
        staffDigitalLiteracy: 90,
        citizenOnlineServicesPct: 95,
      }),
    );
    expect(r.maturityLevel).toBe(5);
    expect(r.priorityActions).toContain('innovation_labs');
  });

  it('FR-490.4: 국가 지수 집계', () => {
    const ai = new GovDigitalTransformationAi();
    const idx = ai.nationalIndex([mk(), mk({ agencyId: 'G2' })]);
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(idx).toBeLessThanOrEqual(100);
  });

  it('FR-490.5: audit 로그', () => {
    const ai = new GovDigitalTransformationAi();
    ai.assess(mk());
    expect(ai.getAuditLog().length).toBeGreaterThan(0);
  });

  it('FR-490.6: C/S 차단', () => {
    const ai = new GovDigitalTransformationAi();
    expect(() => ai.assess(mk(), 'C')).toThrow(/N2SF_BLOCKED/);
    expect(() => ai.assess(mk(), 'S')).toThrow(/N2SF_BLOCKED/);
  });
});
