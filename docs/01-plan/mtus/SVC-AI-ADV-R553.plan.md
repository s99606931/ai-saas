# SVC-AI-ADV-R553 Plan — performance-management-automator-v2.ts
## 요구사항
FR-R553.1: 성과 목표 등록 (goalId, name, targetScore, period)
FR-R553.2: 평가 기록 (goalId, evaluatorId, score, dataGrade?)
FR-R553.3: 달성 여부 조회 (isAchieved) — avgScore >= targetScore
FR-R553.4: 미달성 목표 조회 (getUnachievedGoals)
FR-R553.5: 감사 로그 조회 (getAuditLog)
## 성공 기준
SC-R553.1: N2SF N-05 C/S 등급 차단 / SC-R553.2: CSAP D-06 감사 로그 / SC-R553.3: PII 마스킹 (evaluatorId)
