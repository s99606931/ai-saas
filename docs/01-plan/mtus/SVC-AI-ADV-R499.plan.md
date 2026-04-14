# SVC-AI-ADV-R499 Plan — data-governance-dashboard-v2.ts

## 요구사항
FR-R499.1: 데이터 자산 등록 (assetId, name, owner, dataGrade)
FR-R499.2: 거버넌스 이슈 기록 (assetId, issueType, severity, dataGrade?)
FR-R499.3: 자산별 이슈 수 조회 (getIssueCount)
FR-R499.4: 고위험 자산 조회 (getHighRiskAssets) — severity=high 이슈 보유
FR-R499.5: 감사 로그 조회 (getAuditLog)

## 성공 기준
SC-R499.1: N2SF N-05 C/S 등급 차단
SC-R499.2: CSAP D-06 감사 로그 append-only
SC-R499.3: CSAP D-09 PII SHA-256 마스킹
