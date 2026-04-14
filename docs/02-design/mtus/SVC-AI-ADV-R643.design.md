# SVC-AI-ADV-R643 Design — AI기반 계약 준수 검사 v3

## Executive Summary
| 관점 | 내용 |
|------|------|
| 기능 | Plan FR-R643.1~5 구현 |
| 보안 | N2SF N-05 C/S 차단, CSAP D-06 감사 로그 |
| 품질 | TypeScript strict, Vitest 5+개 |
| 범위 | platform/services/ai-service/src/lib/contract-compliance-checker-v3.ts |

## 설계 결정
- 클래스 기반 단일 모듈 (ContractComplianceCheckerV3)
- 계약 Map<contractId, { vendor }>, 조건 결과 Map<contractId, boolean[]>
- 준수율 = true건수 / 전체건수
- 미준수 기준: 준수율 < threshold (기본 1.0)
- C/S 등급 즉시 throw (N2SF N-05)
- getAuditLog(): shallow copy

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-b |
