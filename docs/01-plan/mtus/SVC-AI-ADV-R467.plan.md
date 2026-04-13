# SVC-AI-ADV-R467 Plan — AI 법원 일정 자동 배정

## Executive Summary
| 관점 | 내용 |
|------|------|
| WHY | 재판부별 업무 부하에 따라 사건 일정 자동 배정 |
| WHO | 법원행정처, 사법행정시스템 운영팀 |
| WHAT | 사건 + 재판부 → 배정 결과 |
| HOW | 사건 유형·우선순위·재판부 가용일 매칭 |

## Context Anchor
- WHY: 사건 적체 해소 및 공정성 확보
- WHO: 사건 배당 담당관
- RISK: 과부하 → 일일 최대 사건 수 제한
- SUCCESS: 전 재판부 부하 표준편차 ≤ 기준
- SCOPE: `ai-court-scheduling.ts`

## 요구사항
- FR-467.1: `Case = { id, type: 'civil'|'criminal'|'admin', priority: 1..5 }`
- FR-467.2: `Judge = { id, specialties: CaseType[], dailyCapacity: number, currentLoad: number }`
- FR-467.3: `schedule(cases[], judges[])` → `{ assignments: [{caseId, judgeId}], unscheduled[] }`
- FR-467.4: 배정 규칙: specialty 일치 + currentLoad < dailyCapacity, priority 높은 순
- FR-467.5: 배정 시 judge.currentLoad += 1
- FR-467.6: 배정 불가 시 unscheduled에 추가
- FR-467.7: N2SF C/S 차단 + `getAuditLog()`

## 추적성
FR-467.* ↔ `ai-court-scheduling.ts` ↔ 테스트 ↔ CSAP D-06 N2SF N-05
