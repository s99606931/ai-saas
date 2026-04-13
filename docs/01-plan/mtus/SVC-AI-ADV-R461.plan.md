# SVC-AI-ADV-R461 Plan — 공공 안전 사건 자동 추적기

## Executive Summary
| 관점 | 내용 |
|------|------|
| WHY | 공공 안전 사건의 발생·패턴을 자동 추적하여 대응 속도 향상 |
| WHO | 국민안전처, 지자체 안전도시 운영부서 |
| WHAT | 사건 이벤트 시계열 → 패턴 분석 + 위험 알림 |
| HOW | 카테고리·지역·시간대 그룹핑 + 빈도 임계 초과 탐지 |

## Context Anchor
- WHY: 동일 유형 사건 반복 시 조기 경보 필요
- WHO: 안전사건 대응팀
- RISK: 오탐지 → threshold 튜닝 및 confidence 포함
- SUCCESS: 패턴 적중률 ≥ 80%
- SCOPE: `public-safety-incident-tracker.ts`

## 요구사항
- FR-461.1: `Incident = { id, category, regionId, timestamp, severity: 1..5 }`
- FR-461.2: `track(incidents[])` → 카테고리별·지역별 집계 및 Top 위험 지역 도출
- FR-461.3: 동일 category+regionId 빈도가 threshold(기본 3) 초과 시 `PatternAlert` 생성
- FR-461.4: 평균 severity ≥ 4 이면 `hotspot = true`
- FR-461.5: N2SF C/S 차단 + `getAuditLog()`

## 추적성
FR-461.* ↔ `public-safety-incident-tracker.ts` ↔ 테스트 ↔ CSAP D-06 N2SF N-05
