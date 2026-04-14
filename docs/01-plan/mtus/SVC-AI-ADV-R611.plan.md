# SVC-AI-ADV-R611 Plan — AI기반 공공 피드백 분류 v3

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 공공기관 SaaS 플랫폼 AI 고도화 |
| WHO | 민원 담당자 |
| RISK | N2SF C/S 등급 데이터 외부 전송 금지 |
| SUCCESS | FR-R611.1~5 모두 충족 |
| SCOPE | platform/services/ai-service/src/lib/public-feedback-classifier-v3.ts |

## 기능 요구사항
| ID | 요구사항 |
|----|---------|
| FR-R611.1 | 피드백 수집 및 카테고리 분류 |
| FR-R611.2 | N2SF 등급 검사 (C/S 차단) |
| FR-R611.3 | 감사 로그 기록 (CSAP D-06) |
| FR-R611.4 | 작성자 PII 마스킹 |
| FR-R611.5 | 카테고리별 감성/우선순위 통계 |

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-b |
