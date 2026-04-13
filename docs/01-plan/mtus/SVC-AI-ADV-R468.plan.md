# SVC-AI-ADV-R468 Plan — 공공 토지 이용 최적화

## Executive Summary
| 관점 | 내용 |
|------|------|
| WHY | 공공 토지의 용도 전환 가능성을 분석해 활용도 향상 |
| WHO | 국토교통부, 한국토지주택공사 |
| WHAT | 토지 현황 → 권장 용도 + 활용 점수 |
| HOW | 면적·접근성·주변 수요 가중합 |

## Context Anchor
- WHY: 유휴 공공 토지 증가
- WHO: 토지정책과
- RISK: 규제 충돌 → 제한 체크 포함
- SUCCESS: 권장 용도 수용률 ≥ 70%
- SCOPE: `public-land-use-optimizer.ts`

## 요구사항
- FR-468.1: `Parcel = { id, areaSqm, accessScore: 0..1, demand: 'housing'|'commerce'|'park'|'industry', currentUse: string, restricted: boolean }`
- FR-468.2: `recommend(parcel)` → `{ id, recommendedUse, utilityScore: 0..100, convertible: boolean }`
- FR-468.3: restricted=true 시 convertible=false, recommendedUse=currentUse
- FR-468.4: utilityScore = 50·accessScore + (areaSqm ≥ 5000 ? 30 : 15) + (demand 가중치: housing 20, commerce 15, park 10, industry 5)
- FR-468.5: convertible = utilityScore ≥ 60
- FR-468.6: N2SF C/S 차단 + `getAuditLog()`

## 추적성
FR-468.* ↔ `public-land-use-optimizer.ts` ↔ 테스트 ↔ CSAP D-06 N2SF N-05
