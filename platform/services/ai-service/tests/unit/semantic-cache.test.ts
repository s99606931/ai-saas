// SVC-AI-ADV-R8 단위 테스트: 시맨틱 캐시
// Design Ref: SVC-AI-ADV-R8 DESIGN §1
// Plan SC: FR-ADV8.1, FR-ADV8.2, FR-ADV8.3, FR-ADV8.7, FR-ADV8.8
// CSAP: D-08, D-12

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// maskPII 모의
vi.mock('../../src/lib/pii-masking.js', () => ({
  maskPII: vi.fn((text: string) => text.replace(/\d{6}-\d{7}/g, '***-***')),
}));

import { SemanticCache, createSemanticCache } from '../../src/lib/semantic-cache.js';
import type { EmbedFunction, SemanticCacheConfig } from '../../src/lib/semantic-cache.js';

// ── 테스트 헬퍼 ─────────────────────────────────────────────────────────────

/**
 * 간단한 모의 임베딩 함수 — 문자열을 고정 벡터로 변환
 * 동일 문자열 → 동일 벡터 (코사인 유사도 1.0)
 * 유사 문자열 → 유사 벡터 (높은 유사도)
 */
function createMockEmbedFn(): EmbedFunction {
  return async (text: string): Promise<number[]> => {
    // 텍스트를 해시하여 128차원 벡터 생성
    const vector = new Array(128).fill(0);
    for (let i = 0; i < text.length; i++) {
      const idx = i % 128;
      vector[idx] = (vector[idx] as number) + text.charCodeAt(i) / 1000;
    }
    // 정규화
    const norm = Math.sqrt(vector.reduce((s: number, v: number) => s + v * v, 0));
    if (norm > 0) {
      for (let i = 0; i < vector.length; i++) {
        vector[i] = (vector[i] as number) / norm;
      }
    }
    return vector;
  };
}

// ── 테스트 ──────────────────────────────────────────────────────────────────

describe('SemanticCache 기본 동작 (FR-ADV8.1)', () => {
  let cache: SemanticCache;
  let embedFn: EmbedFunction;

  beforeEach(() => {
    embedFn = createMockEmbedFn();
    cache = new SemanticCache(embedFn, {
      similarityThreshold: 0.92,
      ttlMs: 60_000,
      maxEntries: 100,
      cleanupIntervalMs: 999_999, // 테스트 중 자동 정리 방지
    });
  });

  afterEach(() => {
    cache.dispose();
  });

  it('저장 후 동일 쿼리 조회 시 히트한다', async () => {
    await cache.store('주민등록 등본 발급 방법', '시청에 방문하시면 됩니다', 'tenant-1', 'sonnet');
    const result = await cache.lookup('주민등록 등본 발급 방법', 'tenant-1');
    expect(result.hit).toBe(true);
    expect(result.response).toBe('시청에 방문하시면 됩니다');
    expect(result.similarity).toBeDefined();
  });

  it('완전히 다른 쿼리는 미스한다', async () => {
    await cache.store('주민등록 등본 발급 방법', '시청에 방문하시면 됩니다', 'tenant-1', 'sonnet');
    const result = await cache.lookup('오늘 날씨가 어떤가요', 'tenant-1');
    expect(result.hit).toBe(false);
    expect(result.response).toBeUndefined();
  });

  it('빈 캐시에서 조회 시 미스한다', async () => {
    const result = await cache.lookup('테스트 쿼리', 'tenant-1');
    expect(result.hit).toBe(false);
  });

  it('히트 시 모델 정보를 반환한다', async () => {
    await cache.store('테스트 쿼리', '응답', 'tenant-1', 'haiku');
    const result = await cache.lookup('테스트 쿼리', 'tenant-1');
    expect(result.model).toBe('haiku');
  });
});

describe('SemanticCache 테넌트 격리 (FR-ADV8.8, CSAP D-08)', () => {
  let cache: SemanticCache;

  beforeEach(() => {
    cache = new SemanticCache(createMockEmbedFn(), {
      similarityThreshold: 0.92,
      ttlMs: 60_000,
      maxEntries: 100,
      cleanupIntervalMs: 999_999,
    });
  });

  afterEach(() => {
    cache.dispose();
  });

  it('다른 테넌트의 캐시에 접근할 수 없다', async () => {
    await cache.store('테스트 쿼리', '테넌트A 응답', 'tenant-A', 'sonnet');
    const result = await cache.lookup('테스트 쿼리', 'tenant-B');
    expect(result.hit).toBe(false);
  });

  it('동일 테넌트는 캐시에 접근할 수 있다', async () => {
    await cache.store('테스트 쿼리', '테넌트A 응답', 'tenant-A', 'sonnet');
    const result = await cache.lookup('테스트 쿼리', 'tenant-A');
    expect(result.hit).toBe(true);
  });
});

describe('SemanticCache TTL 만료 (FR-ADV8.3)', () => {
  it('TTL 만료된 엔트리는 조회되지 않는다', async () => {
    const cache = new SemanticCache(createMockEmbedFn(), {
      similarityThreshold: 0.92,
      ttlMs: 1, // 1ms TTL — 즉시 만료
      maxEntries: 100,
      cleanupIntervalMs: 999_999,
    });

    await cache.store('테스트', '응답', 'tenant-1', 'sonnet');
    // 약간 대기
    await new Promise((r) => setTimeout(r, 10));
    const result = await cache.lookup('테스트', 'tenant-1');
    expect(result.hit).toBe(false);

    cache.dispose();
  });
});

describe('SemanticCache LRU 제거 (FR-ADV8.3)', () => {
  it('최대 엔트리 초과 시 가장 오래된 항목을 제거한다', async () => {
    const cache = new SemanticCache(createMockEmbedFn(), {
      similarityThreshold: 0.92,
      ttlMs: 60_000,
      maxEntries: 2, // 최대 2개
      cleanupIntervalMs: 999_999,
    });

    await cache.store('쿼리1', '응답1', 'tenant-1', 'sonnet');
    await cache.store('쿼리2', '응답2', 'tenant-1', 'sonnet');
    await cache.store('쿼리3', '응답3', 'tenant-1', 'sonnet'); // 쿼리1 제거됨

    const stats = cache.getStats();
    expect(stats.totalEntries).toBe(2);

    cache.dispose();
  });
});

describe('SemanticCache 무효화 (FR-ADV8.7)', () => {
  let cache: SemanticCache;

  beforeEach(() => {
    cache = new SemanticCache(createMockEmbedFn(), {
      similarityThreshold: 0.92,
      ttlMs: 60_000,
      maxEntries: 100,
      cleanupIntervalMs: 999_999,
    });
  });

  afterEach(() => {
    cache.dispose();
  });

  it('테넌트 전체 캐시를 무효화한다', async () => {
    await cache.store('쿼리1', '응답1', 'tenant-1', 'sonnet');
    await cache.store('쿼리2', '응답2', 'tenant-1', 'sonnet');
    const deleted = cache.invalidate('tenant-1');
    expect(deleted).toBe(2);
    expect(cache.getStats().totalEntries).toBe(0);
  });

  it('다른 테넌트의 캐시는 영향받지 않는다', async () => {
    await cache.store('쿼리1', '응답1', 'tenant-1', 'sonnet');
    await cache.store('쿼리2', '응답2', 'tenant-2', 'sonnet');
    cache.invalidate('tenant-1');
    expect(cache.getStats().totalEntries).toBe(1);
  });

  it('clear로 전체 캐시를 초기화한다', async () => {
    await cache.store('쿼리1', '응답1', 'tenant-1', 'sonnet');
    await cache.store('쿼리2', '응답2', 'tenant-2', 'sonnet');
    cache.clear();
    expect(cache.getStats().totalEntries).toBe(0);
    expect(cache.getStats().totalLookups).toBe(0);
    expect(cache.getStats().totalHits).toBe(0);
  });
});

describe('SemanticCache 통계 (FR-ADV8.1)', () => {
  let cache: SemanticCache;

  beforeEach(() => {
    cache = new SemanticCache(createMockEmbedFn(), {
      similarityThreshold: 0.92,
      ttlMs: 60_000,
      maxEntries: 100,
      cleanupIntervalMs: 999_999,
    });
  });

  afterEach(() => {
    cache.dispose();
  });

  it('조회 수를 추적한다', async () => {
    await cache.store('쿼리1', '응답1', 'tenant-1', 'sonnet');
    await cache.lookup('쿼리1', 'tenant-1');
    await cache.lookup('다른 쿼리', 'tenant-1');
    expect(cache.getStats().totalLookups).toBe(2);
  });

  it('히트 수를 추적한다', async () => {
    await cache.store('쿼리1', '응답1', 'tenant-1', 'sonnet');
    await cache.lookup('쿼리1', 'tenant-1');
    expect(cache.getStats().totalHits).toBe(1);
  });

  it('히트율을 계산한다', async () => {
    await cache.store('쿼리1', '응답1', 'tenant-1', 'sonnet');
    await cache.lookup('쿼리1', 'tenant-1'); // hit
    await cache.lookup('전혀다른것', 'tenant-1'); // miss
    const stats = cache.getStats();
    expect(stats.hitRate).toBe(0.5);
  });

  it('테넌트별 엔트리 수를 추적한다', async () => {
    await cache.store('쿼리1', '응답1', 'tenant-1', 'sonnet');
    await cache.store('쿼리2', '응답2', 'tenant-1', 'sonnet');
    await cache.store('쿼리3', '응답3', 'tenant-2', 'sonnet');
    const stats = cache.getStats();
    expect(stats.entriesByTenant['tenant-1']).toBe(2);
    expect(stats.entriesByTenant['tenant-2']).toBe(1);
  });
});

describe('createSemanticCache 팩토리', () => {
  it('SemanticCache 인스턴스를 생성한다', () => {
    const cache = createSemanticCache(createMockEmbedFn());
    expect(cache).toBeInstanceOf(SemanticCache);
    cache.dispose();
  });
});
