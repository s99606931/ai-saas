# SVC-AI-ADV-R451 Plan — 교통 혼잡 예측 AI

## Executive Summary
| 관점 | 내용 |
|------|------|
| WHY | 교차로/도로별 혼잡 사전 예측으로 신호·우회 정책 수립 |
| WHO | 도로교통공단, 시/도 교통정책과 |
| WHAT | 시간/날씨/이벤트 → 혼잡 레벨 |
| HOW | 기준 교통량 + 보정 계수 (시간대·날씨·이벤트) |

## Context Anchor
- WHY: 교통 혼잡으로 인한 사회적 비용 저감
- WHO: 교통 정책 담당자
- RISK: 예측 오류 → 기준치 보수 설정
- SUCCESS: 피크 시간 탐지율 100%
- SCOPE: `traffic-congestion-predictor-ai.ts`

## 요구사항
- FR-451.1: Input = { roadId, baseVolume, hour:0-23, weather:'clear'|'rain'|'snow', event:boolean }
- FR-451.2: 시간 계수 — 7-9/17-19 = 1.6, 10-16 = 1.0, 기타 = 0.5
- FR-451.3: 날씨 계수 — clear=1.0, rain=1.2, snow=1.5
- FR-451.4: 이벤트 시 +0.3 추가
- FR-451.5: predicted = base * hourF * weatherF * (1 + eventBonus)
- FR-451.6: level — ≥2.0배 HIGH, ≥1.3배 MED, else LOW
- FR-451.7: N2SF C/S 차단 + `getAuditLog()`

## 추적성
FR-451.* ↔ `traffic-congestion-predictor-ai.ts` ↔ 테스트 ↔ CSAP D-06 N2SF N-05
