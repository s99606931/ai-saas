# SVC-AI-ADV-R635 Design — AI기반 실시간 정책 엔진 v3

## Executive Summary
| 관점 | 내용 |
|------|------|
| 기능 | Plan FR-R635.1~5 구현 |
| 보안 | N2SF N-05 C/S 차단, CSAP D-06 감사 로그 |
| 품질 | TypeScript strict, Vitest 5+개 |
| 범위 | platform/services/ai-service/src/lib/ |

## 설계 결정
- 클래스 기반 단일 모듈
- 정책: { id, predicate: (event) => boolean }
- 위반 = predicate 반환값 false
- C/S 등급 즉시 throw (N2SF N-05)
- getAuditLog(): AuditEntry[] — append-only shallow copy

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-c |
