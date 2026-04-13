/**
 * 공공 교통 통합 AI 단위 테스트 — SVC-AI-ADV-R488
 * Plan SC: FR-488.1~6
 */

import { describe, it, expect } from 'vitest';
import { PublicTransportIntegrationAi } from '../public-transport-integration-ai';
import type { Route } from '../public-transport-integration-ai';

const mkRoute = (over: Partial<Route> = {}): Route => ({
  routeId: 'R1',
  mode: 'BUS',
  origin: 'A',
  destination: 'B',
  timetableMinutes: [0, 10, 20, 30, 40, 50],
  dailyRidership: 1200,
  capacityPerTrip: 50,
  ...over,
});

describe('PublicTransportIntegrationAi — R488', () => {
  it('FR-488.1: 통합 계획 생성', () => {
    const ai = new PublicTransportIntegrationAi();
    const plan = ai.integrate([mkRoute(), mkRoute({ routeId: 'R2', mode: 'SUBWAY' })]);
    expect(plan.connectedRoutes).toHaveLength(2);
    expect(plan.coverageScore).toBeGreaterThan(0);
  });

  it('FR-488.2: 과부하 노선 증편 제안', () => {
    const ai = new PublicTransportIntegrationAi();
    const plan = ai.integrate([
      mkRoute({ dailyRidership: 5000, capacityPerTrip: 50, timetableMinutes: [0, 30] }),
    ]);
    expect(plan.suggestedAdjustments.some((s) => s.includes('증편'))).toBe(true);
  });

  it('FR-488.3: 저활용 노선 감편 제안', () => {
    const ai = new PublicTransportIntegrationAi();
    const plan = ai.integrate([
      mkRoute({ dailyRidership: 30, capacityPerTrip: 50, timetableMinutes: [0, 30, 60] }),
    ]);
    expect(plan.suggestedAdjustments.some((s) => s.includes('감편'))).toBe(true);
  });

  it('FR-488.4: 요금 수익 시뮬레이션', () => {
    const ai = new PublicTransportIntegrationAi();
    const rev = ai.simulateFareRevenue([mkRoute(), mkRoute({ routeId: 'R2' })], 1500);
    expect(rev).toBe(2 * 1200 * 1500);
  });

  it('FR-488.5: audit 로그', () => {
    const ai = new PublicTransportIntegrationAi();
    ai.integrate([mkRoute()]);
    expect(ai.getAuditLog().length).toBeGreaterThan(0);
  });

  it('FR-488.6: C/S 차단', () => {
    const ai = new PublicTransportIntegrationAi();
    expect(() => ai.integrate([mkRoute()], 'C')).toThrow(/N2SF_BLOCKED/);
    expect(() => ai.integrate([mkRoute()], 'S')).toThrow(/N2SF_BLOCKED/);
  });
});
