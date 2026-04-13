/**
 * 공공서비스 성과 AI 평가기 단위 테스트 — SVC-AI-ADV-R473
 * Plan SC: FR-473.1~6
 */

import { describe, it, expect } from 'vitest';
import { PublicServicePerformanceAi } from '../public-service-performance-ai';
import type { ServiceMetric } from '../public-service-performance-ai';

const mk = (id: string, o: Partial<ServiceMetric> = {}): ServiceMetric => ({
  serviceId: id,
  avgProcessingDays: 3,
  satisfactionScore: 4.5,
  completionRate: 0.95,
  complaintsPer1000: 2,
  costPerCaseKrw: 10_000,
  ...o,
});

describe('PublicServicePerformanceAi — R473', () => {
  it('FR-473.1: 우수 서비스 EXCELLENT 등급', () => {
    const ai = new PublicServicePerformanceAi();
    const r = ai.evaluate(mk('S1'));
    expect(['EXCELLENT', 'GOOD']).toContain(r.tier);
    expect(r.overall).toBeGreaterThan(50);
  });

  it('FR-473.2: 처리 지연 시 efficiency 하락', () => {
    const ai = new PublicServicePerformanceAi();
    const slow = ai.evaluate(mk('S2', { avgProcessingDays: 45 }));
    const fast = ai.evaluate(mk('S3', { avgProcessingDays: 1 }));
    expect(slow.efficiency).toBeLessThan(fast.efficiency);
  });

  it('FR-473.3: 불만 많은 서비스 quality 하락', () => {
    const ai = new PublicServicePerformanceAi();
    const bad = ai.evaluate(
      mk('S4', { satisfactionScore: 2, complaintsPer1000: 30 }),
    );
    expect(bad.quality).toBeLessThan(50);
  });

  it('FR-473.4: 랭킹 내림차순', () => {
    const ai = new PublicServicePerformanceAi();
    const r = ai.rank([
      mk('A', { satisfactionScore: 2, avgProcessingDays: 20 }),
      mk('B'),
      mk('C', { satisfactionScore: 4.9, avgProcessingDays: 0.5 }),
    ]);
    expect(r[0]!.overall).toBeGreaterThanOrEqual(r[1]!.overall);
    expect(r[1]!.overall).toBeGreaterThanOrEqual(r[2]!.overall);
  });

  it('FR-473.5: audit 로그', () => {
    const ai = new PublicServicePerformanceAi();
    ai.evaluate(mk('A'));
    expect(ai.getAuditLog().length).toBeGreaterThan(0);
  });

  it('FR-473.6: C/S 차단', () => {
    const ai = new PublicServicePerformanceAi();
    expect(() => ai.evaluate(mk('A'), 'C')).toThrow(/N2SF_BLOCKED/);
  });
});
