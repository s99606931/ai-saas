# SVC-AI-ADV-R648 Design — AI기반 제로 트러스트 접근 제어 v2

## Executive Summary
| 관점 | 내용 |
|------|------|
| 기능 | Plan FR-R648.1~5 구현 |
| 보안 | N2SF N-05 C/S 차단, CSAP D-08 접근 통제, D-06 감사 로그 |
| 품질 | TypeScript strict, Vitest 5+ |
| 범위 | platform/services/ai-service/src/lib/zero-trust-access-ai-v2.ts |

## 설계 결정
- `ZeroTrustAccessAIV2` 클래스
- `evaluate(req, grade)`: C/S 차단, userId SHA-256 16자 hex 마스킹
- 위험 점수: unknownDevice+40, offHours+20, newLocation+20, failedAttempts×5
- 결정: <30 ALLOW / <70 CHALLENGE / ≥70 DENY

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-c |
