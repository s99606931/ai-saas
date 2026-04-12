# SVC-AI-ADV-R5: Knowledge Graph RAG -- 지식 그래프 기반 관계형 검색
<!-- 통합: R2~R4 내용 포함됨, 2026-04-11 -->
<!-- R2: Plan-Execute + 에이전트 메모리 (FR-ADV2.1~2.6) -->
<!-- R3: AI Safety & Guardrails (FR-ADV3.1~3.5) -->
<!-- R4: Structured Tool Use / Function Calling (FR-ADV4.1~4.5) -->
<!-- 구버전 파일 이동 위치: docs/archive/2026-04/SVC-AI-ADV-legacy/ -->

> 버전: 1.0.0 | 작성일: 2026-04-11 | 작성자: PM Lead

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 공공기관 법령/규정/조문 간 관계(참조, 개정, 상위법/하위법)를 그래프로 모델링하여 맥락적 검색 품질 향상 |
| 기술 | 엔티티 추출 + 관계 추출 → 인메모리 지식 그래프 → 그래프 기반 컨텍스트 확장 → RAG 품질 향상 |
| 보안 | N2SF O등급, PII 마스킹, 그래프 데이터 테넌트 격리 |

## 기능 요구사항

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-ADV5.1 | LLM 기반 엔티티 추출 (법령명, 조문번호, 기관명, 정책명) | 필수 |
| FR-ADV5.2 | LLM 기반 관계 추출 (참조, 개정, 폐지, 상위/하위) | 필수 |
| FR-ADV5.3 | 인메모리 지식 그래프 (노드: 엔티티, 엣지: 관계) | 필수 |
| FR-ADV5.4 | 그래프 기반 컨텍스트 확장: 검색 결과의 관련 노드 탐색 | 중요 |
| FR-ADV5.5 | Knowledge Graph RAG API (/ai/rag/query/graph) | 필수 |
