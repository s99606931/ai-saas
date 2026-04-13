# SVC-AI-ADV-R437 Plan — Urban Plan Impact Analyzer AI

## Executive Summary
| 관점 | 내용 |
|------|------|
| WHY | 개발 계획이 교통/소음/일조에 미치는 영향 사전 분석 |
| WHO | 국토부, 지자체 도시계획과 |
| WHAT | 개발 규모 + 주변 환경 → 영향 점수 → 완화 권고 |
| HOW | 규모-기반 선형 모델 + 임계값 기반 권고 |

## Context Anchor
- WHY: 민원/소송 리스크 사전 예방
- WHO: 도시계획 심의위원
- RISK: 과소/과대 평가 → 결과 설명가능성 필수
- SUCCESS: 영향 3개 카테고리 평가 완비
- SCOPE: `urban-plan-impact-analyzer-ai.ts`

## 요구사항
- FR-437.1: trafficImpact = 0.01 * expectedVehicles
- FR-437.2: noiseImpact = 0.05 * heightMeters + 0.3 * (constructionMonths/12)
- FR-437.3: sunlightImpact = heightMeters / (distanceToNearestBuilding+1)
- FR-437.4: 각 impact > 0.7 → 'HIGH', 권고 목록 생성
- FR-437.5: N2SF C/S 차단 + `getAuditLog()`

## 추적성
FR-437.* ↔ `urban-plan-impact-analyzer-ai.ts` ↔ 테스트 ↔ CSAP D-06 N2SF N-05
