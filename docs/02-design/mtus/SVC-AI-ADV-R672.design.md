# SVC-AI-ADV-R672 Design — AI기반 지능형 캐시 관리 v3

## Executive Summary
| 관점 | 내용 |
|------|------|
| 기능 | Plan FR-R672.1~5 구현 |
| 보안 | N2SF N-05 차단, key SHA-256, CSAP D-06 감사 |
| 품질 | TypeScript strict, Vitest 5+ |
| 범위 | platform/services/ai-service/src/lib/intelligent-cache-manager-v3.ts |

## 설계 결정
- `IntelligentCacheManagerV3` 클래스
- `record(key, hits, lastAccessAt)` 누적
- `recommend(now, dataGrade?)` → 키별 { tier, ttlSec, maskedKey }
- 점수 = hits × recencyDecay(ageMin)
- ≥100 HOT (TTL 3600), ≥10 WARM (TTL 600), 그 외 COLD (TTL 60)
- audit actions: RECORD_ACCESS, RECOMMEND

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-c |
