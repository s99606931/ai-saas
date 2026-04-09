# MTU-N65: Gateway API + Traefik 고도화 설계

> **버전**: 1.0.0 | **작성일**: 2026-04-10 | **작성자**: infra-architect

---

## 1. 아키텍처

```
Gateway API (gateway.networking.k8s.io v1)
  ├── GatewayClass: traefik
  ├── Gateway: saas-gateway (saas 네임스페이스)
  │    ├── HTTP Listener (80) → HTTPS 리다이렉트
  │    └── HTTPS Listener (443) → TLS 종단 (cert-manager)
  └── HTTPRoute (서비스별)
       ├── auth-service-route → /api/v1/auth/*
       ├── api-gateway-route → /api/v1/*
       ├── tenant-route → /api/v1/tenants/*
       ├── audit-route → /api/v1/audit/*
       ├── ai-gateway-route → /api/v1/ai/*
       └── catalog-route → /api/v1/catalog/*
```

## 2. Traefik HelmChartConfig

k3s에서 Traefik을 Gateway API 모드로 활성화:
- kubernetesGateway.enabled: true
- experimental.kubernetesGateway.enabled: true (Traefik v3)
- providers.kubernetesGateway: true

## 3. 미들웨어

### Rate Limiting (CSAP D-08)
- average: 100 req/s (서비스별)
- burst: 200
- sourceCriterion: requestHeaderName X-Forwarded-For

### 보안 헤더
- X-Frame-Options: SAMEORIGIN
- X-Content-Type-Options: nosniff
- Strict-Transport-Security: max-age=31536000; includeSubDomains
- Content-Security-Policy: default-src 'self'
- X-XSS-Protection: 1; mode=block
- Referrer-Policy: strict-origin-when-cross-origin

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 최초 작성 | infra-architect |
