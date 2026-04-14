# SVC-AI-ADV-R658 Plan — AI기반 데이터 메시 코디네이터 v2

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 도메인 분산 데이터 산물 카탈로그/거버넌스 자동화 |
| WHO | 데이터 거버넌스, 도메인 데이터 오너 |
| RISK | N2SF 등급 메타데이터 분류 필수 |
| SUCCESS | FR-R658.1~6 모두 충족 |
| SCOPE | platform/services/ai-service/src/lib/data-mesh-coordinator-ai-v2.ts |

## 기능 요구사항
| ID | 요구사항 |
|----|---------|
| FR-R658.1 | 데이터 산물 등록 (productId, domain, owner, dataGrade) — C/S 차단 |
| FR-R658.2 | 의존성 등록 (downstream → upstream) + 순환 차단 |
| FR-R658.3 | 도메인별 산물 조회 |
| FR-R658.4 | 거버넌스 점수 산출 (오너 등록률 + SLA 정의율 + 메타데이터 완전성) |
| FR-R658.5 | PII 마스킹 (오너명) |
| FR-R658.6 | getAuditLog() append-only 감사 로그 |

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-c |
