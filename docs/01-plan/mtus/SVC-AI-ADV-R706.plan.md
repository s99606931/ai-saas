# SVC-AI-ADV-R706 Plan — AI기반 인프라 계획 자동화 v3

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 예상 워크로드 기반 인프라 자원(cpu/memory/disk) 계획 자동화 |
| WHO | 인프라팀, FinOps |
| RISK | N2SF C/S 워크로드 원본 금지, workloadId 마스킹 |
| SUCCESS | FR-R706.1~5 모두 충족 |
| SCOPE | platform/services/ai-service/src/lib/ai-infrastructure-planner-v3.ts |

## 기능 요구사항
| ID | 요구사항 |
|----|---------|
| FR-R706.1 | 워크로드 등록 (workloadId, baseline: cpu/mem/disk) |
| FR-R706.2 | 수요 전망 추가 (dataGrade? C/S 차단) |
| FR-R706.3 | 자원 계획 산출 (수요 × 안전계수 1.2) |
| FR-R706.4 | 변경 권고 (SCALE_UP/HOLD/SCALE_DOWN) |
| FR-R706.5 | getAuditLog() append-only (workloadId 마스킹) |

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-c |
