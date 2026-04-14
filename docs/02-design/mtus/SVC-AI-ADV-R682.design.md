# SVC-AI-ADV-R682 Design — AI기반 위협 인텔리전스 집계 v2

## Executive Summary
| 관점 | 내용 |
|------|------|
| 기능 | Plan FR-R682.1~5 구현 |
| 보안 | N2SF N-05 C/S 차단, analystEmail SHA-256 16자 마스킹, CSAP D-06 감사 로그 |
| 품질 | TypeScript strict, Vitest 6+ |
| 범위 | platform/services/ai-service/src/lib/ai-threat-intel-aggregator-v2.ts |

## 설계 결정
- `AiThreatIntelAggregatorV2` 클래스
- `registerFeed(feed)`: reliability 0~1 검증
- `ingest(ind, grade?)`: C/S→BLOCKED, analystEmail 마스킹
- 동일 iocId 중복 수집 시 점수 = max(기존, severity×reliability)
- 등급: ≥0.8 CRITICAL / ≥0.5 HIGH / ≥0.3 MEDIUM / LOW
- `getIndicators()` / `getAuditLog()` 제공

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-c |
