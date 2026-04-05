# Flux v2 GitOps 구성 가이드

| 항목 | 내용 |
|------|------|
| 문서 ID | INFRA-GITOPS-001 |
| 버전 | 1.0.0 |
| 최종 수정일 | 2026-04-05 |
| 대상 독자 | DevOps 엔지니어, 인프라 담당자, CSAP 심사 대응 팀 |
| FR 매핑 | FR-5.3 (GitOps 자동 배포) |
| MTU 매핑 | MTU-I3 |
| 관련 문서 | [Gitea CI/CD 가이드](gitea-cicd-guide.md), [Harbor 레지스트리 가이드](harbor-registry-guide.md) |

<!-- Design Ref: MTU-I3 Plan -- Flux GitOps + Harbor -->
<!-- Plan SC: Gitea push → k3s 배포 10분 이내, flux get all Ready -->

---

## 1. 개요

Flux v2 GitOps 컨트롤러를 k3s 클러스터에 배포하여, Gitea 저장소의 매니페스트 변경이 자동으로 클러스터에 반영되는 선언적 배포 자동화를 구현합니다.

### Flux 선택 근거 (ArgoCD 대비)

| 비교 항목 | Flux v2 | ArgoCD |
|---------|---------|--------|
| 네트워크 모델 | Pull-only (아웃바운드 불필요) | Push + Pull (웹 UI 포함) |
| 폐쇄망 적합성 | 높음 (외부 의존 최소) | 중간 (UI 서버 필요) |
| 리소스 사용량 | 경량 (~100MB) | 중량 (~500MB+) |
| OCI 저장소 지원 | 네이티브 지원 | 플러그인 필요 |
| Gitea 연동 | bootstrap gitea 명령 지원 | 별도 설정 필요 |
| 커밋 서명 검증 | verify.provider: cosign 내장 | 외부 도구 필요 |

**결론**: 폐쇄망 환경 + k3s 경량 클러스터 + Cosign 서명 검증 요건에 Flux v2가 최적.

---

## 2. 전제 조건

| 항목 | 요구사항 | 확인 방법 |
|------|---------|---------|
| k3s 클러스터 | v1.28+ 동작 중 | `kubectl get nodes` |
| Gitea | v1.21+ 동작 중 (MTU-I2) | `curl https://gitea.internal:3000` |
| Harbor | v2.9+ 동작 중 | `curl https://harbor.internal:443/api/v2.0/health` |
| kubectl | kubeconfig 설정 완료 | `kubectl cluster-info` |
| Flux CLI | v2.2+ | `flux --version` |

---

## 3. Flux v2 설치

### 3.1 온라인 환경 설치

```bash
# Flux CLI 설치
curl -s https://fluxcd.io/install.sh | sudo bash

# Gitea 연동 부트스트랩
flux bootstrap gitea \
  --owner=saas-org \
  --repository=fleet-infra \
  --branch=main \
  --path=clusters/production \
  --hostname=gitea.internal.svc.cluster.local \
  --token-auth

# 설치 확인
flux check
flux get all
```

### 3.2 폐쇄망 (Air-Gap) 설치 절차

#### 1단계: 외부망에서 Flux 이미지 수집

```bash
# Flux 매니페스트 내보내기
flux install --export > flux-components.yaml

# 포함 이미지 목록 추출
grep 'image:' flux-components.yaml | awk '{print $2}' | sort -u > flux-images.txt

# 이미지 목록 확인 (예시)
cat flux-images.txt
# ghcr.io/fluxcd/source-controller:v1.2.4
# ghcr.io/fluxcd/kustomize-controller:v1.2.2
# ghcr.io/fluxcd/helm-controller:v0.37.4
# ghcr.io/fluxcd/notification-controller:v1.2.4
```

#### 2단계: 이미지 다운로드 및 아카이브

```bash
# 외부망에서 이미지 pull + tar 저장
mkdir -p flux-airgap-bundle
while IFS= read -r image; do
  filename=$(echo "$image" | tr '/:' '__')
  echo "Pulling: $image"
  docker pull "$image"
  docker save "$image" -o "flux-airgap-bundle/${filename}.tar"
done < flux-images.txt

# 번들 압축 (USB 이동용)
tar czf flux-airgap-bundle.tar.gz flux-airgap-bundle/
```

#### 3단계: 내부망 Harbor로 이미지 push

```bash
# USB/배포 채널을 통해 내부망 이동 후
tar xzf flux-airgap-bundle.tar.gz

# Harbor 로그인
docker login harbor.internal.svc.cluster.local --username admin

# 이미지 로드 + 재태깅 + push
for tarfile in flux-airgap-bundle/*.tar; do
  docker load -i "$tarfile"
done

# 재태깅 (Harbor 내부 저장소로)
while IFS= read -r image; do
  local_image="harbor.internal.svc.cluster.local/flux/$(basename "$image")"
  docker tag "$image" "$local_image"
  docker push "$local_image"
done < flux-images.txt
```

#### 4단계: Flux 매니페스트 이미지 경로 수정

```bash
# flux-components.yaml 내 이미지 경로를 Harbor 내부 주소로 변경
sed -i 's|ghcr.io/fluxcd/|harbor.internal.svc.cluster.local/flux/|g' flux-components.yaml

# 적용
kubectl apply -f flux-components.yaml

# 확인
kubectl -n flux-system get pods
flux check
```

---

## 4. GitRepository 구성 (Gitea 연동)

### 4.1 Gitea 인증 시크릿 생성

```bash
# Gitea 토큰을 Kubernetes Secret으로 생성
# 주의: 하드코딩 금지 (CSAP D-09), 환경 변수에서 주입
kubectl -n flux-system create secret generic gitea-credentials \
  --from-literal=username=flux-bot \
  --from-literal=password="${GITEA_FLUX_TOKEN}"
```

### 4.2 GitRepository 리소스

```yaml
# flux-gitops/kustomization-templates/git-repository.yaml
apiVersion: source.toolkit.fluxcd.io/v1
kind: GitRepository
metadata:
  name: saas-app
  namespace: flux-system
  labels:
    app.kubernetes.io/part-of: saas-framework
spec:
  interval: 1m                            # 1분 주기 폴링
  url: https://gitea.internal.svc.cluster.local:3000/saas-org/saas-app.git
  ref:
    branch: main
  secretRef:
    name: gitea-credentials               # 환경 변수 주입 시크릿
  verify:
    provider: cosign                       # MTU-C8 연동: 커밋 서명 검증
    secretRef:
      name: cosign-public-key             # Cosign 공개 키 시크릿
```

### 4.3 Kustomization 리소스 (자동 배포)

```yaml
# flux-gitops/kustomization-templates/kustomization.yaml
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: saas-app-production
  namespace: flux-system
spec:
  interval: 5m                            # 5분 주기 동기화
  path: "./k8s/production"                # 배포 매니페스트 경로
  prune: true                             # 삭제된 리소스 자동 정리
  sourceRef:
    kind: GitRepository
    name: saas-app
  healthChecks:
    - apiVersion: apps/v1
      kind: Deployment
      name: saas-app
      namespace: production
  timeout: 5m
  retryInterval: 1m
  wait: true                              # 헬스체크 대기
```

---

## 5. ImagePolicy 자동 이미지 업데이트

```yaml
# flux-gitops/kustomization-templates/image-policy.yaml
apiVersion: image.toolkit.fluxcd.io/v1beta2
kind: ImageRepository
metadata:
  name: saas-app
  namespace: flux-system
spec:
  image: harbor.internal.svc.cluster.local/saas-org/saas-app
  interval: 1m
  secretRef:
    name: harbor-credentials
---
apiVersion: image.toolkit.fluxcd.io/v1beta2
kind: ImagePolicy
metadata:
  name: saas-app
  namespace: flux-system
spec:
  imageRepositoryRef:
    name: saas-app
  policy:
    semver:
      range: ">=1.0.0"                   # 시맨틱 버전 필터
  filterTags:
    pattern: '^v(?P<version>[0-9]+\.[0-9]+\.[0-9]+)$'
    extract: '$version'
```

---

## 6. 배포 파이프라인 전체 흐름

```
[개발자 PR 병합]
      │
      ▼  (Gitea main 브랜치 push)
[Gitea Actions 실행]              ◀── MTU-I2 파이프라인
      │
      ├── 빌드 + 테스트
      ├── SBOM 생성 (Syft)        ◀── MTU-C8
      ├── 이미지 빌드 + Harbor push
      └── Cosign 이미지 서명       ◀── MTU-C8
      │
      ▼  (1분 이내)
[Flux GitRepository 동기화]
      │  interval: 1m 폴링
      ▼
[Flux Kustomization 적용]
      │
      ├── Harbor 이미지 서명 검증   ◀── Harbor ImageSecurityPolicy
      ├── 미서명 이미지 → 배포 거부
      └── 서명 이미지 → k3s 배포
      │
      ▼  (2~5분)
[k3s 클러스터 배포 완료]
      │  헬스체크 통과
      ▼
[Flux 알림]
      └── 성공/실패 알림 → Gitea 코멘트
```

**전체 소요 시간**: PR 병합 → k3s 배포 완료 = **5~10분 이내** (FR-5.3 충족)

---

## 7. Flux 알림 구성 (Gitea 연동)

```yaml
# flux-gitops/kustomization-templates/notification.yaml
apiVersion: notification.toolkit.fluxcd.io/v1beta3
kind: Provider
metadata:
  name: gitea-notification
  namespace: flux-system
spec:
  type: gitea
  address: https://gitea.internal.svc.cluster.local:3000
  secretRef:
    name: gitea-credentials
---
apiVersion: notification.toolkit.fluxcd.io/v1beta3
kind: Alert
metadata:
  name: deployment-alert
  namespace: flux-system
spec:
  providerRef:
    name: gitea-notification
  eventSeverity: error
  eventSources:
    - kind: Kustomization
      name: saas-app-production
    - kind: GitRepository
      name: saas-app
```

---

## 8. 운영 명령어 레퍼런스

### 상태 확인

```bash
# 전체 Flux 리소스 상태
flux get all

# GitRepository 동기화 상태
flux get sources git

# Kustomization 배포 상태
flux get kustomizations

# 이미지 정책 상태
flux get image all
```

### 트러블슈팅

```bash
# Flux 로그 확인
flux logs --all-namespaces

# 특정 컨트롤러 로그
kubectl -n flux-system logs deploy/source-controller

# 수동 동기화 강제 실행
flux reconcile source git saas-app
flux reconcile kustomization saas-app-production

# 배포 일시 중지/재개
flux suspend kustomization saas-app-production
flux resume kustomization saas-app-production
```

### 롤백

```bash
# Git 기반 롤백 (GitOps 원칙: Git revert)
cd saas-app && git revert HEAD && git push origin main
# Flux가 revert 커밋을 감지 → 자동 롤백 적용

# 긴급 수동 롤백 (비권장, 감사 로그 기록 필수)
kubectl -n production rollout undo deployment/saas-app
# 주의: 다음 Flux 동기화 시 Git 상태로 복원됨
```

---

## 9. 보안 고려사항

### CSAP 매핑

| CSAP 항목 | 요건 | Flux 구현 |
|---------|------|---------|
| D09-02 | 전송 데이터 암호화 | Gitea HTTPS 통신, TLS 1.3+ |
| D12-01 | 배포 취약점 스캔 | Harbor Trivy 연동 (MTU-I3) |
| D12-02 | 이미지 무결성 | Cosign verify.provider 설정 |
| D06-01 | 침해사고 탐지 | 미서명 이미지 배포 차단 이벤트 감사 |

### 시크릿 관리

- Gitea 토큰: Kubernetes Secret (환경 변수 주입, 하드코딩 금지)
- Cosign 키: Sealed Secrets 또는 Kubernetes Secret
- Harbor 인증: Kubernetes Secret + imagePullSecrets

---

## 10. CSAP·N2SF 준수 매핑

| 규제 항목 | 요건 | 구현 방법 | 검증 방법 |
|---------|------|---------|---------|
| CSAP-D05-03 | 소프트웨어 무결성 검증 | Cosign 서명 + Flux verify | `cosign verify <image>` |
| CSAP-D12-01 | 배포 시 취약점 스캔 | Harbor Trivy 자동 스캔 | Harbor UI 스캔 결과 확인 |
| N2SF-N03 | 격리 영역 네트워크 제어 | Flux는 flux-system 네임스페이스 내 동작 | NetworkPolicy 확인 |
| N2SF-N05 | 데이터 영역 무결성 | Git 커밋 서명 + 이미지 서명 | `flux get sources git` verify 상태 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | 최초 작성 — Flux v2 GitOps 설치 + Gitea 연동 + 배포 파이프라인 | Claude Code |
