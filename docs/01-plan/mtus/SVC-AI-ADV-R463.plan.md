# SVC-AI-ADV-R463 Plan — 공중 보건 비상 조기 탐지기

## Executive Summary
| 관점 | 내용 |
|------|------|
| WHY | 감염병·보건 이상 징후 조기 포착 |
| WHO | 질병관리본부, 보건소 |
| WHAT | 증상 보고 시계열 → 이상 급증 탐지 + 경보 수준 |
| HOW | 이동 평균 대비 편차·급증률 기반 trigger |

## Context Anchor
- WHY: 감염병 초기 대응 지연 시 파급 효과 큼
- WHO: 공중보건 대응팀
- RISK: 거짓 경보 → confidence 기반 필터
- SUCCESS: 이상 탐지 정확도 ≥ 85%
- SCOPE: `public-health-emergency-detector.ts`

## 요구사항
- FR-463.1: `SymptomReport = { date: 'YYYY-MM-DD', symptom, count, regionId }`
- FR-463.2: `detect(reports[])` → `{ alertLevel: 'normal'|'warning'|'critical', anomalies[] }`
- FR-463.3: 동일 symptom+region의 최근 count가 이전 평균의 3배 초과 시 anomaly
- FR-463.4: anomaly 2건 이상 → warning, 5건 이상 → critical
- FR-463.5: N2SF C/S 차단 + `getAuditLog()`

## 추적성
FR-463.* ↔ `public-health-emergency-detector.ts` ↔ 테스트 ↔ CSAP D-06 N2SF N-05
