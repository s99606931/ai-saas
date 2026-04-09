# WSL2 DevOps 환경 완전 구축 가이드

> **버전**: 1.0.0 | **작성일**: 2026-04-08 | **검증 환경**: WSL2 Ubuntu, k3s v1.34.6
> **대상**: 신규 합류 개발자, DevOps 엔지니어
> **Design Ref**: MTU-N23 | **CSAP**: D-09, D-10, D-11, D-12

---

## 1. 개요

### 1.1 이 가이드의 목적

이 문서는 WSL2 환경에서 공공기관 SaaS 프레임워크의 완전한 DevOps 파이프라인을 구축하는 단계별 가이드입니다. 클린 WSL2 환경에서 시작하여 30분 이내에 다음을 완성합니다:

- **k3s** (경량 Kubernetes 클러스터)
- **Gitea** (Git 서버 + CI/CD Actions)
- **Harbor** (컨테이너 레지스트리 + 취약점 스캔)
- **Flux v2** (GitOps 자동 배포)
- **Prometheus + Grafana** (모니터링 + 대시보드)

### 1.2 전체 아키텍처

```
[WSL2 Ubuntu]
  |
  +-- Docker Engine (v29.x)
  |     |
  |     +-- Gitea (v1.22) + PostgreSQL 16
  |     |     port: 3000 (HTTP), 2222 (SSH), 5434 (DB)
  |     |
  |     +-- Act Runner (v0.3.x)
  |     |     Docker-in-Docker via /var/run/docker.sock
  |     |
  |     +-- Harbor (v2.11.x) + Trivy
  |           port: 8080 (HTTP)
  |
  +-- k3s (v1.34.x)
  |     |
  |     +-- saas-platform (마이크로서비스 22+ pods)
  |     +-- flux-system (GitOps 4 controllers)
  |     +-- monitoring (Prometheus + Grafana + Alertmanager)
  |
  +-- Flux v2 CLI (v2.8.x)
```

### 1.3 CSAP/N2SF 컴플라이언스 매핑

| 도구 | CSAP 항목 | 설명 |
|------|----------|------|
| k3s | D-11 (가상화 보안) | 컨테이너 격리, 네트워크 정책 |
| Gitea | D-12 (시스템 개발 보안) | 소스코드 관리, CI/CD 자동화 |
| Harbor | D-11-04 (이미지 보안) | Trivy 취약점 스캔, 이미지 서명 |
| Flux | D-12 (변경 관리) | GitOps 기반 선언적 배포 |
| Prometheus | D-06 (침해사고 관리) | 실시간 모니터링, 이상 탐지 알림 |
| Grafana | D-06 (로그 분석) | 시각화 대시보드, SLO 추적 |

---

## 2. 사전 요건

### 2.1 Windows 요구사항

- Windows 10 (Build 19041+) 또는 Windows 11
- WSL2 활성화
- 8GB+ RAM 권장 (전체 스택 운영 시)
- 30GB+ 디스크 여유 공간

### 2.2 WSL2 설정

```powershell
# PowerShell (관리자)
wsl --install -d Ubuntu-22.04
```

`.wslconfig` 권장 설정 (`%USERPROFILE%\.wslconfig`):

```ini
[wsl2]
memory=8GB
processors=4
swap=4GB
localhostForwarding=true
```

### 2.3 Docker Engine 설치

```bash
# Docker 공식 설치 스크립트
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker

# 검증
docker version
# 예상 출력:
# Client: Docker Engine - Community
#  Version:           29.3.x
```

### 2.4 기본 도구 설치

```bash
# kubectl (k3s 설치 시 자동 포함)
# helm
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

# flux CLI
curl -s https://fluxcd.io/install.sh | bash

# 검증
helm version   # v3.20.x
flux version --client  # v2.8.x
```

---

## 3. k3s 클러스터 구축

### 3.1 k3s 설치

```bash
# k3s 설치 (Docker 대신 containerd 사용)
curl -sfL https://get.k3s.io | sh -

# 권한 설정
sudo chmod 644 /etc/rancher/k3s/k3s.yaml

# 환경변수 설정 (~/.bashrc에 추가)
echo 'export KUBECONFIG=/etc/rancher/k3s/k3s.yaml' >> ~/.bashrc
source ~/.bashrc
```

### 3.2 클러스터 검증

```bash
kubectl get nodes
# 예상 출력:
# NAME              STATUS   ROLES           AGE   VERSION
# desktop-xxxxx     Ready    control-plane   1m    v1.34.6+k3s1

kubectl get pods -A
# 예상 출력: kube-system 네임스페이스에 coredns, metrics-server 등 Running
```

### 3.3 CSAP D-11 가상화 보안 연계

k3s는 기본적으로 다음 보안 기능을 제공합니다:
- Pod Security Standards (PSS) 지원
- NetworkPolicy 기본 지원 (Flannel CNI)
- RBAC 활성화 (기본)
- etcd 데이터 암호화 가능

---

## 4. Gitea (Git 서버 + CI/CD)

### 4.1 Docker Compose 기동

```bash
cd /data/ai-saas/infra/gitea

# .env 파일 생성 (비밀번호 자동 생성)
cp env.example .env
DB_PASS="gitea_$(openssl rand -hex 8)"
ADMIN_PASS="admin_$(openssl rand -hex 8)"
sed -i "s/CHANGE_ME_gitea_db_password/${DB_PASS}/" .env
sed -i "s/CHANGE_ME_gitea_admin_password/${ADMIN_PASS}/" .env

echo "DB Password: ${DB_PASS}"
echo "Admin Password: ${ADMIN_PASS}"
# [중요] 이 비밀번호를 안전하게 보관하십시오

# Gitea + PostgreSQL 기동 (Runner 제외)
docker compose up -d postgres gitea
```

### 4.2 초기 설정

Gitea 첫 실행 시 설치 페이지가 표시됩니다. 컨테이너 내에서 직접 설정합니다:

```bash
# app.ini에 INSTALL_LOCK 설정
docker exec --user git gitea sed -i \
  "s/INSTALL_LOCK = false/INSTALL_LOCK = true/" \
  /data/gitea/conf/app.ini

# SECRET_KEY 생성
SECRET_KEY=$(docker exec --user git gitea gitea generate secret SECRET_KEY)
docker exec --user git gitea sed -i \
  "s/SECRET_KEY = /SECRET_KEY = ${SECRET_KEY}/" \
  /data/gitea/conf/app.ini

# Gitea 재시작
docker compose restart gitea

# 관리자 계정 생성
docker exec --user git gitea gitea admin user create \
  --admin \
  --username saas-admin \
  --password "${ADMIN_PASS}" \
  --email admin@public-saas.local \
  --config /data/gitea/conf/app.ini
```

### 4.3 관리자 계정 확인

```bash
# API 접근 테스트
source .env
curl -u "${GITEA_ADMIN_USER}:${GITEA_ADMIN_PASSWORD}" \
  http://localhost:3000/api/v1/version
# 예상 출력: {"version":"1.22.6"}
```

### 4.4 Act Runner 등록

```bash
# Runner 등록 토큰 발급
RUNNER_TOKEN=$(docker exec --user git gitea gitea actions generate-runner-token \
  --config /data/gitea/conf/app.ini | tail -1)
echo "Runner Token: ${RUNNER_TOKEN}"

# .env에 토큰 업데이트
sed -i "s/RUNNER_REGISTRATION_TOKEN=.*/RUNNER_REGISTRATION_TOKEN=${RUNNER_TOKEN}/" .env

# Runner 기동
docker compose up -d runner

# 확인
docker logs gitea-runner 2>&1 | tail -5
# 예상 출력:
# level=info msg="Runner registered successfully."
# level=info msg="Starting runner daemon"
```

### 4.5 저장소 생성 및 워크플로우

```bash
# API로 저장소 생성
source .env
curl -X POST -u "${GITEA_ADMIN_USER}:${GITEA_ADMIN_PASSWORD}" \
  -H "Content-Type: application/json" \
  -d '{"name":"my-service","auto_init":true,"default_branch":"main"}' \
  http://localhost:3000/api/v1/user/repos
```

### 4.6 CSAP D-12 개발보안 연계

- 소스코드 접근 통제: `REQUIRE_SIGNIN_VIEW=true` (인증 필수)
- 사용자 등록 비활성화: `DISABLE_REGISTRATION=true`
- SSH 키 기반 인증: 포트 2222

---

## 5. Harbor (컨테이너 레지스트리)

### 5.1 Harbor 설치

```bash
# Harbor offline installer 다운로드
HARBOR_VERSION="v2.11.2"
mkdir -p /tmp/harbor-install
curl -fSL -o "/tmp/harbor-install/harbor-offline-installer-${HARBOR_VERSION}.tgz" \
  "https://github.com/goharbor/harbor/releases/download/${HARBOR_VERSION}/harbor-offline-installer-${HARBOR_VERSION}.tgz"

# 압축 해제
cd /tmp/harbor-install
tar xzf harbor-offline-installer-${HARBOR_VERSION}.tgz

# 설치 디렉토리로 이동
sudo mkdir -p /opt
sudo mv harbor /opt/harbor
cd /opt/harbor
```

### 5.2 Harbor 설정

```bash
# 템플릿에서 설정 파일 생성
sudo cp harbor.yml.tmpl harbor.yml

# 비밀번호 생성
HARBOR_PASS="Harbor_$(openssl rand -hex 8)"
echo "Harbor Admin Password: ${HARBOR_PASS}"

# 설정 수정
sudo sed -i "s/^hostname:.*/hostname: localhost/" harbor.yml
sudo sed -i "s/^  port: 80$/  port: 8080/" harbor.yml

# HTTPS 비활성화 (개발 환경)
sudo sed -i '/^https:/,/^[a-z]/{
  /^https:/s/^/#/
  /^  port: 443/s/^/  #/
  /^  certificate:/s/^/  #/
  /^  private_key:/s/^/  #/
}' harbor.yml

sudo sed -i "s/^harbor_admin_password:.*/harbor_admin_password: ${HARBOR_PASS}/" harbor.yml
sudo sed -i "s|^data_volume:.*|data_volume: /data/harbor|" harbor.yml

# 데이터 디렉토리 생성 및 설치
sudo mkdir -p /data/harbor
sudo ./install.sh --with-trivy
```

### 5.3 프로젝트 생성

```bash
# public-saas 프로젝트 생성
curl -X POST -u "admin:${HARBOR_PASS}" \
  -H "Content-Type: application/json" \
  -d '{"project_name":"public-saas","public":true}' \
  http://localhost:8080/api/v2.0/projects

# 검증
curl -u "admin:${HARBOR_PASS}" http://localhost:8080/api/v2.0/projects
```

### 5.4 k3s 레지스트리 미러 설정

```bash
# /etc/rancher/k3s/registries.yaml 생성
sudo tee /etc/rancher/k3s/registries.yaml > /dev/null << EOF
mirrors:
  "localhost:8080":
    endpoint:
      - "http://localhost:8080"

configs:
  "localhost:8080":
    auth:
      username: admin
      password: ${HARBOR_PASS}
    tls:
      insecure_skip_verify: true
EOF

# k3s 재시작 (registries 반영)
sudo systemctl restart k3s
```

### 5.5 이미지 빌드/Push/Pull 테스트

```bash
# Docker 로그인
docker login localhost:8080 -u admin -p "${HARBOR_PASS}"

# 테스트 이미지 빌드
echo 'FROM alpine:3.19
CMD ["echo", "Hello"]' > /tmp/Dockerfile
docker build -t localhost:8080/public-saas/test-app:latest /tmp/

# Push
docker push localhost:8080/public-saas/test-app:latest

# k3s에서 Pull 테스트
kubectl run test-pod --image=localhost:8080/public-saas/test-app:latest --restart=Never
kubectl get pod test-pod
# 예상 출력: test-pod   0/1   Completed   0   5s
kubectl delete pod test-pod
```

### 5.6 CSAP D-11-04 이미지 스캔 연계

Harbor에 Trivy가 통합되어 있어 Push된 이미지에 대해 자동 취약점 스캔이 가능합니다.

```bash
# 스캔 결과 확인
curl -u "admin:${HARBOR_PASS}" \
  "http://localhost:8080/api/v2.0/projects/public-saas/repositories/test-app/artifacts?with_scan_overview=true"
```

---

## 6. Flux v2 (GitOps)

### 6.1 Flux CLI 설치

```bash
curl -s https://fluxcd.io/install.sh | bash
flux version --client
# 예상 출력: flux: v2.8.x
```

### 6.2 클러스터 부트스트랩

```bash
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml

# 사전 점검
flux check --pre
# 예상 출력:
# ✔ Kubernetes 1.34.x >=1.33.0-0
# ✔ prerequisites checks passed

# Flux 설치 (클러스터에 컴포넌트 배포)
flux install
# 예상 출력:
# ✔ helm-controller: deployment ready
# ✔ kustomize-controller: deployment ready
# ✔ notification-controller: deployment ready
# ✔ source-controller: deployment ready
# ✔ install finished
```

### 6.3 Flux 상태 확인

```bash
flux check
kubectl get pods -n flux-system
# 예상 출력: 4개 컨트롤러 모두 Running
```

### 6.4 Gitea 연동 (선택)

Gitea 저장소와 연동하여 GitOps 자동 배포를 설정할 수 있습니다:

```bash
# Gitea 저장소를 Flux 소스로 등록
flux create source git my-app \
  --url=http://gitea:3000/saas-admin/my-service.git \
  --branch=main \
  --interval=1m

# Kustomization 설정
flux create kustomization my-app \
  --source=my-app \
  --path="./k8s" \
  --prune=true \
  --interval=5m
```

---

## 7. Prometheus + Grafana (모니터링)

### 7.1 kube-prometheus-stack 배포

```bash
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml

# monitoring 네임스페이스 생성
kubectl create namespace monitoring

# Helm repo 추가
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

# 설치 (WSL2 호환 설정 포함)
helm install kube-prometheus-stack prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --set grafana.service.type=NodePort \
  --set grafana.service.nodePort=30302 \
  --set grafana.adminPassword=admin \
  --set prometheus.service.type=NodePort \
  --set prometheus.service.nodePort=30090 \
  --set prometheus-node-exporter.hostRootFsMount.enabled=false \
  --wait --timeout 5m
```

**[중요] WSL2 특이사항**: `hostRootFsMount.enabled=false` 설정은 WSL2에서 node-exporter의 rootfs mount propagation 문제를 해결합니다.

### 7.2 접근 URL

| 서비스 | URL | 기본 계정 |
|--------|-----|----------|
| Grafana | http://localhost:30302 | admin / admin |
| Prometheus | http://localhost:30090 | (인증 없음) |

### 7.3 메트릭 쿼리 테스트

```bash
# Prometheus API 직접 쿼리
curl -s "http://localhost:30090/api/v1/query?query=up" | python3 -m json.tool | head -20

# 활성 타겟 확인
curl -s "http://localhost:30090/api/v1/targets" | python3 -m json.tool | grep -c "activeTargets"
```

### 7.4 CSAP D-06 감사 로깅 연계

Prometheus는 다음 보안 메트릭을 수집합니다:
- 인증 실패 횟수 추적
- API 응답 시간 모니터링
- Pod 비정상 종료 감지
- 리소스 사용량 임계값 알림

---

## 8. CI/CD 파이프라인 전체 흐름

### 8.1 코드 Push → 빌드 → 배포 시나리오

```
개발자 → git push → Gitea
                       |
                       v
                  Act Runner (CI/CD)
                       |
                  docker build
                       |
                       v
                  Harbor (이미지 저장)
                       |
                  Trivy (취약점 스캔)
                       |
                       v
                  Flux (GitOps)
                       |
                  kubectl apply
                       |
                       v
                  k3s (배포 완료)
                       |
                  Prometheus (메트릭 수집)
```

### 8.2 Gitea Actions 워크플로우 예시

`.gitea/workflows/ci.yaml`:
```yaml
name: CI/CD Pipeline
on: [push]
jobs:
  build-and-push:
    runs-on: self-hosted
    steps:
      - uses: actions/checkout@v4
      - name: Build Image
        run: |
          docker build -t localhost:8080/public-saas/${{ gitea.repository_name }}:${{ gitea.sha }} .
      - name: Push to Harbor
        run: |
          docker login localhost:8080 -u admin -p ${{ secrets.HARBOR_PASSWORD }}
          docker push localhost:8080/public-saas/${{ gitea.repository_name }}:${{ gitea.sha }}
```

---

## 9. 운영 가이드

### 9.1 서비스 시작/중지

```bash
# 전체 환경 시작
./scripts/setup-wsl2-all.sh

# 전체 상태 확인
./scripts/setup-wsl2-all.sh --status

# 전체 중지
./scripts/setup-wsl2-all.sh --stop

# 개별 서비스
cd /data/ai-saas/infra/gitea && docker compose up -d    # Gitea 시작
cd /data/ai-saas/infra/gitea && docker compose stop     # Gitea 중지
cd /opt/harbor && docker compose up -d                   # Harbor 시작
cd /opt/harbor && docker compose stop                    # Harbor 중지
```

### 9.2 포트 할당 요약

| 서비스 | 포트 | 프로토콜 |
|--------|------|----------|
| k3s API | 6443 | HTTPS |
| Gitea Web | 3000 | HTTP |
| Gitea SSH | 2222 | SSH |
| Gitea DB | 5434 | TCP |
| Harbor | 8080 | HTTP |
| Prometheus | 30090 | HTTP (NodePort) |
| Grafana | 30302 | HTTP (NodePort) |
| api-gateway (k3s) | 32276 | HTTP (NodePort) |

### 9.3 로그 확인

```bash
# Gitea 로그
docker logs gitea 2>&1 | tail -20

# Harbor 로그
cd /opt/harbor && docker compose logs --tail 20

# k3s 로그
journalctl -u k3s -n 50

# Flux 로그
kubectl logs -n flux-system deployment/source-controller
```

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-08 | 최초 작성 (실제 WSL2 환경 검증 기반) | PM Lead |
