# SVC-AI-ADV-R446 Plan — 공공 에너지 소비 최적화 AI

## Executive Summary
| 관점 | 내용 |
|------|------|
| WHY | 건물별 에너지 낭비 감지 + 절감 권고 |
| WHO | 공공건물 관리부서, 에너지공단 |
| WHAT | 건물 에너지 사용량 → 낭비 항목 + 절감안 |
| HOW | 단위 면적당 소비 기준치 비교 |

## Context Anchor
- WHY: 에너지 비용 절감 + 탄소중립
- WHO: 시설관리자
- RISK: 건물 특성 차이 → 용도별 기준치
- SUCCESS: 초과 건물 100% 식별
- SCOPE: `public-energy-optimizer-ai.ts`

## 요구사항
- FR-446.1: Building = { id, area, use: 'office'|'school'|'hospital', kwh }
- FR-446.2: benchmark table: office=100, school=80, hospital=150 (kWh/㎡)
- FR-446.3: ratio = kwh/area / benchmark
- FR-446.4: >1.3 → WASTE + 권고 (단열/조명/HVAC)
- FR-446.5: N2SF C/S 차단 + `getAuditLog()`

## 추적성
FR-446.* ↔ `public-energy-optimizer-ai.ts` ↔ 테스트 ↔ CSAP D-06 N2SF N-05
