# SVC-AI-ADV-R63 — Prompt Cache-Aware Router

## Executive Summary

| 관점 | 내용 |
|------|------|
| **기술** | 프롬프트 접두사 캐시 재사용률을 극대화하는 요청 라우팅·배치 |
| **보안** | 캐시 키에 테넌트·권한 포함, 크로스테넌트 유출 방지 |
| **규제** | CSAP D-08/D-09, N2SF N-01 |
| **운영** | 캐시 hit rate, 비용 절감 메트릭 |

## Context Anchor

- **WHY**: LLM 호출의 큰 비용은 반복되는 공통 시스템 프롬프트 토큰. 캐시 재사용으로 최대 75% 절감.
- **WHO**: `onprem-llm-router`·`speculative-router` 하류에서 호출.
- **RISK**: 테넌트 간 프롬프트 혼선 → 테넌트 해시를 키에 포함.
- **SUCCESS**: 캐시 hit rate ≥ 60%, 평균 토큰당 비용 ≥ 40% 감소.
- **SCOPE**: `prompt-cache-aware-router.ts` + 테스트.

## 기능 요구사항

| ID | 요구사항 | 검증 |
|----|---------|------|
| FR-R63.1 | 프롬프트 접두사 해시 + 테넌트 바인딩 | `cacheKey()` |
| FR-R63.2 | 캐시 노드 선택(sticky routing) | `route()` |
| FR-R63.3 | 캐시 무효화(TTL/수동) | `invalidate()` |
| FR-R63.4 | hit/miss/비용 메트릭 | `getMetrics()` |
| FR-R63.5 | N2SF 등급 차단 | N-05 |
| FR-R63.6 | 감사 로그 | D-06 |

## 추적성 매트릭스

| FR | 함수 | 테스트 | CSAP |
|----|------|--------|------|
| FR-R63.1 | `cacheKey` | `cache-key` | D-09 |
| FR-R63.2 | `route` | `sticky-route` | - |
| FR-R63.3 | `invalidate` | `invalidate` | - |
| FR-R63.4 | `getMetrics` | `metrics` | - |
| FR-R63.5 | `enforceDataGrade` | `n2sf-block` | N2SF |
| FR-R63.6 | `getAuditLog` | `audit` | D-06 |
