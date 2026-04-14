# SVC-AI-ADV-R684 Plan — AI기반 서비스 토폴로지 최적화 v3

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 서비스 간 호출 그래프 분석, 비효율 경로·병목 탐지 |
| WHO | SRE팀, 플랫폼팀 |
| RISK | N2SF C/S 차단 (인프라 메트릭) |
| SUCCESS | FR-R684.1~5 모두 충족, ≥5 Vitest 통과 |
| SCOPE | platform/services/ai-service/src/lib/service-topology-optimizer-v3.ts |

## 기능 요구사항
| ID | 요구사항 |
|----|---------|
| FR-R684.1 | `addEdge(edge)` 노드 간 호출 등록 (from, to, avgLatencyMs, rpm) |
| FR-R684.2 | `analyze(grade?)` C/S→BLOCKED |
| FR-R684.3 | 엣지 부하 = avgLatencyMs × rpm / 1000, 상위 20% → HOTSPOT |
| FR-R684.4 | 권고: HOTSPOT 엣지 → SCALE / latency>500ms → CACHE / else MONITOR |
| FR-R684.5 | `getAuditLog()` append-only (ADD_EDGE/ANALYZE) |

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-c |
