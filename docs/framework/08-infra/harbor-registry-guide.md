# Harbor 컨테이너 레지스트리 구현 가이드

| 항목 | 내용 |
|------|------|
| 문서 ID | INFRA-HARBOR-001 |
| 버전 | 1.0.0 |
| 최종 수정일 | 2026-04-05 |
| 대상 독자 | DevOps 엔지니어, 보안 담당자, CSAP 심사 대응 팀 |
| FR 매핑 | INFR-3 (Harbor 레지스트리 운영) |
| MTU 매핑 | MTU-I3 |
| 관련 문서 | [Flux GitOps 가이드](flux-gitops-guide.md), [Supply Chain SBOM](supply-chain/sbom-guide.md), [Sigstore 서명](supply-chain/sigstore-signing.md) |

<!-- Design Ref: MTU-I3 Plan -- Harbor 취약점 스캔 + 서명 검증 -->
<!-- Plan SC: Trivy 오프라인 스캔 + Cosign 서명 검증 정책 활성화 -->

---

## 1. 개요

Harbor v2.9+ 컨테이너 레지스트리를 k3s 클러스터 내부에 배포하여, 이미지 저장·취약점 스캔·서명 검증을 통합 관리합니다. 폐쇄망 환경에서 완전 자립형 운영이 가능하도록 Trivy 오프라인 스캔과 Cosign 서명 검증 정책을 구성합니다.

### Harbor 핵심 기능

| 기능 | 설명 | CSAP 매핑 |
|------|------|---------|
| 이미지 레지스트리 | OCI 호환 컨테이너 이미지 저장 | INFR-3 |
| Trivy 취약점 스캔 | 이미지 빌드 시 자동 CVE 스캔 | CSAP-D05-02 |
| Cosign 서명 검증 | 서명되지 않은 이미지 배포 차단 | CSAP-D05-03 |
| 이미지 복제 | 다중 레지스트리 간 복제 | 재해복구 (D07) |
| 감사 로그 | 모든 이미지 작업 기록 | CSAP-D06 |

---

## 2. 전제 조건

| 항목 | 요구사항 | 확인 방법 |
|------|---------|---------|
| k3s 클러스터 | v1.28+ 동작 중 (MTU-I1) | `kubectl get nodes` |
| Helm | v3.12+ | `helm version` |
| 스토리지 | PV 50GB+ (이미지 저장용) | `kubectl get sc` |
| TLS 인증서 | self-signed 또는 CA 발급 | cert-manager 또는 수동 |
| DNS/Ingress | `harbor.internal` 또는 ClusterIP | Traefik Ingress 설정 |

---

## 3. Harbor 설치 (Helm)

### 3.1 온라인 환경 설치

```bash
# Harbor Helm 차트 추가
helm repo add harbor https://helm.goharbor.io
helm repo update

# 네임스페이스 생성
kubectl create namespace harbor-system

# Harbor 설치 (values.yaml 적용)
helm install harbor harbor/harbor \
  --namespace harbor-system \
  --values harbor-values.yaml \
  --wait --timeout 10m
```

### 3.2 harbor-values.yaml 핵심 설정

```yaml
# harbor-values.yaml
expose:
  type: ingress
  ingress:
    hosts:
      core: harbor.internal
    annotations:
      kubernetes.io/ingress.class: traefik
  tls:
    enabled: true                          # TLS 1.3+ 필수 (CSAP-D09)
    certSource: secret
    secret:
      secretName: harbor-tls-cert

externalURL: https://harbor.internal

persistence:
  enabled: true
  persistentVolumeClaim:
    registry:
      storageClass: local-path             # k3s 내장 스토리지
      size: 50Gi
    database:
      storageClass: local-path
      size: 5Gi

# Trivy 취약점 스캔 설정
trivy:
  enabled: true
  gitHubToken: ""                          # 오프라인: 토큰 불필요
  offlineScan: true                        # 폐쇄망 모드 활성화
  skipUpdate: true                         # DB 자동 업데이트 비활성화

# Notary 비활성화 (Cosign 전용)
notary:
  enabled: false

# 내부 데이터베이스 설정
database:
  type: internal
  internal:
    password: "${HARBOR_DB_PASSWORD}"      # 환경 변수 주입 필수

# 감사 로그 활성화 (CSAP-D06)
log:
  level: info
  local:
    rotate_count: 50
    rotate_size: 200M
    location: /var/log/harbor
```

### 3.3 폐쇄망 (Air-Gap) 설치 절차

#### 1단계: 외부망에서 Harbor 이미지 수집

```bash
# Harbor 이미지 목록 (v2.9.x 기준)
cat > harbor-images.txt << 'EOF'
goharbor/harbor-core:v2.9.4
goharbor/harbor-db:v2.9.4
goharbor/harbor-jobservice:v2.9.4
goharbor/harbor-portal:v2.9.4
goharbor/harbor-registryctl:v2.9.4
goharbor/registry-photon:v2.9.4
goharbor/trivy-adapter-photon:v2.9.4
goharbor/harbor-exporter:v2.9.4
goharbor/redis-photon:v2.9.4
EOF

# 이미지 다운로드 + tar 아카이브
mkdir -p harbor-airgap-bundle
while IFS= read -r image; do
  filename=$(echo "$image" | tr '/:' '__')
  docker pull "$image"
  docker save "$image" -o "harbor-airgap-bundle/${filename}.tar"
done < harbor-images.txt

tar czf harbor-airgap-bundle.tar.gz harbor-airgap-bundle/
```

#### 2단계: 내부망 k3s 노드에 이미지 로드

```bash
# k3s는 containerd 사용 — ctr 명령으로 이미지 import
tar xzf harbor-airgap-bundle.tar.gz

for tarfile in harbor-airgap-bundle/*.tar; do
  sudo k3s ctr images import "$tarfile"
done

# 확인
sudo k3s ctr images list | grep harbor
```

#### 3단계: Helm 차트 오프라인 설치

```bash
# 외부망에서 Helm 차트 패키지 다운로드
helm pull harbor/harbor --version 1.14.0 --untar

# 내부망에서 로컬 차트 설치
helm install harbor ./harbor \
  --namespace harbor-system \
  --values harbor-values.yaml \
  --set trivy.offlineScan=true \
  --set trivy.skipUpdate=true \
  --wait --timeout 10m
```

#### 4단계: Trivy 오프라인 DB 업데이트

```bash
# 외부망에서 Trivy DB 다운로드
oras pull ghcr.io/aquasecurity/trivy-db:2 -o trivy-db/
oras pull ghcr.io/aquasecurity/trivy-java-db:1 -o trivy-java-db/

# USB/배포 채널로 내부망 이동 후 Harbor Trivy 어댑터에 적용
# Harbor Trivy Pod에 DB 파일 복사
kubectl -n harbor-system cp trivy-db/ \
  $(kubectl -n harbor-system get pod -l app=harbor,component=trivy -o name):/home/scanner/.cache/trivy/db/

# 주간 수동 업데이트 스케줄 (매주 월요일)
# crontab: 0 9 * * 1 /opt/scripts/update-trivy-db.sh
```

---

## 4. Cosign 서명 검증 정책

### 4.1 Cosign 키 쌍 생성

```bash
# Cosign 키 쌍 생성 (MTU-C8 연동)
cosign generate-key-pair

# 공개 키를 Kubernetes Secret으로 저장
kubectl -n flux-system create secret generic cosign-public-key \
  --from-file=cosign.pub=cosign.pub

# 비밀 키는 CI/CD 환경에서만 사용 (Gitea Actions 시크릿)
# 주의: 비밀 키 Git 커밋 절대 금지 (CSAP-D09)
```

### 4.2 Harbor 프로젝트 서명 정책 설정

```bash
# Harbor API로 프로젝트 보안 정책 설정
# 서명되지 않은 이미지 배포(pull) 차단
curl -X PUT "https://harbor.internal/api/v2.0/projects/saas-org" \
  -H "Authorization: Basic ${HARBOR_AUTH}" \
  -H "Content-Type: application/json" \
  -d '{
    "metadata": {
      "enable_content_trust": "true",
      "enable_content_trust_cosign": "true"
    }
  }'
```

### 4.3 Kyverno 정책 (클러스터 레벨 강제)

```yaml
# kyverno-image-verify.yaml
# Kyverno로 클러스터 레벨에서 서명 검증 강제 (MTU-C7 Policy as Code 연동)
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: verify-image-signature
  annotations:
    policies.kyverno.io/title: "이미지 서명 검증"
    policies.kyverno.io/description: "Cosign 서명되지 않은 이미지 배포 차단 (CSAP-D05-03)"
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
                      # cosign.pub 내용 (MTU-C8에서 생성)
                      -----END PUBLIC KEY-----
```

---

## 5. 이미지 관리 운영 절차

### 5.1 프로젝트 구조

```
harbor.internal/
├── saas-org/              # 애플리케이션 이미지
│   ├── saas-app:v1.0.0
│   ├── saas-app:v1.1.0
│   └── saas-api:v1.0.0
├── flux/                  # Flux 컨트롤러 이미지 (air-gap)
│   ├── source-controller:v1.2.4
│   └── kustomize-controller:v1.2.2
├── infra/                 # 인프라 이미지 (air-gap)
│   ├── otel-collector:v0.96.0
│   └── trivy:v0.50.0
└── base/                  # 베이스 이미지 (air-gap)
    ├── node:20-alpine
    └── python:3.12-slim
```

### 5.2 이미지 보존 정책

```bash
# Harbor 태그 보존 정책 설정 (최근 10개 태그 유지)
curl -X POST "https://harbor.internal/api/v2.0/projects/saas-org/tag-retention" \
  -H "Authorization: Basic ${HARBOR_AUTH}" \
  -H "Content-Type: application/json" \
  -d '{
    "rules": [{
      "disabled": false,
      "action": "retain",
      "template": "latestPushedK",
      "params": {"latestPushedK": 10},
      "scope_selectors": {
        "repository": [{"kind": "doublestar", "decoration": "repoMatches", "pattern": "**"}]
      },
      "tag_selectors": [{"kind": "doublestar", "decoration": "matches", "pattern": "**"}]
    }],
    "trigger": {"kind": "Schedule", "settings": {"cron": "0 0 * * 0"}}
  }'
```

### 5.3 취약점 스캔 결과 확인

```bash
# 특정 이미지 스캔 결과 조회
curl -s "https://harbor.internal/api/v2.0/projects/saas-org/repositories/saas-app/artifacts/v1.0.0/additions/vulnerabilities" \
  -H "Authorization: Basic ${HARBOR_AUTH}" | jq '.[]'

# Critical/High 취약점 필터
# CVSS 7.0+ 시 MTU-C8 CVE 대응 프로세스 적용
```

---

## 6. 네트워크 구성

| 구성 요소 | 내부 주소 | 포트 | 프로토콜 |
|---------|---------|------|--------|
| Harbor Core | `harbor.internal.svc.cluster.local` | 443 | HTTPS (TLS 1.3) |
| Harbor Portal (UI) | `harbor.internal.svc.cluster.local` | 443 | HTTPS |
| Trivy Adapter | Harbor 내부 | 8080 | HTTP (클러스터 내부) |
| Harbor DB | Harbor 내부 | 5432 | TCP (클러스터 내부) |
| Redis | Harbor 내부 | 6379 | TCP (클러스터 내부) |

### NetworkPolicy (Harbor 네임스페이스)

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: harbor-ingress
  namespace: harbor-system
spec:
  podSelector: {}
  policyTypes:
    - Ingress
  ingress:
    # Flux에서 이미지 pull 허용
    - from:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: flux-system
      ports:
        - protocol: TCP
          port: 443
    # Gitea Actions에서 이미지 push 허용
    - from:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: gitea-system
      ports:
        - protocol: TCP
          port: 443
    # production 네임스페이스에서 이미지 pull 허용
    - from:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: production
      ports:
        - protocol: TCP
          port: 443
```

---

## 7. 모니터링 및 감사

### Harbor 메트릭 (Prometheus 연동)

```yaml
# Harbor exporter ServiceMonitor (MTU-I4 OTel 연동)
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: harbor-metrics
  namespace: harbor-system
spec:
  selector:
    matchLabels:
      app: harbor
      component: exporter
  endpoints:
    - port: metrics
      interval: 30s
```

### 감사 이벤트 (CSAP-D06)

Harbor는 모든 이미지 작업을 감사 로그에 기록합니다:

| 이벤트 유형 | 설명 | 감사 등급 |
|-----------|------|---------|
| PUSH_ARTIFACT | 이미지 push | INFO |
| PULL_ARTIFACT | 이미지 pull | INFO |
| DELETE_ARTIFACT | 이미지 삭제 | WARNING |
| SCANNING_COMPLETED | 취약점 스캔 완료 | INFO |
| SCANNING_FAILED | 스캔 실패 | ERROR |
| TAG_RETENTION | 태그 보존 정책 실행 | INFO |

---

## 8. CSAP·N2SF 준수 매핑

| 규제 항목 | 요건 | 구현 방법 | 검증 방법 |
|---------|------|---------|---------|
| CSAP-D05-02 | 공급망 위험 평가 | Trivy 취약점 스캔 (오프라인) | Harbor UI 스캔 결과 확인 |
| CSAP-D05-03 | 소프트웨어 무결성 검증 | Cosign 서명 + Harbor 정책 | 미서명 이미지 pull 차단 확인 |
| CSAP-D06-01 | 침해사고 탐지 | 이상 이미지 push 감사 로그 | Harbor audit log 확인 |
| CSAP-D09-02 | 전송 암호화 | TLS 1.3 Ingress 설정 | `openssl s_client` 확인 |
| CSAP-D12-01 | 배포 취약점 스캔 | Trivy 자동 스캔 정책 | Critical CVE 0건 확인 |
| N2SF-N04 | 저장 영역 보안 | Harbor PV 암호화, 접근 통제 | PV encryption 상태 확인 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | 최초 작성 — Harbor 설치 + Trivy 오프라인 + Cosign 서명 정책 | Claude Code |
