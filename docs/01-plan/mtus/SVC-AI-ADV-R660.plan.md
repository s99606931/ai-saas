# SVC-AI-ADV-R660 Plan — AI기반 서비스 레벨 최적화 v3

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | SLO 위반 예측 + 자원 할당 자동 권고 |
| WHO | SRE/플랫폼 팀 |
| RISK | 서비스 토폴로지 N2SF 등급 분류 |
| SUCCESS | FR-R660.1~6 모두 충족 |
| SCOPE | platform/services/ai-service/src/lib/service-level-optimizer-ai-v3.ts |

## 기능 요구사항
| ID | 요구사항 |
|----|---------|
| FR-R660.1 | 서비스 등록 (serviceId, sloTarget, dataGrade) — C/S 차단 |
| FR-R660.2 | 메트릭 등록 (latencyMs, errorRate) |
| FR-R660.3 | SLO 준수 판정 (실제 가용성 vs sloTarget) |
| FR-R660.4 | 권고 (SCALE_UP/SCALE_DOWN/STABLE) |
| FR-R660.5 | 위반율 산출 |
| FR-R660.6 | getAuditLog() append-only 감사 로그 |

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-c |
