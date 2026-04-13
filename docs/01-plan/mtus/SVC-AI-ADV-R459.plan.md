# SVC-AI-ADV-R459 Plan — 스마트 폐기물 관리 AI

## Executive Summary
| 관점 | 내용 |
|------|------|
| WHY | IoT 기반 쓰레기통 수거 경로 최적화 |
| WHO | 환경미화과, 위생과 |
| WHAT | 쓰레기통 상태 → 수거 우선순위 경로 |
| HOW | 충진율 임계값 + 최근접 이웃 탐욕법 |

## Context Anchor
- WHY: 수거 경로 최적화로 비용 절감
- WHO: 환경 담당자
- RISK: 긴급 처리 누락 → 오버플로우 임계값 우선
- SUCCESS: 80%+ 충진 통 100% 포함
- SCOPE: `smart-waste-management-ai.ts`

## 요구사항
- FR-459.1: Bin = { id, fillLevel:0-1, x, y }
- FR-459.2: 수거 대상 = fillLevel >= 0.8
- FR-459.3: 시작점 (0,0)에서 nearest-neighbor 탐욕 순회
- FR-459.4: 경로 = bin id 순서 배열
- FR-459.5: 오버플로우(1.0 이상) 발견 시 알람 (`overflow: true`)
- FR-459.6: N2SF C/S 차단 + `getAuditLog()`

## 추적성
FR-459.* ↔ `smart-waste-management-ai.ts` ↔ 테스트 ↔ CSAP D-06 N2SF N-05
