/**
 * 재난 대응 AI 코디네이터 단위 테스트 — SVC-AI-ADV-R481
 * Plan SC: FR-481.1~6
 */

import { describe, it, expect } from 'vitest';
import {
  DisasterResponseAiCoordinator,
} from '../disaster-response-ai-coordinator';
import type {
  DisasterEvent,
  ResourceUnit,
} from '../disaster-response-ai-coordinator';

const mkEvent = (over: Partial<DisasterEvent> = {}): DisasterEvent => ({
  eventId: 'E1',
  type: 'EARTHQUAKE',
  severity: 3,
  affectedPopulation: 300,
  latitudeDeg: 37.5,
  longitudeDeg: 127.0,
  reportedAt: '2026-04-13T00:00:00Z',
  ...over,
});

const mkUnits = (): ResourceUnit[] => [
  { unitId: 'U1', kind: 'AMBULANCE', capacity: 4, readyMinutes: 5 },
  { unitId: 'U2', kind: 'RESCUE_TEAM', capacity: 10, readyMinutes: 15 },
  { unitId: 'U3', kind: 'HELICOPTER', capacity: 20, readyMinutes: 30 },
];

describe('DisasterResponseAiCoordinator — R481', () => {
  it('FR-481.1: severity 5 → P1 우선순위', () => {
    const c = new DisasterResponseAiCoordinator();
    const plan = c.coordinate(mkEvent({ severity: 5 }), mkUnits());
    expect(plan.priority).toBe('P1');
  });

  it('FR-481.2: 유닛 배정 수량 검증', () => {
    const c = new DisasterResponseAiCoordinator();
    const plan = c.coordinate(mkEvent({ affectedPopulation: 50 }), mkUnits());
    expect(plan.assignedUnits.length).toBeGreaterThan(0);
  });

  it('FR-481.3: 대피소 수 = ceil(pop/500)', () => {
    const c = new DisasterResponseAiCoordinator();
    const plan = c.coordinate(mkEvent({ affectedPopulation: 1200 }), mkUnits());
    expect(plan.evacuationCenters).toBe(3);
  });

  it('FR-481.4: 위험지수 계산', () => {
    const c = new DisasterResponseAiCoordinator();
    const idx = c.computeRiskIndex([
      mkEvent({ severity: 5, affectedPopulation: 10000 }),
      mkEvent({ severity: 2, affectedPopulation: 50 }),
    ]);
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(idx).toBeLessThanOrEqual(100);
  });

  it('FR-481.5: audit 로그 append-only', () => {
    const c = new DisasterResponseAiCoordinator();
    c.coordinate(mkEvent(), mkUnits());
    expect(c.getAuditLog().length).toBeGreaterThan(0);
  });

  it('FR-481.6: C/S 차단', () => {
    const c = new DisasterResponseAiCoordinator();
    expect(() => c.coordinate(mkEvent(), mkUnits(), 'C')).toThrow(/N2SF_BLOCKED/);
    expect(() => c.coordinate(mkEvent(), mkUnits(), 'S')).toThrow(/N2SF_BLOCKED/);
  });
});
