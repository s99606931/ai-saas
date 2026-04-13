# SVC-AI-ADV-R462 Plan — AI 기반 도시 교통 신호 제어기

## Executive Summary
| 관점 | 내용 |
|------|------|
| WHY | 교차로별 실시간 교통량에 따른 신호 주기 최적화 |
| WHO | 교통정보센터, 도시계획과 |
| WHAT | 교차로 교통량 → 신호 주기(초) + 우선순위 방향 |
| HOW | 방향별 차량 수 비례 녹색 시간 배분 + 최소/최대 보장 |

## Context Anchor
- WHY: 고정 신호 주기 비효율 해소
- WHO: 교통 제어 운영자
- RISK: 비현실적 주기 배분 → min/max 클램프
- SUCCESS: 병목 방향 녹색 시간 ≥ 평균 대비 +20%
- SCOPE: `ai-urban-traffic-controller.ts`

## 요구사항
- FR-462.1: `Intersection = { id, directions: { N,S,E,W: vehicleCount } }`
- FR-462.2: `optimize(intersection)` → `{ id, greenTimes: { N,S,E,W }, totalCycleSec, priorityDir }`
- FR-462.3: 각 방향 최소 10초, 최대 60초, 총 주기 60~120초
- FR-462.4: priorityDir = 차량 수 최대인 방향
- FR-462.5: N2SF C/S 차단 + `getAuditLog()`

## 추적성
FR-462.* ↔ `ai-urban-traffic-controller.ts` ↔ 테스트 ↔ CSAP D-06 N2SF N-05
