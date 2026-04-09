---
sidebar_position: 3
title: 트래픽 모니터링 가이드
description: RED 메트릭 + 서비스 맵 + 분산 추적으로 트래픽을 완벽하게 파악
---

# 트래픽 모니터링 가이드

> **대상 독자**: 백엔드 개발자, DevOps 엔지니어, 플랫폼 관리자
> **환경**: Tempo (분산 추적) + OTel Collector + Prometheus + Grafana
> **CSAP 준수**: D-06(감사 로그), D-08(접근 통제 모니터링)

---

## 목차

1. [트래픽 모니터링이란?](#1-트래픽-모니터링이란)
2. [RED 메트릭 이해](#2-red-메트릭-이해)
3. [서비스 맵 (Service Graph)](#3-서비스-맵-service-graph)
4. [분산 추적으로 요청 추적하기](#4-분산-추적으로-요청-추적하기)
5. [HTTP 트래픽 분석](#5-http-트래픽-분석)
6. [API Gateway 트래픽](#6-api-gateway-트래픽)
7. [서비스 간 통신 분석](#7-서비스-간-통신-분석)
8. [이상 트래픽 탐지](#8-이상-트래픽-탐지)
9. [성능 병목 분석](#9-성능-병목-분석)
10. [대시보드 활용 팁](#10-대시보드-활용-팁)

---

## 1. 트래픽 모니터링이란?

### 1.1 왜 트래픽을 모니터링하는가?

트래픽 모니터링은 **서비스가 처리하는 요청의 양, 속도, 성공/실패를 파악**하는 것입니다.

- **장애 징후 포착**: 에러율 급증, 응답 시간 증가를 사전 감지
- **용량 계획**: 현재 트래픽 추세를 분석하여 리소스 확장 계획
- **보안 감시**: DDoS, 비정상 접근 패턴 탐지 (CSAP D-08)
- **SLA 관리**: 응답 시간, 가용성 목표 달성 여부 확인

### 1.2 트래픽 데이터 수집 경로

```
사용자 요청
    ↓
API Gateway (Traefik/Ingress)
    ↓ [OTel 자동 계측]
마이크로서비스 (auth, user, tenant, ...)
    ↓ [OTel 자동 계측]
OpenTelemetry Collector
    ├── 메트릭 → Prometheus (RED 메트릭 자동 생성)
    ├── 추적 → Tempo (서비스 맵 + 분산 추적)
    └── 로그 → Loki (요청 로그)
    ↓
Grafana (시각화)
```

---

## 2. RED 메트릭 이해

### 2.1 RED란?

RED는 마이크로서비스 모니터링의 핵심 3대 지표입니다:

| 지표 | 의미 | 단위 | 좋은/나쁜 |
|------|------|------|----------|
| **R**ate | 초당 요청 수 | req/s | 안정적 = 좋음, 급변 = 조사 필요 |
| **E**rror | 에러 발생 비율 | % | 0% = 이상적, 1% 초과 = 경고 |
| **D**uration | 요청 처리 시간 | ms/s | P99 < 1초 = 좋음, 3초 초과 = 경고 |

### 2.2 Grafana에서 RED 메트릭 확인

1. Dashboards > Public SaaS > **서비스 RED 메트릭** 클릭
2. 3개 패널이 표시됩니다:
   - **서비스별 요청률 (Rate)**: 초당 요청 수 추이
   - **서비스별 에러율 (Error %)**: 5분 이동평균 에러율
   - **서비스별 P50/P95/P99 레이턴시 (Duration)**: 응답 시간 분포

### 2.3 RED 메트릭 PromQL

```promql
# Rate: 서비스별 초당 요청 수
sum by (client) (rate(traces_service_graph_request_total[5m]))

# Error: 서비스별 에러율 (%)
sum by (client) (rate(traces_service_graph_request_failed_total[5m]))
/ sum by (client) (rate(traces_service_graph_request_total[5m])) * 100

# Duration P50 (중앙값)
histogram_quantile(0.50, sum by (client, le)
  (rate(traces_service_graph_request_duration_seconds_bucket[5m])))

# Duration P95 (95번째 백분위)
histogram_quantile(0.95, sum by (client, le)
  (rate(traces_service_graph_request_duration_seconds_bucket[5m])))

# Duration P99 (99번째 백분위)
histogram_quantile(0.99, sum by (client, le)
  (rate(traces_service_graph_request_duration_seconds_bucket[5m])))
```

### 2.4 RED 메트릭 해석 가이드

| 상황 | Rate | Error | Duration | 진단 |
|------|------|-------|----------|------|
| 정상 | 안정 | < 0.1% | P99 < 500ms | 이상 없음 |
| 트래픽 급증 | 급증 | 변화 없음 | 약간 증가 | 스케일업 필요 |
| 서비스 장애 | 감소 | 급증 | 급증 | 장애 서비스 확인 |
| DB 병목 | 안정 | 약간 증가 | P99 급증 | DB 쿼리 확인 |
| 네트워크 문제 | 불안정 | 간헐적 증가 | 불규칙 | 네트워크 확인 |

---

## 3. 서비스 맵 (Service Graph)

### 3.1 서비스 맵이란?

서비스 맵은 **마이크로서비스 간의 호출 관계**를 시각적으로 보여줍니다.
각 노드(서비스)와 연결선(호출)에 요청률, 에러율이 표시됩니다.

### 3.2 서비스 맵 확인 방법

**방법 1: 대시보드에서 확인**
1. Dashboards > Public SaaS > 서비스 RED 메트릭
2. 하단의 "서비스 맵 (Service Graph)" 패널

**방법 2: Explore에서 확인**
1. 좌측 메뉴 Explore 클릭
2. 데이터소스: Tempo 선택
3. 탭을 "Service Graph"로 전환

### 3.3 서비스 맵 읽는 법

```
          ┌──────────┐
          │ 사용자   │
          └────┬─────┘
               │ 100 req/s, 0.1% err
          ┌────▼─────┐
          │API Gateway│
          └──┬────┬──┘
     50 req/s│    │40 req/s
    0% err   │    │0.2% err
      ┌──────▼┐ ┌─▼──────┐
      │ Auth  │ │ User   │
      │Service│ │Service │
      └───────┘ └────┬───┘
                     │20 req/s
                ┌────▼────┐
                │PostgreSQL│
                └─────────┘
```

- **노드 크기**: 요청률에 비례 (크면 트래픽 많음)
- **노드 색상**: 초록=정상, 노랑=경고, 빨강=에러
- **연결선 두께**: 요청률에 비례
- **연결선 색상**: 에러율 반영

### 3.4 서비스 맵으로 문제 찾기

1. **빨간 노드** → 해당 서비스에 에러 집중
2. **빨간 연결선** → 해당 호출에서 에러 발생
3. **굵은 연결선** → 트래픽이 집중된 경로
4. **노드 클릭** → 상세 메트릭 패널 표시

---

## 4. 분산 추적으로 요청 추적하기

### 4.1 분산 추적이란?

하나의 사용자 요청이 **여러 서비스를 거치는 전체 과정**을 하나의 Trace로 기록합니다.

```
Trace (전체 요청)
├── Span: API Gateway (50ms)
│   ├── Span: Auth Service 인증 (20ms)
│   └── Span: User Service 조회 (25ms)
│       └── Span: PostgreSQL 쿼리 (15ms)
└── Span: Audit Service 로그 (5ms)
```

### 4.2 추적 검색 방법

**방법 1: 서비스별 검색**
1. Explore > Tempo > Search 탭
2. Service Name: `api-gateway` 선택
3. Status: `error` (에러만 보려면)
4. Duration: `> 500ms` (느린 요청만)
5. Run Query 클릭

**방법 2: TraceQL로 검색**
```traceql
# 500ms 이상 걸린 요청
{duration > 500ms}

# API Gateway의 500 에러
{resource.service.name="api-gateway" && span.http.status_code=500}

# POST 요청 중 에러
{span.http.method="POST" && status=error}

# 특정 경로의 요청
{span.http.route="/api/v1/users"}
```

**방법 3: 로그에서 추적으로 이동**
1. Explore > Loki에서 로그 검색
2. traceId가 포함된 로그 클릭
3. "Tempo에서 추적 보기" 링크 클릭

### 4.3 추적 결과 분석

추적 결과(Trace View)에서 확인할 수 있는 정보:

| 정보 | 위치 | 의미 |
|------|------|------|
| 전체 소요 시간 | 상단 | 사용자가 체감하는 응답 시간 |
| Span 타임라인 | 중앙 | 각 서비스의 처리 시간 시각화 |
| 병목 구간 | 가장 긴 Span | 성능 개선 대상 |
| 에러 Span | 빨간색 표시 | 에러 발생 위치 |
| 서비스 간 간격 | Span 사이 빈 구간 | 네트워크 지연 |

### 4.4 느린 요청 분석 예시

```
Trace: POST /api/v1/tenants (총 2.3초)
├── API Gateway: 라우팅 (5ms) ← 정상
├── Auth Service: 토큰 검증 (15ms) ← 정상
├── Tenant Service: 테넌트 생성 (2.2초) ← 병목!
│   ├── DB: INSERT tenant (50ms) ← 정상
│   ├── DB: INSERT tenant_config (30ms) ← 정상
│   └── Notification: 이메일 발송 (2.0초) ← 원인!
└── Audit Service: 감사 로그 (10ms) ← 정상
```

위 예시에서 이메일 발송이 2초 걸리므로, 비동기 처리로 전환하면 개선됩니다.

---

## 5. HTTP 트래픽 분석

### 5.1 HTTP 상태 코드 분포

```promql
# 상태 코드별 요청 수
sum by (http_status_code) (rate(http_server_request_duration_seconds_count[5m]))

# 2xx (성공)
sum(rate(http_server_request_duration_seconds_count{http_status_code=~"2.."}[5m]))

# 4xx (클라이언트 에러)
sum(rate(http_server_request_duration_seconds_count{http_status_code=~"4.."}[5m]))

# 5xx (서버 에러)
sum(rate(http_server_request_duration_seconds_count{http_status_code=~"5.."}[5m]))
```

### 5.2 HTTP 메서드별 분석

```promql
# 메서드별 요청률
sum by (http_method) (rate(http_server_request_duration_seconds_count[5m]))

# GET vs POST 비율
sum(rate(http_server_request_duration_seconds_count{http_method="GET"}[5m]))
/
sum(rate(http_server_request_duration_seconds_count[5m])) * 100
```

### 5.3 경로별 트래픽

```promql
# 상위 10개 경로
topk(10, sum by (http_route)
  (rate(http_server_request_duration_seconds_count[5m])))

# 경로별 평균 응답 시간
sum by (http_route) (rate(http_server_request_duration_seconds_sum[5m]))
/ sum by (http_route) (rate(http_server_request_duration_seconds_count[5m]))
```

---

## 6. API Gateway 트래픽

### 6.1 Traefik 메트릭

k3s에 내장된 Traefik의 메트릭으로 Gateway 트래픽을 분석합니다.

```promql
# 전체 수신 요청률
sum(rate(traefik_service_requests_total[5m]))

# 서비스별 요청률
sum by (service) (rate(traefik_service_requests_total[5m]))

# 에러 응답 (5xx)
sum by (service) (rate(traefik_service_requests_total{code=~"5.."}[5m]))

# 서비스별 응답 시간 P95
histogram_quantile(0.95, sum by (service, le)
  (rate(traefik_service_request_duration_seconds_bucket[5m])))
```

### 6.2 Rate Limiting 모니터링

```promql
# Rate Limit에 걸린 요청 수 (429 응답)
sum(rate(traefik_service_requests_total{code="429"}[5m]))

# CSAP D-08: Rate Limit 통과/거부 비율
sum(rate(traefik_service_requests_total{code="429"}[5m]))
/ sum(rate(traefik_service_requests_total[5m])) * 100
```

---

## 7. 서비스 간 통신 분석

### 7.1 gRPC/HTTP 내부 호출

```promql
# 서비스 A → 서비스 B 호출률
sum by (client, server)
  (rate(traces_service_graph_request_total[5m]))

# 서비스 간 에러률
sum by (client, server)
  (rate(traces_service_graph_request_failed_total[5m]))
/ sum by (client, server)
  (rate(traces_service_graph_request_total[5m])) * 100

# 서비스 간 평균 레이턴시
histogram_quantile(0.95, sum by (client, server, le)
  (rate(traces_service_graph_request_duration_seconds_bucket[5m])))
```

### 7.2 의존성 분석

서비스 맵에서 특정 서비스의 **업스트림/다운스트림**을 파악할 수 있습니다.

```
업스트림 (이 서비스를 호출하는 서비스):
  API Gateway → User Service

다운스트림 (이 서비스가 호출하는 서비스):
  User Service → PostgreSQL
  User Service → Redis
  User Service → Audit Service
```

---

## 8. 이상 트래픽 탐지

### 8.1 DDoS 징후

```promql
# 초당 요청 수가 평소의 3배 이상
sum(rate(http_server_request_duration_seconds_count[1m])) >
  3 * avg_over_time(sum(rate(http_server_request_duration_seconds_count[1m]))[1h:5m])

# 특정 IP에서의 과다 요청 (OTel 속성 기반)
sum by (net_peer_ip) (rate(http_server_request_duration_seconds_count[1m])) > 100
```

### 8.2 비정상 패턴

| 패턴 | PromQL 예시 | 의미 |
|------|-----------|------|
| 에러율 급증 | `increase(http_5xx_total[5m]) > 50` | 서비스 장애 가능 |
| 트래픽 급감 | `rate(requests[5m]) < 0.1` | 서비스 다운 또는 DNS 문제 |
| 레이턴시 급증 | `histogram_quantile(0.99, ...) > 10` | DB 또는 외부 서비스 문제 |
| 401/403 급증 | `rate(http_4xx_total[5m]) > 10` | 인증 공격 시도 가능 |

### 8.3 알림 설정

이미 구성된 트래픽 관련 알림:

| 알림 | 조건 | 심각도 |
|------|------|--------|
| HighServiceErrorRate | 에러율 1% 초과 5분 지속 | critical |
| HighServiceLatencyP99 | P99 3초 초과 5분 지속 | warning |
| ServiceDown | Blackbox 프로브 2분 실패 | critical |

---

## 9. 성능 병목 분석

### 9.1 병목 찾기 3단계

**1단계: RED 메트릭으로 범위 좁히기**
- 어떤 서비스에서 Duration이 증가했는가?
- 에러율이 높은 서비스는?

**2단계: 분산 추적으로 경로 파악**
- 느린 요청의 Trace를 열어서 어디에서 시간이 소요되는지 확인
- 가장 긴 Span이 병목 지점

**3단계: 원인별 조치**

| 병목 위치 | 진단 방법 | 조치 |
|-----------|----------|------|
| DB 쿼리 | Span에서 `db.statement` 확인 | 인덱스 추가, 쿼리 최적화 |
| 외부 API | Span에서 `http.url` 확인 | 타임아웃 설정, 캐시 도입 |
| 서비스 간 통신 | Span 간 간격 확인 | 비동기 처리, 배치 처리 |
| CPU 과다 | 노드 메트릭 확인 | 스케일업, 알고리즘 최적화 |
| 메모리 부족 | Pod 리소스 확인 | 리소스 제한 상향 |

### 9.2 성능 비교 분석

```promql
# 이번 주 vs 지난 주 P99 비교
histogram_quantile(0.99, sum by (le)
  (rate(traces_service_graph_request_duration_seconds_bucket[5m])))
vs
histogram_quantile(0.99, sum by (le)
  (rate(traces_service_graph_request_duration_seconds_bucket[5m] offset 7d)))
```

---

## 10. 대시보드 활용 팁

### 10.1 일상 모니터링 루틴

| 시간 | 확인 항목 | 대시보드 |
|------|---------|---------|
| 출근 시 | 야간 알림 확인, 서비스 상태 | 서비스 RED 메트릭 |
| 배포 후 | 에러율 변화, 응답 시간 변화 | 서비스 RED 메트릭 |
| 점심 피크 | 트래픽 패턴, 리소스 사용량 | 클러스터 개요 |
| 퇴근 전 | 알림 이력, 이상 징후 | AlertManager |
| 주 1회 | 디스크 추이, DB 성능 | SQL 모니터링, 노드 상세 |

### 10.2 장애 대응 시 확인 순서

1. **서비스 RED 메트릭**: 어떤 서비스에서 에러가 발생하는가?
2. **서비스 맵**: 영향받는 서비스의 범위는?
3. **Explore > Tempo**: 에러 추적을 찾아 원인 파악
4. **Explore > Loki**: 에러 로그 상세 확인
5. **SQL 모니터링**: DB 문제라면 슬로우쿼리/커넥션 확인
6. **노드 상세**: 리소스 부족이라면 CPU/메모리/디스크 확인

### 10.3 유용한 단축키

| 단축키 | 기능 |
|--------|------|
| `d` | 대시보드 목록 열기 |
| `s` | 대시보드 저장 |
| `t` | 시간 범위 선택 열기 |
| `r` | 새로고침 |
| `Ctrl+K` | 검색 열기 |

---

*이 문서는 MTU-N36 트래픽 모니터링 특화 가이드입니다.*
*CSAP D-06/D-08 요건을 준수합니다.*
