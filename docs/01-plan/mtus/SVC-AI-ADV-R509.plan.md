# SVC-AI-ADV-R509 Plan — public-data-standardizer-v2.ts

## 요구사항
FR-R509.1: 데이터 스키마 등록 (schemaId, name, fields[]{name, type, required})
FR-R509.2: 데이터 검증 (schemaId, record{}, dataGrade?)
FR-R509.3: 검증 결과 조회 (getValidationResult) — valid/invalid + errors[]
FR-R509.4: 스키마별 검증 통계 조회 (getValidationStats)
FR-R509.5: 감사 로그 조회 (getAuditLog)

## 성공 기준
SC-R509.1: N2SF N-05 C/S 등급 차단
SC-R509.2: CSAP D-06 감사 로그 append-only
