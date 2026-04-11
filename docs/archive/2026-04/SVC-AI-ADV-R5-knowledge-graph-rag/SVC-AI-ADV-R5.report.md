# SVC-AI-ADV-R5 REPORT: Knowledge Graph RAG

> 작성일: 2026-04-11 | matchRate: 100% (5/5 FR)

## FR 추적성

| FR ID | 구현 파일 | 상태 |
|-------|----------|------|
| FR-ADV5.1 | knowledge-graph-extractor.ts: extractEntitiesAndRelations, ruleBasedExtraction | PASS |
| FR-ADV5.2 | knowledge-graph-extractor.ts: 관계 추출 (LLM + 규칙 기반) | PASS |
| FR-ADV5.3 | knowledge-graph.ts: KnowledgeGraph 클래스 (노드/엣지/BFS) | PASS |
| FR-ADV5.4 | knowledge-graph.ts: explore() BFS N-hop 탐색, linkEntities() | PASS |
| FR-ADV5.5 | knowledge-graph-extractor.ts: addToKnowledgeGraph | PASS |

## 산출물

| 산출물 | 경로 |
|--------|------|
| 지식 그래프 엔진 | platform/services/ai-service/src/lib/knowledge-graph.ts |
| 엔티티/관계 추출기 | platform/services/ai-service/src/lib/knowledge-graph-extractor.ts |
