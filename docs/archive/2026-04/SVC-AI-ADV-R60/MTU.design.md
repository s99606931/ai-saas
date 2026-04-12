# SVC-AI-ADV-R60 — Federated RAG Design

## 아키텍처 옵션

| 옵션 | 장점 | 단점 |
|------|------|------|
| A. 중앙 인덱스 | 단순 | 데이터 주권 위반 |
| B. P2P Gossip | 확장성 | 구현 복잡 |
| **C. Hub-Spoke 연합 (선택)** | 단순·데이터 로컬 | 허브 장애 위험 → 서킷브레이커로 완화 |

## 모듈 구조

```
FederatedRAG
 ├─ registerNode(node)
 ├─ unregisterNode(nodeId)
 ├─ federatedSearch(query, opts) → Result[]
 ├─ rrfMerge(resultsByNode) → Result[]
 ├─ tripBreaker(nodeId)
 ├─ enforceDataGrade(grade)
 └─ getAuditLog()
```

## 데이터 구조

```typescript
interface FederatedNode {
  id: string;
  endpoint: string;
  weight: number;
  healthy: boolean;
}
interface FederatedResult {
  docId: string;
  score: number;
  sourceNode: string;
  snippet: string;
}
```

## 실행 흐름

1. `federatedSearch(query, {minNodes: 2, timeoutMs: 2000})`
2. healthy 노드 병렬 호출, 타임아웃 내 응답만 수집
3. minNodes 미달 → 에러
4. `rrfMerge()`로 Top-K 산출
5. 노드별 실패율 갱신 → 50% 초과 시 `tripBreaker`

## Design Anchor

- Plan FR-R60.1~6 전 항목 반영
- CSAP D-04/D-06/D-10/D-11, N2SF N-04 매핑
