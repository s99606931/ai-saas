# Gitea CI/CD 파이프라인 구현 가이드

| 항목 | 내용 |
|------|------|
| 문서 ID | INFRA-CICD-001 |
| 버전 | 1.0.0 |
| 최종 수정일 | 2026-04-05 |
| 대상 독자 | DevOps 엔지니어, 개발자, 보안 담당자 |
| FR 매핑 | FR-5.2, FR-5.3 |
| MTU 매핑 | MTU-I2 |

<!-- Design Ref: MTU-I2 Plan -- Gitea CI/CD -->
<!-- Plan SC: 빌드→테스트→SBOM→서명→배포 5분 이내, D12 체크리스트 전항목 -->

---

## 1. 개요

외부 클라우드 서비스에 의존하지 않는 완전 자립형 CI/CD 파이프라인을 k3s 클러스터 내부에 구성합니다. Gitea + Gitea Actions로 빌드, 테스트, SBOM 생성, 이미지 서명, 배포, 감사 로그 기록을 자동화합니다.

### 폐쇄망 요건 대응

| 외부 서비스 | 폐쇄망 대체 | 비고 |
|-----------|---------|------|
| GitHub | Gitea (k3s 내부) | Git 호스팅 + 코드 리뷰 |
| GitHub Actions | Gitea Actions | YAML 구문 99% 호환 |
| Docker Hub | Harbor (k3s 내부) | 이미지 레지스트리 (MTU-I3) |
| Sigstore Public | 로컬 Cosign 키 | 이미지 서명 (폐쇄망 모드) |

---

## 2. 아키텍처

```
[개발자 로컬] ──git push──▶ [Gitea (k3s 내부)]
                                    │
                          ┌─────────▼──────────┐
                          │  Gitea Actions      │
                          │                     │
                          │  1. 빌드 (Buildx)   │
                          │  2. 테스트 (Jest)    │
                          │  3. 보안 스캔        │
                          │     - gitleaks      │  ◀── CSAP-D12-03
                          │     - Trivy         │  ◀── CSAP-D12-01
                          │  4. SBOM 생성       │  ◀── MTU-C8 연동
                          │     (Syft → SPDX)   │
                          │  5. 이미지 서명      │  ◀── Cosign
                          │  6. Harbor push     │  ◀── MTU-I3 연동
                          │  7. k3s 배포        │
                          │  8. 감사 로그 기록   │  ◀── CSAP-D06
                          │                     │
                          └─────────┬───────────┘
                                    │
                          ┌─────────▼──────────┐
                          │  Harbor 레지스트리   │
                          │  (서명된 이미지)     │
                          └─────────┬───────────┘
                                    │
                          ┌─────────▼──────────┐
                          │  k3s 클러스터 배포   │
                          │  (Policy as Code)   │  ◀── MTU-C7 연동
                          └────────────────────┘
```

---

## 3. Gitea 설치 (k3s, Helm)

### 3.1 Helm Values 설정

```yaml
# gitea-values.yaml — k3s 내부 Gitea 설치
# CSAP-D09: 시크릿 환경 변수 주입, TLS 1.3+

image:
  repository: gitea/gitea
  tag: "1.21"
  pullPolicy: IfNotPresent

gitea:
  admin:
    username: gitea-admin
    # password: Secret에서 주입 (하드코딩 금지, CSAP-D09)
    existingSecret: gitea-admin-secret
  config:
    server:
      DOMAIN: gitea.internal.svc.cluster.local
      HTTP_PORT: 3000
      PROTOCOL: https
      CERT_FILE: /etc/gitea/tls/tls.crt
      KEY_FILE: /etc/gitea/tls/tls.key
      LFS_START_SERVER: true
    database:
      DB_TYPE: sqlite3        # 경량 구성 (k3s 단일 노드)
      PATH: /data/gitea/gitea.db
    actions:
      ENABLED: true
      DEFAULT_ACTIONS_URL: ""   # 외부 Actions URL 참조 금지
    security:
      INSTALL_LOCK: true
      SECRET_KEY: ""            # existingSecret에서 주입
      INTERNAL_TOKEN: ""        # existingSecret에서 주입
    service:
      DISABLE_REGISTRATION: true  # 외부 가입 차단
      REQUIRE_SIGNIN_VIEW: true   # 로그인 필수

persistence:
  enabled: true
  size: 10Gi
  storageClass: local-path

resources:
  requests:
    memory: 256Mi
    cpu: 100m
  limits:
    memory: 512Mi
    cpu: 500m
```

### 3.2 설치 명령

```bash
# Gitea Helm 설치
helm repo add gitea-charts https://dl.gitea.com/charts/
helm repo update

# 관리자 Secret 생성 (CSAP-D09: 하드코딩 금지)
kubectl create secret generic gitea-admin-secret \
  --namespace gitea \
  --from-literal=password="$(openssl rand -base64 24)" \
  --from-literal=secret-key="$(openssl rand -hex 32)" \
  --from-literal=internal-token="$(openssl rand -hex 32)"

# TLS 인증서 (self-signed, 내부 전용)
kubectl create secret tls gitea-tls \
  --namespace gitea \
  --cert=/path/to/tls.crt \
  --key=/path/to/tls.key

# Helm 설치
helm install gitea gitea-charts/gitea \
  --namespace gitea --create-namespace \
  -f gitea-values.yaml

# 설치 확인
kubectl get pods -n gitea
kubectl get svc -n gitea
# gitea-http   ClusterIP   10.43.x.x   3000/TCP
```

---

## 4. Actions 러너 구성 (k3s DaemonSet)

```yaml
# gitea-runner.yaml — Gitea Actions 러너
# CSAP-D11: non-root, readOnlyRootFilesystem
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: gitea-runner
  namespace: gitea
  labels:
    app: gitea-runner
spec:
  selector:
    matchLabels:
      app: gitea-runner
  template:
    metadata:
      labels:
        app: gitea-runner
      annotations:
        audit.policy/enabled: "true"   # CSAP-D06-01 (MTU-C7)
    spec:
      serviceAccountName: gitea-runner-sa
      securityContext:
        runAsNonRoot: true              # CSAP-D08-01
        runAsUser: 1000
        fsGroup: 1000
      containers:
        - name: runner
          image: gitea/act_runner:latest
          env:
            - name: GITEA_INSTANCE_URL
              value: "https://gitea.internal.svc.cluster.local:3000"
            - name: GITEA_RUNNER_REGISTRATION_TOKEN
              valueFrom:
                secretKeyRef:
                  name: gitea-runner-secret
                  key: token
            - name: GITEA_RUNNER_LABELS
              value: "ubuntu-latest:docker://node:20"
          securityContext:
            readOnlyRootFilesystem: true  # CSAP-D11-03
            allowPrivilegeEscalation: false
          resources:
            requests:
              memory: 256Mi
              cpu: 200m
            limits:
              memory: 1Gi
              cpu: 1000m
          volumeMounts:
            - name: runner-data
              mountPath: /data
            - name: tmp
              mountPath: /tmp
      volumes:
        - name: runner-data
          emptyDir: {}
        - name: tmp
          emptyDir: {}
```

```bash
# 러너 등록 토큰 생성
kubectl create secret generic gitea-runner-secret \
  --namespace gitea \
  --from-literal=token="<RUNNER_REGISTRATION_TOKEN>"

# 러너 배포
kubectl apply -f gitea-runner.yaml

# 러너 상태 확인
kubectl get pods -n gitea -l app=gitea-runner
```

---

## 5. CSAP-D12 배포 보안 체크리스트

| 항목 ID | 요건 | 구현 방법 | 워크플로우 파일 | 상태 |
|---------|------|---------|------------|------|
| D12-01 | 배포 전 취약점 스캔 | Trivy → HIGH 이상 시 파이프라인 중단 | `security-scan.yml` | 자동화 |
| D12-02 | 이미지 무결성 검증 | Cosign 서명 + Harbor 정책 미서명 차단 | `security-scan.yml` | 자동화 |
| D12-03 | 시크릿 하드코딩 금지 | gitleaks Actions 자동 실행 | `security-scan.yml` | 자동화 |
| D12-04 | 배포 승인 워크플로우 | main 브랜치 push 시 리뷰어 승인 필수 | Gitea Branch Protection | 설정 |
| D12-05 | 롤백 절차 | kubectl rollout undo + Flux GitOps 연계 | `deploy-k3s.yml` | 자동화 |

---

## 6. 워크플로우 템플릿

### 6.1 빌드 및 테스트 (`build-test.yml`)

→ 상세: [`gitea-actions-templates/build-test.yml`](./gitea-actions-templates/build-test.yml)

### 6.2 보안 스캔 (`security-scan.yml`)

→ 상세: [`gitea-actions-templates/security-scan.yml`](./gitea-actions-templates/security-scan.yml)

### 6.3 k3s 배포 (`deploy-k3s.yml`)

→ 상세: [`gitea-actions-templates/deploy-k3s.yml`](./gitea-actions-templates/deploy-k3s.yml)

---

## 7. Branch Protection 설정 (D12-04)

```bash
# Gitea API로 Branch Protection 설정
# main 브랜치: 리뷰어 1인 이상 승인 필수
curl -X POST "https://gitea.internal.svc.cluster.local:3000/api/v1/repos/org/repo/branch_protections" \
  -H "Authorization: token ${GITEA_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "branch_name": "main",
    "enable_push": false,
    "enable_merge_whitelist": true,
    "required_approvals": 1,
    "enable_status_check": true,
    "status_check_contexts": ["build-test", "security-scan"]
  }'
```

---

## 8. 감사 로그 연동 (CSAP-D06)

모든 파이프라인 실행은 audit.jsonl에 자동 기록됩니다.

```typescript
// CI/CD 감사 로그 엔트리
interface CICDAuditEntry {
  timestamp: string
  actor: string           // gitea.actor (커밋 작성자)
  action: 'BUILD' | 'TEST' | 'SCAN' | 'SIGN' | 'DEPLOY'
  target: string          // 리포지토리@커밋SHA
  pipelineRunId: string   // gitea.run_id
  environment: string     // production | staging
  result: 'SUCCESS' | 'FAILURE'
  n2sfDomain: 'N06'
  csapControl: string     // D12-01, D12-02, D06-01 등
  metadata?: {
    imageTag?: string
    trivyFindings?: number
    sbomGenerated?: boolean
    imageSigned?: boolean
  }
}
```

---

## 9. 문제 해결

| 증상 | 원인 | 해결 |
|------|------|------|
| 러너 등록 실패 | 토큰 만료 또는 URL 불일치 | Gitea 관리자 패널에서 토큰 재발급 |
| 빌드 실패 (이미지 pull 불가) | 폐쇄망에서 Docker Hub 접근 불가 | Harbor 미러 레지스트리 설정 (MTU-I3) |
| Cosign 서명 실패 | 키 파일 미설정 | `cosign generate-key-pair` 실행 후 Secret 등록 |
| Trivy DB 업데이트 실패 | 폐쇄망 인터넷 차단 | `trivy --skip-db-update` + 오프라인 DB 사전 다운로드 |
| 배포 후 Pod CrashLoopBackOff | Kyverno 정책 위반 (MTU-C7) | 정책 위반 메시지 확인 후 보안 설정 보완 |

---

## 10. 관련 문서

- [k3s WSL2 클러스터 구성](./k3s-wsl2/cluster-setup-recipe.md) (MTU-I1)
- [컨테이너 보안 베이스라인](./container-security-baseline.md) (MTU-I1)
- [Policy as Code](./policy-as-code/README.md) (MTU-C7)
- [SBOM 가이드](./supply-chain/sbom-guide.md) (MTU-C8, 미래)
- [CSAP D12 시스템 개발 보안](../02-csap/standard-grade/implementation-guide/D12-development-security.md)

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | 최초 작성 — Gitea CI/CD 파이프라인 구현 가이드 | Claude Code |
