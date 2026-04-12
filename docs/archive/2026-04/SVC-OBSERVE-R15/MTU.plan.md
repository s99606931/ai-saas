# SVC-OBSERVE-R15 Plan -- 관측성 표준화 패키지

> Round 15: 구조화 로깅 + 메트릭 수집 + 알림 임계값 관리
> 버전: 1.0.0 | 작성일: 2026-04-09 | 작성자: PM Lead

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 17개 서비스 관측성 표준화로 장애 탐지 시간 단축 |
| 기술 | @public-saas/observability 패키지: 구조화 로깅, 메트릭 수집기, 알림 관리 |
| 보안 | CSAP D-06 침해사고 관리: 감사 로그 표준화, 이상 탐지 기반 |
| 운영 | Prometheus 호환 메트릭, 구조화 JSON 로그, 임계값 기반 알림 |

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | 서비스별 로깅/메트릭 형식 불일치로 통합 모니터링 어려움 |
| WHO | SRE 팀, 운영자, 보안 관리자 |
| RISK | 로그 형식 불일치 시 장애 분석 지연, 메트릭 누락 시 알림 사각지대 |
| SUCCESS | 17개 서비스 구조화 로그 통일, Prometheus 메트릭 노출, 임계값 알림 |
| SCOPE | observability 패키지 생성, 로거, 메트릭 수집기, 알림 매니저, Fastify 플러그인 |

## 기능 요구사항

### FR-OBS.1: @public-saas/observability 패키지 생성

**모듈 구조**:
- `StructuredLogger`: JSON 구조화 로거 (pino 호환 인터페이스)
- `MetricsCollector`: 카운터/히스토그램/게이지 메트릭 수집
- `AlertManager`: 임계값 기반 알림 규칙 관리
- `observabilityPlugin`: Fastify 플러그인 (전체 통합)

### FR-OBS.2: 구조화 로깅

- JSON 형식 로그 (timestamp, level, service, message, context)
- 로그 레벨: trace, debug, info, warn, error, fatal
- 테넌트 ID, 요청 ID 자동 포함
- 민감 데이터 자동 마스킹 (PII 필드)
- CSAP D-06 감사 로그 형식 준수

### FR-OBS.3: 메트릭 수집

- Counter: 요청 수, 에러 수, 처리 건수
- Histogram: 응답 시간, 처리 시간
- Gauge: 활성 연결 수, 큐 길이
- Prometheus 텍스트 형식 노출 (/metrics)
- 서비스 레이블 자동 추가

### FR-OBS.4: 알림 임계값 관리

- 규칙 기반 알림 (메트릭 임계값 초과)
- 알림 상태 관리 (firing, resolved)
- 연속 위반 카운트 (flapping 방지)
- 알림 이력 조회

## 검증 기준

- 구조화 로그 JSON 형식 검증
- 메트릭 Prometheus 형식 노출 확인
- 알림 규칙 임계값 초과 시 firing 확인
- 전체 테스트 PASS

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-09 | 초안 작성 | PM Lead |
