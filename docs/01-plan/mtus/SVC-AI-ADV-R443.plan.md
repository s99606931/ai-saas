# SVC-AI-ADV-R443 Plan — 지능형 교육 지원 시스템

## Executive Summary
| 관점 | 내용 |
|------|------|
| WHY | 학습 격차 조기 감지 + 맞춤형 학습 경로 권고 |
| WHO | 초중고 교사, 교육청 장학사 |
| WHAT | 학생 성적 → 격차 + 개별 학습 경로 |
| HOW | 평균 비교 + 취약 과목 추출 |

## Context Anchor
- WHY: 학습 격차 조기 해소
- WHO: 교사·학부모
- RISK: 낙인 → 등급 표시 신중
- SUCCESS: 취약 과목 100% 식별
- SCOPE: `education-support-system.ts`

## 요구사항
- FR-443.1: Student = { id, scores: Record<subject, number> }
- FR-443.2: cohortAvg = 전체 학생 과목별 평균
- FR-443.3: 학생 과목 점수 < cohortAvg - 10 → WEAK
- FR-443.4: recommendations: 각 WEAK 과목 → `${subject} 보충 프로그램`
- FR-443.5: N2SF C/S 차단 + `getAuditLog()`

## 추적성
FR-443.* ↔ `education-support-system.ts` ↔ 테스트 ↔ CSAP D-06 N2SF N-05
