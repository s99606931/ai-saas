import { describe, it, expect, beforeEach } from 'vitest';
import { MultitenantResourceIsolationVerifier } from '../multitenant-resource-isolation-verifier';

describe('MultitenantResourceIsolationVerifier', () => {
  let verifier: MultitenantResourceIsolationVerifier;

  beforeEach(() => {
    verifier = new MultitenantResourceIsolationVerifier();
  });

  it('테넌트를 등록한다', () => {
    verifier.registerTenant('t1', 'Tenant A', { cpu: 80, memory: 4096, storage: 100 });
    const logs = verifier.getAuditLog();
    expect(logs.some(l => l.action === 'REGISTER_TENANT')).toBe(true);
  });

  it('리소스 사용량을 기록한다', () => {
    verifier.registerTenant('t1', 'A', { cpu: 80, memory: 4096, storage: 100 });
    verifier.recordUsage('t1', 'cpu', 50);
    expect(verifier.getAuditLog().some(l => l.action === 'RECORD_USAGE')).toBe(true);
  });

  it('할당량 초과를 탐지한다', () => {
    verifier.registerTenant('t1', 'A', { cpu: 80, memory: 4096, storage: 100 });
    verifier.recordUsage('t1', 'cpu', 90);
    const violations = verifier.checkQuotaViolations('t1');
    expect(violations.length).toBe(1);
    expect(violations[0]!.resourceType).toBe('cpu');
    expect(violations[0]!.overagePercent).toBeGreaterThan(0);
  });

  it('할당량 이내면 위반 없다', () => {
    verifier.registerTenant('t1', 'A', { cpu: 80, memory: 4096, storage: 100 });
    verifier.recordUsage('t1', 'cpu', 70);
    const violations = verifier.checkQuotaViolations('t1');
    expect(violations.length).toBe(0);
  });

  it('전체 격리 검증: 모두 정상이면 isolationHealthy=true', () => {
    verifier.registerTenant('t1', 'A', { cpu: 100, memory: 8192, storage: 200 });
    verifier.registerTenant('t2', 'B', { cpu: 100, memory: 8192, storage: 200 });
    verifier.recordUsage('t1', 'cpu', 50);
    verifier.recordUsage('t2', 'cpu', 60);
    const report = verifier.verifyIsolation();
    expect(report.isolationHealthy).toBe(true);
  });

  it('위반 테넌트 있으면 isolationHealthy=false', () => {
    verifier.registerTenant('t1', 'A', { cpu: 50, memory: 1024, storage: 10 });
    verifier.recordUsage('t1', 'cpu', 80);
    const report = verifier.verifyIsolation();
    expect(report.isolationHealthy).toBe(false);
    expect(report.violations.length).toBeGreaterThan(0);
  });

  it('C등급 데이터 전송을 차단한다', () => {
    verifier.registerTenant('t1', 'A', { cpu: 80, memory: 4096, storage: 100 });
    expect(() => verifier.recordUsage('t1', 'cpu', 50, 'C' as never)).toThrow('BLOCKED');
  });

  it('미등록 테넌트 사용량 기록 시 오류를 던진다', () => {
    expect(() => verifier.recordUsage('unknown', 'cpu', 50)).toThrow('테넌트 미등록');
  });
});
