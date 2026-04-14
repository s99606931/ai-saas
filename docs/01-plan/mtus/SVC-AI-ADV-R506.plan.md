# SVC-AI-ADV-R506 Plan — complaint-conversation-analyzer-v2.ts

## 요구사항
FR-R506.1: 민원 대화 등록 (conversationId, citizenId, channel)
FR-R506.2: 대화 메시지 추가 (conversationId, content, sentiment, dataGrade?)
FR-R506.3: 감정 통계 조회 (getSentimentStats) — positive/neutral/negative 비율
FR-R506.4: 부정 대화 목록 조회 (getNegativeConversations) — negative 메시지 비율 > 50%
FR-R506.5: 감사 로그 조회 (getAuditLog)

## 성공 기준
SC-R506.1: N2SF N-05 C/S 등급 차단
SC-R506.2: CSAP D-06 감사 로그 append-only
SC-R506.3: CSAP D-09 PII SHA-256 마스킹 (citizenId)
