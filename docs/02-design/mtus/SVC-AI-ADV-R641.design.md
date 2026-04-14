# SVC-AI-ADV-R641 Design — AI기반 사기 패턴 인식 v3

## Executive Summary
| 관점 | 내용 |
|------|------|
| 기능 | Plan FR-R641.1~5 구현 |
| 보안 | N2SF N-05 C/S 차단, CSAP D-06 감사 로그, PII SHA-256 마스킹 |
| 품질 | TypeScript strict, Vitest 5+개 |
| 범위 | platform/services/ai-service/src/lib/fraud-pattern-recognizer-v3.ts |

## 설계 결정
- 클래스 기반 단일 모듈 (FraudPatternRecognizerV3)
- 트랜잭션 Map<txId, { maskedActor, amount, score }>
- 위험 점수: amount>=10000 → +0.5, 동일 actor 빈도 >=3 → +0.5
- 고위험 기준: score >= 0.7
- C/S 등급 즉시 throw (N2SF N-05)
- actorEmail SHA-256 16자 마스킹
- getAuditLog(): shallow copy

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-b |
