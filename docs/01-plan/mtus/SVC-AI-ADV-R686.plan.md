# SVC-AI-ADV-R686 Plan — AI기반 규제 샌드박스 관리 v2

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 규제 샌드박스 신청 1차 검토, 리스크 등급 산출 |
| WHO | 정책혁신팀, 법무팀 |
| RISK | N2SF C/S 차단, sponsorEmail PII 마스킹 |
| SUCCESS | FR-R686.1~5 모두 충족, ≥5 Vitest 통과 |
| SCOPE | platform/services/ai-service/src/lib/regulatory-sandbox-ai-v2.ts |

## 기능 요구사항
| ID | 요구사항 |
|----|---------|
| FR-R686.1 | `submitApplication(app, grade?)` C/S→BLOCKED, sponsorEmail→SHA-256 16자 마스킹 |
| FR-R686.2 | 리스크 점수 = consumerImpact×0.4 + legalRisk×0.4 + dataSensitivity×0.2 |
| FR-R686.3 | 등급: ≥0.7 HIGH / ≥0.4 MEDIUM / LOW |
| FR-R686.4 | 판정: HIGH→REJECT, MEDIUM→CONDITIONAL, LOW→APPROVE |
| FR-R686.5 | `getAuditLog()` append-only (SUBMIT_APPLICATION) |

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-c |
