# SVC-AI-ADV-R465 Plan — 인프라 장애 예측기

## Executive Summary
| 관점 | 내용 |
|------|------|
| WHY | 교량·터널·상하수도 장애를 사전 예측하여 사고 예방 |
| WHO | 국토교통부, 시설물 유지관리과 |
| WHAT | 센서 측정값 + 내구 연수 → 장애 확률 + 우선 점검 순위 |
| HOW | 경과 연수·균열 지수·진동·부식 가중합 |

## Context Anchor
- WHY: 사후 대응의 한계를 예측 모델로 보완
- WHO: 시설 점검팀
- RISK: 과대 예측 → 임계값 명확화
- SUCCESS: 위험 시설 식별 재현율 ≥ 90%
- SCOPE: `predictive-infrastructure-failure.ts`

## 요구사항
- FR-465.1: `Facility = { id, type: 'bridge'|'tunnel'|'water', ageYears, crackIndex: 0..1, vibration: 0..1, corrosion: 0..1 }`
- FR-465.2: `predict(facility)` → `{ id, failureProbability: 0..1, riskLevel: 'low'|'mid'|'high', inspectionPriority: 1..5 }`
- FR-465.3: probability = 0.3·(age/50) + 0.3·crackIndex + 0.2·vibration + 0.2·corrosion (clamp 0..1)
- FR-465.4: probability ≥ 0.75 high, ≥ 0.5 mid, else low
- FR-465.5: high → priority 1, mid → 3, low → 5
- FR-465.6: N2SF C/S 차단 + `getAuditLog()`

## 추적성
FR-465.* ↔ `predictive-infrastructure-failure.ts` ↔ 테스트 ↔ CSAP D-06 N2SF N-05
