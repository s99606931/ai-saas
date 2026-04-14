# SVC-AI-ADV-R678 Design — AI기반 공공 인력 최적화 v2

## Executive Summary
| 관점 | 내용 |
|------|------|
| 기능 | Plan FR-R678.1~5 구현 |
| 보안 | N2SF N-05 C/S 차단, CSAP D-06 감사 로그 |
| 품질 | TypeScript strict, Vitest 5+ |
| 범위 | platform/services/ai-service/src/lib/public-workforce-optimizer-ai-v2.ts |

## 설계 결정
- `PublicWorkforceOptimizerAIV2` 클래스
- `registerDepartment(dept)`, `reportLoad(load, grade)`: C/S 차단
- 1인당 케이스/일: ≥40 OVERLOADED / ≥25 BUSY / NORMAL
- 권고: OVERLOADED→HIRE / BUSY→REASSIGN / NORMAL→HOLD
- 평균 잔업 4h+ 시 권고 한 단계 승격

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-c |
