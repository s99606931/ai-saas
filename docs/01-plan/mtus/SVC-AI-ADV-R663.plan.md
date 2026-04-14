# SVC-AI-ADV-R663 Plan — AI기반 시맨틱 API 게이트웨이 v3

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 자연어 요청 → API 라우팅 자동화 (오픈 API 활용성↑) |
| WHO | 행정 포털 사용자, 운영팀 |
| RISK | 자연어 요청 N2SF 분류 필수 |
| SUCCESS | FR-R663.1~6 모두 충족 |
| SCOPE | platform/services/ai-service/src/lib/semantic-api-gateway-v3.ts |

## 기능 요구사항
| ID | 요구사항 |
|----|---------|
| FR-R663.1 | API 등록 (apiId, description, keywords[]) |
| FR-R663.2 | 요청 라우팅 (utterance, dataGrade) — C/S 차단 |
| FR-R663.3 | 시맨틱 매칭 점수 (키워드 일치 + 길이 정규화) |
| FR-R663.4 | 다중 후보 랭킹 (top-k 반환) |
| FR-R663.5 | PII 마스킹 (요청 텍스트) |
| FR-R663.6 | getAuditLog() append-only 감사 로그 |

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-c |
