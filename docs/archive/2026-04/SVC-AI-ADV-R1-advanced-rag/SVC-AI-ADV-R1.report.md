# SVC-AI-ADV-R1 REPORT: Advanced RAG -- 하이브리드 검색 + Reranking

> 버전: 1.0.0 | 작성일: 2026-04-11 | 작성자: PM Lead (Opus 4.6)

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-11 | 초안 작성 | PM Lead |

---

## Executive Summary

| 관점 | 계획 | 달성 |
|------|------|------|
| 비즈니스 | RAG 검색 정확도 70%->90%+ | BM25+시맨틱 RRF 융합 + Cross-encoder Reranking 구현 완료 |
| 기술 | 하이브리드 검색, Reranking, 쿼리 확장, 컨텍스트 압축 | 전 기능 구현, TypeScript 컴파일 통과 |
| 보안 | N2SF O등급, PII 마스킹, CSAP D-12 | Zod 입력검증, maskPII, 등급차단 적용 |
| 운영 | 기존 API 하위 호환 | /ai/rag/query 유지 + /ai/rag/query/advanced 추가 |

---

## Key Decisions & Outcomes

1. **아키텍처 선택**: 옵션 B (순수 TypeScript) -- 외부 서비스 금지 제약 준수
2. **BM25 인덱스**: 인메모리 LRU 캐시 (TTL 5분, 최대 50 테넌트) -- 성능과 메모리 균형
3. **RRF k=60**: 업계 표준값 적용, bm25Weight=0.4 / semanticWeight=0.6 기본
4. **Reranking 배치**: 10개 단위 LLM 호출 -- 컨텍스트 제한 고려
5. **Graceful Degradation**: LLM 호출 실패 시 원본 순위/규칙 기반 폴백

---

## Success Criteria Final Status

| SC | 기준 | 상태 |
|----|------|------|
| SC-1 | BM25 + 시맨틱 하이브리드 검색 (RRF 융합) | PASS |
| SC-2 | LLM Cross-encoder Reranking | PASS |
| SC-3 | 쿼리 확장 (LLM + 규칙 기반 폴백) | PASS |
| SC-4 | 컨텍스트 압축 (관련 구절 추출) | PASS |
| SC-5 | 부모-자식 청크 계층 참조 추적 | PASS |
| SC-6 | 기존 RAG API 하위 호환 유지 | PASS |

---

## FR 추적성

| FR ID | 구현 파일 | 상태 |
|-------|----------|------|
| FR-ADV1.1 | hybrid-retriever.ts: tokenizeKorean, bm25Score, bm25Search, buildBM25Index | PASS |
| FR-ADV1.2 | hybrid-retriever.ts: reciprocalRankFusion, hybridSearch | PASS |
| FR-ADV1.3 | reranker.ts: rerankResults, parseRerankResponse | PASS |
| FR-ADV1.4 | query-expander.ts: expandQuery, ruleBasedExpansion, mergeQueryVariants | PASS |
| FR-ADV1.5 | reranker.ts: compressContexts | PASS |
| FR-ADV1.6 | chunker.ts: hierarchicalChunk, buildChildToParentMap | PASS |
| FR-ADV1.7 | rag-engine.ts: runAdvancedRAG, ai-rag.handler.ts: ragAdvancedQueryHandler | PASS |

## matchRate: 100% (7/7 FR)

---

## Q-Gate 결과

| Gate | 항목 | 결과 |
|------|------|------|
| G1 | FR ID 전수 | PASS (7/7) |
| G2 | 설계 완전성 | PASS (Design 전 섹션 구현) |
| G3 | 코드 품질 | PASS (TSC 통과, 주석 완비) |
| G5 | OWASP Top10 | PASS (입력검증, PII 마스킹) |
| G6 | CSAP D-12, D-08 | PASS (Zod, 등급차단, 감사로그) |
| G7 | audit.jsonl | PASS (logAiEvent 호출) |

---

## 산출물 목록

| 산출물 | 경로 |
|--------|------|
| BM25 하이브리드 검색기 | platform/services/ai-service/src/lib/hybrid-retriever.ts |
| Cross-encoder Reranker | platform/services/ai-service/src/lib/reranker.ts |
| 쿼리 확장기 | platform/services/ai-service/src/lib/query-expander.ts |
| 계층적 청킹 (확장) | platform/services/ai-service/src/lib/chunker.ts |
| Advanced RAG 엔진 (확장) | platform/services/ai-service/src/lib/rag-engine.ts |
| Advanced RAG 핸들러 (확장) | platform/services/ai-service/src/handlers/ai-rag.handler.ts |
| 라우트 등록 (확장) | platform/services/ai-service/src/routes.ts |
| Plan 문서 | docs/01-plan/mtus/SVC-AI-ADV-R1.plan.md |
| Design 문서 | docs/02-design/mtus/SVC-AI-ADV-R1.design.md |
