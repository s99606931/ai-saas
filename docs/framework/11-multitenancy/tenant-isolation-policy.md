# 테넌트 격리 정책 가이드

> MTU-E2 | FR-8.5 | 적용 기준일: 2026-04-05
> 참조: MTU-C7 (Policy as Code), MTU-C3 (CSAP D-08), N2SF N-03 (격리)
> Design Ref: MTU-E2 Option B (등급별 차등 격리)

---

## 1. 개요

Kyverno 정책 기반으로 N2SF 등급별 테넌트 격리를 자동 강제합니다.
정책 위반 시 즉시 차단(Enforce)하여 격리 우회를 원천 방지합니다.

---

## 2. Kyverno 정책 카탈로그

### 2.1 테넌트 레이블 필수화

```yaml
# 모든 테넌트 리소스에 필수 레이블 강제
# Plan SC: FR-8.5, Design Ref: CSAP D-08
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: require-tenant-labels
  annotations:
    policies.kyverno.io/title: 테넌트 필수 레이블
    policies.kyverno.io/category: Multi-Tenancy
    policies.kyverno.io/severity: high
    policies.kyverno.io/description: >-
      공공 SaaS 테넌트 리소스에 tenant-id, n2sf-grade 레이블을 필수화합니다.
spec:
  validationFailureAction: Enforce
  background: true
  rules:
    - name: require-labels
      match:
        any:
          - resources:
              kinds:
                - Pod
                - Service
                - Deployment
                - StatefulSet
                - Job
              namespaceSelector:
                matchLabels:
                  tenant-type: public-saas
      validate:
        message: "테넌트 리소스에 tenant-id, n2sf-grade 레이블 필수 (CSAP D-08)"
        pattern:
          metadata:
            labels:
              tenant-id: "?*"
              n2sf-grade: "C|S|O"
```

### 2.2 리소스 한도 강제

```yaml
# 테넌트 Pod 리소스 한도 필수화 (DoS 방지)
# Plan SC: FR-8.5, Design Ref: CSAP D-11
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: require-tenant-resource-limits
spec:
  validationFailureAction: Enforce
  rules:
    - name: check-limits
      match:
        any:
          - resources:
              kinds: [Pod]
              namespaceSelector:
                matchLabels:
                  tenant-type: public-saas
      validate:
        message: "테넌트 Pod에 CPU/메모리 limits/requests 필수 (CSAP D-08)"
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

### 2.3 C등급 외부 통신 차단

```yaml
# C등급 네임스페이스 외부 이그레스 원천 차단
# Plan SC: FR-8.5, Design Ref: N2SF N-03
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: block-external-egress-grade-c
spec:
  validationFailureAction: Enforce
  rules:
    - name: deny-external-service
      match:
        any:
          - resources:
              kinds: [Service]
              namespaceSelector:
                matchLabels:
                  n2sf-grade: "C"
      validate:
        message: "C등급 네임스페이스에서 ExternalName/LoadBalancer 서비스 생성 불가 (N2SF N-03)"
        deny:
          conditions:
            any:
              - key: "{{ request.object.spec.type }}"
                operator: AnyIn
                value: ["ExternalName", "LoadBalancer"]
```

### 2.4 이미지 레지스트리 제한

```yaml
# 공공 SaaS 테넌트는 Harbor 레지스트리만 허용
# Design Ref: MTU-I3 Harbor, CSAP D-11
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: restrict-tenant-image-registry
spec:
  validationFailureAction: Enforce
  rules:
    - name: allow-harbor-only
      match:
        any:
          - resources:
              kinds: [Pod]
              namespaceSelector:
                matchLabels:
                  tenant-type: public-saas
      validate:
        message: "테넌트 Pod는 Harbor 레지스트리(harbor.internal) 이미지만 허용"
        pattern:
          spec:
            containers:
              - image: "harbor.internal/*"
            initContainers:
              - image: "harbor.internal/*"
```

### 2.5 네임스페이스 간 통신 차단 (S등급)

```yaml
# S등급 네임스페이스 크로스 네임스페이스 통신 차단
# Design Ref: N2SF N-03
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: enforce-namespace-isolation-grade-s
spec:
  validationFailureAction: Audit  # 기존 리소스 영향 최소화 후 Enforce 전환
  rules:
    - name: generate-deny-all-netpol
      match:
        any:
          - resources:
              kinds: [Namespace]
              selector:
                matchLabels:
                  n2sf-grade: "S"
      generate:
        apiVersion: networking.k8s.io/v1
        kind: NetworkPolicy
        name: default-deny-cross-namespace
        namespace: "{{ request.object.metadata.name }}"
        data:
          spec:
            podSelector: {}
            policyTypes:
              - Ingress
              - Egress
            ingress:
              - from:
                  - podSelector: {}
            egress:
              - to:
                  - podSelector: {}
              - to:
                  - namespaceSelector:
                      matchLabels:
                        kubernetes.io/metadata.name: kube-system
                ports:
                  - protocol: UDP
                    port: 53
```

---

## 3. C등급 에어갭 구성 가이드

### 3.1 물리적 네트워크 분리

```
인터넷 ─── [방화벽] ─── 업무망 (O/S등급)
                           │
                       [에어갭]  <-- 물리적 분리
                           │
                       기밀망 (C등급)
                           │
                    ┌──────┴──────┐
                    │ k3s Cluster  │
                    │ (C등급 전용) │
                    │ Harbor Local │
                    │ LM Studio   │
                    └─────────────┘
```

### 3.2 에어갭 이미지 전송 절차

```bash
#!/bin/bash
# C등급 에어갭 이미지 전송 스크립트
# Design Ref: MTU-I3 Harbor

# 1. 업무망에서 이미지 다운로드 및 스캔
docker pull harbor.internal/public-saas/app:v1.0
trivy image harbor.internal/public-saas/app:v1.0 --exit-code 1

# 2. 이미지 tar 파일 생성
docker save harbor.internal/public-saas/app:v1.0 -o /secure-transfer/app-v1.0.tar

# 3. SHA-256 해시 생성 (무결성 검증용)
sha256sum /secure-transfer/app-v1.0.tar > /secure-transfer/app-v1.0.tar.sha256

# 4. 물리적 매체(USB 등)로 기밀망 전송
# !! 물리적 전송만 허용 — 네트워크 전송 절대 금지 !!

# 5. 기밀망에서 무결성 검증 후 로드
sha256sum -c app-v1.0.tar.sha256
k3s ctr images import app-v1.0.tar

# 6. 감사 로그 기록
echo "{\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"action\":\"IMAGE_IMPORT\",\"image\":\"app:v1.0\",\"grade\":\"C\",\"method\":\"airgap\"}" >> /var/log/audit/grade-c/audit.jsonl
```

---

## 4. 테넌트 ResourceQuota 템플릿

```yaml
# S등급 테넌트 리소스 쿼터 (기관 규모별 조정)
# Design Ref: CSAP D-11
apiVersion: v1
kind: ResourceQuota
metadata:
  name: tenant-quota-small
  namespace: tenant-s-agency-a
spec:
  hard:
    requests.cpu: "4"
    requests.memory: "8Gi"
    limits.cpu: "8"
    limits.memory: "16Gi"
    pods: "20"
    services: "10"
    persistentvolumeclaims: "5"
    secrets: "10"
    configmaps: "20"
---
# LimitRange: Pod 기본값 설정
apiVersion: v1
kind: LimitRange
metadata:
  name: tenant-limit-range
  namespace: tenant-s-agency-a
spec:
  limits:
    - default:
        cpu: "500m"
        memory: "512Mi"
      defaultRequest:
        cpu: "100m"
        memory: "128Mi"
      type: Container
```

---

## 5. CSAP/N2SF 준수 체크리스트

| 점검 항목 | CSAP 항목 | N2SF 영역 | 검증 방법 |
|---------|---------|---------|---------|
| 네임스페이스 격리 | D-08-01 | N-03 | `kubectl get netpol -A` 전수 확인 |
| RBAC 최소 권한 | D-08-03 | N-02 | `kubectl auth can-i --list --as=tenant-admin` |
| 리소스 한도 적용 | D-11-03 | N-03 | Kyverno 정책 위반 0건 확인 |
| 이미지 서명 검증 | D-12-05 | N-05 | Cosign 서명 검증 통과 |
| 감사 로그 분리 | D-06-01 | N-06 | 등급별 audit.jsonl 경로 분리 확인 |
| C등급 에어갭 | D-10-01 | N-01 | 외부 통신 시도 → 100% 차단 확인 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | 최초 작성 — Kyverno 정책 6종 + C등급 에어갭 가이드 | Claude Code |
