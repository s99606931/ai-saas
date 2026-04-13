import { describe, it, expect, beforeEach } from 'vitest';
import { SmartWasteRoutePlannerAI } from '../smart-waste-route-planner-ai';

describe('SmartWasteRoutePlannerAI', () => {
  let ai: SmartWasteRoutePlannerAI;

  const depot = { lat: 37.5665, lng: 126.9780 };
  const bins = [
    { binId: 'b1', lat: 37.5700, lng: 126.9800, type: 'general' as const, fillLevel: 85, lastCollectedAt: '2026-04-10' },
    { binId: 'b2', lat: 37.5750, lng: 126.9850, type: 'general' as const, fillLevel: 75, lastCollectedAt: '2026-04-10' },
    { binId: 'b3', lat: 37.5720, lng: 126.9820, type: 'recycle' as const, fillLevel: 50, lastCollectedAt: '2026-04-11' },
    { binId: 'b4', lat: 37.5680, lng: 126.9790, type: 'general' as const, fillLevel: 95, lastCollectedAt: '2026-04-09' },
  ];

  beforeEach(() => {
    ai = new SmartWasteRoutePlannerAI();
    bins.forEach(b => ai.registerBin(b));
  });

  it('쓰레기통을 등록한다', () => {
    expect(ai.getAuditLog().filter(l => l.action === 'REGISTER_BIN').length).toBe(4);
  });

  it('수거 대상(70%+)만 선택한다', () => {
    const targets = ai.selectCollectionTargets();
    expect(targets.length).toBe(3);
    expect(targets.every(t => t.fillLevel >= 70)).toBe(true);
  });

  it('타입 필터로 general만 선택한다', () => {
    const targets = ai.selectCollectionTargets('general');
    expect(targets.every(t => t.type === 'general')).toBe(true);
    expect(targets.length).toBe(3);
  });

  it('경로를 계획하고 정류장 순서를 산출한다', () => {
    const route = ai.planRoute('r1', 'v1', depot, 'general');
    expect(route.stops.length).toBe(3);
    expect(route.stops[0]!.order).toBe(1);
    expect(route.totalDistanceKm).toBeGreaterThan(0);
  });

  it('수거 대상 없으면 빈 경로', () => {
    const ai2 = new SmartWasteRoutePlannerAI();
    const route = ai2.planRoute('r1', 'v1', depot);
    expect(route.stops.length).toBe(0);
    expect(route.totalDistanceKm).toBe(0);
  });

  it('S등급 차단', () => {
    expect(() => ai.planRoute('r1', 'v1', depot, undefined, 'S' as unknown as never)).toThrow(/BLOCKED/);
  });
});
