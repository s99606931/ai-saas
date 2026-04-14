# SVC-AI-ADV-R647 Design — AI기반 정책 영향 시뮬레이터 v2

## Executive Summary
| 관점 | 내용 |
|------|------|
| 기능 | Plan FR-R647.1~5 구현 |
| 보안 | N2SF N-05 C/S 차단, CSAP D-06 감사 로그 |
| 품질 | TypeScript strict, Vitest 5+ |
| 범위 | platform/services/ai-service/src/lib/policy-impact-simulator-v2.ts |

## 설계 결정
- `PolicyImpactSimulatorV2` 클래스
- `simulate(scenario, grade)`: C/S 차단
- projectedBeneficiaries = baseBeneficiaries × (1 + elasticity × delta)
- projectedCost = baseCost × (1 + costElasticity × delta)
- sideEffectScore = |delta|×50 + |costDelta|×30 (0~100 clamp)
- recommendation: <40 PROCEED / <70 REVIEW / 그 외 REJECT

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-c |
