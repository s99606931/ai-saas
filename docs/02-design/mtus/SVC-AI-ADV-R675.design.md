# SVC-AI-ADV-R675 Design — AI기반 코드 리팩토링 자문 v2

## Executive Summary
| 관점 | 내용 |
|------|------|
| 기능 | Plan FR-R675.1~5 구현 |
| 보안 | N2SF N-05 C/S 차단, CSAP D-06 감사 로그 |
| 품질 | TypeScript strict, Vitest 5+ |
| 범위 | platform/services/ai-service/src/lib/ai-code-refactoring-advisor-v2.ts |

## 설계 결정
- `AICodeRefactoringAdvisorV2` 클래스
- `registerModule(module)`, `analyzeMetrics(metric, grade)`: C/S 차단
- 복잡도: cyclomatic ≥20 CRITICAL / ≥10 HIGH / MODERATE
- 권고: CRITICAL→SPLIT / HIGH→SIMPLIFY / MODERATE→REVIEW
- LoC > 800일 때 권고 한 단계 승격

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-c |
