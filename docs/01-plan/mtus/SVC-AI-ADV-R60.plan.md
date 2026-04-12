# SVC-AI-ADV-R60 — Federated RAG (분산 벡터스토어 연합 검색)

## Executive Summary

| 관점 | 내용 |
|------|------|
| **기술** | 다수 기관의 로컬 벡터스토어를 쿼리 단계에서 연합, 결과를 재랭킹하여 반환 |
| **보안** | 원본 문서는 로컬에 상주(데이터 주권), 임베딩·스코어만 교환 |
| **규제** | N2SF 데이터 잔류(Residency) + CSAP D-04 정보자산 관리 |
| **운영** | 기관별 성공/실패/지연 통계, 서킷브레이커 |

## Context Anchor

- **WHY**: 기관 간 문서 공유 없이도 공통 주제 검색을 통해 지식 재활용.
- **WHO**: 중앙 `ai-service`가 오케스트레이터, 기관 노드가 원격 vector search API 노출.
- **RISK**: 부분 실패 시 결과 편향 → 최소 성공 노드 임계값 + 실패율 기반 강등.
- **SUCCESS**: 3 노드 연합 검색 Top-10 병합 정확도 ≥ 로컬 단일 대비 +10%p.
- **SCOPE**: `federated-rag.ts` + 테스트.

## 기능 요구사항

| ID | 요구사항 | 검증 |
|----|---------|------|
| FR-R60.1 | 노드 등록/해제 | `registerNode/unregisterNode` |
| FR-R60.2 | 병렬 연합 검색 | 타임아웃·부분성공 |
| FR-R60.3 | 결과 재랭킹(RRF) | Reciprocal Rank Fusion |
| FR-R60.4 | 노드 서킷브레이커 | 실패율 > 50% → open |
| FR-R60.5 | 감사로그 / 데이터 등급 차단 | CSAP D-06 / N2SF |
| FR-R60.6 | 최소 성공 노드 보장 | `minNodes` 옵션 |

## 추적성 매트릭스

| FR | 함수 | 테스트 | CSAP |
|----|------|--------|------|
| FR-R60.1 | `registerNode` | `node-lifecycle` | D-04 |
| FR-R60.2 | `federatedSearch` | `parallel-search` | D-10 |
| FR-R60.3 | `rrfMerge` | `rrf-rerank` | - |
| FR-R60.4 | `tripBreaker` | `circuit-breaker` | D-11 |
| FR-R60.5 | `getAuditLog` | `audit-trail` | D-06 |
| FR-R60.6 | `enforceMinNodes` | `min-nodes` | - |
