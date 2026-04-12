# SVC-AI-ADV-R133 — 조직 지식 그래프 (Design)

> 작성일: 2026-04-12 | Plan: SVC-AI-ADV-R133.plan.md

## 1. 아키텍처

```
addDocument(O등급만) → extractConcepts
      ↓
OrgKnowledgeGraph
  ├─ buildGraph() — 공동 출현 행렬 → 엣지 가중치
  ├─ findRelated() — 가중치 정렬 상위 N
  ├─ getClusters() — 연결 컴포넌트 기반 클러스터
  └─ getAuditLog() — append-only
```

## 2. 타입 정의

```typescript
export type DataGrade = 'C' | 'S' | 'O'
export interface KnowledgeDoc { docId: string; title: string; content: string }
export interface GraphEdge { from: string; to: string; weight: number }
export interface KnowledgeCluster { clusterId: string; concepts: string[]; size: number }
```

## 3. 알고리즘

### §3.1 개념 추출: 2글자+ 명사 토큰 (공백/구두점 분리)
### §3.2 공동 출현: 같은 문서 내 개념 쌍 → 동시 출현 횟수 집계
### §3.3 클러스터: Union-Find로 weight ≥ threshold인 엣지로 연결된 컴포넌트

## 4. Design Anchor

- N2SF N-05: C/S 등급 차단
- CSAP D-06: 처리 감사 로그
