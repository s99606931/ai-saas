# SVC-AI-ADV-R76 — Report (Agent Dry-Run Simulator)

## Executive Summary
| 관점 | 목표 | 실제 |
|---|---|---|
| 비즈니스 | 에이전트 사고 예방 | ✅ 가상 실행 부작용 0 |
| 기술 | side-effect/위험 산출 | ✅ 5종 effect + riskScore |
| 보안 | CSAP D-06/D-12, N2SF N-05 | ✅ 감사/차단 |
| 품질 | Q-Gate G1~G7 | ✅ 전수 |

## Key Decisions
- Pragmatic Balance 옵션 채택 (Tool Registry + 가상 훅)
- 알려지지 않은 도구는 즉시 BLOCKED (화이트리스트 강제)
- C/S 등급 도구 호출은 실행 중단 후 감사 로그 기록

## SC Final
- FR-R76.1 ✅ registerTool + 검증
- FR-R76.2 ✅ 계획 파싱/단계 검증
- FR-R76.3 ✅ side-effect 집계
- FR-R76.4 ✅ riskScore + highRiskSteps
- FR-R76.5 ✅ getAuditLog + 4가지 이벤트

## 이슈 및 해결
- 기존 Design 초안(Speculative Decoding)이 Plan과 불일치 → Plan 정의(Dry-Run Simulator)로 재작성하여 추적성 복구
