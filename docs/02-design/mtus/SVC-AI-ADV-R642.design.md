# SVC-AI-ADV-R642 Design — AI기반 테스트 자동화 지원 v2

## Executive Summary
| 관점 | 내용 |
|------|------|
| 기능 | Plan FR-R642.1~5 구현 |
| 보안 | N2SF N-05 C/S 차단, CSAP D-06 감사 로그 |
| 품질 | TypeScript strict, Vitest 5+개 |
| 범위 | platform/services/ai-service/src/lib/ai-assisted-testing-v2.ts |

## 설계 결정
- 클래스 기반 단일 모듈 (AiAssistedTestingV2)
- 테스트 Map<testId, { module }>, 결과 Map<testId, 'pass' | 'fail'[]>
- 모듈별 통과율 = pass건수 / 전체건수
- 취약 모듈 기준: 통과율 < threshold
- C/S 등급 즉시 throw (N2SF N-05)
- getAuditLog(): shallow copy

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-b |
