# SVC-AI-ADV-R573 Plan — AI기반 서비스 비용 이상 탐지 v4

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 다중 서비스 비용을 통합 분석하여 이상 비용 패턴 조기 탐지 |
| WHO | 재정 담당자, FinOps 팀 |
| RISK | 오탐으로 인한 정상 지출 차단 방지 |
| SUCCESS | SC-R573-1: 비용 수집 / SC-R573-2: 이상 탐지 / SC-R573-3: 최적화 권고 |
| SCOPE | service-cost-anomaly-detector-v4.ts 구현 |

## 요구사항
- FR-R573.1: 입력 (tenantId, services: {serviceId, currentCost, baseline, category}[])
- FR-R573.2: 각 서비스 이상 여부 = currentCost > baseline * 1.3
- FR-R573.3: 이상 서비스 목록 + 초과율 = (currentCost-baseline)/baseline*100 (소수점 1자리)
- FR-R573.4: 전체 상태 (이상서비스 비율>0.5: CRITICAL, >0.2: WARNING, else NORMAL)
- FR-R573.5: 감사 로그 전수 기록 (getAuditLog)

## 추적성
FR-R573.* ↔ `service-cost-anomaly-detector-v4.ts` ↔ 테스트 ↔ CSAP D-06
