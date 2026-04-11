# 5장. 인프라 및 k3s 클러스터 운영

> **버전**: 1.0.0 | **작성일**: 2026-04-11
> **대상**: 신규 합류 개발자, DevOps 엔지니어
> **관련 문서**: `docs/07-infra/wsl-devops-complete-guide.md`, `docs/07-infra/flux-gitops-integration-guide.md`
> **CSAP**: D-11 (가상화 보안), D-12 (시스템 개발 보안)

---

## 목차

1. [인프라 개요](#1-인프라-개요)
2. [개발 환경 설정](#2-개발-환경-설정)
3. [k3s 클러스터 구조](#3-k3s-클러스터-구조)
4. [GitOps — Flux 워크플로우](#4-gitops--flux-워크플로우)
5. [핵심 인프라 컴포넌트](#5-핵심-인프라-컴포넌트)
6. [스케일링 전략](#6-스케일링-전략)
7. [Helm 차트 사용법](#7-helm-차트-사용법)
8. [실습 시나리오](#8-실습-시나리오)

---

## 1. 인프라 개요

### 1.1 공공기관 SaaS 인프라 철학

공공기관 SaaS 프레임워크는 "선언적 인프라(Declarative Infrastructure)"를 근간으로 합니다. 모든 인프라 상태는 Git 저장소의 YAML 파일로 정의되며, 클러스터는 이 파일을 지속적으로 동기화합니다. 이 접근 방식은 세 가지 공공기관 요건을 동시에 충족합니다.

| 요건 | 충족 방법 |
|------|----------|
| 감사 추적 | 모든 인프라 변경이 Git 커밋 이력으로 기록됨 |
| 재현 가능성 | 동일 Git 상태로 언제든 동일 환경 재구성 가능 |
| CSAP D-12 | GitOps 기반 변경 관리, 승인 없는 배포 차단 |

### 1.2 클라우드 네이티브 기술 스택

```
[WSL2 Ubuntu 22.04]
  |
  +-- Docker Engine v29.x (컨테이너 런타임)
  |     +-- Gitea v1.22        (Git 서버 + CI/CD Actions)  :3000
  |     +-- Harbor v2.11       (컨테이너 레지스트리 + Trivy) :8080
  |     +-- Act Runner v0.3    (CI/CD 실행 에이전트)
  |
  +-- k3s v1.34.x (경량 Kubernetes)
  |     +-- saas-platform      (마이크로서비스 22+ pods)
  |     +-- flux-system        (GitOps 4 컨트롤러)
  |     +-- monitoring         (Prometheus + Grafana + LGTM)
  |     +-- saas-security      (Falco, Kyverno, Gatekeeper)
  |     +-- cnpg-system        (CloudNativePG PostgreSQL)
  |
  +-- Flux v2 CLI v2.8.x (GitOps 동기화 엔진)
```

### 1.3 71개 인프라 모듈 분류

`infra/` 디렉토리에는 71개의 독립 모듈이 있습니다. 각 모듈은 Helm values 파일 또는 Kubernetes 매니페스트로 구성됩니다.

| 카테고리 | 모듈 | 역할 |
|----------|------|------|
| 클러스터 | cicd, cluster-api, vcluster | 클러스터 생성·관리 |
| 서비스 메시 | linkerd, cilium, cilium-zero-trust, gateway-api | mTLS, 제로 트러스트 |
| 모니터링 | monitoring, grafana, thanos, loki, tempo, alertmanager | 관측가능성 LGTM 스택 |
| 데이터 | cloudnative-pg, backup-verification, db-migration | PostgreSQL HA, Velero 백업 |
| 보안 | vault, falco, trivy-operator, kyverno, gatekeeper | 런타임 보안, 정책 엔진 |
| GitOps | flux, gitops, renovate, crossplane | 자동 배포, 의존성 갱신 |
| 스케일링 | keda, vpa, predictive-scaling | 오토스케일링 |
| 빌드/레지스트리 | harbor, buildkit, cosign | 이미지 빌드·서명·저장 |
| 시크릿 | external-secrets, sealed-secrets | 시크릿 관리 |
| 인증서 | cert-manager | TLS 자동 갱신 |

### 1.4 CSAP 보안 통제 매핑

| 인프라 도구 | CSAP 항목 | 설명 |
|------------|----------|------|
| k3s | D-11 (가상화 보안) | 컨테이너 격리, NetworkPolicy, RBAC |
| Gitea | D-12 (시스템 개발 보안) | 소스코드 접근 통제, CI/CD 자동화 |
| Harbor | D-11-04 (이미지 보안) | Trivy 취약점 스캔, Cosign 이미지 서명 |
| Flux | D-12 (변경 관리) | GitOps 기반 선언적 배포, 롤백 |
| Cert-Manager | D-09 (암호화) | TLS 인증서 자동 갱신 |
| Falco | D-06 (침해사고 관리) | 런타임 이상 행위 탐지 |
| Kyverno | D-08 (접근 통제) | 정책 기반 승인 제어 |

---

## 2. 개발 환경 설정

### 2.1 WSL2 설치 및 설정

**Windows 요구사항**
- Windows 10 Build 19041 이상 또는 Windows 11
- 8GB RAM 이상 (전체 스택 운영 시), 30GB 디스크 여유 공간

**WSL2 설치 (PowerShell 관리자 모드)**

```powershell
wsl --install -d Ubuntu-22.04
```

**WSL2 성능 최적화** — `%USERPROFILE%\.wslconfig` 파일 생성:

```ini
[wsl2]
memory=8GB
processors=4
swap=4GB
localhostForwarding=true
```

`localhostForwarding=true` 설정은 k3s NodePort 서비스를 Windows 브라우저에서 `localhost:{포트}`로 직접 접근할 수 있게 해줍니다. 이 설정 없이는 WSL2 IP를 별도로 확인해야 합니다.

WSL2 설정 적용:

```powershell
# PowerShell에서 WSL2 재시작
wsl --shutdown
wsl -d Ubuntu-22.04
```

### 2.2 Docker Engine 설치

Docker Desktop 대신 WSL2 내 Docker Engine을 직접 설치합니다. Docker Desktop은 상업적 라이선스 비용이 발생하며, k3s와 소켓 충돌이 발생할 수 있습니다.

```bash
# Docker 공식 설치 스크립트 (WSL2 Ubuntu 내에서 실행)
curl -fsSL https://get.docker.com | sh

# 현재 사용자를 docker 그룹에 추가
sudo usermod -aG docker $USER
newgrp docker

# 설치 검증
docker version
# 예상 출력:
# Client: Docker Engine - Community
#  Version: 29.3.x
```

### 2.3 k3s 설치 및 설정

k3s는 경량 Kubernetes 배포판으로, 프로덕션과 동일한 API를 제공하면서 메모리 사용량을 최소화합니다.

```bash
# k3s 설치 (containerd 런타임 사용)
curl -sfL https://get.k3s.io | sh -

# 권한 설정 (kubectl 사용 위해 필요)
sudo chmod 644 /etc/rancher/k3s/k3s.yaml

# ~/.bashrc에 환경변수 추가
echo 'export KUBECONFIG=/etc/rancher/k3s/k3s.yaml' >> ~/.bashrc
source ~/.bashrc

# 설치 검증
kubectl get nodes
# 예상 출력:
# NAME              STATUS   ROLES           AGE   VERSION
# desktop-xxxxx     Ready    control-plane   1m    v1.34.6+k3s1
```

**k3s CSAP D-11 기본 보안 설정**

k3s는 설치 시 다음 보안 기능을 기본 활성화합니다:
- RBAC (역할 기반 접근 제어)
- Pod Security Standards (PSS) 지원
- NetworkPolicy (Flannel CNI 기반)
- etcd 데이터 암호화 지원

### 2.4 CLI 도구 설치

```bash
# Helm (Kubernetes 패키지 매니저)
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
helm version   # v3.20.x

# Flux CLI (GitOps 컨트롤러 관리)
curl -s https://fluxcd.io/install.sh | bash
flux version --client  # v2.8.x

# stern (멀티 파드 로그 동시 확인 — 선택)
wget https://github.com/stern/stern/releases/download/v1.30.0/stern_1.30.0_linux_amd64.tar.gz -O /tmp/stern.tar.gz
tar xzf /tmp/stern.tar.gz -C /usr/local/bin/ stern
stern --version

# k9s (TUI Kubernetes 클러스터 관리 — 선택)
wget https://github.com/derailed/k9s/releases/download/v0.32.4/k9s_Linux_amd64.tar.gz -O /tmp/k9s.tar.gz
tar xzf /tmp/k9s.tar.gz -C /usr/local/bin/ k9s
k9s version
```

### 2.5 pnpm + Node.js 22 환경

```bash
# Node.js 22 LTS 설치 (nvm 사용 권장)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 22
nvm use 22
node --version  # v22.x.x

# pnpm 설치 (모노레포 패키지 매니저)
npm install -g pnpm@9
pnpm --version  # 9.x.x

# 프로젝트 의존성 설치
cd /data/ai-saas
pnpm install
```

### 2.6 원클릭 전체 환경 구축

모든 도구 설치 후 아래 스크립트로 전체 스택을 자동 구성할 수 있습니다:

```bash
cd /data/ai-saas

# 전체 설치 (Gitea + Harbor + Act Runner + k3s 레지스트리 미러)
./scripts/setup-wsl2-all.sh

# 상태 확인
./scripts/setup-wsl2-all.sh --status
```

**설치 완료 후 접근 URL**

| 서비스 | URL | 계정 |
|--------|-----|------|
| Gitea | http://localhost:3000 | saas-admin / (설치 시 생성된 비밀번호) |
| Harbor | http://localhost:8080 | admin / (설치 시 생성된 비밀번호) |
| Grafana | http://localhost:30302 | admin / admin |
| Prometheus | http://localhost:30090 | (인증 없음 — 내부 전용) |
| AlertManager | http://localhost:30093 | (인증 없음 — 내부 전용) |

---

## 3. k3s 클러스터 구조

### 3.1 네임스페이스 구조

k3s 클러스터는 용도별로 네임스페이스를 분리하여 CSAP D-11 가상화 격리 요건을 충족합니다.

```
k3s 클러스터
├── kube-system          # Kubernetes 핵심 컴포넌트 (CoreDNS, metrics-server)
├── flux-system          # GitOps 컨트롤러 (4개 Flux 컨트롤러)
├── saas-platform        # 마이크로서비스 애플리케이션
├── monitoring           # 관측가능성 스택 (Prometheus, Grafana, Loki, Tempo)
├── cnpg-system          # CloudNativePG PostgreSQL 오퍼레이터
├── saas                 # CloudNativePG 클러스터 인스턴스
├── cert-manager         # TLS 인증서 자동 갱신
├── linkerd              # 서비스 메시 컨트롤 플레인
├── falco-system         # 런타임 보안 모니터링
├── kyverno              # 정책 엔진
├── external-secrets     # 외부 시크릿 오퍼레이터
├── saas-secrets         # SealedSecret → Secret 동기화 대상
└── gitops-demo          # 학습/테스트용 네임스페이스
```

네임스페이스 간 트래픽은 NetworkPolicy로 제어합니다. `saas-platform`과 `monitoring` 간 통신은 허용되지만, `kube-system`에 대한 직접 접근은 차단됩니다.

### 3.2 핵심 컴포넌트

**Traefik (기본 인그레스 컨트롤러)**

k3s는 Traefik을 기본 인그레스 컨트롤러로 번들합니다. 외부 HTTP/HTTPS 트래픽을 클러스터 내부 서비스로 라우팅합니다.

```bash
# Traefik 상태 확인
kubectl get pods -n kube-system -l app.kubernetes.io/name=traefik

# Traefik 대시보드 접근 (로컬)
kubectl port-forward -n kube-system svc/traefik 9000:9000
# 브라우저: http://localhost:9000/dashboard/
```

**CoreDNS (클러스터 DNS)**

클러스터 내부 서비스 이름 해결을 담당합니다. `서비스명.네임스페이스.svc.cluster.local` 형식으로 서비스에 접근할 수 있습니다.

```bash
# DNS 동작 확인
kubectl run test-dns --image=busybox --rm -it --restart=Never -- \
  nslookup grafana.monitoring.svc.cluster.local
```

**Flannel vs Cilium CNI**

로컬 k3s는 기본 CNI로 Flannel을 사용합니다. 프로덕션 환경에서는 `infra/cilium/` 모듈로 Cilium으로 교체하여 eBPF 기반 제로 트러스트 네트워킹을 구현합니다.

| 항목 | Flannel (기본) | Cilium (프로덕션) |
|------|---------------|-----------------|
| 용도 | 로컬 개발 | 프로덕션 |
| NetworkPolicy | 기본 지원 | 고급 L7 정책 지원 |
| mTLS | Linkerd 별도 필요 | 내장 mTLS 가능 |
| 성능 | 표준 | eBPF 기반 고성능 |

### 3.3 로컬 k3s vs 프로덕션 차이

| 항목 | 로컬 k3s (WSL2) | 프로덕션 k3s |
|------|----------------|-------------|
| 노드 수 | 단일 노드 | 3+ 노드 (HA etcd) |
| CNI | Flannel | Cilium |
| 스토리지 | local-path | CSI 드라이버 (NFS/Ceph) |
| 인증서 | 자체 서명 | Let's Encrypt / 내부 CA |
| 레지스트리 | localhost:8080 (Harbor) | registry.agency.go.kr |
| 리소스 제한 | WSL2 wslconfig 기준 | 서버 스펙 기준 |

### 3.4 클러스터 상태 확인 명령어

```bash
# 전체 노드 상태
kubectl get nodes -o wide

# 전체 네임스페이스의 파드 상태
kubectl get pods -A

# 리소스 사용량 (metrics-server 필요)
kubectl top nodes
kubectl top pods -A

# 특정 네임스페이스 상태
kubectl get all -n saas-platform
kubectl get all -n monitoring

# Flux 동기화 상태
flux get all -A
```

---

## 4. GitOps — Flux 워크플로우

### 4.1 Flux 핵심 개념

**Git이 단일 소스(Single Source of Truth)**

Flux는 Git 저장소를 클러스터 상태의 유일한 진실 소스로 사용합니다. 클러스터에 직접 `kubectl apply`하는 방식은 GitOps 원칙에 위배되며, Flux가 다음 동기화 시 원복합니다.

```
Git 저장소 (fleet-infra)
    │ (5분마다 폴링)
    ▼
Flux Source Controller
    │ (변경 감지)
    ▼
Flux Kustomize/Helm Controller
    │ (매니페스트 적용)
    ▼
k3s 클러스터 상태
```

**4개 Flux 컨트롤러**

```bash
kubectl get pods -n flux-system
# source-controller      — Git/Helm 저장소에서 소스 가져오기
# kustomize-controller   — Kustomization 리소스 적용
# helm-controller        — HelmRelease 리소스 관리
# notification-controller — 이벤트 알림 (Gitea 커밋 상태)
```

### 4.2 HelmRelease 구조 이해

`infra/flux/helm-release.yaml`은 saas-platform 전체 배포를 정의합니다.

```yaml
# infra/flux/helm-release.yaml (핵심 부분)
apiVersion: helm.toolkit.fluxcd.io/v2
kind: HelmRelease
metadata:
  name: saas-platform
  namespace: flux-system
spec:
  interval: 5m                    # 5분마다 동기화 확인
  chart:
    spec:
      chart: ./helm/saas-platform
      sourceRef:
        kind: GitRepository
        name: fleet-infra          # fleet-infra 저장소의 Helm 차트
  targetNamespace: saas-platform
  values:
    global:
      imageRegistry: localhost:8080
      environment: staging
  install:
    remediation:
      retries: 3                   # 설치 실패 시 3회 재시도
  upgrade:
    remediation:
      retries: 3
      remediateLastFailure: true   # 마지막 실패 시 자동 롤백
  dependsOn:
    - name: saas-postgres          # PostgreSQL이 먼저 준비되어야 배포
    - name: saas-redis
```

### 4.3 Kustomization 개념

Kustomization은 Git 저장소의 특정 경로에 있는 매니페스트를 클러스터에 적용합니다.

```yaml
# infra/flux/app-kustomization.yaml
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: sample-apps
  namespace: flux-system
spec:
  interval: 5m
  sourceRef:
    kind: GitRepository
    name: fleet-infra
  path: ./apps/sample-app          # 저장소 내 매니페스트 경로
  prune: true                      # Git에서 삭제된 리소스는 클러스터에서도 삭제
  targetNamespace: gitops-demo
  healthChecks:                    # 배포 성공 기준
    - apiVersion: apps/v1
      kind: Deployment
      name: nginx-demo
      namespace: gitops-demo
```

`prune: true`는 강력하지만 주의가 필요합니다. Git에서 파일을 삭제하면 클러스터에서도 해당 리소스가 삭제됩니다.

### 4.4 변경사항 배포 전체 흐름

```
1. 개발자: Git push → fleet-infra/apps/my-service/deployment.yaml 수정
2. Flux Source Controller: 5분 이내 변경 감지 (또는 즉시 강제 동기화)
3. Flux Kustomize/Helm Controller: 변경된 매니페스트 분석
4. 차이(diff) 계산: 클러스터 현재 상태 vs Git 원하는 상태
5. kubectl apply 실행: 변경 사항만 적용
6. Flux Notification Controller: Gitea 커밋에 배포 결과 상태 업데이트
7. (실패 시) 자동 롤백: 이전 Helm revision으로 복구
```

### 4.5 즉시 강제 동기화

5분 폴링을 기다리지 않고 즉시 동기화하려면:

```bash
# 특정 Kustomization 즉시 동기화
flux reconcile kustomization sample-apps

# 특정 HelmRelease 즉시 동기화
flux reconcile helmrelease saas-platform -n flux-system

# Git 저장소 즉시 갱신
flux reconcile source git fleet-infra

# 전체 동기화 상태 확인
flux get all -A
```

### 4.6 긴급 수정 방법

**시나리오**: Flux가 동기화를 완료하기 전에 프로덕션 장애가 발생한 경우.

```bash
# 1. 특정 HelmRelease 동기화 일시 중지 (Flux가 원복하지 못하게)
flux suspend helmrelease saas-platform -n flux-system

# 2. 직접 kubectl로 긴급 패치
kubectl set image deployment/api-gateway api-gateway=localhost:8080/public-saas/api-gateway:hotfix-v1.2.3 -n saas-platform

# 3. 동작 확인
kubectl rollout status deployment/api-gateway -n saas-platform

# 4. Git에 정상 상태 반영 후 재개
git commit -m "fix: hotfix-v1.2.3 이미지 태그 반영"
git push origin main
flux resume helmrelease saas-platform -n flux-system
flux reconcile helmrelease saas-platform -n flux-system
```

긴급 수정 후에는 반드시 Git에 동일한 변경 사항을 커밋해야 합니다. Flux를 재개하면 Git 상태와 클러스터 상태를 다시 일치시킵니다.

---

## 5. 핵심 인프라 컴포넌트

### 5.1 Traefik — IngressRoute 설정

IngressRoute는 k3s Traefik의 고급 라우팅 CRD입니다.

```yaml
# 예시: API Gateway IngressRoute
apiVersion: traefik.io/v1alpha1
kind: IngressRoute
metadata:
  name: api-gateway-route
  namespace: saas-platform
spec:
  entryPoints:
    - web       # HTTP (80)
    - websecure # HTTPS (443)
  routes:
    - match: Host(`api.agency.go.kr`) && PathPrefix(`/api/v1`)
      kind: Rule
      services:
        - name: api-gateway
          port: 3000
  tls:
    secretName: api-gateway-tls  # cert-manager가 자동 발급
```

표준 Kubernetes Ingress 리소스도 사용 가능합니다:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: my-service
  namespace: saas-platform
  annotations:
    traefik.ingress.kubernetes.io/router.entrypoints: web,websecure
spec:
  rules:
    - host: my-service.agency.go.kr
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: my-service
                port:
                  number: 8080
  tls:
    - hosts:
        - my-service.agency.go.kr
      secretName: my-service-tls
```

### 5.2 Cert-Manager — TLS 자동 갱신

Cert-Manager는 TLS 인증서 발급과 갱신을 자동화하여 CSAP D-09 암호화 요건을 충족합니다.

**ClusterIssuer (서비스 인증서 서명용)**

```yaml
# infra/cert-manager/templates/ca-cluster-issuer.yaml
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: saas-ca-issuer
spec:
  ca:
    secretName: saas-root-ca-secret  # Root CA 인증서가 담긴 Secret
```

**Certificate 리소스 생성**

```yaml
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: my-service-tls
  namespace: saas-platform
spec:
  secretName: my-service-tls
  issuerRef:
    name: saas-ca-issuer
    kind: ClusterIssuer
  dnsNames:
    - my-service.agency.go.kr
    - my-service.saas-platform.svc.cluster.local
  duration: 8760h     # 1년
  renewBefore: 720h   # 만료 30일 전 자동 갱신
```

```bash
# 인증서 상태 확인
kubectl get certificates -A
# NAME              READY   SECRET              AGE
# my-service-tls    True    my-service-tls      5d

# 인증서 상세 확인
kubectl describe certificate my-service-tls -n saas-platform

# 만료 예정 인증서 확인 (AlertManager에서 7일 전 알림)
kubectl get certificates -A -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.status.notAfter}{"\n"}{end}'
```

### 5.3 CloudNativePG — PostgreSQL 클러스터

`infra/cloudnative-pg/clusters/saas-main-db.yaml`이 3-인스턴스 HA PostgreSQL 클러스터를 정의합니다.

**클러스터 특징**

- 인스턴스 3개: primary 1개 + replica 2개 (자동 장애 조치)
- CSAP D-06 감사 로깅: `log_connections`, `log_disconnections`, `log_statement` 활성화
- CSAP D-09 암호화: SSL 강제, `scram-sha-256` 인증
- WAL 아카이빙: MinIO로 연속 백업 (Point-in-Time Recovery 지원)

```bash
# CloudNativePG 클러스터 상태 확인
kubectl get cluster -n saas

# Primary 파드 확인
kubectl get pods -n saas -l cnpg.io/cluster=saas-main-db

# Primary 접속 (개발용)
kubectl exec -it saas-main-db-1 -n saas -- psql -U saas_app saas_platform

# 클러스터 상태 상세
kubectl describe cluster saas-main-db -n saas

# 백업 상태 확인
kubectl get backup -n saas
```

**데이터베이스 마이그레이션**

`infra/db-migration/` 모듈이 Kubernetes Job으로 마이그레이션을 실행합니다. 직접 스키마를 변경하지 말고 마이그레이션 파일을 통해 변경하십시오.

### 5.4 External Secrets — Vault 연동

시크릿 관리는 Sealed Secrets(배포 시점)와 External Secrets Operator(런타임)가 역할을 분담합니다.

```
시크릿 흐름:
1. 개발자 → kubeseal로 SealedSecret 암호화 → Git 커밋
2. Flux → SealedSecret 배포 → saas-secrets 네임스페이스
3. ESO SecretStore → saas-secrets 참조
4. ESO ExternalSecret → saas 네임스페이스에 Secret 동기화
5. 1시간마다 자동 재동기화
```

```bash
# 새 시크릿 추가 절차
# 1. 시크릿 생성
kubectl create secret generic my-api-key \
  -n saas-secrets \
  --from-literal=API_KEY=my-secret-value \
  --dry-run=client -o yaml > secret.yaml

# 2. kubeseal로 암호화 (Git에 커밋 가능한 형태로 변환)
kubeseal --format yaml < secret.yaml > sealed-secret.yaml

# 3. Git 커밋 (sealed-secret.yaml만 커밋, secret.yaml은 커밋 금지)
git add sealed-secret.yaml
git commit -m "feat(secret): my-api-key 시크릿 추가"

# 4. 동기화 확인
kubectl get externalsecret -n saas
kubectl get secret my-api-key -n saas
```

**중요**: `secret.yaml` 파일에는 평문 값이 포함되므로 절대 Git에 커밋하지 마십시오. `.gitignore`에 `secret.yaml`, `*credential*` 패턴이 이미 등록되어 있습니다.

### 5.5 Linkerd — 서비스 메시 (mTLS)

Linkerd는 서비스 간 통신에 상호 TLS(mTLS)를 자동으로 적용합니다. CSAP D-09 전송 암호화 요건을 서비스 코드 변경 없이 충족합니다.

**3계층 인증서 체계**

```
Trust Anchor (Root CA) ─── 10년 유효, 오프라인 보관
  └── Identity Issuer (Intermediate CA) ─── 1년 유효, 클러스터 배포
        └── 워크로드 인증서 ─── 24시간 유효, 자동 회전
```

```bash
# Linkerd 설치 상태 확인
linkerd check

# 서비스 메시 주입 상태 확인 (파드 당 2개 컨테이너: 앱 + linkerd-proxy)
kubectl get pods -n saas-platform -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{range .spec.containers[*]}{.name}{" "}{end}{"\n"}{end}'

# mTLS 동작 확인
linkerd viz edges deployment -n saas-platform
linkerd viz tap deployment/api-gateway -n saas-platform

# 트래픽 분산 확인
linkerd viz stat deployment -n saas-platform
```

**네임스페이스에 Linkerd 자동 주입 활성화**

```bash
kubectl annotate namespace saas-platform linkerd.io/inject=enabled
# 이후 해당 네임스페이스에 배포되는 모든 파드에 linkerd-proxy가 자동 주입됩니다.
```

---

## 6. 스케일링 전략

### 6.1 HPA (Horizontal Pod Autoscaler)

CPU/메모리 사용률에 따라 Pod 수를 자동 조정합니다.

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-gateway-hpa
  namespace: saas-platform
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api-gateway
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70   # CPU 70% 초과 시 스케일 아웃
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
```

```bash
# HPA 상태 확인
kubectl get hpa -n saas-platform
# NAME              REFERENCE                TARGETS         MINPODS  MAXPODS  REPLICAS
# api-gateway-hpa   Deployment/api-gateway   35%/70%         2        10       3

# HPA 이벤트 확인 (스케일 이력)
kubectl describe hpa api-gateway-hpa -n saas-platform
```

### 6.2 KEDA (이벤트 기반 오토스케일)

`infra/keda/` 모듈로 설치된 KEDA는 큐 길이, Prometheus 메트릭 등 외부 이벤트 기반 스케일링을 지원합니다.

```yaml
# KEDA ScaledObject 예시 — Prometheus 메트릭 기반 스케일링
# infra/keda/scaled-objects/api-gateway-scaledobject.yaml
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: api-gateway-scaler
  namespace: saas-platform
spec:
  scaleTargetRef:
    name: api-gateway
  minReplicaCount: 2
  maxReplicaCount: 20
  pollingInterval: 30
  cooldownPeriod: 300
  triggers:
    - type: prometheus
      metadata:
        serverAddress: http://kube-prometheus-stack-prometheus.monitoring.svc:9090
        metricName: http_requests_per_second
        query: |
          sum(rate(http_requests_total{service="api-gateway"}[1m]))
        threshold: "100"   # 초당 요청 100개 이상 시 스케일 아웃
```

```bash
# KEDA ScaledObject 상태 확인
kubectl get scaledobject -n saas-platform

# KEDA 메트릭 서버 확인
kubectl get hpa -n saas-platform  # KEDA가 HPA를 자동 생성함

# KEDA idle 복제 (트래픽 없을 시 0으로 축소)
# infra/keda/idle-replicas/ 참조
```

### 6.3 VPA (Vertical Pod Autoscaler)

CPU/메모리 requests/limits를 사용 패턴에 맞게 자동 조정합니다.

```yaml
# infra/vpa/vpa-objects.yaml
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: api-gateway-vpa
  namespace: saas-platform
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api-gateway
  updatePolicy:
    updateMode: "Off"   # "Off": 권고만 표시, "Auto": 자동 적용
  resourcePolicy:
    containerPolicies:
      - containerName: api-gateway
        minAllowed:
          cpu: 50m
          memory: 64Mi
        maxAllowed:
          cpu: 2
          memory: 2Gi
```

```bash
# VPA 권고 확인 (updateMode: Off일 때)
kubectl get vpa -n saas-platform -o yaml | grep -A 10 recommendation

# 예상 출력:
# recommendation:
#   containerRecommendations:
#   - containerName: api-gateway
#     lowerBound: { cpu: 100m, memory: 128Mi }
#     target: { cpu: 200m, memory: 256Mi }
#     upperBound: { cpu: 500m, memory: 512Mi }
```

**주의**: HPA와 VPA를 동시에 `Auto` 모드로 사용하면 충돌이 발생할 수 있습니다. CPU/메모리 기반 스케일링은 HPA를, 리소스 적정화는 VPA(Off 모드 권고 확인 후 수동 조정)를 사용하는 것을 권장합니다.

---

## 7. Helm 차트 사용법

### 7.1 saas-platform Helm 차트 구조

```
infra/helm/
└── saas-platform/
    ├── Chart.yaml          # 차트 메타데이터 (이름, 버전, 의존성)
    ├── values.yaml         # 기본 설정값
    ├── values-dev.yaml     # 개발 환경 오버라이드
    ├── values-stg.yaml     # 스테이징 환경 오버라이드
    ├── values-prod.yaml    # 프로덕션 환경 오버라이드
    └── templates/
        ├── _helpers.tpl       # 템플릿 헬퍼 함수 (공통 레이블 등)
        ├── deployment.yaml    # Deployment 매니페스트
        ├── service.yaml       # Service 매니페스트
        ├── serviceaccount.yaml
        ├── servicemonitor.yaml # Prometheus 모니터링 설정
        ├── hpa.yaml           # HorizontalPodAutoscaler
        └── NOTES.txt          # 설치 완료 후 안내 메시지
```

### 7.2 values.yaml 주요 설정

```yaml
# infra/helm/saas-platform/values.yaml (핵심 설정)
global:
  imageRegistry: localhost:8080    # Harbor 레지스트리
  imageProject: public-saas
  environment: staging

# 복제 수
replicaCount: 1

# 이미지 설정
image:
  repository: api-gateway
  tag: latest
  pullPolicy: Never                # 로컬 이미지 사용 (k3s 로컬 환경)

# 서비스 설정
service:
  type: NodePort
  port: 3000
  nodePort: 32277

# 리소스 제한 (WSL2 환경 최적화)
resources:
  requests:
    cpu: 100m
    memory: 256Mi
  limits:
    cpu: 500m
    memory: 512Mi

# 모니터링 (ServiceMonitor 자동 생성)
monitoring:
  enabled: true
  serviceMonitor:
    enabled: true
    labels:
      release: kube-prometheus-stack  # Prometheus가 이 레이블로 ServiceMonitor를 탐색

# OpenTelemetry 연동
observability:
  otelCollectorEndpoint: http://saas-otel-collector.monitoring.svc.cluster.local:4317
  tracingEnabled: true
```

### 7.3 Helm 배포 명령어

```bash
# 1. 차트 검증 (문법 오류 확인)
helm lint infra/helm/saas-platform
# 결과: 1 chart(s) linted, 0 chart(s) failed

# 2. 드라이런 (실제 배포 전 매니페스트 미리 보기)
helm install my-service infra/helm/saas-platform \
  -n saas-platform \
  --dry-run --debug

# 3. 설치
kubectl create namespace saas-platform --dry-run=client -o yaml | kubectl apply -f -
helm install my-service infra/helm/saas-platform \
  -n saas-platform \
  --set image.tag=v1.0.0 \
  --timeout 90s

# 4. 업그레이드 (--install: 없으면 설치, 있으면 업그레이드)
helm upgrade --install my-service infra/helm/saas-platform \
  -n saas-platform \
  --set image.tag=v1.1.0 \
  --set replicaCount=2

# 5. 배포 이력 확인
helm history my-service -n saas-platform
# REVISION  STATUS    CHART                  DESCRIPTION
# 1         deployed  saas-platform-1.0.0    Install complete
# 2         deployed  saas-platform-1.0.0    Upgrade complete

# 6. 롤백 (이전 리비전으로 복구)
helm rollback my-service 1 -n saas-platform

# 7. 삭제
helm uninstall my-service -n saas-platform
```

### 7.4 환경별 values 오버라이드

```bash
# 개발 환경
helm upgrade --install my-service infra/helm/saas-platform \
  -n saas-dev \
  -f infra/helm/saas-platform/values.yaml \
  -f infra/helm/saas-platform/values-dev.yaml

# 스테이징 환경
helm upgrade --install my-service infra/helm/saas-platform \
  -n saas-platform \
  -f infra/helm/saas-platform/values.yaml \
  -f infra/helm/saas-platform/values-stg.yaml

# 프로덕션 환경 (프로덕션은 GitOps를 통한 배포만 허용)
# 직접 helm 명령 사용 금지 — fleet-infra 저장소를 통해 배포
```

---

## 8. 실습 시나리오

### 8.1 새 서비스 배포하기

이 실습은 신규 서비스를 처음부터 배포하는 전체 흐름을 경험합니다.

```bash
# Step 1: 로컬 테스트용 간단한 Node.js 서비스 이미지 빌드
cat > /tmp/Dockerfile << 'EOF'
FROM node:22-alpine
WORKDIR /app
RUN echo 'const http=require("http");http.createServer((_,res)=>{res.end(JSON.stringify({status:"ok",service:"my-first-service"}))}).listen(8080);console.log("Listening on :8080")' > app.js
CMD ["node", "app.js"]
EOF

docker build -t localhost:8080/public-saas/my-first-service:v1.0.0 /tmp -f /tmp/Dockerfile

# Step 2: Harbor에 로그인 및 푸시
docker login localhost:8080 -u admin
docker push localhost:8080/public-saas/my-first-service:v1.0.0

# Step 3: k3s에 이미지 임포트 (Harbor에서 직접 pull 대신)
# k3s가 Harbor를 레지스트리 미러로 설정되어 있다면 자동으로 가져옵니다.

# Step 4: Helm 차트 기반 배포
helm upgrade --install my-first-service infra/helm/saas-platform \
  -n saas-platform \
  --set image.repository=public-saas/my-first-service \
  --set image.tag=v1.0.0 \
  --set service.nodePort=32288 \
  --timeout 60s

# Step 5: 배포 확인
kubectl get pods -n saas-platform -l app.kubernetes.io/name=my-first-service
kubectl get svc -n saas-platform my-first-service

# Step 6: 서비스 접근 테스트
curl http://localhost:32288
# 예상 출력: {"status":"ok","service":"my-first-service"}
```

### 8.2 서비스 스케일 조정

```bash
# 즉시 스케일 (수동)
kubectl scale deployment/api-gateway --replicas=3 -n saas-platform

# 확인
kubectl get pods -n saas-platform -l app.kubernetes.io/name=api-gateway
# 3개 파드가 Running 상태로 표시

# HPA 설정으로 영구 스케일 범위 변경 (Helm values 수정 권장)
helm upgrade api-gateway infra/helm/saas-platform \
  -n saas-platform \
  --set autoscaling.enabled=true \
  --set autoscaling.minReplicas=2 \
  --set autoscaling.maxReplicas=10

# GitOps 방식 (권장): fleet-infra 저장소의 values 파일 수정 후 Git push
```

### 8.3 설정 변경 및 롤백

```bash
# 설정 변경 배포
helm upgrade my-first-service infra/helm/saas-platform \
  -n saas-platform \
  --set image.tag=v1.1.0 \
  --set replicaCount=2

# 배포 진행 상태 실시간 확인
kubectl rollout status deployment/my-first-service -n saas-platform

# 배포 히스토리 확인
helm history my-first-service -n saas-platform
# REVISION  STATUS     DESCRIPTION
# 1         superseded Install complete
# 2         deployed   Upgrade complete

# 문제 발생 시 롤백 (리비전 1로 복구)
helm rollback my-first-service 1 -n saas-platform

# 롤백 확인
kubectl get pods -n saas-platform -l app.kubernetes.io/name=my-first-service
kubectl get rs -n saas-platform  # ReplicaSet 이력으로 롤백 확인
```

### 8.4 Flux GitOps 실습

```bash
# fleet-infra 저장소 클론 (Gitea에서)
source /data/ai-saas/infra/gitea/.env
git clone http://${GITEA_ADMIN_USER}:${GITEA_ADMIN_PASSWORD}@localhost:3000/saas-admin/fleet-infra.git /tmp/fleet-infra

# 샘플 앱 추가
mkdir -p /tmp/fleet-infra/apps/my-gitops-app
cat > /tmp/fleet-infra/apps/my-gitops-app/deployment.yaml << 'EOF'
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-gitops-app
  namespace: gitops-demo
spec:
  replicas: 1
  selector:
    matchLabels:
      app: my-gitops-app
  template:
    metadata:
      labels:
        app: my-gitops-app
    spec:
      containers:
        - name: my-gitops-app
          image: nginx:alpine
          ports:
            - containerPort: 80
EOF

# Git 커밋 + 푸시
cd /tmp/fleet-infra
git add -A
git commit -m "feat: GitOps 실습 앱 추가"
git push origin main

# Flux 즉시 동기화
flux reconcile source git fleet-infra

# 배포 확인 (5분 내 자동 배포 또는 즉시 동기화 후 확인)
kubectl get pods -n gitops-demo

# replicas 변경으로 GitOps 동작 확인
sed -i 's/replicas: 1/replicas: 2/' /tmp/fleet-infra/apps/my-gitops-app/deployment.yaml
cd /tmp/fleet-infra && git add -A && git commit -m "feat: replicas 2로 증가" && git push origin main
flux reconcile source git fleet-infra
kubectl get pods -n gitops-demo  # 2개로 증가 확인
```

---

## 참고 문서

- WSL2 완전 구축 가이드: `docs/07-infra/wsl-devops-complete-guide.md`
- WSL2 빠른 시작: `docs/07-infra/wsl-quickstart.md`
- Flux GitOps 연동 가이드: `docs/07-infra/flux-gitops-integration-guide.md`
- Helm 실전 배포 가이드: `docs/07-infra/helm-deployment-guide.md`
- Linkerd Trust Anchor: `infra/linkerd/trust-anchor-guide.md`
- External Secrets 역할 분리: `infra/external-secrets/ROLE-SEPARATION.md`
- Flux HelmRelease 전체 설정: `infra/flux/helm-release.yaml`
- KEDA ScaledObject 예시: `infra/keda/scaled-objects/`

---

*Design Ref: MTU-N23, MTU-N24 | Plan SC: FR-N23.1, FR-N24.1 | CSAP: D-11, D-12*
