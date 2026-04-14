# SVC-AI-ADV-R669 Plan — AI기반 마이크로서비스 카오스 테스팅 v2

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 마이크로서비스 복원력 검증을 위한 카오스 시나리오 자동 생성·평가 |
| WHO | SRE / 플랫폼팀 |
| RISK | 운영 환경 데이터 외부 전송 금지 |
| SUCCESS | FR-R669.1~5 모두 충족 |
| SCOPE | platform/services/ai-service/src/lib/microservice-chaos-tester-ai-v2.ts |

## 기능 요구사항
| ID | 요구사항 |
|----|---------|
| FR-R669.1 | 시나리오 생성 (latency/error/network-partition) |
| FR-R669.2 | 결과 평가 — 복원력 점수 (0~1) |
| FR-R669.3 | dataGrade C/S 차단 (N2SF N-05) |
| FR-R669.4 | targetService SHA-256 16자 마스킹 |
| FR-R669.5 | getAuditLog() append-only 감사 로그 |

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-c |
