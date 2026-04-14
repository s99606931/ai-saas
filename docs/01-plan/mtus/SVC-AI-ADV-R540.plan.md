# SVC-AI-ADV-R540 Plan — AI기반 공공기관 업무 자동화 v2

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 반복적 행정 업무를 자동화하여 공무원 업무 부하 절감 |
| WHO | 업무 혁신 담당자, 행정 자동화팀 |
| RISK | 자동화 오류로 인한 행정 처리 실수 방지 |
| SUCCESS | SC-R540-1: 업무 분류 / SC-R540-2: 자동화 적합성 평가 / SC-R540-3: 자동화 권고 |
| SCOPE | public-workflow-automation-v2.ts 구현 |

## 요구사항
- FR-R540.1: 입력 (taskId, name, repetitionRate 0~1, manualSteps, avgDurationMin, errorProne: boolean)
- FR-R540.2: 자동화 점수 = repetitionRate*40 + min(manualSteps/10,1)*30 + min(avgDurationMin/60,1)*20 + (errorProne?10:0)
- FR-R540.3: 추천 (>=70: AUTOMATE, >=40: SEMI_AUTOMATE, else MANUAL)
- FR-R540.4: 예상 시간 절감 = avgDurationMin * repetitionRate * 0.8 (80% 절감 가정)
- FR-R540.5: 감사 로그 전수 기록 (getAuditLog)

## 추적성
FR-R540.* ↔ `public-workflow-automation-v2.ts` ↔ 테스트 ↔ CSAP D-06
