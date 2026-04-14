# SVC-AI-ADV-R607 (v3) Plan — AI기반 예산 최적화 v3

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 예산 항목별 집행률·우선순위 분석으로 잔여 예산 재배분 권고 |
| WHO | 재정 담당, 사업 운영팀 |
| RISK | 우선순위 잘못 산정으로 인한 예산 낭비 방지 |
| SUCCESS | SC-R607v3-1: 집행률 / SC-R607v3-2: 재배분 / SC-R607v3-3: 감사 |
| SCOPE | budget-optimization-ai-v3.ts 구현 (트랙 A 22차) |

## 기능 요구사항
- FR-R607v3.1: 입력 (items: {id, allocated, spent, priority: 'HIGH'|'MEDIUM'|'LOW'}[])
- FR-R607v3.2: utilization = spent/allocated (allocated=0 → 0)
- FR-R607v3.3: 권고
  - utilization < 0.5 && priority='LOW' → REDUCE
  - utilization > 0.9 && priority='HIGH' → INCREASE
  - else → HOLD
- FR-R607v3.4: totalSpent, totalAllocated, overallUtilization
- FR-R607v3.5: 감사 로그

## 추적성
FR-R607v3.* ↔ `budget-optimization-ai-v3.ts` ↔ 테스트 ↔ 행안부 재정관리 지침
