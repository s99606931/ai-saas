# SVC-AI-ADV-R505 Plan — security-cert-manager-ai.ts

## 요구사항
FR-R505.1: 인증서 등록 (certId, domain, issuer, expiresAt)
FR-R505.2: 인증서 갱신 기록 (certId, newExpiresAt, dataGrade?)
FR-R505.3: 만료 임박 인증서 조회 (getExpiringCerts) — daysUntilExpiry <= threshold
FR-R505.4: 인증서 상태 조회 (getCertStatus) — valid/expiring/expired
FR-R505.5: 감사 로그 조회 (getAuditLog)

## 성공 기준
SC-R505.1: N2SF N-05 C/S 등급 차단
SC-R505.2: CSAP D-06 감사 로그 append-only
