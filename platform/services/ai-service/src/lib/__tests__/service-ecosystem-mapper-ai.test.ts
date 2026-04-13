import { describe, it, expect, beforeEach } from 'vitest';
import { ServiceEcosystemMapperAI } from '../service-ecosystem-mapper-ai';

describe('ServiceEcosystemMapperAI', () => {
  let mapper: ServiceEcosystemMapperAI;

  beforeEach(() => {
    mapper = new ServiceEcosystemMapperAI();
  });

  it('노드를 등록한다', () => {
    mapper.registerNode('svc-auth', 'AuthService', 'api');
    expect(mapper.getAuditLog().some(l => l.action === 'REGISTER_NODE')).toBe(true);
  });

  it('엣지를 추가한다', () => {
    mapper.registerNode('svc-a', 'A', 'api');
    mapper.registerNode('svc-b', 'B', 'api');
    mapper.addEdge('svc-a', 'svc-b', 2);
    expect(mapper.getAuditLog().some(l => l.action === 'ADD_EDGE')).toBe(true);
  });

  it('이웃 서비스를 조회한다', () => {
    mapper.registerNode('svc-a', 'A', 'api');
    mapper.registerNode('svc-b', 'B', 'api');
    mapper.registerNode('svc-c', 'C', 'api');
    mapper.addEdge('svc-a', 'svc-b');
    mapper.addEdge('svc-a', 'svc-c');
    const neighbors = mapper.getNeighbors('svc-a');
    expect(neighbors.length).toBe(2);
    expect(neighbors.some(n => n.id === 'svc-b')).toBe(true);
  });

  it('핵심 서비스를 degree 기준으로 반환한다', () => {
    mapper.registerNode('hub', 'Hub', 'core');
    mapper.registerNode('a', 'A', 'api');
    mapper.registerNode('b', 'B', 'api');
    mapper.registerNode('c', 'C', 'api');
    mapper.addEdge('a', 'hub');
    mapper.addEdge('b', 'hub');
    mapper.addEdge('c', 'hub');
    const critical = mapper.getCriticalServices(1);
    expect(critical[0]!.id).toBe('hub');
    expect(critical[0]!.degree).toBeGreaterThan(0);
  });

  it('C등급 엣지 추가를 차단한다', () => {
    mapper.registerNode('svc-a', 'A', 'api');
    mapper.registerNode('svc-b', 'B', 'api');
    expect(() => mapper.addEdge('svc-a', 'svc-b', 1, 'C' as never)).toThrow('BLOCKED');
  });

  it('미등록 노드 엣지 추가 시 오류를 던진다', () => {
    mapper.registerNode('svc-a', 'A', 'api');
    expect(() => mapper.addEdge('svc-a', 'unknown')).toThrow('노드 미등록');
  });
});
