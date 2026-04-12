// MTU-N380 시맨틱 캐시 엣지 테스트
import { describe, it, expect } from 'vitest';
import { SemanticCacheEdgeService } from '../semantic-cache-edge.js';

describe('MTU-N380 SemanticCacheEdge', () => {
  const svc = new SemanticCacheEdgeService('tenant-n380', 0.9);

  it('FR-N380.1: 캐시 저장 및 유사 조회', () => {
    svc.set('hello world', [1, 0, 0], 'response-1');
    const hit = svc.get([1, 0, 0]);
    expect(hit).toBeDefined();
    expect(hit?.response).toBe('response-1');
  });

  it('FR-N380.2: 테넌트 격리', () => {
    const other = new SemanticCacheEdgeService('tenant-n380-other', 0.9);
    other.set('secret', [0, 1, 0], 'secret-resp');
    const miss = svc.get([0, 1, 0]);
    expect(miss).toBeUndefined();
  });

  it('FR-N380.3: LRU 축출', () => {
    for (let i = 0; i < 5; i++) svc.set(`p${i}`, [i, 0, 0], `r${i}`);
    const evicted = svc.evict(3);
    expect(evicted).toBeGreaterThan(0);
  });

  it('FR-N380.4: 감사 로그', () => {
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
