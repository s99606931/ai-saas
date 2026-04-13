# SVC-AI-ADV-R453 Plan — 예산 집행 심층 분석 v2

## Executive Summary
| 관점 | 내용 |
|------|------|
| WHY | 부서별/항목별 집행 효율 평가 + 이월/불용 경고 |
| WHO | 기획예산담당관, 재정기획관 |
| WHAT | 예산 집행 목록 → 부서별 효율 지표 |
| HOW | 집행률·소진도·편차 계산 |

## Context Anchor
- WHY: 예산 집행 관리 자동화
- WHO: 예산 담당자
- RISK: 집행률만으로 평가 불충분 → 편차 병행
- SUCCESS: 경고 3종 탐지율 100%
- SCOPE: `budget-execution-analyzer-v2.ts`

## 요구사항
- FR-453.1: Entry = { dept, item, allocated, spent, monthsElapsed, monthsTotal }
- FR-453.2: execRate = spent/allocated, expectedRate = monthsElapsed/monthsTotal
- FR-453.3: 경고 — execRate < expectedRate - 0.2 UNDER, > expectedRate + 0.2 OVER
- FR-453.4: 말기(monthsElapsed/monthsTotal ≥ 0.9) + execRate < 0.7 → CARRYOVER_RISK
- FR-453.5: 부서별 집계 = 평균 execRate + 경고 개수
- FR-453.6: N2SF C/S 차단 + `getAuditLog()`

## 추적성
FR-453.* ↔ `budget-execution-analyzer-v2.ts` ↔ 테스트 ↔ CSAP D-06 N2SF N-05
