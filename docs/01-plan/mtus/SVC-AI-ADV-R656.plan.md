# SVC-AI-ADV-R656 Plan — AI기반 공공서비스 챗봇 고도화 v3

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 멀티 도메인 라우팅 + 페르소나 + 폴백으로 응답 품질 향상 |
| WHO | 공공서비스 챗봇 운영팀 |
| RISK | N2SF C/S 등급 발화 외부 전송 금지 |
| SUCCESS | FR-R656.1~6 모두 충족 |
| SCOPE | platform/services/ai-service/src/lib/public-service-chatbot-enhancer-v3.ts |

## 기능 요구사항
| ID | 요구사항 |
|----|---------|
| FR-R656.1 | 도메인 등록 (domainId, keywords[], persona) |
| FR-R656.2 | 발화 라우팅 (utterance, dataGrade) — C/S 차단 |
| FR-R656.3 | 신뢰도 점수 (키워드 일치 비율) |
| FR-R656.4 | 폴백 라우팅 (신뢰도 < 0.3 → 'general') |
| FR-R656.5 | PII 마스킹 (사용자 발화) |
| FR-R656.6 | getAuditLog() append-only 감사 로그 |

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-c |
