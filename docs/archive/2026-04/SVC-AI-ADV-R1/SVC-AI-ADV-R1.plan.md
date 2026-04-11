# SVC-AI-ADV-R1: Advanced RAG — 하이브리드 검색 + Reranking

> 버전: 1.0.0 | 작성일: 2026-04-11 | 작성자: PM Lead

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-11 | 초안 작성 | PM Lead |

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 공공기관 RAG 검색 정확도를 70%→90%+ 수준으로 향상, 키워드+시맨틱 하이브리드 검색으로 법령/규정 등 정확한 용어 매칭 보장 |
| 기술 | BM25 + 벡터 검색 RRF 융합, LLM 기반 Cross-encoder Reranking, 쿼리 확장, 컨텍스트 압축 |
| 보안 | N2SF O등급 데이터만 처리, PII 마스킹 유지, CSAP D-12 입력 검증 |
| 운영 | 기존 RAG API 확장 (하위 호환), 검색 품질 메트릭 수집 |

---

## Context Anchor

### WHY
기존 RAG 엔진은 순수 시맨틱 검색만 지원하여 공공기관 특유의 법령번호, 조문번호, 기관 고유명사 등 정확한 키워드 매칭이 부족합니다. 2026년 최신 RAG 아키텍처는 BM25 키워드 검색 + 시맨틱 검색을 Reciprocal Rank Fusion으로 결합하고, Cross-encoder Reranking으로 정밀도를 높이는 것이 표준입니다.

### WHO
- 공공기관 민원 담당자: 법령/규정 기반 정확한 답변 필요
- 정책 분석관: 특정 조문/정책번호 검색 필요
- 시스템 관리자: 검색 품질 모니터링

### RISK
- BM25 인덱스 메모리 사용량 증가 (완화: 테넌트별 인덱스 크기 제한)
- Reranking 추가 LLM 호출 비용 (완화: 상위 N개만 rerank)
- 쿼리 확장 시 환각 쿼리 생성 가능 (완화: 원본 쿼리 항상 포함)

### SUCCESS
- SC-1: BM25 + 시맨틱 하이브리드 검색 구현 (RRF 융합)
- SC-2: LLM 기반 Cross-encoder Reranking 구현
- SC-3: 쿼리 확장 (LLM 쿼리 재작성 + 다중 검색)
- SC-4: 컨텍스트 압축 (관련 구절만 추출)
- SC-5: 부모-자식 청크 계층 참조 추적
- SC-6: 기존 RAG API 하위 호환 유지

### SCOPE
- 포함: hybrid-retriever.ts, reranker.ts, query-expander.ts, 기존 rag-engine.ts 확장
- 제외: pgvector 마이그레이션 (별도 MTU), UI 변경

---

## 기능 요구사항

| ID | 요구사항 | 우선순위 | 검증 방법 |
|----|---------|---------|----------|
| FR-ADV1.1 | BM25 키워드 검색 엔진 구현 (한국어 형태소 기반 토큰화) | 필수 | 단위 테스트 |
| FR-ADV1.2 | Reciprocal Rank Fusion으로 BM25+시맨틱 결과 융합 (k=60) | 필수 | 단위 테스트 |
| FR-ADV1.3 | LLM 기반 Cross-encoder Reranking (상위 20개→5개 정밀 선별) | 필수 | 단위 테스트 |
| FR-ADV1.4 | LLM 쿼리 확장 (원본+재작성 쿼리 2~3개 다중 검색) | 필수 | 단위 테스트 |
| FR-ADV1.5 | 컨텍스트 압축 (청크에서 질문 관련 구절만 추출) | 중요 | 단위 테스트 |
| FR-ADV1.6 | 부모-자식 청크 계층 구조 (세분화 청크 검색→부모 컨텍스트 반환) | 중요 | 단위 테스트 |
| FR-ADV1.7 | 하이브리드 RAG API 엔드포인트 (기존 /ai/rag/query 확장) | 필수 | 통합 테스트 |

## 비기능 요구사항

| ID | 요구사항 |
|----|---------|
| NFR-1 | 하이브리드 검색 응답시간 < 3초 (10만 청크 기준) |
| NFR-2 | Reranking 추가 레이턴시 < 2초 |
| NFR-3 | N2SF O등급 데이터만 처리, PII 마스킹 유지 |
| NFR-4 | 테넌트 격리 (BM25 인덱스도 테넌트별 분리) |

---

## 추적성 매트릭스

| FR ID | 설계 섹션 | 구현 파일 | 테스트 | CSAP |
|-------|----------|----------|--------|------|
| FR-ADV1.1 | DESIGN §1 | src/lib/hybrid-retriever.ts | TBD | D-12 |
| FR-ADV1.2 | DESIGN §1 | src/lib/hybrid-retriever.ts | TBD | D-12 |
| FR-ADV1.3 | DESIGN §2 | src/lib/reranker.ts | TBD | D-12 |
| FR-ADV1.4 | DESIGN §3 | src/lib/query-expander.ts | TBD | D-12, N-05 |
| FR-ADV1.5 | DESIGN §4 | src/lib/reranker.ts | TBD | D-12 |
| FR-ADV1.6 | DESIGN §5 | src/lib/chunker.ts (확장) | TBD | D-12 |
| FR-ADV1.7 | DESIGN §6 | src/handlers/ai-rag.handler.ts (확장) | TBD | D-08, D-12 |

---

## 산출물 목록

| 산출물 | 경로 | 유형 |
|--------|------|------|
| 하이브리드 검색기 | src/lib/hybrid-retriever.ts | 코드 |
| Reranker | src/lib/reranker.ts | 코드 |
| 쿼리 확장기 | src/lib/query-expander.ts | 코드 |
| 청크 계층 확장 | src/lib/chunker.ts (확장) | 코드 |
| RAG 핸들러 확장 | src/handlers/ai-rag.handler.ts (확장) | 코드 |
| Design 문서 | docs/02-design/mtus/SVC-AI-ADV-R1.design.md | 문서 |
