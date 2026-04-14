# SVC-AI-ADV-R531 Plan — user-behavior-analyzer-v2.ts
## 요구사항
FR-R531.1: 세션 등록 (sessionId, userId, serviceId)
FR-R531.2: 행동 이벤트 기록 (sessionId, eventType, duration, dataGrade?)
FR-R531.3: 세션 참여도 조회 (getEngagementScore) — eventCount * avgDuration
FR-R531.4: 저참여 세션 조회 (getLowEngagementSessions) — score < 10
FR-R531.5: 감사 로그 조회 (getAuditLog)
## 성공 기준
SC-R531.1: N2SF N-05 C/S 등급 차단
SC-R531.2: CSAP D-06 감사 로그 append-only
SC-R531.3: CSAP D-09 PII SHA-256 마스킹 (userId)
