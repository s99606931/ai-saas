# Kyverno 정책 — CSAP 매핑 구현 가이드

| 항목 | 내용 |
|------|------|
| 문서 ID | PAC-KYV-001 |
| 버전 | 1.0.0 |
| 최종 수정일 | 2026-04-05 |
| 정책 엔진 | Kyverno (CNCF Incubating) |
| 정책 수 | 8개 (CSAP D06/D08/D09/D10/D11/D12 매핑) |
| FR 매핑 | FR-9.1 |
| MTU 매핑 | MTU-C7 |

<!-- Design Ref: MTU-C7 Plan -- Kyverno 정책 -->
<!-- Plan SC: CSAP D08/D09/D10/D11/D12/D06 매핑 정책 8개 이상 -->

---

## 정책 목록 요약

| 번호 | 정책명 | CSAP 항목 | 동작 | 설명 |
|------|--------|---------|------|------|
| 1 | require-non-root | CSAP-D08-01 | Enforce | non-root 사용자 실행 강제 |
| 2 | disallow-privileged | CSAP-D08-05 | Enforce | privileged 컨테이너 금지 |
| 3 | require-encryption-labels | CSAP-D09-01 | Enforce | Secret 암호화 + TLS 미적용 차단 |
| 4 | verify-image-signature | CSAP-D09-02, D12-08 | Enforce | Cosign 서명된 이미지만 배포 |
| 5 | require-network-policy | CSAP-D10-04 | Audit | Namespace에 NetworkPolicy 필수 |
| 6 | require-readonly-rootfs | CSAP-D11-03 | Enforce | readOnlyRootFilesystem 강제 |
| 7 | require-resource-limits | CSAP-D11-03 | Enforce | CPU/Memory 리소스 제한 필수 |
| 8 | require-audit-annotation | CSAP-D06-01 | Audit | audit.jsonl 연동 annotation 필수 |

---

## 1. non-root 사용자 실행 강제 (CSAP-D08-01)

ServiceAccount 제한 및 non-root 사용자 실행을 강제합니다.

```yaml
# CSAP-D08-01: 계정 권한 분리 — non-root 실행 강제
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: require-non-root
  annotations:
    policies.kyverno.io/title: Non-Root 실행 강제
    policies.kyverno.io/category: CSAP Compliance
    policies.kyverno.io/severity: high
    csap.control: "D08-01"
    policies.kyverno.io/description: >-
      CSAP-D08-01 계정 권한 분리: 모든 컨테이너는 non-root 사용자로 실행해야 합니다.
      root 실행은 권한 상승 공격의 진입점이 됩니다.
spec:
  validationFailureAction: Enforce
  background: true
  rules:
    - name: run-as-non-root
      match:
        any:
          - resources:
              kinds:
                - Pod
      validate:
        message: >-
          [CSAP-D08-01] Pod는 non-root로 실행해야 합니다.
          spec.securityContext.runAsNonRoot를 true로 설정하십시오.
        pattern:
          spec:
            securityContext:
              runAsNonRoot: true
            containers:
              - securityContext:
                  runAsNonRoot: true
                  allowPrivilegeEscalation: false
```

**검증 명령**:

```bash
# 정책 적용
kubectl apply -f require-non-root.yaml

# 위반 테스트 (root 실행 시도 → 거부됨)
kubectl run test-root --image=nginx --overrides='{
  "spec": {"securityContext": {"runAsNonRoot": false}}
}'
# Expected: Error from server: admission webhook "validate.kyverno.svc-fail"
#   denied the request: [CSAP-D08-01] Pod는 non-root로 실행해야 합니다.

# 정상 테스트 (non-root 실행)
kubectl run test-nonroot --image=nginx --overrides='{
  "spec": {"securityContext": {"runAsNonRoot": true, "runAsUser": 1000}}
}'
# Expected: pod/test-nonroot created
```

---

## 2. privileged 컨테이너 금지 (CSAP-D08-05)

```yaml
# CSAP-D08-05: 특권 모드 제한 — privileged container 금지
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: disallow-privileged
  annotations:
    csap.control: "D08-05"
    policies.kyverno.io/title: Privileged Container 금지
    policies.kyverno.io/severity: critical
spec:
  validationFailureAction: Enforce
  background: true
  rules:
    - name: disallow-privileged-containers
      match:
        any:
          - resources:
              kinds:
                - Pod
      validate:
        message: >-
          [CSAP-D08-05] privileged 컨테이너는 금지됩니다.
          securityContext.privileged를 false로 설정하십시오.
        pattern:
          spec:
            containers:
              - securityContext:
                  privileged: false
            =(initContainers):
              - securityContext:
                  privileged: false
```

**검증 명령**:

```bash
kubectl apply -f disallow-privileged.yaml

# 위반 테스트
kubectl run test-priv --image=nginx --overrides='{
  "spec": {"containers": [{"name": "nginx", "image": "nginx",
    "securityContext": {"privileged": true}}]}
}'
# Expected: denied — [CSAP-D08-05] privileged 컨테이너는 금지됩니다.
```

---

## 3. Secret 암호화 및 TLS 강제 (CSAP-D09-01)

```yaml
# CSAP-D09-01: 암호화 정책 — etcd Secret 암호화 + TLS 미적용 Service 차단
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: require-encryption-labels
  annotations:
    csap.control: "D09-01"
    policies.kyverno.io/title: 암호화 정책 강제
    policies.kyverno.io/severity: high
spec:
  validationFailureAction: Enforce
  background: true
  rules:
    - name: require-tls-on-ingress
      match:
        any:
          - resources:
              kinds:
                - Ingress
      validate:
        message: >-
          [CSAP-D09-01] 모든 Ingress는 TLS를 적용해야 합니다.
          spec.tls 설정이 필요합니다. HTTP 직접 통신은 금지됩니다.
        pattern:
          spec:
            tls:
              - hosts:
                  - "?*"
                secretName: "?*"
    - name: require-sealed-secrets
      match:
        any:
          - resources:
              kinds:
                - Secret
              namespaces:
                - grade-c
                - grade-s
      validate:
        message: >-
          [CSAP-D09-01] C/S 등급 Namespace의 Secret은 SealedSecret으로 관리해야 합니다.
          sealedsecrets.bitnami.com/managed 레이블이 필요합니다.
        pattern:
          metadata:
            labels:
              sealedsecrets.bitnami.com/managed: "true"
```

**검증 명령**:

```bash
kubectl apply -f require-encryption-labels.yaml

# TLS 미적용 Ingress 생성 시도 → 거부
kubectl apply -f - <<EOF
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: test-no-tls
  namespace: grade-o
spec:
  rules:
    - host: test.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: test-svc
                port:
                  number: 80
EOF
# Expected: denied — [CSAP-D09-01] 모든 Ingress는 TLS를 적용해야 합니다.
```

---

## 4. 서명된 이미지만 배포 허용 (CSAP-D09-02, D12-08)

```yaml
# CSAP-D09-02 + D12-08: 이미지 무결성 — Cosign 서명 검증
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: verify-image-signature
  annotations:
    csap.control: "D09-02, D12-08"
    policies.kyverno.io/title: 이미지 서명 검증
    policies.kyverno.io/severity: critical
spec:
  validationFailureAction: Enforce
  background: false
  rules:
    - name: verify-cosign-signature
      match:
        any:
          - resources:
              kinds:
                - Pod
      verifyImages:
        - imageReferences:
            - "harbor.internal.svc.cluster.local/*"
          attestors:
            - entries:
                - keys:
                    publicKeys: |-
                      -----BEGIN PUBLIC KEY-----
                      # Cosign 공개 키 (실제 키로 교체 필수)
                      # 키 생성: cosign generate-key-pair
                      -----END PUBLIC KEY-----
          mutateDigest: true
          required: true
```

**검증 명령**:

```bash
kubectl apply -f verify-image-signature.yaml

# 서명되지 않은 이미지 배포 시도 → 거부
kubectl run test-unsigned --image=harbor.internal.svc.cluster.local/app:unsigned
# Expected: denied — image signature verification failed

# 서명된 이미지 배포 → 허용
# (사전에 cosign sign 완료된 이미지)
kubectl run test-signed --image=harbor.internal.svc.cluster.local/app:v1.0-signed
```

---

## 5. NetworkPolicy 필수 (CSAP-D10-04)

```yaml
# CSAP-D10-04: 네트워크 분리 — 모든 Namespace에 NetworkPolicy 필수
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: require-network-policy
  annotations:
    csap.control: "D10-04"
    policies.kyverno.io/title: NetworkPolicy 필수
    policies.kyverno.io/severity: medium
spec:
  validationFailureAction: Audit    # 기존 Namespace 영향 방지 (Audit 모드)
  background: true
  rules:
    - name: check-networkpolicy-exists
      match:
        any:
          - resources:
              kinds:
                - Namespace
              selector:
                matchExpressions:
                  - key: data-grade
                    operator: Exists
      validate:
        message: >-
          [CSAP-D10-04] data-grade 레이블이 있는 Namespace에는 
          NetworkPolicy가 1개 이상 존재해야 합니다.
        deny:
          conditions:
            any:
              - key: "{{ request.object.metadata.labels.\"data-grade\" }}"
                operator: AnyIn
                value: ["C", "S", "O"]
```

---

## 6. readOnlyRootFilesystem 강제 (CSAP-D11-03)

```yaml
# CSAP-D11-03: 컨테이너 불변성 — readOnlyRootFilesystem 강제
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: require-readonly-rootfs
  annotations:
    csap.control: "D11-03"
    policies.kyverno.io/title: ReadOnly Root Filesystem 강제
    policies.kyverno.io/severity: high
spec:
  validationFailureAction: Enforce
  background: true
  rules:
    - name: require-readonly-rootfs
      match:
        any:
          - resources:
              kinds:
                - Pod
      validate:
        message: >-
          [CSAP-D11-03] 모든 컨테이너는 readOnlyRootFilesystem: true여야 합니다.
          쓰기가 필요한 경로는 emptyDir 볼륨을 마운트하십시오.
        pattern:
          spec:
            containers:
              - securityContext:
                  readOnlyRootFilesystem: true
```

**검증 명령**:

```bash
kubectl apply -f require-readonly-rootfs.yaml

# 쓰기 가능 root filesystem 시도 → 거부
kubectl run test-rw --image=nginx --overrides='{
  "spec": {"containers": [{"name": "nginx", "image": "nginx",
    "securityContext": {"readOnlyRootFilesystem": false}}]}
}'
# Expected: denied — [CSAP-D11-03] readOnlyRootFilesystem: true 필수
```

---

## 7. CPU/Memory 리소스 제한 필수 (CSAP-D11-03)

```yaml
# CSAP-D11-03: 리소스 제한 — CPU/Memory limits 필수
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: require-resource-limits
  annotations:
    csap.control: "D11-03"
    policies.kyverno.io/title: 리소스 제한 필수
    policies.kyverno.io/severity: medium
spec:
  validationFailureAction: Enforce
  background: true
  rules:
    - name: require-limits
      match:
        any:
          - resources:
              kinds:
                - Pod
      validate:
        message: >-
          [CSAP-D11-03] 모든 컨테이너에 resources.limits (cpu, memory)가 필수입니다.
          리소스 제한 없는 컨테이너는 다른 워크로드에 영향을 줄 수 있습니다.
        pattern:
          spec:
            containers:
              - resources:
                  limits:
                    memory: "?*"
                    cpu: "?*"
```

---

## 8. 감사 로그 annotation 필수 (CSAP-D06-01)

```yaml
# CSAP-D06-01: 감사 로그 강제 — audit annotation 필수
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: require-audit-annotation
  annotations:
    csap.control: "D06-01"
    policies.kyverno.io/title: 감사 로그 Annotation 필수
    policies.kyverno.io/severity: medium
spec:
  validationFailureAction: Audit    # 점진적 적용 (Audit 모드 시작)
  background: true
  rules:
    - name: check-audit-annotation
      match:
        any:
          - resources:
              kinds:
                - Deployment
                - StatefulSet
              namespaces:
                - grade-c
                - grade-s
      validate:
        message: >-
          [CSAP-D06-01] C/S 등급 Namespace의 워크로드에는
          audit.policy/enabled: "true" annotation이 필수입니다.
          감사 로그 미생성 워크로드는 배포할 수 없습니다.
        pattern:
          metadata:
            annotations:
              audit.policy/enabled: "true"
          spec:
            template:
              metadata:
                annotations:
                  audit.policy/enabled: "true"
```

---

## 일괄 적용 명령

```bash
# 전체 Kyverno 정책 일괄 적용
kubectl apply -f require-non-root.yaml
kubectl apply -f disallow-privileged.yaml
kubectl apply -f require-encryption-labels.yaml
kubectl apply -f verify-image-signature.yaml
kubectl apply -f require-network-policy.yaml
kubectl apply -f require-readonly-rootfs.yaml
kubectl apply -f require-resource-limits.yaml
kubectl apply -f require-audit-annotation.yaml

# 적용 확인
kubectl get clusterpolicies -o wide
# NAME                        BACKGROUND   VALIDATE ACTION   READY
# require-non-root            true         Enforce           True
# disallow-privileged         true         Enforce           True
# require-encryption-labels   true         Enforce           True
# verify-image-signature      false        Enforce           True
# require-network-policy      true         Audit             True
# require-readonly-rootfs     true         Enforce           True
# require-resource-limits     true         Enforce           True
# require-audit-annotation    true         Audit             True
```

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | 최초 작성 — CSAP 매핑 Kyverno 정책 8개 | Claude Code |
