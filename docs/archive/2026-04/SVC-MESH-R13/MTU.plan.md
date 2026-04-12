# SVC-MESH-R13 Plan -- 서비스 메시 준비

> Round 13: Istio 사이드카 주입 준비 + 서비스 디스커버리 표준화
> 버전: 1.0.0 | 작성일: 2026-04-09 | 작성자: PM Lead

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | k8s 서비스 메시 도입 준비로 제로트러스트 네트워크 기반 확보 |
| 기술 | @public-saas/mesh-ready 패키지: 분산 추적, 그레이스풀 셧다운, 프로브 표준화 |
| 보안 | CSAP D-10 네트워크 보안: 서비스 간 mTLS 준비, 트래픽 격리 |
| 운영 | Kubernetes readiness/liveness 프로브 일관성, 그레이스풀 셧다운 표준화 |

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | 17개 서비스의 서비스 메시 준비도가 각각 다름 (표준화 필요) |
| WHO | k8s 클러스터 관리자, SRE 팀, Istio 운영자 |
| RISK | 기존 서비스 동작 변경으로 인한 회귀, 헤더 전파 누락 |
| SUCCESS | 17개 서비스 분산 추적 헤더 전파, 그레이스풀 셧다운, 서비스 메타데이터 표준화 |
| SCOPE | mesh-ready 패키지 생성, 서비스 메타데이터, SIGTERM 표준화, 추적 헤더 전파 |

## 기능 요구사항

### FR-MESH.1: @public-saas/mesh-ready 패키지 생성

**모듈 구조**:
- `ServiceMetadata`: 서비스 디스커버리 메타데이터 표준화
- `TraceContextPropagator`: W3C TraceContext + B3 헤더 전파
- `GracefulShutdown`: SIGTERM 표준 처리 유틸리티
- `meshReadyPlugin`: Fastify 플러그인 (전체 통합)

### FR-MESH.2: 분산 추적 헤더 전파

**전파 헤더**:
- W3C TraceContext: `traceparent`, `tracestate`
- B3 단일 헤더: `b3`
- B3 다중 헤더: `x-b3-traceid`, `x-b3-spanid`, `x-b3-parentspanid`, `x-b3-sampled`
- 커스텀: `x-request-id` (기존 correlationId 연동)

### FR-MESH.3: 그레이스풀 셧다운 표준화

- SIGTERM 수신 시 신규 요청 거부 (readiness=false)
- 진행 중 요청 완료 대기 (최대 30초)
- 리소스 정리 (DB 연결, 캐시 등)
- SIGKILL 전 로그 flush

### FR-MESH.4: 서비스 메타데이터 표준화

**메타데이터 항목**:
- `service.name`, `service.version`, `service.namespace`
- `service.mesh.sidecar`: true/false (Istio 사이드카 주입 여부)
- `service.protocols`: ["http", "grpc"]
- `service.dependencies`: ["db", "redis", "auth-service"]

## 검증 기준

- W3C TraceContext + B3 헤더 전파 동작 확인
- SIGTERM 처리 후 리소스 정리 확인
- /metadata 엔드포인트에서 서비스 정보 반환
- 전체 테스트 PASS

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-09 | 초안 작성 | PM Lead |
