# MTU-I3: Flux GitOps + Harbor 컨테이너 레지스트리

| 항목 | 내용 |
|------|------|
| MTU ID | MTU-I3 |
| Phase | Phase 3 Infrastructure |
| 상태 | Draft |
| 작성일 | 2026-04-05 |
| FR 매핑 | FR-5.3, INFR-3 |
| 의존 MTU | MTU-I2 (Gitea CI/CD) |
| 예상 세션 | 1 세션 |
| 중요도 | P0 |

---

## 목적

Flux v2 GitOps와 Harbor 컨테이너 레지스트리를 k3s 클러스터 내에 구성하여, 폐쇄망 환경에서도 완전한 GitOps 배포 자동화를 실현합니다. Harbor의 취약점 스캔 + Cosign 서명 검증 정책으로 미인가 이미지의 배포를 원천 차단하며, N2SF 공급망 보안 요건을 충족합니다.

**시장조사 반영**:
- ArgoCD 대비 Flux 선택 근거: 폐쇄망 환경에서 외부 의존성 최소화, pull-only 동기화 모델로 네트워크 아웃바운드 불필요
- Harbor v2.9+: Cosign 서명 검증 정책(Image Security Policy) GA, Trivy 어드바이저리 데이터베이스 오프라인 업데이트 지원
- Flux OCI 저장소: Gitea OCI 레지스트리와 직접 연동 가능 (별도 Helm 저장소 불필요)
- CISA/NIST SSDF 공급망 보안 요건 대응 (MTU-C8 연동)

---

## 산출물 파일 (3개)

| 파일 | 문서 유형 | 핵심 내용 |
|------|---------|---------|
| `05-infra/flux-gitops-guide.md` | 아키텍처레퍼런스형 | Flux v2 설치 + GitOps 동기화 구성 |
| `05-infra/harbor-registry-guide.md` | 구현가이드형 | Harbor 설치 + 취약점 스캔 + 서명 검증 정책 |
| `05-infra/flux-gitops/kustomization-templates/` | 구성 템플릿 | Flux GitRepository + Kustomization YAML 예시 |

---

## 아키텍처 개요

```
[Gitea 저장소]
  ├── app/ (애플리케이션 코드)
  └── k8s/ (k3s 매니페스트)   ◀──── Flux가 감시
         │
         ▼
┌────────────────────────────────────────┐
│          Flux v2 (k3s 내부)           │
│  ┌────────────────┐  ┌─────────────┐  │
│  │ GitRepository  │  │ ImagePolicy │  │
│  │ (Gitea 연결)   │  │ (자동 이미지 │  │
│  └───────┬────────┘  │  업데이트)  │  │
│          │           └──────┬──────┘  │
│  ┌───────▼────────┐         │         │
│  │ Kustomization  │◀────────┘         │
│  │ (배포 자동 적용)│                   │
│  └───────┬────────┘                   │
└──────────┼─────────────────────────────┘
           │
           ▼
┌──────────────────────────┐
│  Harbor 레지스트리        │
│  ┌──────────────────┐    │
│  │ 취약점 스캔 (Trivy)│    │
│  │ Cosign 서명 검증  │    │  ◀── MTU-C8 연동
│  │ Image Security   │    │
│  │ Policy           │    │
│  └──────────────────┘    │
└──────────────────────────┘
           │
           ▼
   k3s 클러스터 (서명 이미지만 배포)
```

---

## 핵심 설계 내용

### 1. Flux v2 설치 (air-gap 절차 포함)

#### 온라인 환경

```bash
# Flux CLI 설치
curl -s https://fluxcd.io/install.sh | sudo bash

# k3s 클러스터에 Flux 부트스트랩 (Gitea 연동)
flux bootstrap gitea \
  --owner=<org> \
  --repository=fleet-infra \
  --branch=main \
  --path=clusters/production \
  --hostname=gitea.internal.svc.cluster.local \
  --token-auth
```

#### 폐쇄망 air-gap 절차

```bash
# 1단계: 외부망에서 Flux 이미지 수집
flux install --export > flux-components.yaml
# 포함 이미지 목록 추출
grep 'image:' flux-components.yaml | sort -u > flux-images.txt

# 2단계: 이미지 내부망 Harbor로 미러링
while read image; do
  # 외부망에서 pull → tar 저장
  docker pull "$image"
  docker save "$image" -o "$(echo $image | tr '/:' '_').tar"
done < flux-images.txt
# tar 파일을 USB/내부 배포 채널로 이동 후

# 3단계: 내부망에서 Harbor push
while read tarfile; do
  docker load -i "$tarfile"
  # 원본 태그 → Harbor 내부 태그로 재태깅
  docker tag "$original" "harbor.internal.svc.cluster.local/flux/$image"
  docker push "harbor.internal.svc.cluster.local/flux/$image"
done
```

### 2. Flux GitRepository + Kustomization 구성

```yaml
# GitRepository: Gitea 저장소 연결
apiVersion: source.toolkit.fluxcd.io/v1
kind: GitRepository
metadata:
  name: saas-app
  namespace: flux-system
spec:
  interval: 1m
  url: https://gitea.internal.svc.cluster.local:3000/org/saas-app.git
  ref:
    branch: main
  secretRef:
    name: gitea-credentials   # 환경 변수 주입, 하드코딩 금지
  verify:
    provider: cosign           # MTU-C8 연동: 커밋 서명 검증
---
# Kustomization: 자동 배포 적용
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: saas-app
  namespace: flux-system
spec:
  interval: 5m
  path: "./k8s/production"
  prune: true                  # 삭제된 리소스 자동 정리
  sourceRef:
    kind: GitRepository
    name: saas-app
  healthChecks:
    - apiVersion: apps/v1
      kind: Deployment
      name: saas-app
      namespace: production
  timeout: 5m
```

### 3. Harbor 레지스트리 구성

#### Harbor 설치 (k3s Helm)

```yaml
# harbor values.yaml 핵심 설정
expose:
  type: ingress
  tls:
    enabled: true              # TLS 1.3+ (CSAP-D09)
persistence:
  enabled: true
  storageClass: local-path     # k3s 내장 스토리지
trivy:
  enabled: true
  gitHubToken: ""              # 오프라인 모드: 토큰 불필요
  offlineScan: true            # 폐쇄망 취약점 스캔 (DB 사전 로드)
notary:
  enabled: false               # Cosign 전용 (Notary 미사용)
```

#### Harbor 이미지 보안 정책 (Cosign 서명 검증)

```yaml
# Harbor Image Security Policy: 서명되지 않은 이미지 배포 차단
apiVersion: goharbor.io/v1beta1
kind: ImageSecurityPolicy
metadata:
  name: require-cosign-signature
  namespace: production
spec:
  cosignVerification:
    enabled: true
    cosignPublicKey: |
      # MTU-C8에서 생성한 Cosign 공개 키
      -----BEGIN PUBLIC KEY-----
      ...
      -----END PUBLIC KEY-----
```

### 4. 폐쇄망 환경 네트워크 구성

| 구성 요소 | 내부 주소 | 비고 |
|---------|---------|------|
| Gitea | `gitea.internal.svc.cluster.local:3000` | k3s ClusterIP |
| Harbor | `harbor.internal.svc.cluster.local:443` | k3s Ingress + TLS |
| Flux | `flux-system` 네임스페이스 | in-cluster 동작 |
| Trivy DB | Harbor 내장 | 오프라인 스캔, 주간 수동 업데이트 |

### 5. GitOps 배포 흐름 (요구사항 FR-5.3)

| 단계 | 트리거 | 소요 시간 | 담당 |
|------|-------|---------|------|
| 1. PR 병합 | Gitea main 브랜치 push | 즉시 | 개발자 |
| 2. Gitea Actions 실행 | 자동 | 5분 이내 | MTU-I2 |
| 3. Harbor 이미지 push | Actions 완료 | 자동 | MTU-I2 |
| 4. Flux GitRepository 동기화 | 1분 주기 폴링 | 최대 1분 | Flux |
| 5. Kustomization 적용 | GitRepository 변경 감지 | 1~2분 | Flux |
| 6. Harbor 서명 검증 | 배포 시 자동 | 실시간 | Harbor 정책 |
| 7. k3s 배포 완료 | 헬스체크 통과 | 2~5분 | Flux |

---

## 기능 요구사항

| ID | 요구사항 | 수용 기준 |
|----|---------|---------|
| FR-5.3 | GitOps 자동 배포 | Gitea push → k3s 배포까지 10분 이내 자동 완료 |
| INFR-3 | Harbor 레지스트리 운영 | 취약점 스캔 + 서명 검증 정책 활성화 확인 |

---

## 합격 기준

1. Flux GitOps 싱크 확인 (Gitea `main` 브랜치 변경 → k3s 자동 배포, `flux get all` 결과 Ready)
2. Harbor 레지스트리 이미지 취약점 스캔 동작 (Trivy 오프라인 스캔 결과 Harbor UI 표시)
3. Cosign 서명 이미지만 k3s 배포 허용 (미서명 이미지 배포 시 ImageSecurityPolicy 거부 확인)
4. 폐쇄망 air-gap 설치 절차 완비 (harbor-registry-guide.md 내 air-gap 섹션 완성 + 재현 가능)

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 0.1.0 | 2026-04-05 | 최초 작성 | Claude Code |
