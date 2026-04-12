# SVC-AI-ADV-R108-microservice — Microservice Dependency Analyzer

> 작성일: 2026-04-12 | 버전: 1.0.0 | 작성자: Implementer
> 세션: #트랙B (R106~R113)

## Executive Summary

| 관점 | 내용 |
|------|------|
| 기능 | 서비스 간 의존성 그래프 자동 생성 + 순환 의존 탐지 + 영향 분석 |
| 품질 | 순환 의존 100% 탐지, 그래프 탐색 정확도 |
| 보안 | 내부 메트릭 전용, 외부 전송 없음 |
| 비용 | 순수 그래프 계산, LLM 없음 |

## Context Anchor

- **WHY**: 마이크로서비스 아키텍처에서 순환 의존성은 배포 실패와 장애 전파의 주요 원인. 수동 추적 불가능.
- **WHO**: 아키텍트, DevOps 엔지니어
- **RISK**: 순환 의존 미탐지로 배포 교착, 영향 분석 오류로 잘못된 롤백
- **SUCCESS**: 서비스 등록 → 의존성 선언 → 순환 탐지 → 영향 경로 분석 완결
- **SCOPE**: In — 방향성 그래프 관리, 순환 탐지(DFS), 영향 경로 BFS. Out — 실제 서비스 통신 모니터링.

## 요구사항

- **FR-R108-M.1**: `registerService(serviceId, metadata)` — 서비스 등록
- **FR-R108-M.2**: `addDependency(from, to, type)` — 의존성 선언
- **FR-R108-M.3**: `detectCycles()` — 순환 의존 목록 반환 (DFS)
- **FR-R108-M.4**: `getImpactPath(serviceId)` — 특정 서비스 변경 시 영향받는 서비스 목록 (BFS)
- **FR-R108-M.5**: `exportGraph()` — 전체 의존성 그래프 JSON 직렬화
- **FR-R108-M.6**: `getAuditLog()` — 등록/변경 이력 (CSAP D-06)
- **NFR-R108-M.1**: TypeScript strict 0 에러, 테스트 6개+
- **CSAP D-06**: 감사 로그 append-only

## 추적성 매트릭스

| FR ID | 구현 파일 | 테스트 | CSAP |
|-------|-----------|--------|------|
| FR-R108-M.1~5 | microservice-dependency-analyzer.ts | .test.ts | - |
| FR-R108-M.6 | getAuditLog() | test | D-06 |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-12 | 최초 작성 | Implementer |
