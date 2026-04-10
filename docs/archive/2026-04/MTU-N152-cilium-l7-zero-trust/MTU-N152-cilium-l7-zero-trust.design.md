# MTU-N152 Cilium L7 Zero Trust — Design

> **문서 버전**: 1.0.0 | **작성일**: 2026-04-10 | **작성자**: CTO Lead

---

## 1. 아키텍처: Cilium eBPF + Hubble

eBPF 기반 커널 레벨 네트워크 정책 → 사이드카 프록시 불필요 → 40% 레이턴시 감소

## 2. 상세 설계

### 2.1 기본 L3/L4 정책 (Default Deny)

```yaml
# infra/cilium-zero-trust/default-deny.yaml
apiVersion: cilium.io/v2
kind: CiliumNetworkPolicy
metadata:
  name: default-deny-all
  namespace: saas-system
spec:
  endpointSelector: {}
  ingress:
    - fromEndpoints:
        - matchLabels:
            io.cilium.k8s.policy.cluster: default
  egress:
    - toEndpoints:
        - matchLabels:
            io.kubernetes.pod.namespace: kube-system
            k8s-app: kube-dns
      toPorts:
        - ports:
            - port: "53"
              protocol: UDP
```

### 2.2 L7 HTTP 필터링

```yaml
# infra/cilium-zero-trust/l7-http-policy.yaml
apiVersion: cilium.io/v2
kind: CiliumNetworkPolicy
metadata:
  name: api-gateway-l7
  namespace: saas-system
spec:
  endpointSelector:
    matchLabels:
      app: api-gateway
  ingress:
    - fromEndpoints:
        - matchLabels:
            app: frontend
      toPorts:
        - ports:
            - port: "8080"
              protocol: TCP
          rules:
            http:
              - method: GET
                path: "/api/v1/.*"
              - method: POST
                path: "/api/v1/auth/login"
              - method: POST
                path: "/api/v1/auth/refresh"
```

### 2.3 L7 gRPC 필터링

```yaml
# infra/cilium-zero-trust/l7-grpc-policy.yaml
apiVersion: cilium.io/v2
kind: CiliumNetworkPolicy
metadata:
  name: grpc-service-policy
  namespace: saas-system
spec:
  endpointSelector:
    matchLabels:
      app: user-service
  ingress:
    - fromEndpoints:
        - matchLabels:
            app: api-gateway
      toPorts:
        - ports:
            - port: "9090"
              protocol: TCP
          rules:
            http:
              - method: POST
                path: "/user.UserService/GetUser"
              - method: POST
                path: "/user.UserService/ListUsers"
```

### 2.4 DNS 기반 이그레스 제어

```yaml
# infra/cilium-zero-trust/fqdn-egress.yaml
apiVersion: cilium.io/v2
kind: CiliumNetworkPolicy
metadata:
  name: external-access-control
  namespace: saas-system
spec:
  endpointSelector:
    matchLabels:
      app: ai-service
  egress:
    - toFQDNs:
        - matchName: "host.docker.internal"
      toPorts:
        - ports:
            - port: "1234"
              protocol: TCP
    - toEndpoints:
        - matchLabels:
            io.kubernetes.pod.namespace: kube-system
            k8s-app: kube-dns
      toPorts:
        - ports:
            - port: "53"
              protocol: UDP
```

### 2.5 Hubble 관측성

```yaml
# infra/cilium-zero-trust/hubble-config.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: hubble-config
  namespace: kube-system
data:
  enable-hubble: "true"
  hubble-listen-address: ":4244"
  hubble-metrics-server: ":9965"
  hubble-metrics: "dns,drop,tcp,flow,icmp,http"
  hubble-export-file-max-size-mb: "10"
  hubble-export-file-max-backups: "5"
```

### 2.6 정책 위반 알림

```yaml
# infra/cilium-zero-trust/alerts.yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: cilium-zero-trust-alerts
  namespace: monitoring
spec:
  groups:
    - name: cilium-zero-trust
      rules:
        - alert: CiliumPolicyDrop
          expr: rate(hubble_drop_total[5m]) > 10
          labels:
            severity: warning
            csap_domain: D-10
          annotations:
            summary: "Cilium 정책 위반 트래픽 감지: {{ $value }}/s"

        - alert: CiliumL7PolicyViolation
          expr: rate(hubble_http_responses_total{code=~"403|401"}[5m]) > 5
          labels:
            severity: warning
            csap_domain: D-08
          annotations:
            summary: "L7 접근 거부 빈발: {{ $value }}/s"
```
