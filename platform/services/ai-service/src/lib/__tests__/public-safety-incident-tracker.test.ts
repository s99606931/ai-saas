/**
 * 공공 안전 사건 자동 추적기 단위 테스트 — SVC-AI-ADV-R461
 * Plan SC: FR-461.1~5
 */

import { describe, it, expect } from 'vitest';
import { PublicSafetyIncidentTracker } from '../public-safety-incident-tracker';
import type { Incident } from '../public-safety-incident-tracker';

const mk = (id: string, category: string, region: string, severity: 1|2|3|4|5): Incident => ({
  id, category, regionId: region, timestamp: '2026-04-13T00:00:00Z', severity,
});

describe('PublicSafetyIncidentTracker — R461', () => {
  it('FR-461.1/2: 사건 집계 및 상위 위험 지역 도출', () => {
    const t = new PublicSafetyIncidentTracker();
    const r = t.track([
      mk('1', 'fire', 'gangnam', 3),
      mk('2', 'fire', 'gangnam', 2),
      mk('3', 'fire', 'songpa', 1),
    ]);
    expect(r.totalIncidents).toBe(3);
    expect(r.topRiskRegion).toBe('gangnam');
  });

  it('FR-461.3: threshold 초과 시 PatternAlert 생성', () => {
    const t = new PublicSafetyIncidentTracker(2);
    const r = t.track([
      mk('1', 'theft', 'gangnam', 3),
      mk('2', 'theft', 'gangnam', 3),
      mk('3', 'theft', 'gangnam', 3),
    ]);
    expect(r.alerts).toHaveLength(1);
    expect(r.alerts[0]?.count).toBe(3);
  });

  it('FR-461.4: 평균 severity ≥ 4 이면 hotspot = true', () => {
    const t = new PublicSafetyIncidentTracker(2);
    const r = t.track([
      mk('1', 'assault', 'mapo', 5),
      mk('2', 'assault', 'mapo', 4),
      mk('3', 'assault', 'mapo', 5),
    ]);
    expect(r.alerts[0]?.hotspot).toBe(true);
  });

  it('FR-461.5: C/S 등급 차단', () => {
    const t = new PublicSafetyIncidentTracker();
    expect(() => t.track([], 'C')).toThrow(/N2SF_BLOCKED/);
    expect(() => t.track([], 'S')).toThrow(/N2SF_BLOCKED/);
  });

  it('FR-461.5: getAuditLog 동작', () => {
    const t = new PublicSafetyIncidentTracker();
    t.track([mk('1', 'fire', 'a', 1)]);
    expect(t.getAuditLog().length).toBeGreaterThan(0);
  });
});
