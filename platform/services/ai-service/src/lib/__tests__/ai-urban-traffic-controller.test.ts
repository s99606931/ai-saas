/**
 * AI 기반 도시 교통 신호 제어기 단위 테스트 — SVC-AI-ADV-R462
 * Plan SC: FR-462.1~5
 */

import { describe, it, expect } from 'vitest';
import { AiUrbanTrafficController } from '../ai-urban-traffic-controller';

describe('AiUrbanTrafficController — R462', () => {
  it('FR-462.2/4: 주요 방향 식별 및 주기 생성', () => {
    const c = new AiUrbanTrafficController();
    const r = c.optimize({
      id: 'X1',
      directions: { N: 20, S: 10, E: 5, W: 5 },
    });
    expect(r.id).toBe('X1');
    expect(r.priorityDir).toBe('N');
    expect(r.totalCycleSec).toBeGreaterThanOrEqual(60);
    expect(r.totalCycleSec).toBeLessThanOrEqual(120);
  });

  it('FR-462.3: 각 방향 min/max 준수', () => {
    const c = new AiUrbanTrafficController();
    const r = c.optimize({
      id: 'X2',
      directions: { N: 1000, S: 0, E: 0, W: 0 },
    });
    for (const d of ['N', 'S', 'E', 'W'] as const) {
      expect(r.greenTimes[d]).toBeGreaterThanOrEqual(10);
      expect(r.greenTimes[d]).toBeLessThanOrEqual(60);
    }
  });

  it('FR-462.3: 모든 방향 0일 때 최소값 할당', () => {
    const c = new AiUrbanTrafficController();
    const r = c.optimize({
      id: 'X3',
      directions: { N: 0, S: 0, E: 0, W: 0 },
    });
    expect(r.greenTimes.N).toBeGreaterThanOrEqual(10);
  });

  it('FR-462.5: C/S 차단', () => {
    const c = new AiUrbanTrafficController();
    expect(() =>
      c.optimize({ id: 'X', directions: { N: 1, S: 1, E: 1, W: 1 } }, 'C'),
    ).toThrow(/N2SF_BLOCKED/);
  });

  it('FR-462.5: getAuditLog', () => {
    const c = new AiUrbanTrafficController();
    c.optimize({ id: 'X', directions: { N: 1, S: 1, E: 1, W: 1 } });
    expect(c.getAuditLog().length).toBeGreaterThan(0);
  });
});
