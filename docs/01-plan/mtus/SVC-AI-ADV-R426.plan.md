# SVC-AI-ADV-R426 Plan — Workforce Planning AI

## Executive Summary
| 관점 | 내용 |
|------|------|
| WHY | 부서별 업무량/현원 기반 최적 인력 배치 권고 |
| WHO | 인사기획팀, 조직 관리 |
| WHAT | 부서 데이터 → 증원/감원/유지 권고 + 필요 인원 델타 |
| HOW | loadPerHead = workload/headcount 기준 임계값 권고 |

## Context Anchor
- WHY: 과부하 부서 식별
- WHO: 인사기획팀
- RISK: 감원 권고 민감성
- SUCCESS: 권고 수용률 ≥ 70%
- SCOPE: `workforce-planning-ai.ts`

## 요구사항
- FR-426.1: loadPerHead = workload / headcount
- FR-426.2: > threshold×1.2 → 'INCREASE', < threshold×0.6 → 'DECREASE', else 'MAINTAIN'
- FR-426.3: neededDelta = round(workload/threshold) - headcount
- FR-426.4: N2SF C/S 차단
- FR-426.5: 감사 로그 + 증원 필요 상위 3개

## 추적성
FR-426.* ↔ `workforce-planning-ai.ts` ↔ 테스트 ↔ CSAP D-06 N2SF N-05
