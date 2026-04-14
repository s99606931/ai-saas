# SVC-AI-ADV-R666 Plan — AI기반 네트워크 트래픽 분류 v3

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 네트워크 플로우를 비즈니스/관리/이상으로 자동 분류 |
| WHO | NOC / 보안 운영팀 |
| RISK | 출발지·목적지 IP 외부 노출 금지 |
| SUCCESS | FR-R666.1~5 모두 충족 |
| SCOPE | platform/services/ai-service/src/lib/network-traffic-classifier-ai-v3.ts |

## 기능 요구사항
| ID | 요구사항 |
|----|---------|
| FR-R666.1 | 트래픽 플로우 분류 (BUSINESS/MANAGEMENT/ANOMALY) |
| FR-R666.2 | 임계 기반 이상 탐지 (bytes/sec, 포트) |
| FR-R666.3 | dataGrade C/S 차단 (N2SF N-05) |
| FR-R666.4 | srcIp/dstIp SHA-256 16자 마스킹 |
| FR-R666.5 | getAuditLog() append-only 감사 로그 |

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-c |
