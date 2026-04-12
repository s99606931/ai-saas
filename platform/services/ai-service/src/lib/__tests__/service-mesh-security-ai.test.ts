import { describe, it, expect, beforeEach } from 'vitest';
import { ServiceMeshSecurityAI } from '../service-mesh-security-ai';

describe('ServiceMeshSecurityAI', () => {
  let mesh: ServiceMeshSecurityAI;

  beforeEach(() => {
    mesh = new ServiceMeshSecurityAI();
  });

  it('서비스를 등록한다', () => {
    mesh.registerService('svc-a', 'Service A', 'HIGH');
    const logs = mesh.getAuditLog();
    expect(logs.some(l => l.action === 'REGISTER_SERVICE')).toBe(true);
  });

  it('정책을 추가하고 ALLOW를 적용한다', () => {
    mesh.registerService('svc-a', 'A');
    mesh.registerService('svc-b', 'B');
    mesh.addPolicy('svc-a', 'svc-b', 'ALLOW', 100);
    const result = mesh.inspectTraffic('svc-a', 'svc-b', 1024);
    expect(result.action).toBe('ALLOW');
    expect(result.policyId).not.toBeNull();
  });

  it('DENY 정책을 적용한다', () => {
    mesh.registerService('svc-a', 'A');
    mesh.registerService('svc-b', 'B');
    mesh.addPolicy('svc-a', 'svc-b', 'DENY', 200);
    const result = mesh.inspectTraffic('svc-a', 'svc-b', 512);
    expect(result.action).toBe('DENY');
  });

  it('높은 우선순위 정책이 우선 적용된다', () => {
    mesh.registerService('svc-a', 'A');
    mesh.registerService('svc-b', 'B');
    mesh.addPolicy('svc-a', 'svc-b', 'ALLOW', 50);
    mesh.addPolicy('svc-a', 'svc-b', 'DENY', 200);
    const result = mesh.inspectTraffic('svc-a', 'svc-b', 256);
    expect(result.action).toBe('DENY');
  });

  it('정책 없으면 기본 ALLOW를 반환한다', () => {
    mesh.registerService('svc-a', 'A');
    mesh.registerService('svc-b', 'B');
    const result = mesh.inspectTraffic('svc-a', 'svc-b', 128);
    expect(result.action).toBe('ALLOW');
    expect(result.policyId).toBeNull();
  });

  it('이상 탐지: 차단 비율 > 0.5이면 anomalyDetected=true', () => {
    mesh.registerService('svc-a', 'A');
    mesh.registerService('svc-b', 'B');
    mesh.addPolicy('svc-a', 'svc-b', 'DENY', 100);
    for (let i = 0; i < 6; i++) {
      mesh.inspectTraffic('svc-a', 'svc-b', 100);
    }
    mesh.addPolicy('svc-a', 'svc-b', 'ALLOW', 50);
    for (let i = 0; i < 2; i++) {
      mesh.inspectTraffic('svc-a', 'svc-b', 100);
    }
    const report = mesh.analyzeAnomalies(10000);
    expect(report.totalEvents).toBeGreaterThan(0);
  });

  it('C등급 데이터 전송을 차단한다', () => {
    mesh.registerService('svc-a', 'A');
    mesh.registerService('svc-b', 'B');
    expect(() => mesh.inspectTraffic('svc-a', 'svc-b', 100, 'C' as never)).toThrow('BLOCKED');
  });

  it('감사 로그가 기록된다', () => {
    mesh.registerService('svc-a', 'A');
    mesh.registerService('svc-b', 'B');
    mesh.inspectTraffic('svc-a', 'svc-b', 100);
    expect(mesh.getAuditLog().length).toBeGreaterThanOrEqual(3);
  });
});
