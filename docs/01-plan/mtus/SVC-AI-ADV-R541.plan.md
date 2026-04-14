# SVC-AI-ADV-R541 Plan — 실시간 비용 이상 탐지 v2

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 클라우드/서비스 비용 이상 급증을 실시간 탐지하여 예산 초과 방지 |
| WHO | 재정 담당자, 인프라 운영팀 |
| RISK | 오탐으로 인한 서비스 중단 방지 |
| SUCCESS | SC-R541-1: 비용 수집 / SC-R541-2: 이상 탐지 / SC-R541-3: 경보 생성 |
| SCOPE | realtime-cost-anomaly-detector-v2.ts 구현 |

## 요구사항
- FR-R541.1: 입력 (serviceId, date, actualCost, budgetedCost, prevMonthCost)
- FR-R541.2: 이상 여부 = actualCost > budgetedCost*1.2 OR actualCost > prevMonthCost*1.5
- FR-R541.3: 심각도 (actualCost > budgetedCost*2: CRITICAL, > budgetedCost*1.5: HIGH, > budgetedCost*1.2: MEDIUM, else NORMAL)
- FR-R541.4: 초과율 = (actualCost - budgetedCost) / budgetedCost * 100 (소수점 2자리)
- FR-R541.5: 감사 로그 전수 기록 (getAuditLog)

## 추적성
FR-R541.* ↔ `realtime-cost-anomaly-detector-v2.ts` ↔ 테스트 ↔ CSAP D-06
