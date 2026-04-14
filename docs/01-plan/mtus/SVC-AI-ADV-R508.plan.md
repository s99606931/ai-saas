# SVC-AI-ADV-R508 Plan — service-token-security-manager-v2.ts

## 요구사항
FR-R508.1: 토큰 등록 (tokenId, serviceId, tokenType, expiresAt)
FR-R508.2: 토큰 사용 기록 (tokenId, clientId, dataGrade?)
FR-R508.3: 토큰 만료 여부 확인 (isExpired)
FR-R508.4: 만료 토큰 목록 조회 (getExpiredTokens)
FR-R508.5: 감사 로그 조회 (getAuditLog)

## 성공 기준
SC-R508.1: N2SF N-05 C/S 등급 차단
SC-R508.2: CSAP D-06 감사 로그 append-only
SC-R508.3: CSAP D-09 PII SHA-256 마스킹 (clientId)
