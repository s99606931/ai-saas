# SVC-AI-ADV-R668 Plan — AI기반 민원인 역량 강화 v2

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 민원인의 디지털 리터러시 진단 및 맞춤 학습 추천 |
| WHO | 디지털 포용 부서 / 민원실 |
| RISK | 민원인 식별정보 외부 전송 금지 |
| SUCCESS | FR-R668.1~5 모두 충족 |
| SCOPE | platform/services/ai-service/src/lib/citizen-empowerment-ai-v2.ts |

## 기능 요구사항
| ID | 요구사항 |
|----|---------|
| FR-R668.1 | 디지털 리터러시 점수 산출 (0~100) |
| FR-R668.2 | 등급 분류 (BEGINNER/INTERMEDIATE/ADVANCED) + 맞춤 추천 |
| FR-R668.3 | dataGrade C/S 차단 (N2SF N-05) |
| FR-R668.4 | citizenId SHA-256 16자 마스킹 |
| FR-R668.5 | getAuditLog() append-only 감사 로그 |

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-c |
