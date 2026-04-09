# 공공기관 멀티테넌시 SaaS 아키텍처 가이드

> MTU-E2 | FR-8.5 | 적용 기준일: 2026-04-05
> 참조: MTU-C3 (CSAP D08~D13), MTU-I1 (k3s WSL2), MTU-I3 (Flux+Harbor), MTU-C7 (Policy as Code)
> Design Ref: MTU-E2 Option B (등급별 차등 격리)

---

## 1. 개요

공공기관 대상 SaaS 서비스에서 복수 기관이 단일 인프라를 안전하게 공유하는 멀티테넌시 아키텍처입니다.
N2SF 데이터 등급(C/S/O)별로 차등 격리 전략을 적용하여 보안과 비용 효율을 동시에 달성합니다.

**핵심 원칙**:
- C등급(기밀): 클러스터 수준 물리적 격리 (에어갭)
- S등급(민감): 네임스페이스 수준 논리적 격리 (NetworkPolicy)
- O등급(공개): RBAC 기반 논리 격리 (공유 네임스페이스)

---

## 2. N2SF 등급별 테넌트 격리 전략

### 2.1 격리 수준 매트릭스

| N2SF 등급 | 격리 수준 | k3s 구성 | 네트워크 | CSAP 요건 | AI API |
|-----------|---------|---------|---------|---------|--------|
| C (기밀) | 클러스터 격리 | 전용 k3s 클러스터 | 물리 분리 (에어갭) | D-08, D-09, D-10, D-12 전면 | LM Studio 전용 |
| S (민감) | 네임스페이스 격리 | 전용 네임스페이스 | NetworkPolicy 완전 차단 | D-08, D-09 적용 | LM Studio 전용 |
| O (공개) | 논리 격리 | 공유 네임스페이스 | RBAC 기반 분리 | D-08 적용 | Claude API (PII 마스킹 후) |

### 2.2 전체 아키텍처 구성도

```
                        ┌─────────────────────────────────────────────┐
                        │          공공기관 SaaS 플랫폼               │
                        │                                             │
  ┌─────────────────────┼──────────────────────┐                      │
  │  C등급 전용 인프라    │                      │                      │
  │                      │                      │                      │
  │  ┌───────────────┐  │  ┌────────────────┐  │  ┌────────────────┐ │
  │  │ k3s Cluster   │  │  │ k3s Cluster    │  │  │ k3s Cluster    │ │
  │  │ (에어갭)       │  │  │ (공유)          │  │  │ (공유)          │ │
  │  │               │  │  │                │  │  │                │ │
  │  │ tenant-c-001  │  │  │ tenant-s-001   │  │  │ tenant-o-shared│ │
  │  │ tenant-c-002  │  │  │ tenant-s-002   │  │  │  RBAC 분리     │ │
  │  │               │  │  │ tenant-s-003   │  │  │  - agency-a    │ │
  │  │ 외부통신 차단  │  │  │                │  │  │  - agency-b    │ │
  │  └───────────────┘  │  │ NetworkPolicy  │  │  │  - agency-c    │ │
  │                      │  │ 격리 적용       │  │  │                │ │
  │  Harbor (에어갭)      │  └────────────────┘  │  └────────────────┘ │
  │  LM Studio (전용)    │                      │                      │
  └──────────────────────┘                      │                      │
                                                │                      │
            S등급 네임스페이스 격리               │   O등급 공유 격리     │
                                                │                      │
                        └─────────────────────────────────────────────┘
                                    │
                            ┌───────────────┐
                            │ AI 게이트웨이   │
                            │ (MTU-A1)       │
                            │ N2SF 등급 라우팅│
                            └───────────────┘
```

---

## 3. C등급 테넌트: 에어갭 클러스터 격리

### 3.1 전용 k3s 클러스터 구성

```bash
# C등급 전용 k3s 클러스터 초기화 (에어갭 환경)
# 1. 외부 저장소 없이 Harbor 프라이빗 레지스트리만 사용
# Design Ref: MTU-I1 cluster-setup-recipe.md
k3s server \
  --disable traefik \
  --disable servicelb \
  --private-registry /etc/rancher/k3s/registries.yaml \
  --cluster-cidr 10.42.0.0/16 \
  --service-cidr 10.43.0.0/16 \
  --kube-apiserver-arg="audit-policy-file=/etc/k3s/audit-policy.yaml" \
  --kube-apiserver-arg="audit-log-path=/var/log/k3s/audit.log" \
  --protect-kernel-defaults=true

# 2. 에어갭용 이미지 사전 로드
k3s ctr images import grade-c-images.tar

# 3. PSS restricted 프로파일 적용 (CSAP D-11)
kubectl label namespace tenant-c-001 \
  pod-security.kubernetes.io/enforce=restricted \
  pod-security.kubernetes.io/warn=restricted
```

### 3.2 네트워크 완전 차단

```yaml
# C등급 전면 차단 NetworkPolicy
# Plan SC: FR-8.5, Design Ref: N2SF N-03
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: deny-all-external
  namespace: tenant-c-001
  labels:
    n2sf-grade: "C"
    tenant-id: "ministry-defense"
spec:
  podSelector: {}
  policyTypes:
    - Ingress
    - Egress
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              name: tenant-c-001
  egress:
    - to:
        - namespaceSelector:
            matchLabels:
              name: tenant-c-001
    # DNS는 클러스터 내부 CoreDNS만 허용
    - to:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: kube-system
      ports:
        - protocol: UDP
          port: 53
```

### 3.3 C등급 AI 연동

C등급 테넌트는 외부 AI API 전송이 절대 금지됩니다 (CLAUDE.md 절대 제약 5번).

```typescript
// C등급 AI 요청 처리
// Design Ref: MTU-A1 security-gateway-pattern.md
async function handleCGradeAIRequest(request: AIRequest): Promise<AIResponse> {
  // 외부 API 전송 절대 금지 — LM Studio 온프레미스만 허용
  const lmStudioEndpoint = 'http://host.docker.internal:1234/v1/chat/completions';

  const response = await fetch(lmStudioEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'local-model',
      messages: request.messages,
      temperature: 0.7,
    }),
  });

  // 감사 로그 기록
  await auditLog({
    actor: request.userId,
    action: 'AI_REQUEST',
    grade: 'C',
    target: 'lm-studio-local',
    result: response.ok ? 'SUCCESS' : 'FAILURE',
  });

  return response.json();
}
```

---

## 4. S등급 테넌트: 네임스페이스 격리

### 4.1 네임스페이스 생성 및 격리

```yaml
# S등급 테넌트 네임스페이스 구성
# Plan SC: FR-8.5
apiVersion: v1
kind: Namespace
metadata:
  name: tenant-s-agency-a
  labels:
    n2sf-grade: "S"
    tenant-id: "agency-a"
    tenant-type: "public-saas"
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/warn: restricted
---
# NetworkPolicy: 동일 네임스페이스 내부 통신만 허용
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: namespace-isolation
  namespace: tenant-s-agency-a
spec:
  podSelector: {}
  policyTypes:
    - Ingress
    - Egress
  ingress:
    - from:
        - podSelector: {}  # 동일 네임스페이스 내부만
  egress:
    - to:
        - podSelector: {}  # 동일 네임스페이스 내부만
    - to:  # DNS 허용
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: kube-system
      ports:
        - protocol: UDP
          port: 53
```

### 4.2 RBAC 역할 분리

```yaml
# S등급 테넌트 RBAC (CSAP D-08)
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: tenant-s-admin
  namespace: tenant-s-agency-a
rules:
  - apiGroups: ["", "apps", "batch"]
    resources: ["pods", "services", "deployments", "jobs", "configmaps"]
    verbs: ["get", "list", "watch", "create", "update", "delete"]
  - apiGroups: [""]
    resources: ["secrets"]
    verbs: ["get", "list"]  # 비밀 생성/삭제는 클러스터 관리자만
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: tenant-s-admin-binding
  namespace: tenant-s-agency-a
subjects:
  - kind: User
    name: "agency-a-admin"
    apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: Role
  name: tenant-s-admin
  apiGroup: rbac.authorization.k8s.io
```

---

## 5. O등급 테넌트: 공유 논리 격리

### 5.1 RBAC 기반 리소스 분리

```yaml
# O등급 공유 네임스페이스 — RBAC으로 테넌트별 분리
# Design Ref: CSAP D-08 접근 통제
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: tenant-o-agency-a-role
  namespace: tenant-o-shared
rules:
  - apiGroups: ["", "apps"]
    resources: ["pods", "services", "deployments"]
    verbs: ["get", "list", "watch", "create", "update"]
    resourceNames: []  # 레이블 기반 필터링은 admission webhook에서 처리
---
# Kyverno 정책으로 테넌트 레이블 강제
apiVersion: kyverno.io/v1
kind: Policy
metadata:
  name: enforce-tenant-label
  namespace: tenant-o-shared
spec:
  validationFailureAction: Enforce
  rules:
    - name: require-tenant-id
      match:
        any:
          - resources:
              kinds: [Pod, Service, Deployment]
      validate:
        message: "O등급 공유 네임스페이스에서 tenant-id 레이블 필수"
        pattern:
          metadata:
            labels:
              tenant-id: "?*"
```

---

## 6. 공통 Kyverno 정책

### 6.1 리소스 한도 필수화

```yaml
# Design Ref: MTU-C7 kyverno-policies.md
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: require-tenant-resource-limits
spec:
  validationFailureAction: Enforce
  rules:
    - name: check-resource-limits
      match:
        any:
          - resources:
              kinds: [Pod]
              namespaceSelector:
                matchLabels:
                  tenant-type: public-saas
      validate:
        message: "테넌트 Pod에 CPU/메모리 한도 설정 필수 (CSAP D-08)"
        pattern:
          spec:
            containers:
              - resources:
                  limits:
                    cpu: "?*"
                    memory: "?*"
                  requests:
                    cpu: "?*"
                    memory: "?*"
```

### 6.2 이미지 레지스트리 제한

```yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: restrict-image-registry
spec:
  validationFailureAction: Enforce
  rules:
    - name: allow-only-harbor
      match:
        any:
          - resources:
              kinds: [Pod]
              namespaceSelector:
                matchLabels:
                  tenant-type: public-saas
      validate:
        message: "공공 SaaS 테넌트는 Harbor 레지스트리 이미지만 허용"
        pattern:
          spec:
            containers:
              - image: "harbor.internal/*"
```

---

## 7. 모니터링 및 감사

### 7.1 테넌트별 메트릭 수집

```yaml
# OpenTelemetry Collector 테넌트별 메트릭 분리
# Design Ref: MTU-I4 opentelemetry-guide.md
apiVersion: v1
kind: ConfigMap
metadata:
  name: otel-collector-config
data:
  config.yaml: |
    receivers:
      otlp:
        protocols:
          grpc:
            endpoint: 0.0.0.0:4317
    processors:
      attributes/tenant:
        actions:
          - key: tenant.id
            from_context: k8s.namespace.name
            action: insert
    exporters:
      prometheus:
        endpoint: 0.0.0.0:9090
    service:
      pipelines:
        metrics:
          receivers: [otlp]
          processors: [attributes/tenant]
          exporters: [prometheus]
```

### 7.2 감사 로그 테넌트 격리

```typescript
// 테넌트별 감사 로그 분리
// Plan SC: FR-8.5, Design Ref: CSAP D-06
interface TenantAuditEntry {
  timestamp: string;
  tenantId: string;
  n2sfGrade: 'C' | 'S' | 'O';
  actor: string;
  action: string;
  resource: string;
  result: 'SUCCESS' | 'FAILURE' | 'BLOCKED';
  ip: string;
}

async function tenantAuditLog(entry: TenantAuditEntry): Promise<void> {
  // 등급별 감사 로그 저장 경로 분리
  const logPath = entry.n2sfGrade === 'C'
    ? `/var/log/audit/grade-c/${entry.tenantId}/audit.jsonl`
    : `/var/log/audit/shared/audit.jsonl`;

  await appendToFile(logPath, JSON.stringify(entry) + '\n');
}
```

---

## 8. CSAP/N2SF 준수 매트릭스

| 요건 | CSAP 항목 | N2SF 영역 | 구현 위치 |
|------|---------|---------|---------|
| 접근 통제 | D-08-01~12 | N-02 | RBAC + NetworkPolicy |
| 데이터 격리 | D-09-01~04 | N-03 | 네임스페이스/클러스터 격리 |
| 네트워크 분리 | D-10-01~08 | N-01 | NetworkPolicy + 에어갭 |
| 감사 로그 | D-06-01~05 | N-06 | 테넌트별 audit.jsonl |
| 리소스 한도 | D-11-01~07 | N-03 | Kyverno 정책 |
| AI 등급 분류 | — | N-05 | AI 게이트웨이 (MTU-A1) |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | 최초 작성 — N2SF 등급별 차등 격리 아키텍처 | Claude Code |
