# MTU-N28: Gitea + Harbor k3s 마이그레이션 Design

| 항목 | 내용 |
|------|------|
| MTU ID | MTU-N28 |
| Phase | Phase 3 Infrastructure |
| 버전 | 1.0.0 |
| 상태 | Approved |
| 작성일 | 2026-04-08 |
| 작성자 | PM Lead Agent (Claude Code) |
| 관련 Plan | docs/01-plan/mtus/MTU-N28-k3s-cicd-migration.plan.md |

---

## 1. 아키텍처 설계

### 1.1 전체 구조 (k3s 클러스터 내)

```
k3s 클러스터 (desktop-8ccjega, 172.18.120.97)
  |
  +-- cicd 네임스페이스
  |     |
  |     +-- Gitea (Helm: gitea-charts/gitea)
  |     |     +-- gitea Pod (Web + SSH)
  |     |     +-- postgresql Pod (내장, Helm subchart)
  |     |     +-- PVC: gitea-data, gitea-postgresql
  |     |     +-- Service: NodePort 30300 (HTTP), 30222 (SSH)
  |     |
  |     +-- Harbor (Helm: harbor/harbor)
  |     |     +-- core, portal, jobservice, registry, trivy
  |     |     +-- postgresql (내장), redis (내장)
  |     |     +-- PVC: harbor-registry, harbor-database
  |     |     +-- Service: NodePort 30080 (HTTP)
  |     |
  |     +-- Act Runner (Deployment)
  |           +-- gitea/act_runner:latest
  |           +-- Gitea 인스턴스 URL: http://gitea-http.cicd.svc:3000
  |
  +-- saas-platform 네임스페이스 (기존)
  +-- monitoring 네임스페이스 (기존)
```

### 1.2 포트 할당표

| 서비스 | ClusterIP 포트 | NodePort | 용도 |
|--------|---------------|----------|------|
| Gitea HTTP | 3000 | 30300 | Web UI + API |
| Gitea SSH | 22 | 30222 | Git SSH |
| Harbor HTTP | 80 | 30080 | Registry + Web UI |

### 1.3 네임스페이스 분리 (CSAP D-10)

- `cicd`: Gitea + Harbor + Act Runner (CI/CD 전용)
- `saas-platform`: 애플리케이션 서비스 (기존)
- 네임스페이스 간 NetworkPolicy로 필요 트래픽만 허용

---

## 2. Gitea Helm 배포 설계

### 2.1 Helm 차트

- 리포: `https://dl.gitea.com/charts/`
- 차트: `gitea-charts/gitea`
- 내장 PostgreSQL subchart 사용 (별도 DB 불필요)

### 2.2 주요 Helm values (gitea-values.yaml)

```yaml
# Gitea 서버 설정
gitea:
  admin:
    username: saas-admin
    password: <Secret에서 참조>
    email: admin@public-saas.local
  config:
    server:
      ROOT_URL: http://localhost:30300
      SSH_PORT: 22
      SSH_LISTEN_PORT: 22
      DOMAIN: localhost
      LFS_START_SERVER: true
    actions:
      ENABLED: true
    service:
      DISABLE_REGISTRATION: true
      REQUIRE_SIGNIN_VIEW: true

# NodePort 서비스
service:
  http:
    type: NodePort
    port: 3000
    nodePort: 30300
  ssh:
    type: NodePort
    port: 22
    nodePort: 30222

# 내장 PostgreSQL
postgresql:
  enabled: true
  global:
    postgresql:
      auth:
        password: <Secret에서 참조>
        database: gitea

# 영속 볼륨
persistence:
  enabled: true
  size: 10Gi
  storageClass: local-path
```

### 2.3 데이터 마이그레이션 전략

1. Docker Gitea PostgreSQL에서 pg_dump 실행
2. k3s Gitea 배포 후 PostgreSQL Pod에 pg_restore 실행
3. Gitea 데이터 볼륨 (/data) 복사는 선택 사항 (리포 데이터)
4. **1안 (권장)**: 신규 설치 후 admin 계정만 재생성 (클린 스타트)
5. **2안**: 전체 DB 마이그레이션 (복잡도 높음)

**선택: 1안 (클린 스타트)** - 현재 Gitea에 중요 데이터가 제한적이므로 신규 설치 후 필요 설정만 재구성

---

## 3. Harbor Helm 배포 설계

### 3.1 Helm 차트

- 리포: `https://helm.goharbor.io`
- 차트: `harbor/harbor`
- 내장 PostgreSQL + Redis 사용

### 3.2 주요 Helm values (harbor-values.yaml)

```yaml
expose:
  type: nodePort
  nodePort:
    ports:
      http:
        nodePort: 30080
  tls:
    enabled: false

externalURL: http://localhost:30080

harborAdminPassword: <Secret에서 참조>

# 내장 DB
database:
  type: internal

# 내장 Redis
redis:
  type: internal

# Trivy 스캐너 (CSAP D-11-04)
trivy:
  enabled: true

# 영속 볼륨
persistence:
  enabled: true
  persistentVolumeClaim:
    registry:
      size: 20Gi
      storageClass: local-path
    database:
      size: 5Gi
      storageClass: local-path
```

---

## 4. Act Runner 배포 설계

### 4.1 Deployment 매니페스트

- 이미지: `gitea/act_runner:latest`
- 환경변수:
  - `GITEA_INSTANCE_URL`: `http://gitea-http.cicd.svc:3000`
  - `GITEA_RUNNER_REGISTRATION_TOKEN`: Secret에서 참조
  - `GITEA_RUNNER_NAME`: `k3s-runner`
  - `GITEA_RUNNER_LABELS`: `self-hosted,ubuntu-latest:host`
- 볼륨: runner-data PVC (runner 상태 저장)

### 4.2 Runner 등록 흐름

1. Gitea 배포 완료 대기
2. Gitea admin 로그인 후 Runner 등록 토큰 발급
3. Act Runner Deployment 배포 (토큰을 Secret으로 주입)

---

## 5. k3s registries.yaml 설계

### 5.1 갱신 내용

```yaml
mirrors:
  "localhost:30080":
    endpoint:
      - "http://localhost:30080"
  "harbor.local:30080":
    endpoint:
      - "http://localhost:30080"

configs:
  "localhost:30080":
    auth:
      username: admin
      password: <Harbor 비밀번호>
    tls:
      insecure_skip_verify: true
```

### 5.2 적용 방법

- `/etc/rancher/k3s/registries.yaml` 업데이트
- `sudo systemctl restart k3s` 실행 (k3s 재시작 필요)

---

## 6. 보안 설계 (CSAP)

| CSAP 항목 | 적용 방법 |
|-----------|---------|
| D-08 접근통제 | Gitea DISABLE_REGISTRATION=true, admin 전용 |
| D-09 암호화 | Secret으로 비밀번호 관리, base64 인코딩 |
| D-10 네트워크 | cicd 네임스페이스 격리 |
| D-11 가상화 | Pod securityContext (runAsNonRoot) |
| D-11-04 이미지 스캔 | Harbor Trivy 활성화 |

---

## 7. 구현 순서

1. `k8s/cicd/namespace.yaml` 생성 및 적용
2. `k8s/cicd/secrets.yaml` 생성 및 적용
3. Helm 리포 추가 (gitea-charts, harbor)
4. `k8s/cicd/gitea-values.yaml` 작성
5. Gitea Helm 설치
6. `k8s/cicd/harbor-values.yaml` 작성
7. Harbor Helm 설치
8. Gitea Runner 토큰 발급
9. `k8s/cicd/act-runner.yaml` 작성 및 적용
10. `/etc/rancher/k3s/registries.yaml` 갱신 + k3s 재시작
11. Docker Compose 서비스 종료
12. 검증 (모든 서비스 접속 테스트)

---

## 8. 롤백 계획

Docker Compose 서비스는 데이터 볼륨을 보존한 채 종료하므로, 문제 발생 시:

```bash
# k3s 서비스 중지
helm uninstall gitea -n cicd
helm uninstall harbor -n cicd

# Docker Compose 재시작
cd /data/ai-saas/infra/gitea && docker compose up -d
cd /opt/harbor && docker compose up -d
```
