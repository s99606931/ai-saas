# SVC-AI-ADV-R479 Plan — AI기반 실시간 서비스 건강 지수 산출

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 여러 서비스 메트릭을 종합하여 단일 건강 지수를 산출해 운영 가시성 제공 |
| WHO | SRE, 서비스 운영팀 |
| RISK | 개별 메트릭 과다 알림으로 인한 알림 피로 방지 필요 |
| SUCCESS | SC-R479-1: 메트릭 수집 / SC-R479-2: 건강 지수 산출 / SC-R479-3: 등급 분류 |
| SCOPE | realtime-service-health-index-ai.ts 구현 |

## 요구사항
- FR-R479.1: 메트릭 입력 (serviceId, availability, latencyScore, errorScore, saturationScore) — 각 0~100
- FR-R479.2: 건강 지수 = availability*0.4 + latencyScore*0.3 + errorScore*0.2 + saturationScore*0.1
- FR-R479.3: 등급 분류 (>=90: EXCELLENT, >=75: GOOD, >=60: FAIR, else POOR)
- FR-R479.4: 최저 메트릭 식별 (개선 권고 대상)
- FR-R479.5: 감사 로그 전수 기록 (getAuditLog)

## 추적성
FR-R479.* ↔ `realtime-service-health-index-ai.ts` ↔ 테스트 ↔ CSAP D-06
