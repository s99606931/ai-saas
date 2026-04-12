# Plan: SVC-OTEL-R3 -- OpenTelemetry 분산 추적 확산 (Round 3-A)

> 작성일: 2026-04-09 | 버전: 1.0 | 작성자: PM Lead
> 참조: auth-service telemetry.ts 기존 패턴

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 장애 원인 추적 시간 단축, CSAP D-06 침해사고 관리 강화 |
| 기술 | OpenTelemetry SDK 15개 서비스 확산 + 공유 패키지 생성 |
| 보안 | D-06 감사 추적 보완, D-07 가용성 관제, N2SF 관측성 |
| 운영 | 분산 추적 ID 기반 장애 진단, 서비스 간 지연 시간 가시성 |

## Context Anchor

- **WHY**: auth-service에만 OTel 적용됨. 나머지 15개 서비스에 관측성 부재 -> 장애 추적 불가
- **WHO**: SRE 운영팀, 보안 감사관, 개발팀
- **RISK**: 분산 서비스 장애 시 원인 추적 불가, CSAP D-06 감사 추적 미비
- **SUCCESS**: 15개 서비스 OTel 적용 + 공유 패키지 + 테스트 PASS
- **SCOPE**: telemetry 라이브러리 생성, 15개 서비스 index.ts 통합, 유닛 테스트

---

## 기능 요구사항

### FR-OTEL.1: 공유 관측성 패키지 (@public-saas/observability)

- platform/packages/observability/ 디렉토리 생성
- initTelemetry(serviceName, version) 함수 내보내기
- shutdownTelemetry() 함수 내보내기
- 환경 변수 OTEL_ENABLED=true 시에만 활성화
- OTel 패키지 미설치 시 graceful fallback (경고만 출력)
- 서비스명, 버전을 Resource 속성으로 설정

### FR-OTEL.2: X-Response-Time 미들웨어

- 공유 패키지에 responseTimePlugin 포함
- 모든 응답에 X-Response-Time 헤더 추가 (ms 단위)
- Fastify 플러그인 형태 (fastify-plugin 래핑)

### FR-OTEL.3: 15개 서비스 OTel 통합

- 대상: user-service, tenant-service, api-gateway, ai-service, audit-service,
  menu-service, catalog-service, subscription-service, billing-service,
  crm-service, notification-service, file-service, compliance-service,
  security-service, security-monitor-service
- 각 서비스 index.ts에 initTelemetry() 호출 추가
- Graceful Shutdown에 shutdownTelemetry() 호출 추가
- package.json에 @public-saas/observability 의존성 추가

### FR-OTEL.4: 테스트

- 공유 패키지 단위 테스트: initTelemetry, shutdownTelemetry, responseTimePlugin
- OTEL_ENABLED=false 시 비활성화 확인
- OTEL_ENABLED=true + 패키지 미설치 시 graceful 처리 확인
- X-Response-Time 헤더 존재 확인

---

## 비기능 요구사항

- NFR-1: OTel 비활성화 시 성능 영향 0 (import 자체 스킵)
- NFR-2: OTel 활성화 시 요청당 오버헤드 < 1ms
- NFR-3: 패키지 미설치 환경에서 서비스 정상 기동 필수

## CSAP 매핑

| CSAP 항목 | 관련 FR | 설명 |
|-----------|---------|------|
| D-06 | FR-OTEL.1 | 분산 추적으로 침해사고 추적 강화 |
| D-07 | FR-OTEL.3 | 서비스 가용성 관측 |
| D-10 | FR-OTEL.2 | 응답 시간 모니터링 (DoS 탐지 보조) |

## 추적성 매트릭스

| FR ID | 산출물 | 테스트 | CSAP |
|-------|--------|--------|------|
| FR-OTEL.1 | packages/observability/src/index.ts | otel.test.ts | D-06 |
| FR-OTEL.2 | packages/observability/src/response-time.ts | response-time.test.ts | D-10 |
| FR-OTEL.3 | 15개 서비스 index.ts 수정 | integration test | D-07 |
| FR-OTEL.4 | tests/ | 전체 테스트 | - |
