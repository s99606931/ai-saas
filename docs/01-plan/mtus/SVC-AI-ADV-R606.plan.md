# SVC-AI-ADV-R606 Plan — AI기반 자동 서비스 품질 보증 v3

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | SLA 위반 사전 탐지 및 품질 보증 자동화로 서비스 신뢰성 향상 |
| WHO | 서비스 품질 관리자, SRE |
| RISK | 오탐으로 인한 불필요한 에스컬레이션 방지 |
| SUCCESS | SC-R606-1: 품질 지표 수집 / SC-R606-2: SLA 위반 판단 / SC-R606-3: 에스컬레이션 |
| SCOPE | service-quality-assurance-v3.ts 구현 |

## 요구사항
- FR-R606.1: 입력 (serviceId, availability, responseTimeMs, errorRate, slaAvailability, slaResponseTimeMs, slaErrorRate)
- FR-R606.2: 각 항목 SLA 위반 여부 (availability < slaAvailability, responseTime > slaResponseTimeMs, errorRate > slaErrorRate)
- FR-R606.3: 위반 심각도 (3개 위반: CRITICAL, 2개: HIGH, 1개: MEDIUM, 0개: OK)
- FR-R606.4: 에스컬레이션 필요 = 심각도가 CRITICAL 또는 HIGH
- FR-R606.5: 감사 로그 전수 기록 (getAuditLog)

## 추적성
FR-R606.* ↔ `service-quality-assurance-v3.ts` ↔ 테스트 ↔ CSAP D-06
