# SVC-AI-ADV-R655 Plan — AI기반 SLA 협상 자동화 v2

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 공공-민간 SLA 자동 협상으로 운영 비용 절감 |
| WHO | 서비스 운영팀 |
| RISK | N2SF C/S 등급 계약 정보 외부 전송 금지 |
| SUCCESS | FR-R655.1~6 모두 충족 |
| SCOPE | platform/services/ai-service/src/lib/ai-driven-sla-negotiator-v2.ts |

## 기능 요구사항
| ID | 요구사항 |
|----|---------|
| FR-R655.1 | SLA 제안 등록 (proposalId, party, terms, dataGrade) — C/S 차단 |
| FR-R655.2 | 협상 라운드 추가 (counterTerms) |
| FR-R655.3 | 점수 계산 (가용성/응답시간/가격 가중합) |
| FR-R655.4 | 합의 판정 (점수 ≥ 임계 + 양측 동의) |
| FR-R655.5 | PII 마스킹 (담당자명/이메일 SHA-256 16자) |
| FR-R655.6 | getAuditLog() append-only 감사 로그 |

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-c |
