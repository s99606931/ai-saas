/**
 * AI 법원 일정 자동 배정 단위 테스트 — SVC-AI-ADV-R467
 * Plan SC: FR-467.1~7
 */

import { describe, it, expect } from 'vitest';
import { AiCourtScheduling } from '../ai-court-scheduling';
import type { Judge } from '../ai-court-scheduling';

describe('AiCourtScheduling — R467', () => {
  it('FR-467.3/4: 우선순위 높은 사건부터 배정', () => {
    const s = new AiCourtScheduling();
    const judges: Judge[] = [
      { id: 'j1', specialties: ['civil'], dailyCapacity: 2, currentLoad: 0 },
    ];
    const r = s.schedule(
      [
        { id: 'c1', type: 'civil', priority: 1 },
        { id: 'c2', type: 'civil', priority: 5 },
      ],
      judges,
    );
    expect(r.assignments[0]?.caseId).toBe('c2');
  });

  it('FR-467.5: 배정 시 currentLoad 증가', () => {
    const s = new AiCourtScheduling();
    const judges: Judge[] = [
      { id: 'j1', specialties: ['criminal'], dailyCapacity: 3, currentLoad: 0 },
    ];
    s.schedule(
      [
        { id: 'c1', type: 'criminal', priority: 3 },
        { id: 'c2', type: 'criminal', priority: 3 },
      ],
      judges,
    );
    expect(judges[0]?.currentLoad).toBe(2);
  });

  it('FR-467.6: capacity 초과 시 unscheduled', () => {
    const s = new AiCourtScheduling();
    const judges: Judge[] = [
      { id: 'j1', specialties: ['admin'], dailyCapacity: 1, currentLoad: 0 },
    ];
    const r = s.schedule(
      [
        { id: 'c1', type: 'admin', priority: 5 },
        { id: 'c2', type: 'admin', priority: 5 },
      ],
      judges,
    );
    expect(r.unscheduled).toContain('c2');
  });

  it('FR-467.4: specialty 불일치 시 unscheduled', () => {
    const s = new AiCourtScheduling();
    const judges: Judge[] = [
      { id: 'j1', specialties: ['civil'], dailyCapacity: 5, currentLoad: 0 },
    ];
    const r = s.schedule([{ id: 'c1', type: 'criminal', priority: 3 }], judges);
    expect(r.unscheduled).toContain('c1');
  });

  it('FR-467.7: C/S 차단 + audit log', () => {
    const s = new AiCourtScheduling();
    expect(() => s.schedule([], [], 'S')).toThrow(/N2SF_BLOCKED/);
    s.schedule([], []);
    expect(s.getAuditLog().length).toBeGreaterThan(0);
  });
});
