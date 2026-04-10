# MTU-N142: SLI/SLO 정의 표준화 — Design

> **문서 ID**: MTU-N142.design
> **버전**: 1.0.0 | **작성일**: 2026-04-10
> **작성자**: PM Lead (claude-opus-4-6)
> **Plan 참조**: MTU-N142.plan

---

## Executive Summary

| 관점 | 설계 결정 |
|------|----------|
| 아키텍처 | Sloth CRD v1 기반 PrometheusServiceLevel, 3대 SLI(가용성/지연/처리량) 표준화 |
| 메트릭 체계 | `http_requests_total`, `http_request_duration_seconds_bucket` 통일 |
| 알림 전략 | Multi-window multi-burn rate (Google SRE), 티어별 severity 차등 |
| 거버넌스 | 분기별 SLO 리뷰, 에러 버짓 소진 시 기능 동결 정책 |

## Design Anchor

| 항목 | 결정 |
|------|------|
| WHY | 비표준 SLO → 장애 감지 일관성 부재. 표준화로 통합 관측 가능 |
| WHAT | 13개 서비스 x 3 SLI = 최대 39 SLO (서비스별 필요한 SLI만 적용) |
| HOW | Sloth CRD YAML → Prometheus recording/alerting rules 자동 생성 |

## SS1. SLI 표준 유형 정의

### 3대 SLI 유형

| SLI 유형 | 메트릭 | 에러 정의 | 적용 서비스 |
|----------|--------|----------|------------|
| 가용성 (Availability) | `http_requests_total` | HTTP 5xx 응답 | 전체 13개 |
| 지연시간 (Latency) | `http_request_duration_seconds_bucket` | P95 > 임계값 | 전체 13개 |
| 처리량 (Throughput) | `http_requests_total` | 초당 처리량 < 최소 기준 | Critical/High 7개 |

### Sloth CRD 표준 템플릿

```yaml
apiVersion: sloth.slok.dev/v1
kind: PrometheusServiceLevel
metadata:
  name: "{service}-slo"
  namespace: production
  labels:
    app.kubernetes.io/name: "{service}"
    app.kubernetes.io/part-of: saas-platform
    csap.compliance/domain: "D-06"
    team: "{team}"
    tier: "{critical|high|standard}"
spec:
  service: "{service}"
  labels:
    owner: "{team}"
    tier: "{tier}"
  slos:
    - name: "availability"
      objective: {목표값}
      description: "{서비스명} HTTP 요청 성공률"
      sli:
        events:
          errorQuery: |
            sum(rate(http_requests_total{job="{service}",code=~"5.."}[{{.window}}]))
          totalQuery: |
            sum(rate(http_requests_total{job="{service}"}[{{.window}}]))
      alerting:
        name: "{Service}AvailabilitySLOBreach"
        labels:
          category: "availability"
          severity: "{critical|warning}"
          csap_domain: "D-06"
    - name: "latency"
      objective: {목표값}
      description: "{서비스명} P95 응답시간 {임계값}ms 미만"
      sli:
        events:
          errorQuery: |
            sum(rate(http_request_duration_seconds_bucket{job="{service}",le="{임계값_초}"}[{{.window}}]))
            -
            sum(rate(http_request_duration_seconds_count{job="{service}"}[{{.window}}]))
          totalQuery: |
            sum(rate(http_request_duration_seconds_count{job="{service}"}[{{.window}}]))
```

## SS2. 티어별 알림 정책

| 티어 | 에러 버짓 50% | 에러 버짓 75% | 에러 버짓 100% |
|------|-------------|-------------|--------------|
| Critical | warning + Slack | critical + PagerDuty | critical + 기능 동결 |
| High | info + Slack | warning + Slack | critical + PagerDuty |
| Standard | info (로그) | warning + Slack | critical + Slack |

## SS3. 서비스별 SLO 상세 설계

### SS3.1 신규 추가 서비스 (8개)

| 서비스 | 가용성 목표 | 지연 임계값 | 처리량 SLI | CSAP 매핑 |
|--------|-----------|-----------|-----------|----------|
| user-service | 99.9% | P95 < 500ms | 10 rps | D-08 |
| subscription-service | 99.9% | P95 < 500ms | 5 rps | - |
| menu-service | 99.5% | P95 < 500ms | - | - |
| catalog-service | 99.5% | P95 < 500ms | - | - |
| billing-service | 99.5% | P95 < 1000ms | - | - |
| crm-service | 99.5% | P95 < 1000ms | - | - |
| notification-service | 99.5% | P95 < 1000ms | - | D-06 |
| file-service | 99.5% | P95 < 2000ms | - | - |

### SS3.2 기존 서비스 표준 정합성

| 서비스 | 현재 SLO | 표준 대비 | 조치 |
|--------|---------|----------|------|
| api-gateway | 가용성 99.9%, 지연 P95<500ms | 적합 | 처리량 SLI 추가 권장 |
| auth-service | 가용성 99.95% | 적합 | 지연 SLI 추가 |
| tenant-service | 가용성 99.9% | 적합 | 지연 SLI 추가 |
| audit-service | 가용성 99.99% | 적합 | 지연 SLI 추가 |
| ai-gateway | 가용성 99.5% | 적합 | 지연 SLI 추가 |

## SS4. SLI 카탈로그 구조

```yaml
# sli-catalog.yaml 구조
catalog:
  version: "1.0.0"
  lastUpdated: "2026-04-10"
  services:
    - name: "{service}"
      tier: "{tier}"
      slos:
        - type: availability
          objective: {값}
          window: 30d
          errorBudget: {계산값}
        - type: latency
          objective: {값}
          threshold: "{임계값}"
          percentile: p95
```

## SS5. 거버넌스 정책

| 항목 | 정책 |
|------|------|
| SLO 리뷰 주기 | 분기별 (3개월마다) |
| 목표 변경 절차 | SRE 팀 제안 → 서비스 오너 합의 → PM 승인 |
| 에러 버짓 소진 대응 | 100% 소진 시 신규 기능 배포 동결 + 안정성 작업 전환 |
| SLI 추가/변경 | 반드시 이 표준 문서 업데이트 후 CRD 반영 |

---

## Session Guide

| 단계 | 산출물 | 검증 |
|------|--------|------|
| 1 | SLI 표준 문서 (README.md) | 3대 SLI 정의 + 티어 분류 완료 |
| 2 | 8개 신규 서비스 Sloth CRD | YAML 문법 + 표준 준수 |
| 3 | 기존 5개 서비스 지연 SLI 보강 | CRD 업데이트 |
| 4 | SLI 카탈로그 | 13개 서비스 전수 매핑 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 최초 작성 | PM Lead |
