# SVC-AI-ADV-R699 Plan — AI 거버넌스 대시보드 자동화 v2

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 거버넌스 KPI(정책 준수·리스크·감사) 대시보드 자동 집계 |
| WHO | CDO, 거버넌스 위원회 |
| RISK | N2SF C/S 등급 지표 외부 전송 금지, 담당자 PII 마스킹 |
| SUCCESS | FR-R699.1~5 모두 충족 |
| SCOPE | platform/services/ai-service/src/lib/ai-governance-dashboard-v2.ts |

## 기능 요구사항
| ID | 요구사항 |
|----|---------|
| FR-R699.1 | KPI 등록 (kpiId, target, weight 0~1) |
| FR-R699.2 | 지표 수신 (dataGrade? C/S 차단, reporterId PII 마스킹 sha256) |
| FR-R699.3 | 달성도 = actual/target*100 (cap 150) |
| FR-R699.4 | 종합 상태 (AT_RISK<70 / MONITOR<90 / ON_TRACK) |
| FR-R699.5 | getAuditLog() append-only (마스킹 ID 저장) |

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-b |
