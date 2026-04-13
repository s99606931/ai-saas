# SVC-AI-ADV-R444 Plan — AI기반 실시간 서비스 건전성 예측 v2

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 서비스 이상 징후를 사전에 예측하여 선제적 대응 가능 |
| WHO | SRE 팀, 운영팀 |
| RISK | 오탐으로 인한 불필요한 알림 최소화 필요 |
| SUCCESS | SC-R444-1: 서비스 지표 등록 / SC-R444-2: 건전성 점수 계산 / SC-R444-3: C/S 등급 차단 |
| SCOPE | realtime-health-predictor-v2.ts 구현 |

## 요구사항
- FR-R444.1: 서비스 지표 등록 (serviceId, name, baselineScore)
- FR-R444.2: 건전성 지표 기록 (cpuUsage 0-100, memUsage 0-100, errorRate 0-100)
- FR-R444.3: 건전성 점수 계산 (100 - cpu*0.3 - mem*0.3 - errorRate*0.4, floor 0)
- FR-R444.4: 위험 서비스 조회 (healthScore < threshold)
- FR-R444.5: N2SF N-05 C/S 등급 차단

## 추적성
FR-R444.* ↔ `realtime-health-predictor-v2.ts` ↔ 테스트 ↔ CSAP D-06 N2SF N-05
