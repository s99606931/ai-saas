# SVC-AI-ADV-R454 Plan — 재난 복구 우선순위 결정기

## Executive Summary
| 관점 | 내용 |
|------|------|
| WHY | 재난 이후 피해 시설 복구 우선순위 자동 산정 |
| WHO | 재난안전관리본부, 지방자치단체 재난과 |
| WHAT | 시설별 피해 → 우선순위 순위 |
| HOW | 피해 규모 + 회복력 가중합 |

## Context Anchor
- WHY: 제한된 복구 자원 최적 배분
- WHO: 재난 복구 담당관
- RISK: 중대 시설 누락 → 필수 시설 가중치 상향
- SUCCESS: critical 시설 TOP3 보장
- SCOPE: `disaster-recovery-prioritizer.ts`

## 요구사항
- FR-454.1: Facility = { id, type, damage:0-1, residents, criticality:'low'|'med'|'high' }
- FR-454.2: criticality 가중: low=1, med=2, high=3
- FR-454.3: score = damage * 0.4 + (residents/10000, max 1.0) * 0.3 + critWeight/3 * 0.3
- FR-454.4: score 내림차순 정렬 → rank 부여
- FR-454.5: damage ≥ 0.8 AND criticality = high → URGENT 태그
- FR-454.6: N2SF C/S 차단 + `getAuditLog()`

## 추적성
FR-454.* ↔ `disaster-recovery-prioritizer.ts` ↔ 테스트 ↔ CSAP D-06 N2SF N-05
