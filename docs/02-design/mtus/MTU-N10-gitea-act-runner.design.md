# MTU-N10: WSL2 Gitea + Act Runner 설치 구성 Design

| 항목 | 내용 |
|------|------|
| MTU ID | MTU-N10 |
| Phase | Phase 3 Infrastructure |
| 버전 | 1.0.0 |
| 상태 | Approved |
| 작성일 | 2026-04-08 |
| 작성자 | PM Lead Agent (Claude Code) |
| 관련 Plan | docs/01-plan/mtus/MTU-N10-gitea-act-runner.plan.md |

---

## 1. 아키텍처 설계

### 1.1 Docker Compose 구조

```
saas-cicd (Docker Network)
  |
  +-- gitea (localhost:3000, SSH:2222)
  |     +-- volume: gitea-data:/data
  |     +-- depends_on: postgres
  |
  +-- postgres (localhost:5433)
  |     +-- volume: postgres-data:/var/lib/postgresql/data
  |
  +-- runner (Gitea Act Runner)
        +-- volume: runner-data:/data
        +-- mount: /var/run/docker.sock
        +-- depends_on: gitea
```

### 1.2 포트 할당

| 서비스 | 호스트 포트 | 컨테이너 포트 | 용도 |
|--------|-----------|-------------|------|
| Gitea | 3000 | 3000 | Web UI + API |
| Gitea SSH | 2222 | 22 | Git SSH |
| PostgreSQL | 5433 | 5432 | Gitea DB |

### 1.3 네트워크 분리

- `saas-cicd`: Gitea + Runner 전용 네트워크 (외부 서비스 격리)
- Docker 기본 bridge 네트워크 사용하지 않음 (CSAP D-10 네트워크 격리)

---

## 2. docker-compose.yml 설계

### 2.1 서비스 정의

- **gitea**: `gitea/gitea:1.22` (LTS)
  - ROOT_URL: http://localhost:3000
  - DB: PostgreSQL 연결
  - SSH port: 2222
  - 볼륨: gitea-data

- **postgres**: `postgres:16-alpine`
  - DB명: gitea
  - 사용자/비밀번호: 환경변수 (.env)
  - 볼륨: postgres-data
  - 헬스체크: pg_isready

- **runner**: `gitea/act_runner:latest`
  - GITEA_INSTANCE_URL 환경변수
  - GITEA_RUNNER_REGISTRATION_TOKEN 환경변수
  - Docker socket 마운트 (/var/run/docker.sock)
  - 라벨: ubuntu-latest:host

### 2.2 환경변수 (.env.example)

```
GITEA_DB_USER=gitea
GITEA_DB_PASSWORD=<변경 필수>
GITEA_DB_NAME=gitea
GITEA_ADMIN_USER=saas-admin
GITEA_ADMIN_PASSWORD=<변경 필수>
GITEA_ADMIN_EMAIL=admin@public-saas.local
RUNNER_REGISTRATION_TOKEN=<Gitea에서 발급>
```

---

## 3. 스크립트 설계

### 3.1 setup-gitea-wsl2.sh

```
실행 흐름:
1. 사전 요건 확인 (docker, docker-compose)
2. .env 파일 존재 확인 (없으면 .env.example 복사)
3. docker-compose up -d (gitea + postgres)
4. Gitea 준비 대기 (health check, 최대 60초)
5. Gitea admin 계정 생성 (CLI)
6. Organization 생성 (public-saas)
7. Repository 생성 (saas-platform)
8. 검증: curl localhost:3000 응답 확인
```

### 3.2 setup-act-runner.sh

```
실행 흐름:
1. Gitea 접속 확인
2. Runner 등록 토큰 확인 (환경변수 또는 Gitea API)
3. Runner config.yaml 생성
4. docker-compose up -d runner
5. Runner 등록 상태 확인 (Gitea API)
6. 테스트 워크플로우 실행 확인
```

---

## 4. 보안 설계 (CSAP D-09)

- 모든 비밀번호는 환경변수로 관리 (하드코딩 금지)
- .env 파일은 .gitignore에 포함
- .env.example만 버전 관리
- 기본 비밀번호 변경 경고 메시지 출력
