# SVC-AI-ADV-R664 Plan — AI기반 로그 자동 파싱 v3

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 비정형 시스템 로그를 AI 패턴으로 자동 분류·추출 |
| WHO | SRE / 보안 운영팀 |
| RISK | 로그 내 PII(이메일·IP) 외부 전송 금지 |
| SUCCESS | FR-R664.1~5 모두 충족 |
| SCOPE | platform/services/ai-service/src/lib/ai-powered-log-parser-v3.ts |

## 기능 요구사항
| ID | 요구사항 |
|----|---------|
| FR-R664.1 | 로그 라인 파싱 (timestamp/level/message 추출) |
| FR-R664.2 | 심각도 분류 (DEBUG/INFO/WARN/ERROR/FATAL) |
| FR-R664.3 | dataGrade C/S 차단 (N2SF N-05) |
| FR-R664.4 | PII(이메일·IPv4) SHA-256 16자 마스킹 |
| FR-R664.5 | getAuditLog() append-only 감사 로그 |

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-c |
