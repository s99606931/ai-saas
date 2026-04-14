# SVC-AI-ADV-R517 Plan — AI기반 공공기관 업무 병목 탐지

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 업무 프로세스에서 처리 지연 단계를 자동 탐지하여 행정 효율화 |
| WHO | 업무 프로세스 관리자, 행정 효율화 담당자 |
| RISK | 병목 방치로 인한 민원 처리 지연 방지 |
| SUCCESS | SC-R517-1: 프로세스 단계 수집 / SC-R517-2: 병목 탐지 / SC-R517-3: 개선 권고 |
| SCOPE | workflow-bottleneck-detector-ai.ts 구현 |

## 요구사항
- FR-R517.1: 단계 입력 (stepId, name, avgDurationMin, expectedDurationMin, queueSize)
- FR-R517.2: 병목 판정 (avgDurationMin > expectedDurationMin*1.5: BOTTLENECK, >expectedDurationMin*1.2: WARNING, else NORMAL)
- FR-R517.3: 심각도 (avgDurationMin > expectedDurationMin*2||queueSize>50: CRITICAL, BOTTLENECK: HIGH, WARNING: MEDIUM)
- FR-R517.4: 전체 흐름 건강 점수 = NORMAL 단계수/전체*100
- FR-R517.5: 감사 로그 전수 기록 (getAuditLog)

## 추적성
FR-R517.* ↔ `workflow-bottleneck-detector-ai.ts` ↔ 테스트 ↔ CSAP D-06
