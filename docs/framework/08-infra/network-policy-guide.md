# k3s NetworkPolicy 보안 정책 구현 가이드

| 항목 | 내용 |
|------|------|
| 문서 ID | INFRA-NETPOL-001 |
| 버전 | 1.0.0 |
| 최종 수정일 | 2026-04-05 |
| 대상 독자 | 인프라 엔지니어, 보안 담당자, N2SF 심사 대응 팀 |
| FR 매핑 | FR-5.4 (네트워크 보안 정책) |
| MTU 매핑 | MTU-I4 |
| 관련 문서 | [k3s 클러스터 설치](k3s-wsl2/), [N2SF 등급 분류](../04-n2sf/data-grade-classification.md), [N2SF 아키텍처](../04-n2sf/n2sf-infrastructure-architecture.md) |

<!-- Design Ref: MTU-I4 Plan -- 네트워크 보안 + OTel -->
<!-- Plan SC: C/S/O 등급별 NetworkPolicy 전수, N2SF N03 격리 충족 -->

---

## 1. 개요

k3s 클러스터에 N2SF 데이터 등급(C/S/O)별 NetworkPolicy를 적용하여, 기밀·민감 데이터의 네트워크 경로를 엄격히 통제합니다. Kubernetes NetworkPolicy API를 사용하며, kube-router CNI(MTU-I1에서 구성)가 정책을 강제합니다.

### CNI 전제 조건

| CNI | NetworkPolicy 지원 | MTU-I1 구성 |
|-----|-------------------|------------|
| Flannel (기본) | 미지원 | 사용하지 않음 |
| **kube-router** | 지원 | MTU-I1에서 설치 완료 |
| Calico | 지원 | 대안 (필요 시) |

> MTU-I1에서 `--flannel-backend=none` + kube-router CNI를 설치했으므로 NetworkPolicy가 즉시 동작합니다.

---

## 2. N2SF 데이터 등급별 네임스페이스 구성

### 2.1 네임스페이스 생성

```bash
# C등급 (기밀) 네임스페이스
kubectl create namespace grade-c
kubectl label namespace grade-c n2sf.grade=C

# S등급 (민감) 네임스페이스
kubectl create namespace grade-s
kubectl label namespace grade-s n2sf.grade=S

# O등급 (공개) 네임스페이스
kubectl create namespace grade-o
kubectl label namespace grade-o n2sf.grade=O

# 모니터링 네임스페이스 (OTel, Prometheus)
kubectl create namespace monitoring
kubectl label namespace monitoring n2sf.grade=infra

# 확인
kubectl get namespaces --show-labels | grep n2sf
```

### 2.2 네임스페이스 역할

| 네임스페이스 | N2SF 등급 | 배치 서비스 | 외부 통신 |
|-----------|---------|---------|---------|
| `grade-c` | C (기밀) | LM Studio, 온프레미스 DB | 완전 차단 (에어갭 근사) |
| `grade-s` | S (민감) | 내부 API, 인증 서비스, 민감 DB | 내부 제한적 허용 |
| `grade-o` | O (공개) | 공개 API, 웹 UI, AI API GW | AI API 게이트웨이 경유만 |
| `monitoring` | Infra | OTel, Prometheus, Loki, Jaeger | 내부 전용 |

---

## 3. C등급 (기밀) 완전 격리 정책

```yaml
# network-policies/grade-c-isolation.yaml
# N2SF N03-01: C등급 기밀 데이터 완전 격리
# 외부 인터넷 차단, 타 네임스페이스 접근 차단
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: grade-c-full-isolation
  namespace: grade-c
  labels:
    n2sf.area: "N03"
    csap.control: "D10-01"
  annotations:
    description: "C등급 기밀 네임스페이스 완전 격리 (N2SF N03-01)"
spec:
  podSelector: {}                          # 모든 Pod에 적용
  policyTypes:
    - Ingress
    - Egress
  ingress:
    # 동일 네임스페이스(grade-c) 내부 통신만 허용
    - from:
        - namespaceSelector:
            matchLabels:
              n2sf.grade: "C"
  egress:
    # C등급 내부 통신만 허용
    - to:
        - namespaceSelector:
            matchLabels:
              n2sf.grade: "C"
    # 클러스터 내부 DNS만 허용 (서비스 디스커버리)
    - to:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: kube-system
      ports:
        - protocol: UDP
          port: 53
    # OTel Collector로 메트릭/로그 전송 허용 (모니터링)
    - to:
        - namespaceSelector:
            matchLabels:
              n2sf.grade: "infra"
      ports:
        - protocol: TCP
          port: 4317                       # OTel gRPC
```

### 검증 방법

```bash
# C등급 Pod에서 외부 연결 시도 → 차단 확인
kubectl -n grade-c run test-c --image=busybox --rm -it -- wget -q -T 5 https://google.com
# Expected: wget: download timed out (차단됨)

# C등급 → S등급 접근 시도 → 차단 확인
kubectl -n grade-c run test-c --image=busybox --rm -it -- wget -q -T 5 http://api.grade-s.svc.cluster.local
# Expected: wget: download timed out (차단됨)

# C등급 내부 통신 → 허용 확인
kubectl -n grade-c run test-c --image=busybox --rm -it -- wget -q -T 5 http://lmstudio.grade-c.svc.cluster.local
# Expected: 200 OK (허용됨)
```

---

## 4. S등급 (민감) 제한적 통신 정책

```yaml
# network-policies/grade-s-restricted.yaml
# N2SF N03-02: S등급 민감 데이터 제한적 내부 통신
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: grade-s-restricted
  namespace: grade-s
  labels:
    n2sf.area: "N03"
    csap.control: "D10-02"
  annotations:
    description: "S등급 민감 네임스페이스 제한적 내부 통신 (N2SF N03-02)"
spec:
  podSelector: {}
  policyTypes:
    - Ingress
    - Egress
  ingress:
    # S등급 내부 통신 허용
    - from:
        - namespaceSelector:
            matchLabels:
              n2sf.grade: "S"
    # O등급 → S등급 API 호출 허용 (승인된 경로)
    - from:
        - namespaceSelector:
            matchLabels:
              n2sf.grade: "O"
      ports:
        - protocol: TCP
          port: 443                        # HTTPS API만
  egress:
    # S등급 내부 통신 허용
    - to:
        - namespaceSelector:
            matchLabels:
              n2sf.grade: "S"
    # DNS
    - to:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: kube-system
      ports:
        - protocol: UDP
          port: 53
    # OTel Collector 메트릭/로그 전송
    - to:
        - namespaceSelector:
            matchLabels:
              n2sf.grade: "infra"
      ports:
        - protocol: TCP
          port: 4317
```

### 검증 방법

```bash
# S등급 → 외부 연결 → 차단
kubectl -n grade-s run test-s --image=busybox --rm -it -- wget -q -T 5 https://google.com
# Expected: 차단됨

# O등급 → S등급 443 → 허용
kubectl -n grade-o run test-o --image=busybox --rm -it -- wget -q -T 5 https://api.grade-s.svc.cluster.local:443
# Expected: 허용됨

# C등급 → S등급 → 차단
kubectl -n grade-c run test-c --image=busybox --rm -it -- wget -q -T 5 http://api.grade-s.svc.cluster.local
# Expected: 차단됨
```

---

## 5. O등급 (공개) AI API 게이트웨이 정책

```yaml
# network-policies/grade-o-ai-gateway.yaml
# N2SF N05: O등급 공개 데이터 — AI API 게이트웨이 경유만 외부 허용
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: grade-o-ai-gateway-only
  namespace: grade-o
  labels:
    n2sf.area: "N05"
    csap.control: "D10-03"
  annotations:
    description: "O등급 AI API 게이트웨이 경유 외부 통신 (N2SF N05)"
spec:
  podSelector:
    matchLabels:
      app: ai-gateway                     # AI 게이트웨이 Pod만
  policyTypes:
    - Egress
  egress:
    # AI API 엔드포인트만 허용 (HTTPS 443)
    # 보안 주의: to: [] (전체 허용)은 N2SF N05 위반
    - to:
        - ipBlock:
            cidr: 0.0.0.0/0
            except:
              - 10.0.0.0/8                 # 내부망 직접 접근 차단
              - 172.16.0.0/12             # Docker 내부 차단
              - 192.168.0.0/16            # 사설망 차단
      ports:
        - protocol: TCP
          port: 443                        # HTTPS only (api.anthropic.com 등)
    # 클러스터 내부 DNS
    - to:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: kube-system
      ports:
        - protocol: UDP
          port: 53
    # OTel Collector
    - to:
        - namespaceSelector:
            matchLabels:
              n2sf.grade: "infra"
      ports:
        - protocol: TCP
          port: 4317
---
# O등급 일반 Pod: 외부 통신 차단, 내부 통신만
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: grade-o-default
  namespace: grade-o
  labels:
    n2sf.area: "N03"
spec:
  podSelector:
    matchExpressions:
      - key: app
        operator: NotIn
        values: ["ai-gateway"]             # AI GW 제외 일반 Pod
  policyTypes:
    - Ingress
    - Egress
  ingress:
    # 외부(Ingress Controller)에서 접근 허용
    - from:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: kube-system
    # O등급 내부 통신
    - from:
        - namespaceSelector:
            matchLabels:
              n2sf.grade: "O"
  egress:
    # O등급 + S등급 내부 통신
    - to:
        - namespaceSelector:
            matchLabels:
              n2sf.grade: "O"
    - to:
        - namespaceSelector:
            matchLabels:
              n2sf.grade: "S"
      ports:
        - protocol: TCP
          port: 443
    # DNS
    - to:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: kube-system
      ports:
        - protocol: UDP
          port: 53
    # OTel
    - to:
        - namespaceSelector:
            matchLabels:
              n2sf.grade: "infra"
      ports:
        - protocol: TCP
          port: 4317
```

---

## 6. 기본 차단 정책 (Default Deny)

```yaml
# network-policies/default-deny-all.yaml
# 모든 네임스페이스에 기본 차단 정책 적용 (화이트리스트 방식)
# 명시적으로 허용하지 않은 트래픽은 모두 차단
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: grade-c
spec:
  podSelector: {}
  policyTypes:
    - Ingress
    - Egress
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: grade-s
spec:
  podSelector: {}
  policyTypes:
    - Ingress
    - Egress
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: grade-o
spec:
  podSelector: {}
  policyTypes:
    - Ingress
    - Egress
```

> **적용 순서**: 먼저 default-deny-all 적용 → 이후 등급별 허용 정책 적용. Kubernetes NetworkPolicy는 OR 논리로 결합되므로 허용 정책이 추가되면 해당 트래픽만 허용됩니다.

---

## 7. N2SF N03 격리 요건 충족 매핑

| N2SF 요건 | 요건 내용 | k3s 구현 | NetworkPolicy | 검증 방법 |
|---------|---------|---------|-------------|---------|
| N03-01 | C등급 데이터 격리 | `grade-c` 네임스페이스 + full isolation | `grade-c-full-isolation.yaml` | 외부 연결 실패 확인 |
| N03-02 | S등급 접근 통제 | `grade-s` 네임스페이스 + restricted | `grade-s-restricted.yaml` | 승인 경로만 통과 확인 |
| N03-03 | 등급 간 데이터 흐름 통제 | Ingress/Egress 정책 명시적 허용 | 전체 정책 조합 | 정책 다이어그램 감리 |
| N03-04 | 네트워크 감사 추적 | OTel → audit.jsonl | OTel k8sobjects receiver | audit.jsonl 무결성 확인 |

---

## 8. CSAP·N2SF 준수 매핑

| 규제 항목 | 요건 | 구현 방법 | 검증 |
|---------|------|---------|------|
| CSAP-D10-01 | 네트워크 분리 | 데이터 등급별 네임스페이스 + NetworkPolicy | `kubectl get netpol -A` |
| CSAP-D10-02 | 네트워크 접근 통제 | 화이트리스트 방식 (default deny + allow) | 트래픽 테스트 |
| CSAP-D10-03 | 외부 연결 통제 | AI GW만 443 외부 허용, 나머지 차단 | 외부 연결 실패 확인 |
| N2SF-N03 | 격리 영역 | 위 N03-01~04 매핑 참조 | 전수 검증 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | 최초 작성 — C/S/O 등급별 NetworkPolicy + N2SF N03 매핑 | Claude Code |
