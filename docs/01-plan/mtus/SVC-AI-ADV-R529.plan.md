# SVC-AI-ADV-R529 Plan — service-continuity-assurer-ai.ts
## 요구사항
FR-R529.1: 서비스 등록 (serviceId, name, rto, rpo)
FR-R529.2: 장애 이벤트 기록 (serviceId, duration, impact, dataGrade?)
FR-R529.3: 연속성 점수 조회 (getContinuityScore) — max(0, 100 - totalDowntime/rto*50 - impact*10)
FR-R529.4: 위험 서비스 조회 (getAtRiskServices) — score < 60
FR-R529.5: 감사 로그 조회 (getAuditLog)
## 성공 기준
SC-R529.1: N2SF N-05 C/S 등급 차단
SC-R529.2: CSAP D-06 감사 로그 append-only
