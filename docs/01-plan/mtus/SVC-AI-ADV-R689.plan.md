# SVC-AI-ADV-R689 Plan — AI기반 용량 예측 자동화 v3

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 시계열 사용률 기반 N주 후 용량 부족 자동 예측 |
| WHO | SRE팀, FinOps팀 |
| RISK | N2SF C/S 차단 (인프라 메트릭) |
| SUCCESS | FR-R689.1~5 모두 충족, ≥5 Vitest 통과 |
| SCOPE | platform/services/ai-service/src/lib/ai-capacity-forecaster-v3.ts |

## 기능 요구사항
| ID | 요구사항 |
|----|---------|
| FR-R689.1 | `forecast(samples, weeksAhead, threshold, grade?)` C/S→BLOCKED |
| FR-R689.2 | 선형 회귀 기울기 = (last3avg − first3avg) / max(1,n−3) |
| FR-R689.3 | 예측값 = last + slope × weeksAhead |
| FR-R689.4 | 판정: predicted≥threshold EXPAND / predicted≥threshold×0.8 WATCH / HEALTHY |
| FR-R689.5 | `getAuditLog()` append-only (FORECAST) |

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-c |
