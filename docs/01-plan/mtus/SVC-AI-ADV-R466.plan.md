# SVC-AI-ADV-R466 Plan — 스마트 에너지 그리드 최적화

## Executive Summary
| 관점 | 내용 |
|------|------|
| WHY | 피크 수요 시간대 부하 분산으로 전력 안정성 확보 |
| WHO | 한국전력공사, 에너지관리공단 |
| WHAT | 지역별 수요·공급 → 부하 재분배 계획 |
| HOW | 수요/공급 잔여량 기반 송전 이동량 계산 |

## Context Anchor
- WHY: 국지적 수요 초과 발생 시 광역 배분
- WHO: 그리드 운영자
- RISK: 음수 배분 → 0 이상 클램프
- SUCCESS: 수요 충족률 ≥ 95%
- SCOPE: `smart-energy-grid-optimizer.ts`

## 요구사항
- FR-466.1: `Region = { id, demandKw, supplyKw }`
- FR-466.2: `optimize(regions[])` → `{ transfers: [{from,to,amountKw}], shortageRegions[], surplusRegions[] }`
- FR-466.3: surplus = supply > demand, shortage = demand > supply
- FR-466.4: surplus 지역에서 shortage 지역으로 min(surplus, shortage) 이동
- FR-466.5: N2SF C/S 차단 + `getAuditLog()`

## 추적성
FR-466.* ↔ `smart-energy-grid-optimizer.ts` ↔ 테스트 ↔ CSAP D-06 N2SF N-05
