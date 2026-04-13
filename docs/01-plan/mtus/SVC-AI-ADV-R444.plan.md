# SVC-AI-ADV-R444 Plan — 공공 부동산 평가 AI

## Executive Summary
| 관점 | 내용 |
|------|------|
| WHY | 공시지가 자동 산정 + 비교 사례 분석 |
| WHO | 국토부, 지방자치단체 평가사 |
| WHAT | 대상 토지 특성 → 공시가격 제안 |
| HOW | 유사사례 가중평균 + 특성 보정 |

## Context Anchor
- WHY: 평가 일관성 확보
- WHO: 감정평가사
- RISK: 외부 요인 미반영 → 보정계수 활용
- SUCCESS: 비교사례 3건 이상 시 95% 신뢰
- SCOPE: `public-real-estate-appraiser-ai.ts`

## 요구사항
- FR-444.1: Target = { area, use: 'residential'|'commercial'|'land', year }
- FR-444.2: Comparable = { area, use, year, price } 리스트
- FR-444.3: 동일 use 사례만 사용; 없으면 오류
- FR-444.4: price/area 단가 → 가중평균(최신 연도 가중) → target.area * unitAvg
- FR-444.5: N2SF C/S 차단 + `getAuditLog()`

## 추적성
FR-444.* ↔ `public-real-estate-appraiser-ai.ts` ↔ 테스트 ↔ CSAP D-06 N2SF N-05
