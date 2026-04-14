# SVC-AI-ADV-R530 Plan — code-complexity-analyzer-v2.ts
## 요구사항
FR-R530.1: 코드 모듈 등록 (moduleId, name, language)
FR-R530.2: 복잡도 메트릭 기록 (moduleId, cyclomaticComplexity, linesOfCode, dataGrade?)
FR-R530.3: 복잡도 등급 조회 (getComplexityGrade) — >=20:high, >=10:medium, else low
FR-R530.4: 고복잡도 모듈 조회 (getHighComplexityModules) — grade=high
FR-R530.5: 감사 로그 조회 (getAuditLog)
## 성공 기준
SC-R530.1: N2SF N-05 C/S 등급 차단
SC-R530.2: CSAP D-06 감사 로그 append-only
