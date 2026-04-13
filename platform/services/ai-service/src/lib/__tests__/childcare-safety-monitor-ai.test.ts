import { describe, it, expect, beforeEach } from 'vitest';
import { ChildcareSafetyMonitorAI } from '../childcare-safety-monitor-ai';

describe('ChildcareSafetyMonitorAI', () => {
  let ai: ChildcareSafetyMonitorAI;

  beforeEach(() => {
    ai = new ChildcareSafetyMonitorAI();
  });

  it('시설을 등록한다', () => {
    ai.registerFacility({ facilityId: 'f1', name: '햇살 어린이집', childCount: 20, staffCount: 4 });
    expect(ai.listFacilities().length).toBe(1);
    expect(ai.getAuditLog().some(l => l.action === 'REGISTER_FACILITY')).toBe(true);
  });

  it('위험 요인을 보고한다', () => {
    ai.registerFacility({ facilityId: 'f1', name: 'A', childCount: 15, staffCount: 3 });
    ai.reportHazard({ facilityId: 'f1', hazard: 'fall', severity: 6, detectedAt: '2026-04-13T09:00:00Z' });
    expect(ai.getReports('f1').length).toBe(1);
  });

  it('안전 평가를 산출한다', () => {
    ai.registerFacility({ facilityId: 'f1', name: 'A', childCount: 10, staffCount: 3 });
    ai.reportHazard({ facilityId: 'f1', hazard: 'fire', severity: 8, detectedAt: '2026-04-13T09:00:00Z' });
    ai.reportHazard({ facilityId: 'f1', hazard: 'fall', severity: 5, detectedAt: '2026-04-13T10:00:00Z' });
    const result = ai.assess('f1');
    expect(result.riskScore).toBeGreaterThan(0);
    expect(['safe', 'caution', 'warning', 'critical']).toContain(result.level);
  });

  it('교직원 비율이 낮으면 위험 점수가 증가한다', () => {
    ai.registerFacility({ facilityId: 'f1', name: 'A', childCount: 100, staffCount: 5 });
    ai.reportHazard({ facilityId: 'f1', hazard: 'hygiene', severity: 3, detectedAt: '2026-04-13T09:00:00Z' });
    const result = ai.assess('f1');
    expect(result.riskScore).toBeGreaterThanOrEqual(15);
  });

  it('미등록 시설 평가 시 오류를 던진다', () => {
    expect(() => ai.assess('unknown')).toThrow('시설 미등록');
  });

  it('C등급 데이터는 차단한다', () => {
    expect(() =>
      ai.registerFacility({ facilityId: 'f1', name: 'A', childCount: 10, staffCount: 2 }, 'C'),
    ).toThrow('BLOCKED');
  });
});
