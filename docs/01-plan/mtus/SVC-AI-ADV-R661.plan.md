# SVC-AI-ADV-R661 Plan — AI기반 예측적 예산 계획 v3

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 운영 비용 추세 + 잔여 예산 기반 종료 시점 예측 |
| WHO | 재무팀, 사업 PM |
| RISK | 예산/계약 정보 N2SF C/S 차단 |
| SUCCESS | FR-R661.1~6 모두 충족 |
| SCOPE | platform/services/ai-service/src/lib/predictive-budget-planner-v3.ts |

## 기능 요구사항
| ID | 요구사항 |
|----|---------|
| FR-R661.1 | 예산 등록 (budgetId, totalAmount, dataGrade) — C/S 차단 |
| FR-R661.2 | 지출 기록 (timestamp, amount) |
| FR-R661.3 | 월 평균 소진율 산출 |
| FR-R661.4 | 잔여 개월 수 예측 |
| FR-R661.5 | 경고 등급 (CRITICAL: ≤1개월 / WARN: ≤3개월 / OK) |
| FR-R661.6 | getAuditLog() append-only 감사 로그 |

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-c |
