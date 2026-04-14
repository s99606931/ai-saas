# SVC-AI-ADV-R615 Design — AI기반 규제 변경 탐지 v3

## Executive Summary
| 관점 | 내용 |
|------|------|
| 기능 | Plan FR-R615.1~5 구현 |
| 보안 | N2SF N-05 C/S 차단, CSAP D-06 감사 로그 |
| 품질 | TypeScript strict, Vitest 5+개 |
| 범위 | platform/services/ai-service/src/lib/ |

## 설계 결정
- 스냅샷: clauseId → text Map
- diff: added/removed/modified 3집합
- 영향도: modified>5||removed>3 → HIGH / >0 → MEDIUM / else LOW
- 고위험 키워드(필수/금지/제재) 포함 시 HIGH 승격

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-b |
