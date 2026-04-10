# MTU-N65: Gateway API + Traefik 고도화

> **버전**: 1.0.0 | **작성일**: 2026-04-10 | **작성자**: PM Lead

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | ingress-nginx 아카이브(2026-03) 대응, Kubernetes Gateway API 표준으로 전환 |
| 기술 | k3s 기본 Traefik + Gateway API CRD + HTTPRoute + 미들웨어 (Rate Limit, Headers) |
| 보안 | CSAP D-08 접근통제 Rate Limiting, CORS/보안 헤더, TLS 종단 (cert-manager) |
| 운영 | 서비스별 HTTPRoute 라우팅, Prometheus 트래픽 모니터링 |

---

## 기능 요구사항

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-N65.1 | Gateway API CRD 설치 (v1.2) | P0 |
| FR-N65.2 | Gateway 리소스 (Traefik GatewayClass) | P0 |
| FR-N65.3 | 서비스별 HTTPRoute 6종 | P0 |
| FR-N65.4 | Rate Limiting 미들웨어 (CSAP D-08) | P0 |
| FR-N65.5 | 보안 헤더 미들웨어 (HSTS, CSP, X-Frame) | P0 |
| FR-N65.6 | TLS 종단 (cert-manager Certificate 참조) | P1 |
| FR-N65.7 | Traefik HelmChartConfig 활성화 | P0 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 최초 작성 | PM Lead |
