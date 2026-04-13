# SVC-AI-ADV-R448 Plan — 공공 계약 이행 모니터

## Executive Summary
| 관점 | 내용 |
|------|------|
| WHY | 계약 조건 준수 자동 추적 + 위반 경보 |
| WHO | 조달청, 계약 담당관 |
| WHAT | 계약 마일스톤 + 실적 → 지연/미달 감지 |
| HOW | 만기일/진척률 비교 |

## Context Anchor
- WHY: 지연·부실 계약 사전 대응
- WHO: 계약 관리자
- RISK: 부정확 일정 → 경보 검토 필요
- SUCCESS: 지연 마일스톤 100% 탐지
- SCOPE: `public-contract-monitor.ts`

## 요구사항
- FR-448.1: Milestone = { id, dueDate(ISO), progress(0..1), weight }
- FR-448.2: today 기준 dueDate < today && progress < 1 → OVERDUE
- FR-448.3: dueDate >= today && progress < expected (dueDate 남은일 기반) → AT_RISK
- FR-448.4: overallProgress = sum(weight*progress)/sum(weight)
- FR-448.5: N2SF C/S 차단 + `getAuditLog()`

## 추적성
FR-448.* ↔ `public-contract-monitor.ts` ↔ 테스트 ↔ CSAP D-06 N2SF N-05
