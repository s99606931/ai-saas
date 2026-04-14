# SVC-AI-ADV-R703 Plan — AI기반 관찰가능성 상관관계 분석 v3

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 메트릭/로그/트레이스 간 상관관계 탐지로 근본 원인 추적 가속 |
| WHO | SRE, 장애대응팀 |
| RISK | N2SF C/S 원본 로그 금지, traceId/serviceId 마스킹 필수 |
| SUCCESS | FR-R703.1~5 모두 충족 |
| SCOPE | platform/services/ai-service/src/lib/ai-observability-correlator-v3.ts |

## 기능 요구사항
| ID | 요구사항 |
|----|---------|
| FR-R703.1 | 신호 등록 (signalId, type: metric/log/trace) |
| FR-R703.2 | 이벤트 수신 (timestamp, signalId, dataGrade?) - C/S 차단 |
| FR-R703.3 | 시간 윈도우 내 상관관계 점수 (Jaccard-like) |
| FR-R703.4 | 근본 원인 후보 산출 (score ≥ threshold) |
| FR-R703.5 | getAuditLog() append-only |

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-c |
