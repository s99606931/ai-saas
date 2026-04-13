# SVC-AI-ADV-R456 Plan — 지자체 부채 위험도 평가기

## Executive Summary
| 관점 | 내용 |
|------|------|
| WHY | 지방자치단체 부채 건전성 자동 평가 |
| WHO | 행안부, 지방재정 담당관 |
| WHAT | 재정지표 → 위험등급 |
| HOW | 3지표 가중합 + 임계값 |

## Context Anchor
- WHY: 지방 재정 위기 조기 경보
- WHO: 재정 담당관
- RISK: 단일 지표 오판 → 다지표 병행
- SUCCESS: 심각 등급 탐지율 100%
- SCOPE: `public-debt-risk-assessor.ts`

## 요구사항
- FR-456.1: Finance = { region, debtRatio, repaymentRatio, reserveRatio }
- FR-456.2: 가중치 — debtRatio 0.5, repaymentRatio 0.3, reserveRatio 0.2 (역수)
- FR-456.3: score = debtRatio*0.5 + repaymentRatio*0.3 + (1-reserveRatio)*0.2
- FR-456.4: 등급 — ≥0.7 CRITICAL, ≥0.5 WARNING, ≥0.3 CAUTION, else SAFE
- FR-456.5: 모든 지표 [0,1] 범위 검증
- FR-456.6: N2SF C/S 차단 + `getAuditLog()`

## 추적성
FR-456.* ↔ `public-debt-risk-assessor.ts` ↔ 테스트 ↔ CSAP D-06 N2SF N-05
