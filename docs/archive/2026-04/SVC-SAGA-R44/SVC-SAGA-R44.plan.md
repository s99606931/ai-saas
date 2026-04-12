# SVC-SAGA-R44 Plan — 분산 트랜잭션 Saga 오케스트레이터

| 항목 | 값 |
|------|-----|
| MTU ID | SVC-SAGA-R44 |
| 대상 | `platform/packages/saga` |
| Round | R44 |
| 작성일 | 2026-04-11 |
| 작성자 | PM Lead |
| 복잡도 | MED |
| 의존 MTU | SVC-OUTBOX-R43, SVC-BACKOFF-R42 |

---

## Executive Summary (4관점)

| 관점 | 현황 | 목표 | 측정 지표 |
|------|------|------|---------|
| 기능 | 다단계 마이크로서비스 트랜잭션의 원자성 보장 부재 | 보상 트랜잭션 기반 Saga 오케스트레이션 | 단계 실패 시 100% 롤백 |
| 품질 | 분산 실패 시 부분 커밋으로 데이터 불일치 가능 | 단계 추적 + 재시도 + 보상 자동 실행 | 테스트 12개 이상 전수 통과 |
| 보안 | 감사 추적 부재 | 모든 단계 전이 감사 로그 (CSAP D-06) | audit.jsonl 기록율 100% |
| 운영 | 실패 복구 수작업 필요 | 재시도·타임아웃·dead letter 지원 | 관측 가능한 상태 머신 |

---

## Context Anchor

- **WHY**: 여러 서비스(결제, 재고, 알림 등)를 순차 호출하는 비즈니스 플로우에서 중간 실패 시 이미 커밋된 단계의 원복이 필요. 분산 트랜잭션(2PC)은 가용성 저하로 공공 SaaS 환경에 부적합. Saga 패턴으로 완결성 + 가용성을 동시 확보.
- **WHO**: billing-service, subscription-service, crm-service, notification-service 등 다단계 워크플로우를 수행하는 마이크로서비스.
- **RISK**: 보상 단계 자체가 실패할 경우 수동 개입 필요. 단계 간 순서·멱등성 가정 실수 시 부분 재적용 위험.
- **SUCCESS**: (1) 단일 코드로 단계 + 보상 정의, (2) 단계 실패 시 역순 보상 자동 호출, (3) 완료/실패/진행 중 상태 추적, (4) 감사 로그로 전이 전수 기록.
- **SCOPE**: In-memory 상태 저장 + 훅 기반 영속화 가능 구조. 외부 큐/메시징 미포함 (caller가 외부 드라이버 주입). RPC 통신 코드 미포함.

---

## 기능 요구사항 (FR)

| ID | 요구사항 | 우선순위 | 수용 기준 |
|----|----------|---------|----------|
| FR-SAGA.1 | Saga 정의는 단계(step)별 `execute`와 `compensate` 핸들러를 포함한다 | M | 최소 2단계 Saga 실행 가능 |
| FR-SAGA.2 | 모든 단계 성공 시 전체 상태는 `completed`로 전이한다 | M | 단위 테스트 검증 |
| FR-SAGA.3 | 특정 단계 실패 시 이전에 성공한 단계를 역순으로 보상 호출한다 | M | 3단계 중 2단계 실패 시 1단계 보상 호출 |
| FR-SAGA.4 | 보상 실행 성공 시 상태는 `compensated`, 실패 시 `failed_compensation` | M | 양쪽 경로 테스트 |
| FR-SAGA.5 | 모든 단계 전이(start, step_ok, step_fail, compensate_ok, compensate_fail, end)는 이벤트 훅을 통해 감사 가능하다 | M | onTransition 콜백 전수 호출 |
| FR-SAGA.6 | Saga 컨텍스트는 단계 간 가변 공유 객체로 제공된다 | M | step1 결과가 step2에서 사용 가능 |
| FR-SAGA.7 | 각 단계에 타임아웃 지정 가능. 초과 시 실패로 처리 | S | 타임아웃 테스트 통과 |
| FR-SAGA.8 | 이미 실행 중인 Saga를 두 번 실행 불가 (재진입 금지) | M | 재실행 시 예외 |
| FR-SAGA.9 | Saga 상태는 외부 제공 store에 저장 가능 (훅 기반) | S | MemorySagaStore 기본 구현 + 커스텀 store 주입 |
| FR-SAGA.10 | 보상 단계에서 발생한 에러는 원본 에러와 함께 집계 반환 | M | `SagaExecutionError`로 래핑 |

비기능:
- NFR-SAGA.1: 메모리 사용 단일 Saga 1MB 이하.
- NFR-SAGA.2: 10단계 Saga 오버헤드 < 5ms (핸들러 제외).

---

## 추적성 매트릭스

| FR | 산출물 | 테스트 | CSAP |
|----|--------|--------|------|
| FR-SAGA.1 | `saga.ts::SagaDefinition` | `saga.test.ts::정의` | D-12 |
| FR-SAGA.2 | `saga.ts::Saga.execute` | `saga.test.ts::완료 경로` | D-12 |
| FR-SAGA.3 | `saga.ts::compensate` | `saga.test.ts::역순 보상` | D-12 |
| FR-SAGA.4 | `saga.ts::finalizeCompensation` | `saga.test.ts::보상 실패 전이` | D-12 |
| FR-SAGA.5 | `saga.ts::onTransition` | `saga.test.ts::이벤트 훅` | D-06 |
| FR-SAGA.6 | `saga.ts::SagaContext` | `saga.test.ts::컨텍스트 공유` | - |
| FR-SAGA.7 | `saga.ts::withTimeout` | `saga.test.ts::타임아웃` | D-14 |
| FR-SAGA.8 | `saga.ts::Saga.execute 재진입` | `saga.test.ts::중복 실행` | - |
| FR-SAGA.9 | `saga.ts::MemorySagaStore` | `saga.test.ts::store 주입` | D-06 |
| FR-SAGA.10 | `saga.ts::SagaExecutionError` | `saga.test.ts::에러 집계` | - |

---

## Q-Gate 목표

- G1 FR 전수: 10/10
- G2 설계 완전성: Design 문서에서 상태 머신 다이어그램 + 타입 정의 완비
- G3 코드 품질: ts-strict, 함수 80줄 이하, 중첩 4단계 이하
- G4 테스트 커버리지: 12개 이상 테스트, 라인 커버리지 85%+
- G5 OWASP: 입력 검증 (step 이름 중복 금지)
- G6 CSAP: D-06 감사 훅 제공, D-12 입력 검증, D-14 타임아웃
- G7 audit.jsonl 기록
