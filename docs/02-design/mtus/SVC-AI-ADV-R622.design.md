# SVC-AI-ADV-R622 Design — AI기반 실시간 거래 이상 탐지 v3

## Executive Summary
| 관점 | 내용 |
|------|------|
| 기능 | Plan FR-R622.1~5 구현 |
| 보안 | N2SF N-05 C/S 차단, CSAP D-06 감사 로그 |
| 품질 | TypeScript strict, Vitest 5+개 |
| 범위 | platform/services/ai-service/src/lib/ |

## 설계 결정
- 클래스 기반 단일 모듈
- getAuditLog(): AuditEntry[] — append-only shallow copy
- C/S 등급 즉시 throw (N2SF N-05)
- PII는 SHA-256 16자 hex 마스킹 (해당 시)

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-c |
