/**
 * AI 수자원 관리 단위 테스트 — SVC-AI-ADV-R489
 * Plan SC: FR-489.1~6
 */

import { describe, it, expect } from 'vitest';
import { AiWaterResourceManager } from '../ai-water-resource-manager';
import type { Reservoir } from '../ai-water-resource-manager';

const mk = (over: Partial<Reservoir> = {}): Reservoir => ({
  reservoirId: 'W1',
  capacityMcm: 100,
  currentLevelMcm: 60,
  inflowMcmPerDay: 2,
  outflowMcmPerDay: 2,
  rainfallMmForecast7d: 20,
  ...over,
});

describe('AiWaterResourceManager — R489', () => {
  it('FR-489.1: 정상 수위 NORMAL', () => {
    const m = new AiWaterResourceManager();
    const r = m.plan(mk());
    expect(r.status).toBe('NORMAL');
  });

  it('FR-489.2: 가뭄 조건 DROUGHT', () => {
    const m = new AiWaterResourceManager();
    const r = m.plan(
      mk({ currentLevelMcm: 10, inflowMcmPerDay: 0.5, outflowMcmPerDay: 2 }),
    );
    expect(r.status).toBe('DROUGHT');
    expect(r.actions).toContain('water_restriction');
  });

  it('FR-489.3: 홍수 위험 FLOOD_RISK', () => {
    const m = new AiWaterResourceManager();
    const r = m.plan(mk({ currentLevelMcm: 98, rainfallMmForecast7d: 300 }));
    expect(r.status).toBe('FLOOD_RISK');
    expect(r.actions).toContain('preemptive_discharge');
  });

  it('FR-489.4: 유역 수지 계산', () => {
    const m = new AiWaterResourceManager();
    const b = m.basinBalance([mk(), mk({ reservoirId: 'W2', inflowMcmPerDay: 5 })]);
    expect(b).toBe(3);
  });

  it('FR-489.5: audit 로그', () => {
    const m = new AiWaterResourceManager();
    m.plan(mk());
    expect(m.getAuditLog().length).toBeGreaterThan(0);
  });

  it('FR-489.6: C/S 차단', () => {
    const m = new AiWaterResourceManager();
    expect(() => m.plan(mk(), 'C')).toThrow(/N2SF_BLOCKED/);
    expect(() => m.plan(mk(), 'S')).toThrow(/N2SF_BLOCKED/);
  });
});
