import { describe, it, expect, beforeEach } from 'vitest';
import { SlaViolationPreventerAI } from '../sla-violation-preventer-ai';

describe('SlaViolationPreventerAI', () => {
  let preventer: SlaViolationPreventerAI;

  beforeEach(() => {
    preventer = new SlaViolationPreventerAI();
  });

  it('SLA를 등록한다', () => {
    preventer.registerSla('svc-1', '민원 API', 200, 99.9, 1.0);
    expect(preventer.getAuditLog().some(l => l.action === 'REGISTER_SLA')).toBe(true);
  });

  it('지표를 기록한다', () => {
    preventer.registerSla('svc-1', '민원 API', 200, 99.9, 1.0);
    preventer.recordMetrics('svc-1', 150, 99.95, 0.5);
    expect(preventer.getAuditLog().some(l => l.action === 'RECORD_METRICS')).toBe(true);
  });

  it('정상 지표에서 safe 위험 수준을 반환한다', () => {
    preventer.registerSla('svc-1', '민원 API', 200, 99.9, 1.0);
    preventer.recordMetrics('svc-1', 100, 99.95, 0.5);
    const result = preventer.getRiskLevel('svc-1');
    expect(result.riskLevel).toBe('safe');
    expect(result.violations.length).toBe(0);
  });

  it('응답시간 초과 시 critical을 반환한다', () => {
    preventer.registerSla('svc-1', '민원 API', 200, 99.9, 1.0);
    preventer.recordMetrics('svc-1', 500, 99.95, 0.5);
    const result = preventer.getRiskLevel('svc-1');
    expect(result.riskLevel).toBe('critical');
    expect(result.violations.length).toBeGreaterThan(0);
  });

  it('위험 서비스 목록을 반환한다', () => {
    preventer.registerSla('svc-1', 'OK API', 200, 99.9, 1.0);
    preventer.registerSla('svc-2', 'Bad API', 200, 99.9, 1.0);
    preventer.recordMetrics('svc-1', 100, 99.95, 0.5);
    preventer.recordMetrics('svc-2', 500, 90, 5.0);
    const atRisk = preventer.getAtRiskServices();
    expect(atRisk.some(r => r.serviceId === 'svc-2')).toBe(true);
    expect(atRisk.every(r => r.serviceId !== 'svc-1')).toBe(true);
  });

  it('C등급 지표 기록을 차단한다', () => {
    preventer.registerSla('svc-1', 'API', 200, 99.9, 1.0);
    expect(() => preventer.recordMetrics('svc-1', 100, 99.9, 0.5, 'C' as never)).toThrow('BLOCKED');
  });

  it('미등록 서비스 지표 기록 시 오류를 던진다', () => {
    expect(() => preventer.recordMetrics('unknown', 100, 99.9, 0.5)).toThrow('SLA 미등록');
  });
});
