# SVC-AI-ADV-R422 Plan — Smart Parking Allocator AI

## Executive Summary
| 관점 | 내용 |
|------|------|
| WHY | 공공기관 주차장 포화 해소 및 우선순위 기반 자동 배정 |
| WHO | 시설관리팀, 방문 민원인 |
| WHAT | 주차 요청 + 슬롯 풀 → 우선순위 기반 최적 슬롯 할당 |
| HOW | 우선순위 스코어(EMERGENCY/DISABLED/STAFF/VISITOR) + nearest-fit |

## Context Anchor
- WHY: 공공기관 주차 혼란 감소
- WHO: 시설관리팀
- RISK: 비상차량 슬롯 선점 방지
- SUCCESS: 우선순위 위반 0건, 활용률 경보 정상
- SCOPE: `smart-parking-allocator-ai.ts`

## 요구사항
- FR-422.1: 우선순위(EMERGENCY=100>DISABLED=90>STAFF=60>VISITOR=30) 내림차순 배정
- FR-422.2: 가용 슬롯 없으면 assigned=null, reason='NO_SLOT'
- FR-422.3: 활용률 > 0.9 → alert='SATURATED'
- FR-422.4: N2SF C/S 차단
- FR-422.5: 감사 로그(`getAuditLog()`) + 배정 이력

## 추적성
FR-422.* ↔ `smart-parking-allocator-ai.ts` ↔ 테스트 ↔ CSAP D-06 N2SF N-05
