# SVC-AI-ADV-R440 Plan — Smart City Integrated Dashboard AI

## Executive Summary
| 관점 | 내용 |
|------|------|
| WHY | 도시 KPI 실시간 수집 + 이상 감지 + 통합 스냅샷 생성 |
| WHO | 스마트시티 운영센터, 시장실 |
| WHAT | 다중 도메인 KPI → 이상 항목 + 종합 지수 |
| HOW | Z-score 이상 감지 + 도메인별 가중 평균 |

## Context Anchor
- WHY: 의사결정 실시간성 확보
- WHO: 스마트시티 데이터 분석가
- RISK: 노이즈 → 이상 탐지 임계값 조정 필요
- SUCCESS: 이상 KPI 100% 플래그
- SCOPE: `smart-city-dashboard-ai.ts`

## 요구사항
- FR-440.1: KPI 입력 = { domain, name, value, baseline, stddev }
- FR-440.2: z = (value - baseline) / stddev; |z| ≥ 2 → 이상
- FR-440.3: 도메인별 정상화 점수 = 1 - min(|z|, 3)/3
- FR-440.4: cityIndex = 도메인 점수 평균 (0..1)
- FR-440.5: N2SF C/S 차단 + `getAuditLog()`

## 추적성
FR-440.* ↔ `smart-city-dashboard-ai.ts` ↔ 테스트 ↔ CSAP D-06 N2SF N-05
