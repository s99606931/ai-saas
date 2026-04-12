// MTU-N353 배포 추적 테스트
import { describe, it, expect } from 'vitest';
import { DeploymentTrackerService } from '../deployment-tracker.js';

describe('MTU-N353 DeploymentTracker', () => {
  const svc = new DeploymentTrackerService('tenant-n353');

  it('FR-N353.1: 배포 기록', () => {
    const dep = svc.record('api', 'v1.0.0', 'prod', ['feat: add user API'], 'alice');
    expect(dep).toBeDefined();
  });

  it('FR-N353.2: 배포 목록', () => {
    svc.record('web', 'v2.0.0', 'prod', ['fix: styles'], 'bob');
    const list = svc.list('web');
    expect(list.length).toBeGreaterThan(0);
  });

  it('FR-N353.3: 배포 비교', () => {
    const a = svc.record('svc', 'v1', 'staging', ['change a'], 'dev');
    const b = svc.record('svc', 'v2', 'staging', ['change b'], 'dev');
    const diffs = svc.compare(a, b);
    expect(Array.isArray(diffs)).toBe(true);
  });

  it('FR-N353.6: 감사 로그', () => {
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
