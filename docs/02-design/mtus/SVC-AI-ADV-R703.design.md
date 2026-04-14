# SVC-AI-ADV-R703 Design — AI기반 관찰가능성 상관관계 분석 v3

## Executive Summary
| 관점 | 내용 |
|------|------|
| 기능 | Plan FR-R703.1~5 구현 |
| 보안 | N2SF N-05 C/S 차단, signalId sha256 16자, CSAP D-06 |
| 품질 | TypeScript strict, Vitest 6+ |
| 범위 | platform/services/ai-service/src/lib/ai-observability-correlator-v3.ts |

## 설계 결정
- `AIObservabilityCorrelatorV3` 클래스
- 이벤트 buckets: Map<signalId, timestampMs[]>
- 상관관계: |A ∩ B_window| / |A ∪ B_window|, B_window = B의 이벤트를 ±windowMs 확장 후 겹치는 A 이벤트 수
- `findRootCauseCandidates(target, windowMs, threshold)` — target과 상관점수 ≥ threshold인 모든 signal 반환
- 감사 로그에 상관 계산 호출 기록

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-c |
