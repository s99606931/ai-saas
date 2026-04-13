/**
 * 공중 보건 비상 조기 탐지기 단위 테스트 — SVC-AI-ADV-R463
 * Plan SC: FR-463.1~5
 */

import { describe, it, expect } from 'vitest';
import { PublicHealthEmergencyDetector } from '../public-health-emergency-detector';

describe('PublicHealthEmergencyDetector — R463', () => {
  it('FR-463.2/3: 급증 시 anomaly 탐지', () => {
    const d = new PublicHealthEmergencyDetector();
    const r = d.detect([
      { date: '2026-04-01', symptom: 'fever', count: 5, regionId: 'a' },
      { date: '2026-04-02', symptom: 'fever', count: 5, regionId: 'a' },
      { date: '2026-04-03', symptom: 'fever', count: 50, regionId: 'a' },
    ]);
    expect(r.anomalies.length).toBeGreaterThan(0);
    expect(r.anomalies[0]?.ratio).toBeGreaterThan(3);
  });

  it('FR-463.4: 2건 이상 → warning', () => {
    const d = new PublicHealthEmergencyDetector();
    const r = d.detect([
      { date: '2026-04-01', symptom: 'cough', count: 1, regionId: 'a' },
      { date: '2026-04-02', symptom: 'cough', count: 20, regionId: 'a' },
      { date: '2026-04-01', symptom: 'fever', count: 1, regionId: 'b' },
      { date: '2026-04-02', symptom: 'fever', count: 20, regionId: 'b' },
    ]);
    expect(r.alertLevel).toBe('warning');
  });

  it('FR-463.4: 5건 이상 → critical', () => {
    const d = new PublicHealthEmergencyDetector();
    const data = [];
    for (let i = 0; i < 5; i++) {
      data.push(
        { date: '2026-04-01', symptom: `s${i}`, count: 1, regionId: 'r' },
        { date: '2026-04-02', symptom: `s${i}`, count: 50, regionId: 'r' },
      );
    }
    const r = d.detect(data);
    expect(r.alertLevel).toBe('critical');
  });

  it('FR-463.2: 정상 상태는 normal', () => {
    const d = new PublicHealthEmergencyDetector();
    const r = d.detect([
      { date: '2026-04-01', symptom: 'flu', count: 5, regionId: 'a' },
      { date: '2026-04-02', symptom: 'flu', count: 6, regionId: 'a' },
    ]);
    expect(r.alertLevel).toBe('normal');
  });

  it('FR-463.5: C/S 차단 + audit log', () => {
    const d = new PublicHealthEmergencyDetector();
    expect(() => d.detect([], 'S')).toThrow(/N2SF_BLOCKED/);
    d.detect([]);
    expect(d.getAuditLog().length).toBeGreaterThan(0);
  });
});
