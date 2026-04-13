# SVC-AI-ADV-R430 Plan — Smart Grid Load Balancer AI

## Executive Summary
| 관점 | 내용 |
|------|------|
| WHY | 공공 전력 수요 지역별 부하 균형 AI 조정 |
| WHO | 한전, 공공 에너지 관리 센터 |
| WHAT | 지역별 부하 + 발전 용량 → 재분배 권고 |
| HOW | 부하율 분석 + OVERLOAD→저부하 이전 제안 |

## Context Anchor
- WHY: 블랙아웃 방지 및 비용 절감
- WHO: 에너지 운영 센터
- RISK: 긴급 실시간성 요구
- SUCCESS: 과부하 구역 탐지 ≥ 95%
- SCOPE: `smart-grid-load-balancer-ai.ts`

## 요구사항
- FR-430.1: loadRatio = demandMW / capacityMW
- FR-430.2: >0.9 → 'OVERLOAD', <0.5 → 'SLACK', else 'NORMAL'
- FR-430.3: OVERLOAD 지역 overflow = demand - capacity×0.9
- FR-430.4: transferMW = min(overflow, sourceSlack) (source = SLACK 지역)
- FR-430.5: N2SF C/S 차단 + 감사 로그

## 추적성
FR-430.* ↔ `smart-grid-load-balancer-ai.ts` ↔ 테스트 ↔ CSAP D-06 N2SF N-05
