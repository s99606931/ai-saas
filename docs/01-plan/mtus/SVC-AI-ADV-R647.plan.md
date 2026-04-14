# SVC-AI-ADV-R647 Plan — AI기반 정책 영향 시뮬레이터 v2

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 정책 도입 전 시뮬레이션 기반 영향 평가 |
| WHO | 정책 담당 공무원 |
| RISK | N2SF C/S 등급 정책 데이터 외부 전송 금지 |
| SUCCESS | FR-R647.1~5 모두 충족 |
| SCOPE | platform/services/ai-service/src/lib/policy-impact-simulator-v2.ts |

## 기능 요구사항
| ID | 요구사항 |
|----|---------|
| FR-R647.1 | 시나리오 등록 (scenarioId, baseline, deltas) |
| FR-R647.2 | 투입 변수 반영 (dataGrade? C/S 차단) |
| FR-R647.3 | 예상 지표 산출 (beneficiaries, cost) |
| FR-R647.4 | 부작용 점수 및 권고 (PROCEED/REVIEW/REJECT) |
| FR-R647.5 | getAuditLog() append-only 감사 로그 |

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-c |
