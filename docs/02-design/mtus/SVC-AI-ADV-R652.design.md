# SVC-AI-ADV-R652 Design — AI기반 스마트 아카이빙 v2

## Executive Summary
| 관점 | 내용 |
|------|------|
| 기능 | Plan FR-R652.1~5 구현 |
| 보안 | N2SF N-05 C/S 차단, CSAP D-06 감사 로그 |
| 품질 | TypeScript strict, Vitest 5+ |
| 범위 | platform/services/ai-service/src/lib/smart-archiving-ai-v2.ts |

## 설계 결정
- `SmartArchivingAIV2` 클래스
- `register(record, grade)`: C/S 차단
- ageYears = (now - createdAt) / (365×86400000)
- 상태: PERMANENT→ARCHIVE, age≥retention→DISPOSAL, age≥retention×0.8→REVIEW, else ACTIVE
- `getDisposalCandidates()`: DISPOSAL 상태 목록

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-c |
