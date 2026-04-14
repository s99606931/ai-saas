# SVC-AI-ADV-R605 (v3) Plan — AI기반 장애 근본 원인 분석 v3

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 장애 발생 시 메트릭 시그널을 자동 분석하여 근본 원인 후보 도출 |
| WHO | SRE, 운영팀 |
| RISK | 잘못된 원인 식별로 인한 복구 지연 방지 |
| SUCCESS | SC-R605v3-1: 시그널 분류 / SC-R605v3-2: 권고 / SC-R605v3-3: 감사 로그 |
| SCOPE | incident-root-cause-ai-v3.ts 구현 (트랙 A 22차) |

## 기능 요구사항
- FR-R605v3.1: 입력 (incidentId, errorRate, latencyMs, cpuPct, memPct, deployedRecently: boolean)
- FR-R605v3.2: 원인 분류
  - errorRate>0.5 → CODE_ERROR
  - latencyMs>5000 → RESOURCE_EXHAUSTION
  - memPct>90 → MEMORY_LEAK
  - deployedRecently → RECENT_DEPLOY
  - else → UNKNOWN
- FR-R605v3.3: 권고 (CODE_ERROR/RECENT_DEPLOY → ROLLBACK, RESOURCE_EXHAUSTION/MEMORY_LEAK → SCALE_OUT, UNKNOWN → MONITOR)
- FR-R605v3.4: severity 산정 (CODE_ERROR=CRITICAL, RECENT_DEPLOY=HIGH, RESOURCE_EXHAUSTION=HIGH, MEMORY_LEAK=HIGH, UNKNOWN=LOW)
- FR-R605v3.5: 감사 로그 기록

## 추적성
FR-R605v3.* ↔ `incident-root-cause-ai-v3.ts` ↔ 테스트 ↔ CSAP D-06
