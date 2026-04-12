# SVC-AI-ADV-R65 — AI 위기 대응 플레이북

> 2026-04-12 | v1.0.0 | PM Lead (4차 세션)

## Executive Summary
| 관점 | 목표 | 지표 |
|---|---|---|
| 비즈니스 | 인시던트 자동 대응 체계 | MTTR 50% 단축 |
| 기술 | 플레이북 매칭 + 자동 실행 + 인간 승인 게이트 | 플레이북 10개+ |
| 보안 | 자동 실행 권한 엄격 통제 | RBAC 필수 |
| 규정 | 모든 대응 활동 audit 기록 | 100% |

## Context Anchor
- WHY: 보안 사고/장애 발생 시 수작업 대응 지연 → 피해 확대
- WHO: SRE, SOC, 보안 담당, 감리
- RISK: 오탐에 의한 자동 조치 오류, 권한 오남용
- SUCCESS: 주요 시나리오 10개 플레이북화, 자동화율 50%
- SCOPE: IN - 플레이북 매칭/실행/감사 / OUT - ML 기반 신규 플레이북 생성

## FR
| FR | 제목 | 산출물 |
|---|---|---|
| FR-R65.1 | 플레이북 매칭 (시그널 → 시나리오) | crisis-response-engine.ts |
| FR-R65.2 | 단계별 실행 + 승인 게이트 | incident-playbook.ts |
| FR-R65.3 | 감사 로그 + 실행 이력 | crisis-response-engine.ts |

## 추적성
| FR | 산출물 | CSAP |
|---|---|---|
| FR-R65.1 | crisis-response-engine.ts | D-06 |
| FR-R65.2 | incident-playbook.ts | D-08 (RBAC) |
| FR-R65.3 | crisis-response-engine.ts | D-06 |
