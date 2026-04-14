# SVC-AI-ADV-R580 Plan — AI기반 공공기관 예산 소진율 분석 v2

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 예산 소진율 실시간 분석으로 예산 집행 이상 조기 감지 |
| WHO | 예산 담당자 |
| RISK | N2SF C/S 등급 데이터 외부 전송 금지 |
| SUCCESS | 예산 등록, 지출 기록, 소진율 산출 |
| SCOPE | budget-burn-rate-analyzer-v2.ts |

## 기능 요구사항
| ID | 요구사항 |
|----|---------|
| FR-R580.1 | 예산 항목 등록 (budgetId, name, totalBudget) |
| FR-R580.2 | 지출 기록 (budgetId, amount, dataGrade?) — C/S 차단 |
| FR-R580.3 | 소진율 반환 = totalSpent / totalBudget * 100 |
| FR-R580.4 | 과소진 예산 목록 반환 (소진율 > 90%) |
| FR-R580.5 | 감사 로그 getAuditLog() |

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-c |
