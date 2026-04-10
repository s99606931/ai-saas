# SVC-CHAOS-R12 Plan -- Chaos Engineering 기초

> Round 12: 장애 복원력 검증을 위한 Chaos Engineering 패키지 구축
> 버전: 1.0.0 | 작성일: 2026-04-09 | 작성자: PM Lead

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 서비스 장애 시 자동 복구/격리로 공공기관 SLA 99.9% 보장 |
| 기술 | @public-saas/chaos 패키지: 지연 주입, 에러 주입, Circuit Breaker 패턴 |
| 보안 | CSAP D-07 가용성 요건: 장애 시 서비스 격리, graceful degradation |
| 운영 | 복원력 테스트 시나리오로 운영 장애 사전 대비 |

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | 마이크로서비스 장애 전파 방지를 위한 복원력 패턴 부재 |
| WHO | SRE 팀, k8s 운영자, 서비스 개발자 |
| RISK | Chaos 테스트 실행 중 실제 서비스 영향, 테스트 데이터 오염 |
| SUCCESS | 3종 장애 시나리오(지연/에러/타임아웃) 복원력 검증 |
| SCOPE | chaos 패키지 생성, Circuit Breaker 강화, 복원력 테스트 |

## 기능 요구사항

### FR-CHAOS.1: @public-saas/chaos 패키지 생성

**모듈 구조**:
- `ChaosEngine`: 장애 주입 엔진 (지연, 에러, 중단)
- `chaosPlugin`: Fastify 플러그인 (테스트 환경 전용)
- `ResilienceTestRunner`: 복원력 테스트 실행기

**장애 유형**:
1. **지연 주입** (latency injection): 응답 시간을 인위적으로 증가
2. **에러 주입** (error injection): 랜덤 HTTP 5xx 반환
3. **연결 실패 주입** (connection failure): DB/Redis 연결 실패 시뮬레이션

### FR-CHAOS.2: Circuit Breaker 패턴

**상태 머신**:
- CLOSED: 정상 (요청 전달)
- OPEN: 차단 (즉시 fallback 반환)
- HALF_OPEN: 일부 요청 허용 (복구 확인)

**설정**:
- 실패 임계값: 5회 (CLOSED -> OPEN)
- 타임아웃: 30초 (OPEN -> HALF_OPEN)
- 성공 임계값: 3회 (HALF_OPEN -> CLOSED)

### FR-CHAOS.3: 복원력 테스트 시나리오

**시나리오 1**: DB 연결 실패
- healthPlugin이 503 반환
- 다른 서비스는 영향 없음 (격리 확인)

**시나리오 2**: 하위 서비스 타임아웃
- api-gateway Circuit Breaker 작동
- fallback 응답 반환
- HALF_OPEN 상태에서 자동 복구

**시나리오 3**: 에러율 급증
- Circuit Breaker OPEN 전환
- 정상 복구 후 CLOSED 전환

### FR-CHAOS.4: 안전 가드

- `NODE_ENV === 'test'` 일 때만 chaos 기능 활성화
- 프로덕션 환경 chaos 주입 절대 금지
- 테스트 후 자동 정리 (장애 주입 해제)

## 추적성 매트릭스

| FR ID | 모듈 | CSAP | 테스트 |
|-------|------|------|--------|
| FR-CHAOS.1 | ChaosEngine | D-07 | T-CHAOS.1 |
| FR-CHAOS.2 | CircuitBreaker | D-07 | T-CHAOS.2 |
| FR-CHAOS.3 | ResilienceTest | D-07 | T-CHAOS.3 |
| FR-CHAOS.4 | SafeGuard | D-07 | T-CHAOS.4 |

## 검증 기준

- ChaosEngine 3종 장애 주입 동작 확인
- Circuit Breaker 상태 전이 (CLOSED->OPEN->HALF_OPEN->CLOSED) 검증
- 복원력 테스트 3종 시나리오 전체 PASS
- 프로덕션 환경 안전 가드 동작 확인

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-09 | 초안 작성 | PM Lead |
