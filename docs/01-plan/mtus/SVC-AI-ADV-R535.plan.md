# SVC-AI-ADV-R535 Plan — failure-pattern-learner-v2.ts
## 요구사항
FR-R535.1: 장애 패턴 등록 (patternId, name, indicators[])
FR-R535.2: 장애 발생 기록 (patternId, serviceId, severity, dataGrade?)
FR-R535.3: 패턴 발생 빈도 조회 (getPatternFrequency)
FR-R535.4: 고빈도 패턴 조회 (getHighFrequencyPatterns) — frequency >= threshold
FR-R535.5: 감사 로그 조회 (getAuditLog)
## 성공 기준
SC-R535.1: N2SF N-05 C/S 등급 차단
SC-R535.2: CSAP D-06 감사 로그 append-only
