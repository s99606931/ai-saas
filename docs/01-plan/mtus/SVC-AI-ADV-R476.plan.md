# SVC-AI-ADV-R476 Plan — AI기반 서비스 용량 예측 v2

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 서비스 트래픽 추이를 분석해 필요 용량을 사전에 예측하여 과부하 방지 |
| WHO | 인프라 운영팀, SRE |
| RISK | 용량 부족으로 인한 서비스 장애 방지 필요 |
| SUCCESS | SC-R476-1: 메트릭 수집 / SC-R476-2: 추세 예측 / SC-R476-3: 권고 용량 산출 |
| SCOPE | service-capacity-predictor-v2.ts 구현 |

## 요구사항
- FR-R476.1: 메트릭 입력 (serviceId, cpuUsage, memUsage, requestRate, window: 'day'|'week'|'month')
- FR-R476.2: 성장률 계산 (requestRate 기반 선형 외삽)
- FR-R476.3: 권고 용량 = 현재 × (1 + 성장률 × 1.2 안전 마진)
- FR-R476.4: 상태 분류 (cpu>80||mem>80: OVERLOADED, >60: WARNING, else HEALTHY)
- FR-R476.5: 감사 로그 전수 기록 (getAuditLog)

## 추적성
FR-R476.* ↔ `service-capacity-predictor-v2.ts` ↔ 테스트 ↔ CSAP D-06
