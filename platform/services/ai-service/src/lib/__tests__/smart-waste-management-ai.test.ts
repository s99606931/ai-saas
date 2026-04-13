import { describe, it, expect } from 'vitest';
import { SmartWasteManagementAI } from '../smart-waste-management-ai.js';

describe('SVC-AI-ADV-R459 SmartWasteManagementAI', () => {
  const svc = new SmartWasteManagementAI();

  it('FR-459.2: 0.8 이상만 포함', () => {
    const r = svc.plan([
      { id: 'b1', fillLevel: 0.9, x: 1, y: 0 },
      { id: 'b2', fillLevel: 0.5, x: 2, y: 0 },
      { id: 'b3', fillLevel: 0.85, x: 3, y: 0 },
    ]);
    expect(r.path).toEqual(['b1', 'b3']);
  });

  it('FR-459.3: 최근접 이웃 순회', () => {
    const r = svc.plan([
      { id: 'b1', fillLevel: 0.9, x: 10, y: 0 },
      { id: 'b2', fillLevel: 0.9, x: 1, y: 0 },
      { id: 'b3', fillLevel: 0.9, x: 5, y: 0 },
    ]);
    expect(r.path).toEqual(['b2', 'b3', 'b1']);
  });

  it('FR-459.5: 오버플로우 감지', () => {
    const r = svc.plan([{ id: 'b1', fillLevel: 1.2, x: 1, y: 0 }]);
    expect(r.overflow).toBe(true);
  });

  it('수거 대상 없음', () => {
    const r = svc.plan([{ id: 'b1', fillLevel: 0.5, x: 1, y: 0 }]);
    expect(r.path.length).toBe(0);
    expect(r.totalDistance).toBe(0);
  });

  it('거리 계산', () => {
    const r = svc.plan([{ id: 'b1', fillLevel: 0.9, x: 3, y: 4 }]);
    expect(r.totalDistance).toBe(5); // sqrt(9+16)=5
  });

  it('fillLevel 음수 오류', () => {
    expect(() =>
      svc.plan([{ id: 'b1', fillLevel: -0.1, x: 0, y: 0 }]),
    ).toThrow('INVALID_FILL');
  });

  it('FR-459.6: C 차단', () => {
    expect(() => svc.plan([], 'C')).toThrow('N2SF_BLOCKED');
  });

  it('감사 로그', () => {
    svc.plan([]);
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
