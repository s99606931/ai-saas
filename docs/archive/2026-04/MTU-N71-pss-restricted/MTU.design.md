# MTU-N71: Pod Security Standards Restricted 프로필 — Design

> **버전**: 1.0.0 | **작성일**: 2026-04-10 | **작성자**: PM Lead (Opus)

---

## 1. 아키텍처 개요

### 1.1 PSA Restricted 프로필 요구사항

Restricted 프로필은 다음을 강제합니다:
- `runAsNonRoot: true` — 루트 사용자 금지
- `allowPrivilegeEscalation: false` — 권한 상승 금지
- `capabilities.drop: ["ALL"]` — 모든 Linux 케이퍼빌리티 제거
- `readOnlyRootFilesystem: true` (권장)
- `seccompProfile.type: RuntimeDefault` — seccomp 프로필 강제
- hostNetwork, hostPID, hostIPC, hostPath 전부 금지

### 1.2 네임스페이스 분류

| 카테고리 | 네임스페이스 | PSS 레벨 |
|---------|-------------|---------|
| 시스템 | kube-system, kube-public, kube-node-lease | privileged |
| GitOps | flux-system | privileged (Flux 컨트롤러 필요) |
| 모니터링 | monitoring | baseline (node-exporter 필요) |
| 보안 도구 | falco-system, trivy-system | privileged (커널 접근 필요) |
| 앱 서비스 | default, saas-apps, saas-data | **restricted** |
| CI/CD | gitea, harbor | baseline |
| 메시 | linkerd, cert-manager | baseline |
| 테스트 | chaos-testing | baseline |

---

## 2. 네임스페이스 라벨 매니페스트 설계

```yaml
# 앱 네임스페이스 — Restricted Enforce
metadata:
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/enforce-version: latest
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/audit-version: latest
    pod-security.kubernetes.io/warn: restricted
    pod-security.kubernetes.io/warn-version: latest
```

---

## 3. 워크로드 securityContext 표준 템플릿

```yaml
securityContext:
  runAsNonRoot: true
  runAsUser: 1000
  runAsGroup: 3000
  fsGroup: 2000
  seccompProfile:
    type: RuntimeDefault
containers:
  - name: app
    securityContext:
      allowPrivilegeEscalation: false
      readOnlyRootFilesystem: true
      capabilities:
        drop: ["ALL"]
```

---

## 4. Kyverno 보조 정책 설계

### 4.1 PSS 위반 감사 로깅 정책

```yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: pss-restricted-audit
spec:
  validationFailureAction: Audit
  background: true
  rules:
    - name: check-restricted-compliance
      match:
        any:
          - resources:
              kinds: ["Pod"]
      validate:
        message: "Pod does not comply with restricted PSS profile"
        podSecurity:
          level: restricted
          version: latest
```

---

## 5. 검증 테스트 설계

| 테스트 ID | 시나리오 | 기대 결과 |
|----------|---------|----------|
| PSS-01 | restricted NS에 특권 컨테이너 배포 시도 | 차단 |
| PSS-02 | restricted NS에 hostNetwork Pod 배포 시도 | 차단 |
| PSS-03 | restricted NS에 hostPath 볼륨 Pod 배포 시도 | 차단 |
| PSS-04 | restricted NS에 정상 컨테이너 배포 | 성공 |
| PSS-05 | system NS에 특권 컨테이너 배포 | 성공 (예외) |
| PSS-06 | 모든 앱 NS에 restricted 라벨 확인 | 라벨 존재 |
| PSS-07 | Deployment securityContext 호환 확인 | 모든 Deployment 통과 |
| PSS-08 | StatefulSet securityContext 호환 확인 | 모든 StatefulSet 통과 |
| PSS-09 | capabilities.drop ALL 확인 | 전 컨테이너 적용 |
| PSS-10 | runAsNonRoot 확인 | 전 컨테이너 적용 |
| PSS-11 | Kyverno 정책 적용 확인 | ClusterPolicy active |
| PSS-12 | Kyverno 위반 리포트 생성 확인 | PolicyReport 생성 |
| PSS-13 | seccompProfile RuntimeDefault 확인 | 전 컨테이너 적용 |
| PSS-14 | allowPrivilegeEscalation false 확인 | 전 컨테이너 적용 |
| PSS-15 | 전체 NS PSS 레벨 매트릭스 검증 | 분류표 일치 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 최초 작성 | PM Lead |
