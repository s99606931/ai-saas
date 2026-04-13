# SVC-AI-ADV-R442 Plan — AI 기반 공공 보건 트렌드 분석기

## Executive Summary
| 관점 | 내용 |
|------|------|
| WHY | 감염병/만성질환/사망률 시계열 이상 패턴 자동 식별 |
| WHO | 질병관리본부, 보건 정책 분석관 |
| WHAT | 주차별 사건 시계열 → 증가율·이상구간 |
| HOW | 이동평균 + 백분율 증가 임계 |

## Context Anchor
- WHY: 조기 경보 → 대응 시간 확보
- WHO: 공공보건 분석가
- RISK: 과대 경보 → 임계값 조정
- SUCCESS: 50%+ 증가 구간 탐지
- SCOPE: `public-health-trend-analyzer.ts`

## 요구사항
- FR-442.1: 입력 = { category, weeks: number[] } (주차 값)
- FR-442.2: ma4 = 4주 이동평균; 첫 3주는 스킵
- FR-442.3: spike: 최근값 / ma4 ≥ 1.5 → SPIKE
- FR-442.4: growth = 마지막 - 첫 / 첫 (%)
- FR-442.5: N2SF C/S 차단 + `getAuditLog()`

## 추적성
FR-442.* ↔ `public-health-trend-analyzer.ts` ↔ 테스트 ↔ CSAP D-06 N2SF N-05
