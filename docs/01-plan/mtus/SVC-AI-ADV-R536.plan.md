# SVC-AI-ADV-R536 Plan — budget-planning-assistant-v2.ts
## 요구사항
FR-R536.1: 예산 항목 등록 (itemId, name, category, allocatedAmount)
FR-R536.2: 지출 기록 (itemId, spentAmount, dataGrade?)
FR-R536.3: 집행률 조회 (getExecutionRate) — spentAmount/allocatedAmount*100
FR-R536.4: 초과 예산 항목 조회 (getOverBudgetItems) — spentAmount > allocatedAmount
FR-R536.5: 감사 로그 조회 (getAuditLog)
## 성공 기준
SC-R536.1: N2SF N-05 C/S 등급 차단
SC-R536.2: CSAP D-06 감사 로그 append-only
