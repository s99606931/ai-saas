import { describe, it, expect } from 'vitest';
import { ServiceDependencyMapperV3 } from '../service-dependency-mapper-v3.js';

describe('SVC-AI-ADV-R603 (v3) ServiceDependencyMapperV3', () => {
  it('FR-R603v3.1: 정점/간선 등록', () => {
    const svc = new ServiceDependencyMapperV3();
    const r = svc.build({
      services: ['a', 'b', 'c'],
      edges: [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'c' },
      ],
    });
    expect(r.totalServices).toBe(3);
    expect(r.totalEdges).toBe(2);
  });

  it('FR-R603v3.2: 자기 참조 간선 무시', () => {
    const svc = new ServiceDependencyMapperV3();
    const r = svc.build({
      services: ['a'],
      edges: [{ from: 'a', to: 'a' }],
    });
    expect(r.totalEdges).toBe(0);
  });

  it('FR-R603v3.3: BFS 영향 노드 집계', () => {
    const svc = new ServiceDependencyMapperV3();
    svc.build({
      services: ['a', 'b', 'c', 'd'],
      edges: [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'c' },
        { from: 'd', to: 'a' },
      ],
    });
    expect(svc.impactedBy('a')).toEqual(['b', 'c']);
  });

  it('FR-R603v3.4: 순환 탐지', () => {
    const svc = new ServiceDependencyMapperV3();
    const r = svc.build({
      services: ['a', 'b'],
      edges: [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'a' },
      ],
    });
    expect(r.hasCycles).toBe(true);
    expect(r.cycles.length).toBeGreaterThan(0);
  });

  it('FR-R603v3.4: 순환 없음', () => {
    const svc = new ServiceDependencyMapperV3();
    const r = svc.build({
      services: ['a', 'b'],
      edges: [{ from: 'a', to: 'b' }],
    });
    expect(r.hasCycles).toBe(false);
  });

  it('FR-R603v3.5: 감사 로그', () => {
    const svc = new ServiceDependencyMapperV3();
    svc.build({ services: ['a'], edges: [] });
    const log = svc.getAuditLog();
    expect(log).toHaveLength(1);
    expect(log[0]?.action).toBe('BUILD_GRAPH');
  });
});
