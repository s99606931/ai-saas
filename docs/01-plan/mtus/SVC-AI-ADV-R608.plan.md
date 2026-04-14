# SVC-AI-ADV-R608 Plan — AI기반 클라우드 리소스 이상 탐지 v2

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 클라우드 리소스 비정상 사용을 탐지하여 보안 사고 및 비용 낭비 방지 |
| WHO | 클라우드 운영팀, 보안 담당자 |
| RISK | 정상 사용을 이상으로 오탐하는 경우 방지 |
| SUCCESS | SC-R608-1: 리소스 수집 / SC-R608-2: 이상 탐지 / SC-R608-3: 대응 권고 |
| SCOPE | cloud-resource-anomaly-detector-v2.ts 구현 |

## 요구사항
- FR-R608.1: 입력 (accountId, resources: {resourceId, type, cpuUsage, networkEgressGB, unusualAccessCount}[])
- FR-R608.2: 각 리소스 이상 (cpuUsage>95: CPU_SPIKE, networkEgressGB>100: DATA_EXFIL, unusualAccessCount>50: INTRUSION, else NORMAL)
- FR-R608.3: 심각도 (DATA_EXFIL||INTRUSION: CRITICAL, CPU_SPIKE: HIGH, NORMAL: OK)
- FR-R608.4: 즉시 대응 필요 = CRITICAL 리소스 존재
- FR-R608.5: 감사 로그 전수 기록 (getAuditLog)

## 추적성
FR-R608.* ↔ `cloud-resource-anomaly-detector-v2.ts` ↔ 테스트 ↔ CSAP D-06
