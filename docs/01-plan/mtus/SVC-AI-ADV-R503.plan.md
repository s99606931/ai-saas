# SVC-AI-ADV-R503 Plan — public-license-intelligence-ai.ts

## 요구사항
FR-R503.1: 인허가 항목 등록 (licenseId, name, requiredDocuments[], processingDays)
FR-R503.2: 신청 기록 (licenseId, applicantId, submittedDocuments[], dataGrade?)
FR-R503.3: 완비율 계산 (getCompletionRate) — submittedDocs ∩ requiredDocs / requiredDocs * 100
FR-R503.4: 미비 서류 목록 조회 (getMissingDocuments)
FR-R503.5: 감사 로그 조회 (getAuditLog)

## 성공 기준
SC-R503.1: N2SF N-05 C/S 등급 차단
SC-R503.2: CSAP D-06 감사 로그 append-only
SC-R503.3: CSAP D-09 PII SHA-256 마스킹 (applicantId)
