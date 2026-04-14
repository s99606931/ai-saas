# SVC-AI-ADV-R532 Plan — realtime-api-contract-validator-v2.ts
## 요구사항
FR-R532.1: API 계약 등록 (contractId, apiPath, expectedFields[]{name,type})
FR-R532.2: 응답 검증 (contractId, response{}, dataGrade?)
FR-R532.3: 검증 결과 조회 (getValidationResult) — valid/invalid + violations[]
FR-R532.4: 위반 통계 조회 (getViolationStats)
FR-R532.5: 감사 로그 조회 (getAuditLog)
## 성공 기준
SC-R532.1: N2SF N-05 C/S 등급 차단
SC-R532.2: CSAP D-06 감사 로그 append-only
