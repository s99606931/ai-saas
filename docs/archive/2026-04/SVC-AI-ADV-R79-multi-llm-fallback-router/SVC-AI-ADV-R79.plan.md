# SVC-AI-ADV-R79 — Multi-LLM Fallback Router

> 2026-04-12 | v1.0.0 | PM Lead (8차 세션)

## Executive Summary
| 관점 | 목표 | 지표 |
|---|---|---|
| 비즈니스 | 여러 LLM 프로바이더 가용성·비용 최적화 | 가용성 99.9% |
| 기술 | 정책 기반 라우팅(우선순위/비용/레이턴시/서킷) | 선택 p95 < 5ms |
| 보안 | 시크릿 env 참조만 허용 + 등급 guard | CSAP D-09, N2SF N-05 |
| 규정 | 폴백 감사 | CSAP D-06 |

## Context Anchor
- **WHY**: 단일 LLM 공급자 장애/쿼터 초과 시 서비스 중단 위험. 비용·품질·레이턴시 정책에 따라 다중 프로바이더 간 폴백·라우팅이 필요.
- **WHO**: 플랫폼팀, AI Gateway
- **RISK**: 시크릿 하드코딩, 무한 폴백 루프, 비용 폭증
- **SUCCESS**: 폴백 성공률 ≥ 99%, 시크릿 하드코딩 0건
- **SCOPE**: IN — 프로바이더 등록/정책/폴백 체인/서킷/비용 집계 / OUT — 실제 HTTP 호출

## FR
| FR | 제목 | 산출물 |
|---|---|---|
| FR-R79.1 | 프로바이더 등록(id/envKey/비용/우선순위) + 시크릿 하드코딩 차단 | multi-llm-fallback-router.ts |
| FR-R79.2 | 라우팅 정책(cost/priority/latency) + 체인 빌드 | multi-llm-fallback-router.ts |
| FR-R79.3 | 폴백 실행 + 서킷 브레이커(연속 실패 3회 open) + half-open | multi-llm-fallback-router.ts |
| FR-R79.4 | 호출 집계(provider별 성공/실패/비용 누계) + 리포트 | multi-llm-fallback-router.ts |
| FR-R79.5 | getAuditLog + 이벤트 (REGISTER/ROUTE/FALLBACK/CIRCUIT_OPEN/BLOCKED) | multi-llm-fallback-router.ts |

## 추적성
| FR | 산출물 | 테스트 | CSAP |
|---|---|---|---|
| FR-R79.1 | multi-llm-fallback-router.ts | multi-llm-fallback-router.test.ts | D-09 |
| FR-R79.2 | multi-llm-fallback-router.ts | multi-llm-fallback-router.test.ts | - |
| FR-R79.3 | multi-llm-fallback-router.ts | multi-llm-fallback-router.test.ts | - |
| FR-R79.4 | multi-llm-fallback-router.ts | multi-llm-fallback-router.test.ts | - |
| FR-R79.5 | multi-llm-fallback-router.ts | multi-llm-fallback-router.test.ts | D-06 |
