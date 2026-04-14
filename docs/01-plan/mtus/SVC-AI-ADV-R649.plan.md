# SVC-AI-ADV-R649 Plan — AI기반 공공데이터 카탈로그 자동화 v3

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 공공데이터 카탈로그 메타정보 자동 생성·품질 평가 |
| WHO | 공공데이터 포털 운영팀 |
| RISK | N2SF C/S 등급 원본 데이터 외부 전송 금지 |
| SUCCESS | FR-R649.1~5 모두 충족 |
| SCOPE | platform/services/ai-service/src/lib/public-data-catalog-ai-v3.ts |

## 기능 요구사항
| ID | 요구사항 |
|----|---------|
| FR-R649.1 | 데이터셋 등록 (datasetId, title, fields) |
| FR-R649.2 | 메타 자동 추론 (dataGrade? C/S 차단) |
| FR-R649.3 | 품질 점수 산출 (완전성/최신성/표준준수) |
| FR-R649.4 | 품질 등급 판정 (A/B/C/D) |
| FR-R649.5 | getAuditLog() append-only 감사 로그 |

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-c |
