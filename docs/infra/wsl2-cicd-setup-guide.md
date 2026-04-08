# WSL2 CI/CD 완전 설치 가이드

| 항목 | 내용 |
|------|------|
| 문서 ID | MTU-N15 |
| 버전 | 1.0.0 |
| 작성일 | 2026-04-08 |
| 작성자 | PM Lead Agent (Claude Code) |
| 대상 | DevOps 엔지니어, 개발팀, 신규 온보딩 |

---

## 1. 개요

WSL2 환경에서 공공기관 SaaS 프레임워크의 전체 CI/CD 파이프라인을 구축하는 가이드입니다.

### 아키텍처

```
+------------------------------------------------------------------+
|                      WSL2 Ubuntu 22.04                           |
|                                                                  |
|  +-----------+  +----------+  +-----------------------------+    |
|  | Gitea     |  | Harbor   |  | k3s Cluster                 |    |
|  | :3000     |  | :8080    |  |                             |    |
|  |           |  |          |  |  +--------+  +-----------+  |    |
|  | Git 서버  |  | 이미지   |  |  | Pods   |  | Services  |  |    |
|  | Actions   |  | 레지스트리|  |  | (helm) |  | (NodePort)|  |    |
|  +-----+-----+  +----+-----+  +----+------+-+-----+------+  |    |
|        |              |              |            |           |    |
|  +-----+-----+        |              |            |           |    |
|  | Act Runner |--------+--------------+            |           |    |
|  | (Docker)   | push image / helm deploy           |           |    |
|  +------------+                                    |           |    |
|                                                                  |
+------------------------------------------------------------------+

CI/CD 흐름:
  git push --> Gitea Actions 트리거
           --> Act Runner 실행 (빌드+테스트)
           --> Docker 이미지 빌드
           --> Harbor Push
           --> helm upgrade (k3s)
           --> Pod 배포 완료
```

---

## 2. 사전 요구사항

### 2.1 시스템 요구사항

| 항목 | 최소 | 권장 |
|------|------|------|
| WSL2 버전 | Windows 10 2004+ | Windows 11 최신 |
| 메모리 | 8GB | 16GB |
| 디스크 | 30GB 여유 | 50GB 여유 |
| CPU | 4코어 | 8코어 |

### 2.2 필수 소프트웨어

```bash
# Docker Desktop (WSL2 통합 활성화 필수)
# 설치 확인:
docker --version        # Docker 24.0+
docker compose version  # Docker Compose v2.20+

# curl (보통 기본 설치됨)
curl --version
```

### 2.3 권장 소프트웨어

```bash
# Node.js + pnpm (프로젝트 빌드용)
node --version   # v22+
pnpm --version   # v9.15.0

# Helm (k3s 배포용)
helm version     # v3.16+
```

### 2.4 WSL2 systemd 활성화 (k3s 필수)

```bash
# /etc/wsl.conf 에 다음 추가:
sudo tee /etc/wsl.conf << 'EOF'
[boot]
systemd=true
EOF

# Windows PowerShell에서 WSL 재시작:
wsl --shutdown
wsl
```

---

## 3. 빠른 시작 (원클릭 설치)

가장 빠른 설치 방법입니다. 모든 구성요소를 자동으로 설치합니다.

```bash
# 프로젝트 디렉토리에서:
cd /data/ai-saas

# 스크립트 실행 권한 부여
chmod +x scripts/setup-wsl2-all.sh
chmod +x scripts/setup-gitea-wsl2.sh
chmod +x scripts/setup-act-runner.sh
chmod +x scripts/setup-harbor-wsl2.sh
chmod +x scripts/test-cicd-pipeline.sh

# 원클릭 설치
./scripts/setup-wsl2-all.sh

# Harbor 없이 설치 (메모리 부족 시)
./scripts/setup-wsl2-all.sh --skip-harbor
```

설치 완료 후:
```bash
# 전체 상태 확인
./scripts/setup-wsl2-all.sh --status

# E2E 검증
./scripts/test-cicd-pipeline.sh
```

---

## 4. 단계별 수동 설치

### 4.1 k3s 설치

```bash
# k3s 설치 (traefik 비활성화, kubeconfig 권한 설정)
curl -sfL https://get.k3s.io | sh -s - \
  --write-kubeconfig-mode 644 \
  --disable traefik \
  --protect-kernel-defaults

# kubeconfig 설정
mkdir -p ~/.kube
sudo cp /etc/rancher/k3s/k3s.yaml ~/.kube/config
sudo chown $(id -u):$(id -g) ~/.kube/config
export KUBECONFIG=~/.kube/config

# 확인
kubectl get nodes
# NAME        STATUS   ROLES                  AGE   VERSION
# <hostname>  Ready    control-plane,master   1m    v1.29.x+k3s1
```

### 4.2 Gitea + PostgreSQL 설치

```bash
# 자동 설치 스크립트
./scripts/setup-gitea-wsl2.sh

# 또는 수동 설치:
cd infra/gitea
cp env.example .env
# .env 파일의 비밀번호 변경
vim .env
docker compose up -d postgres gitea

# 확인
curl http://localhost:3000/api/v1/version
```

### 4.3 Harbor 레지스트리 설치

```bash
# 자동 설치 스크립트
./scripts/setup-harbor-wsl2.sh

# 설치 후 Docker insecure-registry 설정:
# /etc/docker/daemon.json 편집:
sudo tee /etc/docker/daemon.json << 'EOF'
{
  "insecure-registries": ["localhost:8080"]
}
EOF
sudo systemctl restart docker

# 확인
curl http://localhost:8080/api/v2.0/systeminfo
```

### 4.4 Act Runner 설치

```bash
# 1. Gitea에서 Runner 등록 토큰 발급
#    http://localhost:3000/-/admin/actions/runners
#    "Create New Runner" 클릭 -> 토큰 복사

# 2. 토큰을 .env에 입력
cd infra/gitea
vim .env
# RUNNER_REGISTRATION_TOKEN=<발급받은 토큰>

# 3. Runner 시작
./scripts/setup-act-runner.sh

# 확인
docker logs gitea-runner
```

### 4.5 k3s 레지스트리 설정

Harbor를 k3s의 이미지 소스로 등록합니다.

```bash
# registries.yaml 복사
sudo cp infra/harbor/registries.yaml /etc/rancher/k3s/registries.yaml

# 비밀번호 변경
sudo vim /etc/rancher/k3s/registries.yaml
# CHANGE_ME_harbor_admin_password -> 실제 Harbor 비밀번호

# k3s 재시작
sudo systemctl restart k3s

# 확인
kubectl get nodes  # Ready 확인
```

---

## 5. Gitea 초기 설정

### 5.1 Admin 계정 로그인

```
URL: http://localhost:3000
계정: saas-admin (setup-gitea-wsl2.sh에서 설정한 값)
```

### 5.2 Organization 생성 (자동 생성됨)

- Organization: `public-saas`
- Repository: `public-saas/saas-platform`

### 5.3 Git Remote 설정

```bash
# 현재 프로젝트에 Gitea remote 추가
git remote add gitea http://localhost:3000/public-saas/saas-platform.git

# 코드 push
git push gitea main
git push gitea stg
```

---

## 6. Harbor 프로젝트 설정

### 6.1 로그인

```
URL: http://localhost:8080
계정: admin
비밀번호: setup-harbor-wsl2.sh에서 설정한 값
```

### 6.2 프로젝트 확인 (자동 생성됨)

- 프로젝트: `public-saas` (공개)

### 6.3 수동 이미지 push 테스트

```bash
# Harbor 로그인
docker login localhost:8080
# Username: admin
# Password: <Harbor 비밀번호>

# 테스트 이미지 빌드+push
docker build -t localhost:8080/public-saas/api-gateway:test \
  -f platform/services/api-gateway/Dockerfile .
docker push localhost:8080/public-saas/api-gateway:test

# Harbor UI에서 이미지 확인
# http://localhost:8080/harbor/projects/public-saas/repositories
```

---

## 7. Gitea Secrets 설정

CI/CD 파이프라인이 Harbor와 k3s에 접근하려면 Gitea Secrets가 필요합니다.

### 7.1 필요한 Secrets

| Secret 이름 | 설명 | 설정 방법 |
|------------|------|---------|
| `HARBOR_URL` | Harbor 주소 | `localhost:8080` |
| `HARBOR_USERNAME` | Harbor 사용자명 | `admin` |
| `HARBOR_PASSWORD` | Harbor 비밀번호 | Harbor 설치 시 설정한 값 |
| `KUBECONFIG` | k3s kubeconfig | `cat ~/.kube/config` 출력값 |

### 7.2 설정 방법

1. Gitea에서 Repository Settings 접속
   ```
   http://localhost:3000/public-saas/saas-platform/settings
   ```
2. `Actions` > `Secrets` 선택
3. 각 Secret 추가:
   - Name: `HARBOR_USERNAME`, Value: `admin`
   - Name: `HARBOR_PASSWORD`, Value: `<비밀번호>`
   - Name: `HARBOR_URL`, Value: `localhost:8080`
   - Name: `KUBECONFIG`, Value: `<kubeconfig 내용>`

### 7.3 KUBECONFIG 값 생성

```bash
# kubeconfig 내용 출력 (이것을 Secret 값으로 사용)
cat ~/.kube/config

# 또는 base64 인코딩
cat ~/.kube/config | base64 -w 0
```

---

## 8. 파이프라인 첫 실행

### 8.1 CI 파이프라인 (자동)

```bash
# Gitea에 코드 push -> CI 자동 실행
git push gitea stg

# Gitea Actions에서 실행 상태 확인:
# http://localhost:3000/public-saas/saas-platform/actions
```

### 8.2 Deploy 파이프라인 (main push)

```bash
# main 브랜치에 push -> 자동 빌드+배포
git push gitea main

# 실행 순서:
# 1. Build & Push Docker Images (16개 서비스 병렬)
# 2. Build & Push Portal
# 3. Helm Deploy (k3s)
# 4. Deployment Notification
```

### 8.3 수동 확인

```bash
# k3s Pod 상태
kubectl get pods -n saas-platform

# 서비스 상태
kubectl get svc -n saas-platform

# 헬스체크
curl http://localhost:<NodePort>/health
```

---

## 9. 문제 해결 (FAQ)

### Q1: Docker Desktop이 시작되지 않습니다
WSL2 통합이 활성화되어 있는지 확인하십시오.
```
Docker Desktop > Settings > Resources > WSL Integration > Enable
```

### Q2: k3s가 설치되지 않습니다
WSL2에서 systemd가 활성화되어야 합니다.
```bash
cat /etc/wsl.conf
# [boot]
# systemd=true
```

### Q3: Gitea에 접속할 수 없습니다 (localhost:3000)
```bash
# 컨테이너 상태 확인
docker ps | grep gitea
# 로그 확인
docker logs gitea
# 포트 충돌 확인
ss -tlnp | grep 3000
```

### Q4: Act Runner가 등록되지 않습니다
```bash
# Runner 로그 확인
docker logs gitea-runner
# 등록 토큰이 올바른지 확인
# Gitea Admin > Actions > Runners에서 새 토큰 발급
```

### Q5: Harbor에 push할 수 없습니다
```bash
# insecure-registry 설정 확인
cat /etc/docker/daemon.json
# {"insecure-registries": ["localhost:8080"]}
# Docker 재시작
sudo systemctl restart docker
```

### Q6: k3s에서 Harbor 이미지를 pull할 수 없습니다
```bash
# registries.yaml 확인
cat /etc/rancher/k3s/registries.yaml
# k3s 재시작
sudo systemctl restart k3s
# k3s 로그 확인
sudo journalctl -u k3s -f
```

### Q7: Helm deploy가 실패합니다
```bash
# Helm chart 유효성 확인
helm lint helm/saas-platform/
# dry-run 테스트
helm template saas-test helm/saas-platform/ -f helm/saas-platform/values-dev.yaml
# 수동 배포
helm upgrade --install saas-dev helm/saas-platform/ \
  -f helm/saas-platform/values-dev.yaml \
  --namespace saas-platform --create-namespace
```

### Q8: 메모리 부족 (OOM)
```bash
# WSL2 메모리 제한 설정 (Windows 사용자 홈에 .wslconfig 생성)
# C:\Users\<username>\.wslconfig
[wsl2]
memory=8GB
swap=4GB
```

### Q9: 포트 충돌
```bash
# 사용 중인 포트 확인
ss -tlnp | grep -E "3000|2222|5433|8080"
# 해당 프로세스 확인 후 종료
```

### Q10: CI 워크플로우가 트리거되지 않습니다
- Gitea에서 Actions가 활성화되었는지 확인
- `.gitea/workflows/` 디렉토리가 push에 포함되었는지 확인
- Runner가 Online 상태인지 확인: http://localhost:3000/-/admin/actions/runners

---

## 10. 포트 참조표

| 포트 | 서비스 | 프로토콜 | 용도 |
|------|--------|---------|------|
| 3000 | Gitea | HTTP | Web UI + Git HTTP |
| 2222 | Gitea | SSH | Git SSH |
| 5433 | PostgreSQL | TCP | Gitea 데이터베이스 |
| 8080 | Harbor | HTTP | Container Registry |
| 6443 | k3s API | HTTPS | Kubernetes API |
| 30000-32767 | k3s NodePort | TCP | 서비스 노출 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-08 | 초기 작성 | PM Lead Agent |
