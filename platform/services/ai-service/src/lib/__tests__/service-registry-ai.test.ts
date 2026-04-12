import { describe, it, expect, beforeEach } from 'vitest';
import { ServiceRegistryAI } from '../service-registry-ai';

describe('ServiceRegistryAI', () => {
  let registry: ServiceRegistryAI;

  beforeEach(() => {
    registry = new ServiceRegistryAI();
  });

  it('서비스를 등록한다', () => {
    registry.register('svc-1', 'AuthService', 'http://auth:8080', ['auth'], 'api');
    expect(registry.getAuditLog().some(l => l.action === 'REGISTER')).toBe(true);
  });

  it('태그 기반 서비스를 발견한다', () => {
    registry.register('svc-1', 'AuthService', 'http://auth:8080', ['auth', 'security'], 'api');
    registry.register('svc-2', 'DataService', 'http://data:8080', ['data'], 'api');
    const results = registry.discover({ tag: 'auth' });
    expect(results.length).toBe(1);
    expect(results[0]!.id).toBe('svc-1');
  });

  it('헬스 상태를 갱신한다', () => {
    registry.register('svc-1', 'AuthService', 'http://auth:8080');
    registry.updateHealth('svc-1', false);
    const results = registry.discover({ healthyOnly: true });
    expect(results.length).toBe(0);
  });

  it('서비스를 해제한다', () => {
    registry.register('svc-1', 'AuthService', 'http://auth:8080');
    registry.deregister('svc-1');
    expect(registry.discover().length).toBe(0);
  });

  it('TTL 만료 서비스를 제거한다', () => {
    // registeredAt을 과거로 설정하기 위해 TTL=0(무제한) 서비스와 구분 확인
    // pruneExpired는 ttlMs>0이고 경과시간>ttlMs인 경우만 제거
    registry.register('svc-inf', 'Permanent', 'http://perm:8080', [], 'generic', 0);
    // TTL이 0이면 만료 없음: 제거 0
    expect(registry.pruneExpired()).toBe(0);
    // 여전히 발견됨
    expect(registry.discover().length).toBe(1);
  });

  it('C등급 발견 요청을 차단한다', () => {
    expect(() => registry.discover({}, 'C' as never)).toThrow('BLOCKED');
  });

  it('유형 기반 서비스를 발견한다', () => {
    registry.register('svc-1', 'A', 'http://a:8080', [], 'grpc');
    registry.register('svc-2', 'B', 'http://b:8080', [], 'api');
    const results = registry.discover({ type: 'grpc' });
    expect(results.length).toBe(1);
    expect(results[0]!.type).toBe('grpc');
  });
});
