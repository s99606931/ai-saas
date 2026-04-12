# SVC-AI-ADV-R61 — Tool-Use Planner (멀티스텝 도구 사용 계획 + 백트래킹)

## Executive Summary

| 관점 | 내용 |
|------|------|
| **기술** | 사용자 목표를 서브골로 분해, 도구 호출 시퀀스 생성, 실패 시 백트래킹 |
| **보안** | 도구별 권한 검사(RBAC) 선행, 외부 툴 호출 전 승인 플래그 |
| **규제** | CSAP D-08 접근 통제, 감사 기록 |
| **운영** | 계획/실행 로그 DAG 형태 저장, 재실행 가능 |

## Context Anchor

- **WHY**: 단일 함수 호출로는 해결 불가한 복합 업무(민원 처리, 감리 수집) 자동화.
- **WHO**: `ai-agent.handler`에서 `planner.plan(goal) → planner.execute(plan)` 사용.
- **RISK**: 도구 실패 반복 → 최대 백트래킹 depth·재시도 제한.
- **SUCCESS**: 3단계 이상 골 태스크 평균 성공률 ≥ 85%.
- **SCOPE**: `tool-use-planner.ts` + 테스트.

## 기능 요구사항

| ID | 요구사항 | 검증 |
|----|---------|------|
| FR-R61.1 | 목표 → 서브골 DAG 생성 | `plan()` |
| FR-R61.2 | 도구 호출 실행 엔진 | `execute()` |
| FR-R61.3 | 실패 시 백트래킹 | `backtrack()` |
| FR-R61.4 | 최대 depth/시도 제한 | 기본 5/3 |
| FR-R61.5 | 도구 권한 검사 | `checkToolPermission()` |
| FR-R61.6 | 감사 로그/N2SF 차단 | D-06 / N-05 |

## 추적성 매트릭스

| FR | 함수 | 테스트 | CSAP |
|----|------|--------|------|
| FR-R61.1 | `plan` | `dag-build` | - |
| FR-R61.2 | `execute` | `execute-plan` | - |
| FR-R61.3 | `backtrack` | `backtrack` | - |
| FR-R61.4 | `enforceLimits` | `depth-limit` | - |
| FR-R61.5 | `checkToolPermission` | `rbac-check` | D-08 |
| FR-R61.6 | `getAuditLog` | `audit` | D-06 |
