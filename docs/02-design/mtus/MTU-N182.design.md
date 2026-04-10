# MTU-N182: Ingress/Gateway API 트래픽 모니터링 Design

> **문서 ID**: DESIGN-N182 | **버전**: 1.0 | **작성일**: 2026-04-10
> **작성자**: PM Lead | **상태**: 승인

---

## Executive Summary

| 관점 | 설계 결정 |
|------|----------|
| 아키텍처 | Traefik/Nginx Ingress Controller 메트릭 기반 PrometheusRule |
| 데이터 흐름 | Ingress Controller → Prometheus scrape → recording rules → Grafana + Alertmanager |
| 보안 | HTTP 공격 패턴 탐지, TLS 인증서 만료 예측, CSAP D-08/D-09/D-13 준수 |
| 운영 | RED 메트릭(Rate/Error/Duration) 기반 SLI 모니터링 |

## Design Anchor

```
Plan 참조: PLAN-N182
FR 범위: FR-N182.1 ~ FR-N182.6
CSAP 매핑: D-08 (접근 통제), D-09 (암호화), D-13 (네트워크 보안)
```

## 아키텍처 옵션 분석

| 옵션 | 장점 | 단점 | 선택 |
|------|------|------|------|
| A: Traefik 내장 메트릭 (k3s 기본) | k3s 기본 포함, 즉시 사용 | Traefik 한정 | **선택** |
| B: Nginx Ingress Controller | 풍부한 메트릭 | 추가 설치 필요 | 보조 지원 |
| C: Istio/Envoy 기반 | 고급 트래픽 관리 | 서비스 메쉬 전체 필요 | - |

**선택 근거**: k3s 기본 Traefik + Nginx Ingress 호환 PromQL 쿼리로 다중 환경 지원

## 상세 설계

### DS-N182.1: HTTP 상태 코드별 요청 모니터링

```yaml
# 상태 코드 그룹별 RPS
- record: ingress:http:requests_by_status
  expr: |
    sum by (ingress, status_group) (
      label_replace(
        rate(traefik_entrypoint_requests_total[5m]),
        "status_group", "${1}xx", "code", "(.).*"
      )
    )
```

### DS-N182.2: 요청 레이턴시 모니터링

```yaml
# P50/P90/P99 레이턴시
- record: ingress:http:latency_p99
  expr: |
    histogram_quantile(0.99,
      sum by (ingress, le) (
        rate(traefik_entrypoint_request_duration_seconds_bucket[5m])
      )
    )
```

### DS-N182.3: RPS 모니터링

```yaml
- record: ingress:http:rps
  expr: sum by (ingress) (rate(traefik_entrypoint_requests_total[5m]))
```

### DS-N182.5: 비정상 트래픽 탐지

```yaml
# 단일 소스 RPS 급증 (DDoS 의심)
- alert: IngressTrafficSpike
  expr: ingress:http:rps > 5 * avg_over_time(ingress:http:rps[1h] offset 1h)
```

### DS-N182.6: TLS 인증서 만료 예측

```yaml
- alert: TlsCertExpiringSoon
  expr: (traefik_tls_certs_not_after - time()) / 86400 < 30
```

## 대시보드 레이아웃

```
Row 1: 종합 현황
  - 총 RPS | 5xx 에러율 | P99 레이턴시 | TLS 인증서 잔여일
Row 2: HTTP 상태 코드
  - 2xx/3xx/4xx/5xx 분포 | 상태 코드별 추이
Row 3: 레이턴시 분석
  - P50/P90/P99 추이 | 엔드포인트별 레이턴시
Row 4: 트래픽 분석
  - RPS 추이 | 비정상 트래픽 감지 | 봇 트래픽 비율
```

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-10 | 초안 작성 | PM Lead |
