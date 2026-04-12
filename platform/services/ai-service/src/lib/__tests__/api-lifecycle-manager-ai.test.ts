import { describe, it, expect, beforeEach } from 'vitest';
import { ApiLifecycleManagerAI } from '../api-lifecycle-manager-ai';

describe('ApiLifecycleManagerAI', () => {
  let manager: ApiLifecycleManagerAI;

  beforeEach(() => {
    manager = new ApiLifecycleManagerAI();
  });

  it('API를 등록한다', () => {
    manager.registerApi('api-1', 'User API v1', '1.0', 'user-service', 'active');
    expect(manager.getAuditLog().some(l => l.action === 'REGISTER_API')).toBe(true);
  });

  it('상태를 deprecated로 전환한다', () => {
    manager.registerApi('api-1', 'User API v1', '1.0', 'user-service', 'active');
    manager.transitionStatus('api-1', 'deprecated', '2026-12-31');
    const deprecated = manager.getDeprecatedApis();
    expect(deprecated.length).toBe(1);
    expect(deprecated[0]!.id).toBe('api-1');
  });

  it('deprecated API의 잔여 일수를 계산한다', () => {
    manager.registerApi('api-1', 'User API v1', '1.0', 'user-service', 'active');
    manager.transitionStatus('api-1', 'deprecated', '2027-01-01');
    const deprecated = manager.getDeprecatedApis();
    expect(deprecated[0]!.daysUntilRetirement).toBeGreaterThan(0);
  });

  it('마이그레이션 대상을 추천한다', () => {
    manager.registerApi('api-v1', 'User API v1', '1.0', 'user-service', 'active');
    manager.registerApi('api-v2', 'User API v2', '2.0', 'user-service', 'active');
    manager.transitionStatus('api-v1', 'deprecated');
    const targets = manager.getMigrationTargets();
    expect(targets.length).toBeGreaterThan(0);
    expect(targets[0]!.fromApiId).toBe('api-v1');
    expect(targets[0]!.toApiId).toBe('api-v2');
  });

  it('C등급 상태 전환을 차단한다', () => {
    manager.registerApi('api-1', 'API', '1.0', 'svc', 'active');
    expect(() => manager.transitionStatus('api-1', 'deprecated', undefined, 'C' as never)).toThrow('BLOCKED');
  });

  it('미등록 API 전환 시 오류를 던진다', () => {
    expect(() => manager.transitionStatus('unknown', 'deprecated')).toThrow('API 미등록');
  });

  it('retired API는 immediate 긴급도로 추천된다', () => {
    manager.registerApi('api-v1', 'Old API', '1.0', 'svc', 'active');
    manager.registerApi('api-v2', 'New API', '2.0', 'svc', 'active');
    manager.transitionStatus('api-v1', 'retired');
    const targets = manager.getMigrationTargets();
    expect(targets.some(t => t.urgency === 'immediate')).toBe(true);
  });
});
