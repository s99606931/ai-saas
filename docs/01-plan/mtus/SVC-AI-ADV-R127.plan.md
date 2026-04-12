# SVC-AI-ADV-R127 — Agent Task Scheduler (DAG)

> 작성일: 2026-04-12 | 버전: 1.0.0 | 작성자: PM Lead
> 원 요청 번호: R127

## Executive Summary

| 관점 | 내용 |
|------|------|
| 기능 | DAG 기반 에이전트 태스크 스케줄러 — 의존성 해소 + 병렬 실행 + 결과 전달 |
| 품질 | 사이클 탐지(Kahn), 병렬도 제한, 실패 전파/skipOnFailure, 결정적 실행 순서 |
| 보안 | 태스크 페이로드 등급 guard, 결과 PII 마스킹 |
| 비용 | 메모리 기반 스케줄링, 외부 의존 없음 |

## Context Anchor

- **WHY**: 복합 AI 워크플로우(검색→요약→번역→감리)는 DAG 구조. 순차 실행은 비효율 → 의존성 해소 후 병렬 실행 필요
- **WHO**: Agent orchestrator, RAG 파이프라인, 자동 감리 워크플로우
- **RISK**: 사이클·교착 → Kahn 토폴로지 정렬로 사전 검증
- **SUCCESS**: registerTask + dependsOn + run() → 결정적 순서 + 병렬 실행 + 결과 맵
- **SCOPE**: In — DAG 검증/실행/결과 집계. Out — 분산 워커 큐(외부)

## 요구사항

- **FR-R127.1**: 태스크 등록 (id, dependencies, executor)
- **FR-R127.2**: DAG 사이클 탐지 (등록 시 즉시)
- **FR-R127.3**: Kahn 알고리즘 토폴로지 정렬 (in-degree 0 우선)
- **FR-R127.4**: 의존성 해소 후 병렬 실행 (maxConcurrency 제한)
- **FR-R127.5**: 부모 결과를 자식 executor에 전달 (results map)
- **FR-R127.6**: 실패 시 의존 자손 태스크 자동 skip(`skipOnFailure: true`) 또는 abort
- **FR-R127.7**: 실행 결과 ScheduleResult { results, failed[], skipped[], duration }
- **FR-R127.8**: N2SF C/S 등급 페이로드 차단 (registerTask 시 grade 검사)
- **FR-R127.9**: `getAuditLog()`
- **NFR-R127.1**: TypeScript strict 0, 테스트 80%+

## 추적성 매트릭스

| FR ID | 구현 | 테스트 | CSAP |
|-------|------|--------|------|
| FR-R127.1~7 | agent-task-scheduler.ts | .test.ts | D-12 |
| FR-R127.8 | grade guard | test | N2SF N-05 |
| FR-R127.9 | auditLog | test | D-06 |
