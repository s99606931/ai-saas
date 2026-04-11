# SVC-AI-ADV-R5 DESIGN: Knowledge Graph RAG

> Plan 참조: docs/01-plan/mtus/SVC-AI-ADV-R5.plan.md

## 아키텍처: 옵션 B (순수 TypeScript 인메모리 그래프) 선택

## §1. 엔티티/관계 추출 (knowledge-graph-extractor.ts)
- LLM에게 문서에서 엔티티+관계 JSON 추출 지시
- 엔티티 타입: law(법령), article(조문), organization(기관), policy(정책), concept(개념)
- 관계 타입: references(참조), amends(개정), supersedes(대체), parent_of(상위), related_to(관련)

## §2. 인메모리 지식 그래프 (knowledge-graph.ts)
- 노드: {id, type, name, metadata, documentId}
- 엣지: {source, target, relation, weight}
- 테넌트별 그래프 분리 (LRU 캐시)
- 그래프 탐색: BFS로 N-hop 관련 노드 탐색

## §3. Graph-Enhanced RAG
- 기존 하이브리드 검색 결과에서 엔티티 매칭
- 매칭된 엔티티의 1~2hop 관련 노드에서 추가 문서 검색
- 기존 검색 결과 + 그래프 확장 결과 합산

## §4. API: POST /ai/rag/query/graph

## 구현 순서
1. knowledge-graph.ts (그래프 자료구조)
2. knowledge-graph-extractor.ts (LLM 엔티티/관계 추출)
3. rag-engine.ts 확장 (Graph-Enhanced RAG)
