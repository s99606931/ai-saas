# SVC-AI-ADV-R555 Plan — service-productivity-analyzer-ai.ts
## 요구사항
FR-R555.1: 서비스 등록 (serviceId, name, teamSize)
FR-R555.2: 생산성 메트릭 기록 (serviceId, requestsHandled, defectsFixed, dataGrade?)
FR-R555.3: 생산성 점수 조회 (getProductivityScore) — (requestsHandled + defectsFixed*2) / teamSize
FR-R555.4: 저생산성 서비스 조회 (getLowProductivityServices) — score < 10
FR-R555.5: 감사 로그 조회 (getAuditLog)
## 성공 기준
SC-R555.1: N2SF N-05 C/S 등급 차단 / SC-R555.2: CSAP D-06 감사 로그
