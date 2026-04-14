# SVC-AI-ADV-R612 Design — AI기반 인프라 비용 예측 v3

## Executive Summary
| 관점 | 내용 |
|------|------|
| 기능 | Plan FR-R612.1~5 구현 |
| 보안 | N2SF N-05 C/S 차단, CSAP D-06 감사 로그 |
| 품질 | TypeScript strict, Vitest 5+개 |
| 범위 | platform/services/ai-service/src/lib/ |

## 설계 결정
- 간단 선형회귀 slope*x + intercept 계산 후 다음 월(n+1) 예측
- 샘플 2개 미만 시 마지막 값 그대로 반환
- 예측>예산×1.1 → OVER_BUDGET / >×0.9 → WARNING / OK
- 음수 예측은 0으로 클램프

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-b |
