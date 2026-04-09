# MTU-N53: OPA Gatekeeper 정책 엔진 통합 -- 설계 문서

> **버전**: 1.0.0 | **작성일**: 2026-04-10 | **작성자**: security-architect

---

## Executive Summary

| 관점 | 설계 결정 |
|------|----------|
| 비즈니스 | Kyverno(이미지 서명 검증) + Gatekeeper(복합 Rego 정책) 이중 엔진 구조 |
| 기술 | OPA Gatekeeper v3.18 Helm 배포, 8개 ConstraintTemplate, Rego 정책 |
| 보안 | Enforce 모드 기본, Audit 병행, 위반 이벤트 Prometheus 노출 |
| 운영 | Flux GitOps 자동 배포, Grafana 대시보드 정책 위반 시각화 |

---

## 3.1 아키텍처 개요

```
                    ┌─────────────────────────────┐
                    │    Kubernetes API Server     │
                    │  (Admission Webhook Chain)   │
                    └──────┬──────────┬────────────┘
                           │          │
                    ┌──────▼──┐  ┌────▼──────────┐
                    │ Kyverno │  │ OPA Gatekeeper │
                    │ (v1.17) │  │   (v3.18)      │
                    └─────────┘  └────────────────┘
                    │ 역할:       │ 역할:
                    │ - 이미지 서명│ - 특권 컨테이너 차단
                    │ - 라벨 강제 │ - 리소스 제한 강제
                    │ - Provenance│ - 허용 레지스트리 제한
                    │             │ - hostPath 차단
                    │             │ - latest 태그 차단
                    │             │ - 복합 Rego 정책
```

### 역할 분리 원칙

| 영역 | Kyverno | OPA Gatekeeper |
|------|---------|----------------|
| 이미지 서명 검증 | O (Cosign 통합) | X |
| 라벨/어노테이션 강제 | O (mutate 지원) | X |
| SLSA Provenance 검증 | O | X |
| 특권 컨테이너 차단 | X | O (Rego) |
| 리소스 제한 강제 | X | O (Rego) |
| 허용 레지스트리 제한 | X | O (Rego) |
| hostPath 차단 | X | O (Rego) |
| latest 태그 차단 | X | O (Rego) |
| 복합 조건 정책 | X | O (Rego) |
| 리소스 비율 검증 | X | O (Rego) |

---

## 3.2 ConstraintTemplate 설계

### 3.2.1 K8sBlockPrivilegedContainers

```rego
# Rego 정책: 특권 컨테이너 및 권한 상승 차단
# Design Ref: FR-N53.4
package k8sblockprivilegedcontainers

violation[{"msg": msg}] {
  container := input.review.object.spec.containers[_]
  container.securityContext.privileged == true
  msg := sprintf("특권 컨테이너 금지: %v (CSAP D-08)", [container.name])
}

violation[{"msg": msg}] {
  container := input.review.object.spec.containers[_]
  container.securityContext.allowPrivilegeEscalation == true
  msg := sprintf("권한 상승 금지: %v (CSAP D-08)", [container.name])
}
```

### 3.2.2 K8sRequireResourceLimits

```rego
# Rego 정책: CPU/메모리 리소스 제한 강제
# Design Ref: FR-N53.5
package k8srequireresourcelimits

violation[{"msg": msg}] {
  container := input.review.object.spec.containers[_]
  not container.resources.limits.memory
  msg := sprintf("메모리 제한 필수: %v", [container.name])
}

violation[{"msg": msg}] {
  container := input.review.object.spec.containers[_]
  not container.resources.limits.cpu
  msg := sprintf("CPU 제한 필수: %v", [container.name])
}

violation[{"msg": msg}] {
  container := input.review.object.spec.containers[_]
  not container.resources.requests.memory
  msg := sprintf("메모리 요청 필수: %v", [container.name])
}
```

### 3.2.3 K8sAllowedRegistries

```rego
# Rego 정책: 허용된 컨테이너 레지스트리만 사용
# Design Ref: FR-N53.6
package k8sallowedregistries

violation[{"msg": msg}] {
  container := input.review.object.spec.containers[_]
  not startswith(container.image, "harbor.local/")
  not startswith(container.image, "registry.k8s.io/")
  not startswith(container.image, "docker.io/library/")
  msg := sprintf("미승인 레지스트리: %v (CSAP D-09)", [container.image])
}
```

### 3.2.4 K8sBlockHostPath

```rego
# Rego 정책: hostPath 볼륨 마운트 차단
# Design Ref: FR-N53.7
package k8sblockhostpath

violation[{"msg": msg}] {
  volume := input.review.object.spec.volumes[_]
  volume.hostPath
  msg := sprintf("hostPath 마운트 금지: %v (CSAP D-08)", [volume.name])
}
```

### 3.2.5 K8sBlockLatestTag

```rego
# Rego 정책: latest 태그 사용 차단
# Design Ref: FR-N53.8
package k8sblocklatesttag

violation[{"msg": msg}] {
  container := input.review.object.spec.containers[_]
  endswith(container.image, ":latest")
  msg := sprintf("latest 태그 금지: %v", [container.image])
}

violation[{"msg": msg}] {
  container := input.review.object.spec.containers[_]
  not contains(container.image, ":")
  msg := sprintf("태그 미지정 금지: %v", [container.image])
}
```

### 3.2.6 K8sBlockHostNetwork

```rego
# hostNetwork 사용 차단
package k8sblockhostnetwork

violation[{"msg": msg}] {
  input.review.object.spec.hostNetwork == true
  msg := "hostNetwork 사용 금지 (CSAP D-08)"
}
```

### 3.2.7 K8sRequireNonRootUser

```rego
# 루트 사용자 실행 차단
package k8srequirenonrootuser

violation[{"msg": msg}] {
  container := input.review.object.spec.containers[_]
  not container.securityContext.runAsNonRoot
  msg := sprintf("runAsNonRoot 필수: %v", [container.name])
}
```

### 3.2.8 K8sRequireReadOnlyRootFS

```rego
# 읽기 전용 루트 파일시스템 강제
package k8srequirereadonlyrootfs

violation[{"msg": msg}] {
  container := input.review.object.spec.containers[_]
  not container.securityContext.readOnlyRootFilesystem
  msg := sprintf("읽기 전용 루트 FS 필수: %v (CSAP D-08)", [container.name])
}
```

---

## 3.3 Helm Values 설계

```yaml
# OPA Gatekeeper v3.18 Helm values
# Design Ref: FR-N53.1
replicas: 1                    # WSL2 환경 경량화
auditInterval: 60              # 60초 주기 감사
constraintViolationsLimit: 20
auditFromCache: true
emitAdmissionEvents: true      # Admission 이벤트 발행
emitAuditEvents: true          # Audit 이벤트 발행
logLevel: INFO
resources:
  limits:
    cpu: 500m
    memory: 512Mi
  requests:
    cpu: 100m
    memory: 256Mi
podAnnotations:
  prometheus.io/scrape: "true"
  prometheus.io/port: "8888"
```

---

## 3.4 Prometheus 메트릭 연동

Gatekeeper는 기본적으로 `:8888/metrics` 엔드포인트에서 메트릭을 노출합니다.

주요 메트릭:
- `gatekeeper_violations`: 정책 위반 수
- `gatekeeper_audit_duration_seconds`: 감사 소요 시간
- `gatekeeper_constraint_template_status`: ConstraintTemplate 상태

---

## 3.5 Flux GitOps 연동

```yaml
# infra/flux/gatekeeper-kustomization.yaml
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: gatekeeper-policies
  namespace: flux-system
spec:
  interval: 5m
  path: ./infra/gatekeeper
  prune: true
  sourceRef:
    kind: GitRepository
    name: ai-saas
```

---

## 3.6 테스트 전략

| TC ID | 테스트 내용 | 유형 | 예상 결과 |
|-------|-----------|------|----------|
| TC-01 | Gatekeeper Helm 설치 검증 | 설치 | gatekeeper-system 네임스페이스 Ready |
| TC-02 | 특권 컨테이너 차단 | 정책 | 배포 거부 |
| TC-03 | 리소스 제한 누락 차단 | 정책 | 배포 거부 |
| TC-04 | 미승인 레지스트리 차단 | 정책 | 배포 거부 |
| TC-05 | hostPath 마운트 차단 | 정책 | 배포 거부 |
| TC-06 | latest 태그 차단 | 정책 | 배포 거부 |
| TC-07 | hostNetwork 차단 | 정책 | 배포 거부 |
| TC-08 | 비루트 사용자 강제 | 정책 | 배포 거부 |
| TC-09 | 읽기 전용 FS 강제 | 정책 | 배포 거부 |
| TC-10 | Kyverno-Gatekeeper 공존 | 통합 | 충돌 없이 병행 동작 |
| TC-11 | Prometheus 메트릭 노출 | 모니터링 | gatekeeper_violations 수집 |
| TC-12 | 정상 Pod 배포 허용 | 양성 | 모든 정책 통과 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 최초 작성 | security-architect |
