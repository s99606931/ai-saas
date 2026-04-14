# SVC-AI-ADV-R698 Plan — AI기반 공공 API 보안 강제화 v3

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 공공 API 보안 정책(인증/레이트/암호화) 위반 자동 탐지·차단 |
| WHO | API 게이트웨이 운영팀, 보안팀 |
| RISK | N2SF C/S 등급 요청 본문 외부 전송 금지, clientId 마스킹 |
| SUCCESS | FR-R698.1~5 모두 충족 |
| SCOPE | platform/services/ai-service/src/lib/public-api-security-enforcer-v3.ts |

## 기능 요구사항
| ID | 요구사항 |
|----|---------|
| FR-R698.1 | API 정책 등록 (apiId, requireAuth, maxRps) |
| FR-R698.2 | 요청 평가 (dataGrade? C/S 차단, clientId PII 마스킹 sha256) |
| FR-R698.3 | 위반 점수 = noAuth*50 + overRate*30 + noTLS*20 |
| FR-R698.4 | 결정 (BLOCK≥70 / WARN≥30 / ALLOW) |
| FR-R698.5 | getAuditLog() append-only (마스킹 ID 저장) |

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-b |
