# MTU-N54: Linkerd 서비스 메시 + mTLS Zero Trust -- 설계 문서

> **버전**: 1.0.0 | **작성일**: 2026-04-10 | **작성자**: bkend-expert

---

## Executive Summary

| 관점 | 설계 결정 |
|------|----------|
| 비즈니스 | Linkerd 경량 서비스 메시 채택 (Istio 대비 리소스 1/10, k3s 최적) |
| 기술 | Linkerd v2.16 Helm 설치, mTLS 자동, ServiceProfile + AuthorizationPolicy |
| 보안 | TLS 인증서 24시간 자동 회전, ServiceAccount 기반 워크로드 신원 인증 |
| 운영 | Linkerd Viz 대시보드, Prometheus 통합, 리소스 오버헤드 최소 (10MB/프록시) |

---

## 3.1 아키텍처 개요

```
┌─────────────────────────────────────────────────────┐
│                  k3s Cluster (WSL2)                   │
│                                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ linkerd-ns   │  │ saas-ns      │  │ monitoring   │ │
│  │              │  │              │  │              │ │
│  │ Control Plane│  │ ┌──────────┐ │  │ Prometheus   │ │
│  │ - Destination│  │ │auth-svc  │ │  │ Grafana      │ │
│  │ - Identity   │  │ │+sidecar  │ │  │ Linkerd Viz  │ │
│  │ - Proxy Inj. │  │ └──────────┘ │  │              │ │
│  │              │  │ ┌──────────┐ │  │              │ │
│  │  Trust Anchor│  │ │api-gw    │ │  │              │ │
│  │  (CA Root)   │  │ │+sidecar  │ │  │              │ │
│  │              │  │ └──────────┘ │  │              │ │
│  │              │  │ ┌──────────┐ │  │              │ │
│  │              │  │ │tenant-svc│ │  │              │ │
│  │              │  │ │+sidecar  │ │  │              │ │
│  │              │  │ └──────────┘ │  │              │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
│                                                       │
│  모든 Pod 간 통신: mTLS 자동 (24시간 인증서 회전)      │
└─────────────────────────────────────────────────────┘
```

---

## 3.2 Trust Anchor 인증서 체계

```
Root CA (Trust Anchor)
  └── Issuer CA (Identity Issuer)
        └── 워크로드 인증서 (24시간 자동 회전)
              - 서비스 A Proxy
              - 서비스 B Proxy
              - ...
```

### 인증서 생성 절차 (step CLI)

```bash
# 1. Trust Anchor 생성 (10년 유효)
step certificate create root.linkerd.cluster.local ca.crt ca.key \
  --profile root-ca --no-password --insecure --not-after=87600h

# 2. Identity Issuer 생성 (1년 유효)
step certificate create identity.linkerd.cluster.local issuer.crt issuer.key \
  --profile intermediate-ca --not-after=8760h --no-password --insecure \
  --ca ca.crt --ca-key ca.key
```

---

## 3.3 Linkerd Helm Values

```yaml
# Linkerd Control Plane values
identityTrustAnchorsPEM: |
  # Trust Anchor 인증서 (ca.crt 내용)
identity:
  issuer:
    tls:
      crtPEM: |
        # Issuer 인증서 (issuer.crt 내용)
      keyPEM: |
        # Issuer 개인키 (issuer.key 내용)

# 리소스 제한 (WSL2 최적화)
proxy:
  resources:
    cpu:
      request: 10m
      limit: 100m
    memory:
      request: 10Mi
      limit: 50Mi
  logLevel: warn

# 프록시 자동 주입 설정
proxyInit:
  resources:
    cpu:
      request: 10m
      limit: 100m
    memory:
      request: 10Mi
      limit: 50Mi
```

---

## 3.4 ServiceProfile 설계 (6개 서비스)

| 서비스 | 라우트 수 | 재시도 | 타임아웃 |
|--------|---------|--------|---------|
| auth-service | 4 | 1회 | 5s |
| api-gateway | 6 | 0회 | 10s |
| tenant-service | 4 | 1회 | 5s |
| audit-service | 3 | 2회 | 3s |
| ai-gateway | 2 | 0회 | 30s |
| catalog-service | 3 | 1회 | 5s |

---

## 3.5 AuthorizationPolicy 설계

```yaml
# 서비스 인가 정책: api-gateway만 auth-service 접근 허용
apiVersion: policy.linkerd.io/v1beta3
kind: AuthorizationPolicy
metadata:
  name: auth-service-policy
  namespace: saas
spec:
  targetRef:
    group: core
    kind: Server
    name: auth-service
  requiredAuthenticationRefs:
    - name: auth-service-mtls
      kind: MeshTLSAuthentication
      group: policy.linkerd.io
```

---

## 3.6 테스트 전략

| TC ID | 테스트 내용 | 유형 |
|-------|-----------|------|
| TC-01 | Linkerd CLI 설치 확인 | 설치 |
| TC-02 | Control Plane 설정 검증 | 설치 |
| TC-03 | Trust Anchor 가이드 완비 | 문서 |
| TC-04 | Helm values 필수 항목 | 설정 |
| TC-05 | mTLS 설정 활성화 확인 | 보안 |
| TC-06~11 | ServiceProfile 6개 서비스 | 구성 |
| TC-12 | AuthorizationPolicy 설정 | 보안 |
| TC-13 | Grafana 대시보드 패널 | 모니터링 |
| TC-14 | Retry/Timeout 정책 설정 | 트래픽 |
| TC-15 | k3s WSL2 호환성 가이드 | 문서 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 최초 작성 | bkend-expert |
