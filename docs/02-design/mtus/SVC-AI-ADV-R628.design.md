# SVC-AI-ADV-R628 Design — AI기반 워크플로우 버전 관리 v2

## Executive Summary
| 관점 | 내용 |
|------|------|
| 기능 | Plan FR-R628.1~5 구현 |
| 보안 | N2SF N-05 C/S 차단, CSAP D-06 감사 로그 |
| 품질 | TypeScript strict, Vitest 5+개 |
| 범위 | platform/services/ai-service/src/lib/ |

## 설계 결정
- 클래스 기반 단일 모듈
- getAuditLog(): AuditEntry[] — append-only shallow copy
- C/S 등급 즉시 throw (N2SF N-05)
- 버전 회귀 판단: score 감소량 >= regressionThreshold

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-c |
