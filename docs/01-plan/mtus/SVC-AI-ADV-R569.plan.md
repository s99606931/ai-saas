# SVC-AI-ADV-R569 Plan — AI기반 공공기관 조달 자동화 v2

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 반복 조달 업무를 자동화하여 예산 집행 투명성 및 효율 향상 |
| WHO | 조달 담당 공무원, 구매 팀 |
| RISK | 자동 조달 오류로 인한 예산 낭비 방지 |
| SUCCESS | SC-R569-1: 조달 요청 분류 / SC-R569-2: 자동 승인 판단 / SC-R569-3: 조달 경로 결정 |
| SCOPE | public-procurement-automation-v2.ts 구현 |

## 요구사항
- FR-R569.1: 입력 (procurementId, itemCategory, estimatedAmount, vendorCount, isEmergency: boolean, budgetAvailable: number)
- FR-R569.2: 자동 승인 가능 (estimatedAmount <= budgetAvailable*0.1 && vendorCount>=3 && !isEmergency: true)
- FR-R569.3: 조달 방식 (isEmergency: EMERGENCY_PURCHASE, estimatedAmount>50000000: OPEN_BID, estimatedAmount>10000000: LIMITED_BID, else DIRECT_CONTRACT)
- FR-R569.4: 예산 여유율 = (budgetAvailable - estimatedAmount) / budgetAvailable * 100 (소수점 1자리)
- FR-R569.5: 감사 로그 전수 기록 (getAuditLog)

## 추적성
FR-R569.* ↔ `public-procurement-automation-v2.ts` ↔ 테스트 ↔ CSAP D-06
