# SVC-AI-ADV-R502 Plan — citizen-request-auto-processor-v2.ts

## 요구사항
FR-R502.1: 민원 요청 등록 (requestId, citizenId, requestType, description)
FR-R502.2: 민원 처리 상태 업데이트 (requestId, status, dataGrade?)
FR-R502.3: 요청 유형별 통계 조회 (getRequestTypeStats)
FR-R502.4: 미처리 민원 목록 조회 (getPendingRequests) — status=pending
FR-R502.5: 감사 로그 조회 (getAuditLog)

## 성공 기준
SC-R502.1: N2SF N-05 C/S 등급 차단
SC-R502.2: CSAP D-06 감사 로그 append-only
SC-R502.3: CSAP D-09 PII SHA-256 마스킹 (citizenId)
