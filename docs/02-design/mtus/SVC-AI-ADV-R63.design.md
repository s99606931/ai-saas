# SVC-AI-ADV-R63 — Prompt Cache-Aware Router Design

## 아키텍처 옵션

| 옵션 | 장점 | 단점 |
|------|------|------|
| A. 랜덤 라우팅 | 단순 | 캐시 hit 낮음 |
| **B. Consistent hash sticky (선택)** | 높은 hit rate | 노드 증감 시 재분배 |
| C. 중앙 캐시 서버 | 공유율 최대 | SPOF |

## 모듈 구조

```
PromptCacheAwareRouter
 ├─ registerNode(node)
 ├─ cacheKey(tenantId, prefix) → string
 ├─ route(tenantId, prompt) → RoutedNode
 ├─ invalidate(key)
 ├─ getMetrics() → Metrics
 ├─ enforceDataGrade(grade)
 └─ getAuditLog()
```

## 데이터 구조

```typescript
interface CacheNode { id: string; load: number; cachedKeys: Set<string>; }
interface RoutedNode { nodeId: string; cacheHit: boolean; key: string; }
interface CacheMetrics { hits: number; misses: number; hitRate: number; savedTokens: number; }
```

## 실행 흐름

1. 프롬프트 접두사 N(기본 512) 토큰 해시화
2. `tenantId::prefixHash` 로 cacheKey 산출
3. 이 키를 보유한 노드 우선 라우팅 (sticky)
4. miss 시 load 최소 노드 선택 → 새 캐시 키 등록
5. TTL 만료/수동 `invalidate` 시 제거
6. C/S 등급 요청은 항상 BLOCKED

## Design Anchor

- Plan FR-R63.1~6 전 항목 반영
- CSAP D-08/D-09/D-06, N2SF N-05 매핑
