# SVC-CACHE-R30 DESIGN: Cache Manager 라이브러리

> 버전: 1.0.0 | 작성일: 2026-04-12 | 작성자: PM Lead
> Plan 참조: docs/01-plan/mtus/SVC-CACHE-R30.plan.md

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-12 | 초안 작성 | PM Lead |

---

## LRU 알고리즘

```
get(key):
  → 존재 + TTL 유효 → 항목을 리스트 앞으로 이동, 값 반환 (HIT)
  → 존재 + TTL 만료 → 삭제, undefined 반환 (MISS)
  → 미존재 → undefined 반환 (MISS)

set(key, value, ttlMs?):
  → 이미 존재 → 값 갱신, 리스트 앞으로 이동
  → 미존재 + 크기 < maxSize → 추가
  → 미존재 + 크기 >= maxSize → LRU 항목(리스트 끝) 제거 후 추가 (EVICT)
```

구현: Map 순서 보존 특성 활용. get 시 delete+set으로 순서 갱신.

---

## 주요 인터페이스

```typescript
interface CacheOptions {
  maxSize: number;         // 최대 항목 수 (기본: 1000)
  defaultTtlMs: number;   // 기본 TTL (밀리초, 기본: 300000 = 5분)
  namespace?: string;      // 키 네임스페이스 (테넌트 격리)
}

interface CacheMetrics {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
}

interface CacheManager<V> {
  get(key: string): V | undefined;
  set(key: string, value: V, ttlMs?: number): void;
  delete(key: string): boolean;
  has(key: string): boolean;
  clear(): void;
  getOrSet(key: string, loader: () => V | Promise<V>, ttlMs?: number): Promise<V>;
  getMetrics(): CacheMetrics;
}
```

---

## Session Guide

### 구현 순서
1. `src/cache-manager.ts` -- 코어 LRU 캐시
2. `src/index.ts` -- 패키지 엔트리포인트
3. `tests/cache-manager.test.ts` -- 단위 테스트

### Design Anchor
- 모든 구현 파일 상단: `// Design Ref: SVC-CACHE-R30 DESIGN`
- 모든 함수: `// Plan SC: FR-CM.{번호}`
