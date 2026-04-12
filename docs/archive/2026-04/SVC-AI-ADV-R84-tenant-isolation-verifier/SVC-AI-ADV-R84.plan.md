# SVC-AI-ADV-R84 — AI 멀티테넌트 격리 검증기

> v1.0.0 | 2026-04-12 | PM Lead (5차 세션)

## Executive Summary
| 관점 | 목표 | 지표 |
|---|---|---|
| 비즈니스 | 테넌트 교차 데이터 접근 0건 | 위반율 = 0 |
| 기술 | 런타임 접근 검증 + 자동 차단 | 검증 p95 < 1ms |
| 보안 | CSAP 다중 테넌트 격리 | D-08, D-12 |
| 규정 | 위반 감사 추적 | D-06 |

## Context Anchor
- **WHY**: 공공기관 SaaS에서 여러 기관 테넌트가 공용 인프라 사용 시 데이터 교차 접근은 절대 금지. 기존 `multitenant-rls.ts`(DB 수준 RLS)와 보완적으로, 서비스 레이어에서 자원별 tenantId 검증을 수행하는 **경량 검증기**가 필요.
- **WHO**: API 게이트웨이, 서비스 레이어, 감사팀
- **RISK**: 검증 누락, 성능 저하
- **SUCCESS**: 위반 탐지율 100%, 지연 ≤ 1ms
- **SCOPE**: IN — 자원 등록/접근 검증/위반 차단/감사 / OUT — DB RLS 대체

## FR
| FR | 제목 | 산출물 |
|---|---|---|
| FR-R84.1 | 자원 등록(resourceId, ownerTenantId) | tenant-isolation-verifier.ts |
| FR-R84.2 | 접근 검증(actorTenantId == ownerTenantId) | 동일 |
| FR-R84.3 | 위반 시 차단 예외 + 감사 기록 | 동일 |
| FR-R84.4 | 공유 리소스(allowList) 예외 처리 | 동일 |
| FR-R84.5 | getAuditLog + REGISTER/ALLOW/DENY/SHARE | 동일 |

## 추적성
| FR | 산출물 | 테스트 | CSAP |
|---|---|---|---|
| R84.1~4 | tenant-isolation-verifier.ts | tenant-isolation-verifier.test.ts | D-08 |
| R84.5 | 동일 | 동일 | D-06 |
