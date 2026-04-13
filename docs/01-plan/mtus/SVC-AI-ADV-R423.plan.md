# SVC-AI-ADV-R423 Plan — Public Transport Optimizer

## Executive Summary
| 관점 | 내용 |
|------|------|
| WHY | 공공 버스 노선 배차간격 AI 최적화로 승객 대기시간 감축 |
| WHO | 교통공사, 시내버스 운영과 |
| WHAT | 노선별 승객수/배차 → 증차/감차/유지 권고 + 예상 대기시간 |
| HOW | loadRatio = passengers/capacity 기반 임계값 결정 |

## Context Anchor
- WHY: 승객 대기시간 20% 감축 목표
- WHO: 교통공사, 시민
- RISK: 과도 감차 → 서비스 저하
- SUCCESS: 권고 정확도 ≥ 85%
- SCOPE: `public-transport-optimizer.ts`

## 요구사항
- FR-423.1: loadRatio = passengers/capacity
- FR-423.2: loadRatio > 0.85 → 'INCREASE', < 0.3 → 'DECREASE', else 'MAINTAIN'
- FR-423.3: estimatedWaitMin = 60 / headwayPerHour
- FR-423.4: N2SF C/S 차단
- FR-423.5: 감사 로그 + 권고 사유

## 추적성
FR-423.* ↔ `public-transport-optimizer.ts` ↔ 테스트 ↔ CSAP D-06 N2SF N-05
