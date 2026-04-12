// MTU-N339 상태 점검 오케스트레이터 테스트
import { describe, it, expect } from 'vitest';
import { HealthCheckOrchestratorService } from '../health-check-orchestrator.js';

describe('MTU-N339 HealthCheckOrchestrator', () => {
  const svc = new HealthCheckOrchestratorService('tenant-n339');

  it('FR-N339.1: 점검 대상 등록', () => {
    const t = svc.register('api', 'service', 'https://api.example.com/health', 30);
    expect(t).toBeDefined();
    expect(svc.targets().length).toBeGreaterThan(0);
  });

  it('FR-N339.2: 점검 시뮬레이션', () => {
    const t = svc.register('db', 'database', 'db.example.com:5432');
    const result = svc.check(t, 50, true);
    expect(result).toBeDefined();
  });

  it('FR-N339.3: 리포트 생성', () => {
    const t = svc.register('cache', 'cache', 'cache.example.com:6379');
    const result = svc.check(t, 10, true);
    const report = svc.report([result]);
    expect(report).toBeDefined();
  });

  it('FR-N339.6: 감사 로그', () => {
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
