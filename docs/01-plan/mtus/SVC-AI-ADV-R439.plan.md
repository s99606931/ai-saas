# SVC-AI-ADV-R439 Plan — AI기반 자동 장애 시나리오 시뮬레이션 v2

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 공공 SaaS 장애 대응 훈련을 자동화하여 SRE 팀 실전 대비 강화 |
| WHO | SRE 엔지니어, 운영팀 |
| RISK | 시뮬레이션과 실제 환경 혼동 방지 필요 |
| SUCCESS | SC-R439-1: 시나리오 등록 감사 로그 / SC-R439-2: 심각도별 영향도 계산 / SC-R439-3: C/S 등급 차단 |
| SCOPE | failure-scenario-simulator-v2.ts 구현 |

## 요구사항
- FR-R439.1: 장애 시나리오 등록 (scenarioId, name, severity: critical/high/medium/low)
- FR-R439.2: 심각도별 영향도 점수 (critical:100, high:70, medium:40, low:10)
- FR-R439.3: 시뮬레이션 실행 및 감사 로그 기록
- FR-R439.4: 활성 시나리오 목록 조회
- FR-R439.5: N2SF N-05 C/S 등급 차단

## 추적성
FR-R439.* ↔ `failure-scenario-simulator-v2.ts` ↔ 테스트 ↔ CSAP D-06 N2SF N-05
