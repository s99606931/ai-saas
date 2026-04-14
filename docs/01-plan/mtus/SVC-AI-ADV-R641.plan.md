# SVC-AI-ADV-R641 Plan — AI기반 사기 패턴 인식 v3

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 공공기관 SaaS 플랫폼 AI 고도화 (트랙 B 23차) |
| WHO | 공공기관 감사/보안 담당자 |
| RISK | N2SF C/S 등급 데이터 외부 전송 금지 |
| SUCCESS | FR-R641.1~5 모두 충족 |
| SCOPE | platform/services/ai-service/src/lib/fraud-pattern-recognizer-v3.ts |

## 기능 요구사항
| ID | 요구사항 |
|----|---------|
| FR-R641.1 | 트랜잭션 등록 (txId, amount, actorEmail) |
| FR-R641.2 | 트랜잭션 평가 (dataGrade? C/S 차단) |
| FR-R641.3 | 사기 위험 점수 산출 (금액·빈도 기반) |
| FR-R641.4 | 고위험 트랜잭션 목록 반환 |
| FR-R641.5 | 감사 로그 getAuditLog() |

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-b |
