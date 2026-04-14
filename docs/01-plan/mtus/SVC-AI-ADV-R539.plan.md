# SVC-AI-ADV-R539 Plan — AI기반 자동 장애 근원 분석 v2

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 장애 발생 시 근원 원인을 자동 분석하여 복구 시간 단축 |
| WHO | SRE, 장애 대응팀 |
| RISK | 잘못된 근원 분석으로 인한 복구 지연 방지 |
| SUCCESS | SC-R539-1: 이벤트 수집 / SC-R539-2: 근원 분석 / SC-R539-3: 복구 권고 |
| SCOPE | root-cause-analyzer-v2.ts 구현 |

## 요구사항
- FR-R539.1: 입력 (incidentId, affectedService, symptoms: string[], errorRate, latencySpike, memUsage)
- FR-R539.2: 근원 분류 (errorRate>0.5: CODE_ERROR, latencySpike>5000: RESOURCE_EXHAUSTION, memUsage>90: MEMORY_LEAK, else UNKNOWN)
- FR-R539.3: 심각도 (CODE_ERROR&&errorRate>0.8: CRITICAL, RESOURCE_EXHAUSTION||CODE_ERROR: HIGH, MEMORY_LEAK: MEDIUM, else LOW)
- FR-R539.4: 복구 권고 (CRITICAL: ROLLBACK, HIGH: SCALE_OUT, MEDIUM: RESTART, LOW: MONITOR)
- FR-R539.5: 감사 로그 전수 기록 (getAuditLog)

## 추적성
FR-R539.* ↔ `root-cause-analyzer-v2.ts` ↔ 테스트 ↔ CSAP D-06
