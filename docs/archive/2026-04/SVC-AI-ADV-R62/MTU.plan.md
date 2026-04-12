# SVC-AI-ADV-R62 — Retrieval Fallback Chain (BM25→Dense→Web→LLM)

## Executive Summary

| 관점 | 내용 |
|------|------|
| **기술** | 검색 품질 실패 시 다음 검색기로 순차 폴백, 각 단계 신뢰 점수 평가 |
| **보안** | Web/LLM 폴백 시 N2SF 등급 검사, C/S 등급은 항상 내부 BM25로 제한 |
| **규제** | CSAP D-12, N2SF N-04(외부 연동) |
| **운영** | 단계별 latency, hit-rate 메트릭 |

## Context Anchor

- **WHY**: 단일 검색기 실패 시 전체 RAG 품질 저하 방지.
- **WHO**: RAG 엔진이 `fallbackChain.search(query)` 호출.
- **RISK**: 체인 길어지면 응답 지연 → 전체 timeout 상한.
- **SUCCESS**: 검색 실패율 50% 감소, p95 latency < 2s.
- **SCOPE**: `retrieval-fallback-chain.ts` + 테스트.

## 기능 요구사항

| ID | 요구사항 | 검증 |
|----|---------|------|
| FR-R62.1 | 체인 등록 (BM25→Dense→Web→LLM) | `registerStage` |
| FR-R62.2 | 단계별 실행 + 품질 평가 | `search()` |
| FR-R62.3 | 품질 기준 미달 시 다음 단계 | `scoreThreshold` |
| FR-R62.4 | 전체 timeout | `maxTotalMs` |
| FR-R62.5 | N2SF 등급별 외부 단계 제한 | C/S → Web 금지 |
| FR-R62.6 | 감사 로그 | D-06 |

## 추적성 매트릭스

| FR | 함수 | 테스트 | CSAP |
|----|------|--------|------|
| FR-R62.1 | `registerStage` | `register-stage` | - |
| FR-R62.2 | `search` | `execute-chain` | - |
| FR-R62.3 | `evaluateQuality` | `quality-gate` | - |
| FR-R62.4 | `enforceTimeout` | `timeout` | - |
| FR-R62.5 | `restrictByGrade` | `grade-restrict` | N2SF |
| FR-R62.6 | `getAuditLog` | `audit` | D-06 |
