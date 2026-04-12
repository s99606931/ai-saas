import { describe, it, expect, beforeEach } from 'vitest';
import {
  PromptCacheAwareRouter,
  type CacheNode,
} from '../prompt-cache-aware-router.js';

function node(id: string, load = 0, healthy = true): CacheNode {
  return { id, endpoint: `http://${id}`, load, healthy };
}

describe('PromptCacheAwareRouter 생성자', () => {
  it('기본 옵션 생성', () => {
    const r = new PromptCacheAwareRouter();
    expect(r.getCacheSize()).toBe(0);
  });

  it('잘못된 prefixLength 거부', () => {
    expect(() => new PromptCacheAwareRouter({ prefixLength: 0 })).toThrow('RC_INVALID_PREFIX');
  });

  it('잘못된 ttlMs 거부', () => {
    expect(() => new PromptCacheAwareRouter({ ttlMs: 0 })).toThrow('RC_INVALID_TTL');
  });
});

describe('registerNode', () => {
  it('노드 등록', () => {
    const r = new PromptCacheAwareRouter();
    r.registerNode(node('n1'));
    expect(r.listNodes().length).toBe(1);
  });

  it('unregister 시 연관 캐시도 제거', () => {
    const r = new PromptCacheAwareRouter();
    r.registerNode(node('n1'));
    r.route('t1', 'system prompt A\nUser query');
    expect(r.getCacheSize()).toBe(1);
    r.unregisterNode('n1');
    expect(r.getCacheSize()).toBe(0);
  });
});

describe('cacheKey (FR-R63.1)', () => {
  it('테넌트 분리', () => {
    const r = new PromptCacheAwareRouter();
    const k1 = r.cacheKey('t1', 'hello world');
    const k2 = r.cacheKey('t2', 'hello world');
    expect(k1).not.toBe(k2);
  });

  it('동일 테넌트+프롬프트 동일 키', () => {
    const r = new PromptCacheAwareRouter();
    const a = r.cacheKey('t1', 'same prompt content');
    const b = r.cacheKey('t1', 'same prompt content');
    expect(a).toBe(b);
  });

  it('빈 테넌트 거부', () => {
    const r = new PromptCacheAwareRouter();
    expect(() => r.cacheKey('', 'x')).toThrow('RC_TENANT_REQUIRED');
  });

  it('접두사 길이 내 차이 민감', () => {
    const r = new PromptCacheAwareRouter({ prefixLength: 10, ttlMs: 60000 });
    const a = r.cacheKey('t1', 'abcdefghij ZZZ');
    const b = r.cacheKey('t1', 'abcdefghij YYY');
    expect(a).toBe(b);  // 접두사가 같음
  });
});

describe('route (FR-R63.2)', () => {
  let r: PromptCacheAwareRouter;
  beforeEach(() => {
    r = new PromptCacheAwareRouter();
    r.registerNode(node('n1'));
    r.registerNode(node('n2'));
  });

  it('healthy 노드 없음 에러', () => {
    const r2 = new PromptCacheAwareRouter();
    r2.registerNode(node('bad', 0, false));
    expect(() => r2.route('t1', 'q')).toThrow('RC_NO_HEALTHY_NODE');
  });

  it('첫 호출은 miss', () => {
    const res = r.route('t1', 'prompt A');
    expect(res.cacheHit).toBe(false);
    const m = r.getMetrics();
    expect(m.misses).toBe(1);
  });

  it('두 번째 동일 요청은 hit', () => {
    const a = r.route('t1', 'system prompt X');
    const b = r.route('t1', 'system prompt X');
    expect(a.nodeId).toBe(b.nodeId);
    expect(b.cacheHit).toBe(true);
  });

  it('sticky — 동일 키 동일 노드', () => {
    const a = r.route('t1', 'unique content Z');
    const b = r.route('t1', 'unique content Z');
    expect(b.nodeId).toBe(a.nodeId);
  });

  it('load 최소 노드 선택', () => {
    const r2 = new PromptCacheAwareRouter();
    r2.registerNode(node('heavy', 100));
    r2.registerNode(node('light', 1));
    const res = r2.route('t1', 'new query');
    expect(res.nodeId).toBe('light');
  });
});

describe('invalidate (FR-R63.3)', () => {
  it('개별 키 무효화', () => {
    const r = new PromptCacheAwareRouter();
    r.registerNode(node('n1'));
    const res = r.route('t1', 'x');
    expect(r.invalidate(res.key)).toBe(true);
    expect(r.getCacheSize()).toBe(0);
  });

  it('테넌트 전체 무효화', () => {
    const r = new PromptCacheAwareRouter();
    r.registerNode(node('n1'));
    r.route('t1', 'a');
    r.route('t1', 'b');
    r.route('t2', 'c');
    expect(r.invalidateTenant('t1')).toBe(2);
    expect(r.getCacheSize()).toBe(1);
  });

  it('TTL 만료', async () => {
    const r = new PromptCacheAwareRouter({ ttlMs: 20 });
    r.registerNode(node('n1'));
    r.route('t1', 'x');
    await new Promise((res) => setTimeout(res, 40));
    r.route('t1', 'y');  // evictExpired 트리거
    const log = r.getAuditLog();
    expect(log.some((e) => e.action === 'EVICT_EXPIRED')).toBe(true);
  });
});

describe('getMetrics (FR-R63.4)', () => {
  it('hit rate 계산', () => {
    const r = new PromptCacheAwareRouter();
    r.registerNode(node('n1'));
    r.route('t1', 'a');  // miss
    r.route('t1', 'a');  // hit
    r.route('t1', 'a');  // hit
    const m = r.getMetrics();
    expect(m.hitRate).toBeCloseTo(2 / 3, 2);
    expect(m.savedTokens).toBeGreaterThan(0);
  });
});

describe('enforceDataGrade (FR-R63.5)', () => {
  it('C/S 차단', () => {
    const r = new PromptCacheAwareRouter();
    expect(() => r.enforceDataGrade('C')).toThrow('BLOCKED');
    expect(() => r.enforceDataGrade('S')).toThrow('BLOCKED');
  });

  it('route에 grade=C 전달 시 차단', () => {
    const r = new PromptCacheAwareRouter();
    r.registerNode(node('n1'));
    expect(() => r.route('t1', 'x', 'C')).toThrow('BLOCKED');
  });
});

describe('getAuditLog (FR-R63.6)', () => {
  it('route 동작 기록', () => {
    const r = new PromptCacheAwareRouter();
    r.registerNode(node('n1'));
    r.route('t1', 'x');
    r.route('t1', 'x');
    const log = r.getAuditLog();
    expect(log.some((e) => e.action === 'ROUTE_MISS')).toBe(true);
    expect(log.some((e) => e.action === 'ROUTE_HIT')).toBe(true);
  });
});
