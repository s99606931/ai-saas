/**
 * AI 환경 규정 준수 단위 테스트 — SVC-AI-ADV-R478
 * Plan SC: FR-478.1~6
 */

import { describe, it, expect } from 'vitest';
import { AiEnvironmentalCompliance } from '../ai-environmental-compliance';
import type { EmissionRecord } from '../ai-environmental-compliance';

const mk = (
  pollutant: EmissionRecord['pollutant'],
  value: number,
): EmissionRecord => ({
  facilityId: 'F1',
  pollutant,
  valuePpm: value,
  timestamp: new Date().toISOString(),
});

describe('AiEnvironmentalCompliance — R478', () => {
  it('FR-478.1: 모두 한도 내 COMPLIANT', () => {
    const ai = new AiEnvironmentalCompliance();
    const r = ai.check('F1', [mk('CO2', 500), mk('NOx', 50)]);
    expect(r.overallStatus).toBe('COMPLIANT');
    expect(r.violations).toHaveLength(0);
  });

  it('FR-478.2: 경미 위반 WARNING', () => {
    const ai = new AiEnvironmentalCompliance();
    const r = ai.check('F1', [mk('NOx', 120)]);
    expect(r.overallStatus).toBe('WARNING');
    expect(r.violations[0]!.severity).toBe('MINOR');
  });

  it('FR-478.3: 중대 위반 VIOLATION + 벌금', () => {
    const ai = new AiEnvironmentalCompliance();
    const r = ai.check('F1', [mk('CO2', 3000)]);
    expect(r.overallStatus).toBe('VIOLATION');
    expect(r.violations[0]!.severity).toBe('SEVERE');
    expect(r.penaltyEstimateKrw).toBeGreaterThan(0);
  });

  it('FR-478.4: 다중 오염물질 처리', () => {
    const ai = new AiEnvironmentalCompliance();
    const r = ai.check('F1', [mk('CO2', 1500), mk('SOx', 200), mk('PM10', 30)]);
    expect(r.violations.length).toBe(2);
  });

  it('FR-478.5: audit 로그', () => {
    const ai = new AiEnvironmentalCompliance();
    ai.check('F1', []);
    expect(ai.getAuditLog().length).toBeGreaterThan(0);
  });

  it('FR-478.6: C/S 차단', () => {
    const ai = new AiEnvironmentalCompliance();
    expect(() => ai.check('F1', [], 'S')).toThrow(/N2SF_BLOCKED/);
  });
});
