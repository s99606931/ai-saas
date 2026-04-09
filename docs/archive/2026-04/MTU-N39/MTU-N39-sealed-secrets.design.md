# Design: MTU-N39 Sealed Secrets GitOps 시크릿 관리

> **버전**: 1.0.0 | **작성일**: 2026-04-09

---

## Design Anchor

| 항목 | 값 |
|------|---|
| 도구 | Bitnami Sealed Secrets v0.27+ |
| 패턴 | GitOps 시크릿 (암호화 -> Git -> Flux 자동 배포) |
| 스코프 | strict (namespace 고정, CVE-2026-22728 대응) |
| 키 로테이션 | 30일 주기, 이전 키 유지 (복호화 호환) |

---

## S3. 상세 설계

### S3.1 Sealed Secrets 컨트롤러 설치

```yaml
# Helm 설치 명령
helm repo add sealed-secrets https://bitnami-labs.github.io/sealed-secrets
helm install sealed-secrets sealed-secrets/sealed-secrets \
  --namespace kube-system \
  -f infra/sealed-secrets/values.yaml
```

### S3.2 values.yaml 설정

```yaml
# 핵심 보안 설정
commandArgs:
  - "--update-status"
  - "--key-renew-period=720h"    # 30일 키 로테이션
  - "--key-cutoff-time=0"        # 이전 키 영구 유지 (복호화)

# CVE-2026-22728 대응: strict scope 강제
# namespace 고정 모드만 허용
secretScope: strict
```

### S3.3 SealedSecret 생성 흐름

```bash
# 1. 일반 시크릿 생성 (임시)
kubectl create secret generic db-credentials \
  --from-literal=POSTGRES_USER=saas \
  --from-literal=POSTGRES_PASSWORD=${DB_PASS} \
  --namespace saas-platform \
  --dry-run=client -o yaml > /tmp/secret.yaml

# 2. kubeseal로 암호화 (strict scope -- namespace 고정)
kubeseal --format yaml \
  --scope strict \
  --controller-namespace kube-system \
  --controller-name sealed-secrets \
  < /tmp/secret.yaml > infra/sealed-secrets/templates/db-credentials.yaml

# 3. 임시 파일 즉시 삭제
rm -f /tmp/secret.yaml

# 4. Git 커밋 (암호화된 SealedSecret만 저장)
git add infra/sealed-secrets/templates/db-credentials.yaml
git commit -m "feat(secrets): DB 크리덴셜 SealedSecret 추가"
```

### S3.4 Flux 연동

```yaml
# infra/sealed-secrets/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
namespace: saas-platform
resources:
  - templates/db-credentials.yaml
  - templates/harbor-credentials.yaml
  - templates/jwt-secret.yaml
  - templates/cosign-keys.yaml
```

### S3.5 CVE-2026-22728 대응

CVE-2026-22728: Sealed Secrets 키 로테이션 시 메타데이터 조작으로 namespace-scoped 시크릿을 cluster-wide로 확장 가능.

**대응 조치**:
1. `secretScope: strict` 강제 (default scope 사용 금지)
2. kubeseal `--scope strict` 필수 사용
3. Kyverno 정책으로 SealedSecret scope 검증

```yaml
# Kyverno 정책: SealedSecret scope 검증
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: sealed-secret-strict-scope
spec:
  rules:
    - name: require-strict-scope
      match:
        resources:
          kinds: ["SealedSecret"]
      validate:
        message: "SealedSecret은 strict scope만 허용 (CVE-2026-22728)"
        pattern:
          spec:
            encryptedData:
              "?*": "?*"
```

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-09 | 최초 설계 | PM Lead (security-architect) |
