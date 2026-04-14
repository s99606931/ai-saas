# SVC-AI-ADV-R681 Plan — AI기반 민원인 피드백 루프 v3

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 민원 피드백 자동 분류·우선순위 산출 |
| WHO | 민원실, 정책기획팀 |
| RISK | N2SF C/S 등급 민원인 PII 외부 전송 금지, PII 마스킹 필수 |
| SUCCESS | FR-R681.1~5 모두 충족 |
| SCOPE | platform/services/ai-service/src/lib/citizen-feedback-loop-ai-v3.ts |

## 기능 요구사항
| ID | 요구사항 |
|----|---------|
| FR-R681.1 | 채널 등록 (channelId, name, weight) |
| FR-R681.2 | 피드백 수신 (dataGrade? C/S 차단, citizenId PII 마스킹 sha256) |
| FR-R681.3 | 우선순위 등급 (URGENT/HIGH/NORMAL) |
| FR-R681.4 | 권고 (ESCALATE/REVIEW/QUEUE) |
| FR-R681.5 | getAuditLog() append-only 감사 로그 (마스킹 ID 저장) |

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-c |
