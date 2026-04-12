# SVC-WORKFLOW-R20 Plan -- 비동기 워크플로우 엔진

> Design Ref: SVC-WORKFLOW-R20 Plan
> CSAP: D-10 접근 제어, D-06 침해사고 관리 (감사 추적)
> 작성일: 2026-04-09

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 공공기관 SaaS에서 복잡한 비동기 프로세스(결재, 승인, 배포 파이프라인)를 선언적으로 정의하고 안전하게 실행 |
| 기술 | Step 기반 상태 머신 + Saga 보상 트랜잭션 + 재시도 + 타임아웃 + EventBus 연동 |
| 규제 | CSAP D-06 감사 로깅 (워크플로우 전이 전수 기록), D-10 권한 기반 워크플로우 실행 |
| 운영 | 워크플로우 시각화, 실패 복구, 데드레터 처리 자동화 |

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | 서비스 간 비동기 프로세스(사용자 등록 → 테넌트 생성 → 알림 발송 등)를 안전하게 오케스트레이션 |
| WHO | 플랫폼 개발자 (워크플로우 정의), 운영자 (모니터링), 감사인 (추적) |
| RISK | 분산 트랜잭션 실패 시 데이터 불일치, 무한 재시도 루프, 보상 트랜잭션 누락 |
| SUCCESS | 워크플로우 정의 → 실행 → 보상 → 감사 로깅 전 과정 자동화 |
| SCOPE | @public-saas/workflow-engine 패키지 + Fastify 플러그인 |

## 기능 요구사항

| ID | 요구사항 | 우선순위 | 검증 기준 |
|----|---------|---------|----------|
| FR-WF.1 | Step 기반 워크플로우 정의 (WorkflowDefinition) | P0 | 3단계 이상 워크플로우 정의 및 실행 |
| FR-WF.2 | 워크플로우 실행 엔진 (WorkflowEngine) | P0 | 워크플로우 생성 → 단계별 실행 → 완료 상태 전이 |
| FR-WF.3 | Saga 보상 트랜잭션 | P0 | 중간 단계 실패 시 역순으로 보상 핸들러 실행 |
| FR-WF.4 | 재시도 + 지수 백오프 | P1 | 단계 실패 시 설정된 횟수만큼 재시도 후 보상 |
| FR-WF.5 | 단계별 타임아웃 | P1 | 타임아웃 초과 시 실패 처리 + 보상 |
| FR-WF.6 | EventBus 연동 | P1 | 워크플로우 상태 전이 시 이벤트 발행 |
| FR-WF.7 | Fastify 플러그인 통합 | P1 | 플러그인 등록, /workflows/stats 엔드포인트 |
| FR-WF.8 | 워크플로우 인스턴스 조회 | P2 | 실행 중/완료/실패 워크플로우 목록 및 상세 조회 |

## 비기능 요구사항

| ID | 요구사항 | 기준 |
|----|---------|------|
| NFR-WF.1 | 워크플로우 상태 전이 전수 감사 로깅 | CSAP D-06 |
| NFR-WF.2 | 동시 실행 워크플로우 100개 이상 처리 | 성능 |
| NFR-WF.3 | 보상 트랜잭션 실패 시 데드레터 큐 저장 | 안정성 |

## 산출물

| 파일 | 설명 |
|------|------|
| `platform/packages/workflow-engine/src/workflow-definition.ts` | 워크플로우/단계 정의 타입 |
| `platform/packages/workflow-engine/src/workflow-engine.ts` | 핵심 실행 엔진 |
| `platform/packages/workflow-engine/src/workflow-plugin.ts` | Fastify 플러그인 |
| `platform/packages/workflow-engine/src/index.ts` | 엔트리포인트 |
| `platform/packages/workflow-engine/tests/workflow-definition.test.ts` | 정의 테스트 |
| `platform/packages/workflow-engine/tests/workflow-engine.test.ts` | 엔진 테스트 |
| `platform/packages/workflow-engine/tests/workflow-plugin.test.ts` | 플러그인 테스트 |

## 추적성 매트릭스

| FR | 소스 파일 | 테스트 | CSAP |
|----|----------|--------|------|
| FR-WF.1 | workflow-definition.ts | workflow-definition.test.ts | - |
| FR-WF.2 | workflow-engine.ts | workflow-engine.test.ts | D-10 |
| FR-WF.3 | workflow-engine.ts | workflow-engine.test.ts | D-06 |
| FR-WF.4 | workflow-engine.ts | workflow-engine.test.ts | - |
| FR-WF.5 | workflow-engine.ts | workflow-engine.test.ts | - |
| FR-WF.6 | workflow-engine.ts | workflow-engine.test.ts | D-06 |
| FR-WF.7 | workflow-plugin.ts | workflow-plugin.test.ts | D-10 |
| FR-WF.8 | workflow-engine.ts | workflow-engine.test.ts | - |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 0.1.0 | 2026-04-09 | 초안 작성 | PM Lead |
