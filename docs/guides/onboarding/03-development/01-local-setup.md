# 로컬 개발 환경 구성

> **문서 ID**: ONBOARD-03-01
> **버전**: 1.0.0 | **작성일**: 2026-04-11 | **작성자**: Implementer (Sonnet)
> **선행 학습**: `02-code-management.md` (2장)
> **소요 시간**: 약 2~3시간 (초기 설정 포함)

---

## 목차

1. [사전 준비 및 체크리스트](#1-사전-준비-및-체크리스트)
2. [저장소 클론 및 의존성 설치](#2-저장소-클론-및-의존성-설치)
3. [환경 변수(.env) 설정](#3-환경-변수env-설정)
4. [데이터베이스 설정 (Prisma)](#4-데이터베이스-설정-prisma)
5. [전체 개발 서버 실행](#5-전체-개발-서버-실행)
6. [개별 서비스 실행](#6-개별-서비스-실행)
7. [테스트 실행](#7-테스트-실행)
8. [로컬 k3s 배포](#8-로컬-k3s-배포)
9. [자주 발생하는 오류와 해결법](#9-자주-발생하는-오류와-해결법)
10. [개발 치트시트](#10-개발-치트시트)
11. [변경 이력](#11-변경-이력)

---

## 1. 사전 준비 및 체크리스트

### 1.1 필수 소프트웨어

로컬 개발 환경을 시작하기 전에 다음 소프트웨어가 설치되어 있어야 합니다.

| 소프트웨어 | 버전 | 확인 명령 | 설치 안내 |
|-----------|------|----------|----------|
| Node.js | 22.x | `node --version` | https://nodejs.org |
| pnpm | 9.15.0 | `pnpm --version` | `npm install -g pnpm@9.15.0` |
| Docker | 24.0+ | `docker --version` | https://docker.com |
| Git | 2.40+ | `git --version` | https://git-scm.com |
| k3s (선택) | 1.29+ | `k3s --version` | §8 참조 |

```bash
# 버전 일괄 확인
node --version     # v22.x.x 이어야 합니다
pnpm --version     # 9.15.x 이어야 합니다
docker --version   # Docker version 24.x.x
git --version      # git version 2.4x.x
```

> 중요: Node.js 버전이 다르면 CI/CD 파이프라인과 동작이 달라집니다. 정확히 v22를 사용하세요.
> `nvm`(Node Version Manager)을 사용하면 버전을 쉽게 전환할 수 있습니다.

### 1.2 nvm으로 Node.js 22 설치 (권장)

```bash
# nvm 설치 (이미 설치된 경우 생략)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash

# 셸 재시작 또는 소스 로드
source ~/.bashrc   # bash 사용자
source ~/.zshrc    # zsh 사용자

# Node.js 22 설치
nvm install 22
nvm use 22
nvm alias default 22

# 확인
node --version  # v22.x.x
```

### 1.3 pnpm 설치

```bash
# pnpm 전역 설치
npm install -g pnpm@9.15.0

# 또는 corepack 사용 (Node.js 22에 내장)
corepack enable
corepack prepare pnpm@9.15.0 --activate

# 확인
pnpm --version  # 9.15.0
```

### 1.4 환경 구성 플로우

```mermaid
flowchart LR
  A[소프트웨어\n설치 확인] --> B[저장소 클론]
  B --> C[pnpm install]
  C --> D[.env 설정]
  D --> E[Docker\n서비스 시작\nPG + Redis]
  E --> F[pnpm db:migrate\n+ db:seed]
  F --> G[pnpm build]
  G --> H[pnpm dev\n또는 개별 서비스]
  H --> I([개발 환경\n준비 완료])
```

---

## 2. 저장소 클론 및 의존성 설치

### 2.1 저장소 클론

```bash
# Gitea 저장소 클론 (내부 서버)
git clone http://gitea.internal/public-saas/ai-saas.git
cd ai-saas

# 또는 SSH 사용
git clone git@gitea.internal:public-saas/ai-saas.git
cd ai-saas
```

### 2.2 의존성 설치

```bash
# 루트에서 모든 워크스페이스 의존성 설치
# (platform/services/*, platform/packages/*, packages/* 등 전부)
pnpm install
```

이 명령 한 번으로 모노레포 전체의 의존성이 설치됩니다. 처음 실행 시 수백 개의 패키지를 받으므로 5~10분이 걸릴 수 있습니다.

pnpm은 중복 패키지를 글로벌 저장소에 저장하므로 두 번째부터는 훨씬 빠릅니다.

```bash
# 설치 결과 확인
ls node_modules/     # 루트 node_modules
ls platform/services/auth-service/node_modules/  # 서비스별 node_modules (심볼릭 링크)
```

### 2.3 전체 빌드

```bash
# 모든 패키지를 의존성 순서대로 빌드 (Turbo 사용)
pnpm build
```

Turbo가 자동으로 의존성 그래프를 분석하여 올바른 순서로 빌드합니다. 공유 패키지가 먼저 빌드된 후 서비스가 빌드됩니다.

```bash
# 빌드 성공 확인
ls platform/packages/auth-sdk/dist/    # 공유 패키지 빌드 결과
ls platform/services/auth-service/dist/ # 서비스 빌드 결과
```

### 2.4 빌드 실패 시 확인 사항

```bash
# TypeScript 타입 오류만 확인
pnpm typecheck

# 특정 패키지만 빌드
pnpm --filter @public-saas/auth-sdk build

# 빌드 캐시 초기화 후 재빌드
rm -rf .turbo
pnpm build
```

---

## 3. 환경 변수(.env) 설정

> CSAP D-12 보안 요건: 시크릿(비밀번호, API 키, 토큰)은 절대 코드에 하드코딩하지 않습니다.
> 모든 시크릿은 `.env` 파일로 관리하고, 이 파일은 절대 git에 커밋하지 않습니다.

### 3.1 .env 파일 생성

```bash
# 루트 디렉토리에서
cp .env.example .env

# .env 파일 편집
nano .env    # 또는 vi, code, 원하는 편집기 사용
```

### 3.2 필수 설정 항목

`.env.example`에 정의된 항목 중 로컬 개발에 반드시 설정해야 하는 항목입니다.

```bash
# ================================================================
# 공통 설정
# ================================================================
NODE_ENV=development
LOG_LEVEL=info

# ================================================================
# PostgreSQL 16
# ================================================================
DB_USER=saas
DB_PASSWORD=localdev-password-change-in-production
DB_NAME=saas_platform
DB_PORT=5432
DATABASE_URL="postgresql://saas:localdev-password-change-in-production@localhost:5432/saas_platform"

# ================================================================
# Redis 7
# ================================================================
REDIS_PASSWORD=localdev-redis-password
REDIS_PORT=6379
REDIS_URL="redis://default:localdev-redis-password@localhost:6379"

# ================================================================
# JWT 인증 (RSA RS256 키 생성 방법은 아래 참조)
# ================================================================
JWT_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
JWT_ACCESS_EXPIRY=900        # 15분 (초 단위)
JWT_REFRESH_EXPIRY=604800    # 7일 (초 단위)

# ================================================================
# 암호화 키 (AES-256 — CSAP D-09)
# 생성: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# ================================================================
ENCRYPTION_KEY=your-64-character-hex-string-here
```

### 3.3 JWT RSA 키 생성

```bash
# RSA 2048비트 키 쌍 생성
openssl genrsa -out private.pem 2048
openssl rsa -in private.pem -pubout -out public.pem

# 키 내용을 .env에 적합한 형태로 변환 (개행을 \n으로)
awk '{printf "%s\\n", $0}' private.pem
awk '{printf "%s\\n", $0}' public.pem

# 생성된 파일 보안 삭제 (.env에 내용을 복사한 후)
shred -u private.pem public.pem
```

> 경고: `private.pem`, `public.pem` 파일을 git에 커밋하면 감리 중대 결함입니다.
> 키 내용은 `.env`에만 보관하고 원본 파일은 즉시 삭제하세요.

### 3.4 암호화 키 생성

```bash
# AES-256 암호화 키 생성 (64자 hex 문자열)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# 출력 예: a3f8c2e1d0b94f7a6e5d4c3b2a1908f7e6d5c4b3a2918070605040302010f0e
```

### 3.5 Docker로 개발용 서비스 실행

`.env` 설정 후 PostgreSQL과 Redis를 Docker로 실행합니다.

```bash
# docker-compose.yml이 있는 루트에서
docker compose up -d postgres redis

# 실행 확인
docker compose ps
# NAME                STATUS          PORTS
# saas-postgres       running         0.0.0.0:5432->5432/tcp
# saas-redis          running         0.0.0.0:6379->6379/tcp

# 로그 확인
docker compose logs postgres
docker compose logs redis
```

---

## 4. 데이터베이스 설정 (Prisma)

### 4.1 Prisma 마이그레이션

Prisma는 이 프로젝트의 ORM입니다. 스키마 정의는 `prisma/schema.prisma`에 있으며, 마이그레이션은 SQL DDL을 자동으로 생성합니다.

```bash
# 데이터베이스 마이그레이션 실행 (개발 환경)
pnpm db:migrate

# 실제 실행되는 명령:
# prisma migrate dev --name init
```

마이그레이션이 성공하면 다음과 같은 메시지가 출력됩니다.

```
The following migration(s) have been created and applied from new schema changes:

migrations/
  └─ 20260101000000_init/
    └─ migration.sql

Your database is now in sync with your schema.
```

### 4.2 시드 데이터 삽입

개발 환경에서는 테스트에 필요한 기본 데이터(테넌트, 관리자 계정 등)를 시드로 삽입합니다.

```bash
# 시드 데이터 삽입
pnpm db:seed

# 삽입 확인
# 성공 시: "Seeding completed. 기본 테넌트, 관리자 계정 생성 완료."
```

시드 데이터로 생성되는 항목:
- 테넌트: `dev-tenant` (슬러그: `dev`)
- 관리자: `admin@dev.example.com` / 비밀번호: `Admin1234!@#$`
- 기본 역할: `SUPER_ADMIN`, `TENANT_ADMIN`, `USER`, `VIEWER`

> 시드 계정 비밀번호는 개발 환경 전용입니다. 스테이징/프로덕션에서는 절대 사용 금지입니다.

### 4.3 Prisma Studio (선택)

데이터베이스 내용을 GUI로 확인하고 싶을 때 Prisma Studio를 사용합니다.

```bash
# Prisma Studio 실행 (브라우저에서 http://localhost:5555 열림)
npx prisma studio
```

### 4.4 스키마 변경 시 마이그레이션 추가

서비스 개발 중 스키마를 변경해야 할 때는 다음 순서를 따릅니다.

```bash
# 1. prisma/schema.prisma 파일 편집

# 2. 마이그레이션 파일 생성 (이름은 변경 내용을 설명하는 snake_case로)
npx prisma migrate dev --name add_user_profile_fields

# 3. 생성된 마이그레이션 파일 검토
cat prisma/migrations/20260411000000_add_user_profile_fields/migration.sql

# 4. Prisma 클라이언트 재생성 (마이그레이션 후 자동으로 실행됨)
npx prisma generate

# 5. 타입 확인
pnpm typecheck
```

---

## 5. 전체 개발 서버 실행

### 5.1 전체 서비스 동시 실행

```bash
# 루트에서 전체 개발 서버 실행
pnpm dev
```

이 명령은 Turbo를 통해 모든 서비스를 병렬로 실행합니다. 서비스 포트는 다음과 같습니다.

| 서비스 | 포트 | 용도 |
|--------|------|------|
| api-gateway | 3000 | 외부 진입점 |
| auth-service | 3001 | 인증/인가 |
| tenant-service | 3002 | 테넌트 관리 |
| user-service | 3003 | 사용자 관리 |
| billing-service | 3004 | 청구 관리 |
| ai-service | 3010 | AI/LLM 연동 |
| compliance-service | 3011 | CSAP 준수 |
| portal (Next.js) | 3100 | 관리 포털 |

### 5.2 헬스체크로 정상 기동 확인

```bash
# 각 서비스 헬스체크
curl http://localhost:3000/health    # api-gateway
curl http://localhost:3001/health    # auth-service
curl http://localhost:3002/health    # tenant-service

# 모든 서비스 헬스체크 (jq 필요)
for port in 3000 3001 3002 3003 3004 3010 3011; do
  echo -n "Port $port: "
  curl -s http://localhost:$port/health | jq -r '.status'
done
```

정상 응답 예시:
```json
{
  "status": "ok",
  "service": "auth-service",
  "version": "0.3.0",
  "checks": {
    "database": "ok",
    "redis": "ok"
  }
}
```

---

## 6. 개별 서비스 실행

개발 중에는 전체 서비스를 실행할 필요 없이 수정 중인 서비스만 실행하는 것이 효율적입니다.

### 6.1 단일 서비스 실행

```bash
# auth-service만 실행
cd /data/ai-saas/platform/services/auth-service
pnpm dev
```

또는 루트에서 필터를 사용합니다.

```bash
# 루트에서 특정 서비스만 실행
pnpm --filter @public-saas/auth-service dev
pnpm --filter @public-saas/user-service dev
```

### 6.2 여러 서비스 동시 실행 (관련 서비스 묶음)

여러 터미널을 열거나 `tmux`를 사용합니다.

```bash
# 터미널 1: auth-service
pnpm --filter @public-saas/auth-service dev

# 터미널 2: user-service
pnpm --filter @public-saas/user-service dev

# 터미널 3: api-gateway (라우팅)
pnpm --filter @public-saas/api-gateway dev
```

### 6.3 핫 리로드 확인

Fastify 서비스는 `tsx watch` 또는 `nodemon`을 사용하여 파일 변경 시 자동으로 재시작됩니다.

```bash
# 핫 리로드가 동작하는지 확인 (파일 수정 후)
# 콘솔에 다음과 같은 메시지가 나타나면 정상
# [auth-service] Server listening at http://0.0.0.0:3001
```

---

## 7. 테스트 실행

### 7.1 전체 테스트 실행

```bash
# 루트에서 전체 워크스페이스 테스트 실행 (Turbo 병렬)
pnpm test
```

### 7.2 테스트 커버리지 확인

```bash
# 커버리지 포함 전체 테스트
pnpm test:coverage

# 커버리지 보고서는 각 패키지의 coverage/ 디렉토리에 생성됩니다
ls platform/services/auth-service/coverage/
# lcov.info
# index.html  ← 브라우저로 열면 시각화된 커버리지 확인 가능
```

Q-Gate G4 요건: **전체 커버리지 80% 이상**이 필수입니다.

### 7.3 특정 서비스 테스트

```bash
# auth-service 테스트만 실행
pnpm --filter @public-saas/auth-service test

# 파일을 지정하여 실행
pnpm --filter @public-saas/auth-service test -- tests/login.test.ts

# 특정 테스트 이름 패턴으로 실행 (vitest 사용)
pnpm --filter @public-saas/auth-service test -- --grep "로그인"
```

### 7.4 테스트 감시 모드

개발 중 파일을 수정하면 자동으로 관련 테스트가 재실행됩니다.

```bash
cd /data/ai-saas/platform/services/auth-service
pnpm test -- --watch
```

### 7.5 E2E 테스트

E2E 테스트는 모든 서비스가 실행 중인 상태에서 실행해야 합니다.

```bash
# 전체 서비스 실행 후 (별도 터미널)
cd /data/ai-saas/platform/tests/e2e
pnpm test:e2e
```

---

## 8. 로컬 k3s 배포

> 이 섹션은 k3s가 설치된 환경에서만 해당됩니다.
> 일반 기능 개발 시에는 §5~6의 `pnpm dev` 방식으로도 충분합니다.

### 8.1 k3s 설치 (WSL2 환경)

```bash
# k3s 설치 (단일 노드, 로컬 개발용)
curl -sfL https://get.k3s.io | INSTALL_K3S_EXEC="--disable traefik" sh -

# kubeconfig 설정
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
sudo chmod 644 /etc/rancher/k3s/k3s.yaml

# 클러스터 상태 확인
kubectl get nodes
# NAME    STATUS   ROLES                  AGE   VERSION
# local   Ready    control-plane,master   1m    v1.29.x
```

### 8.2 Helm으로 서비스 배포

```bash
# 네임스페이스 생성
kubectl create namespace saas-dev

# auth-service Helm 차트 배포
helm install auth-service charts/auth-service \
  --namespace saas-dev \
  --set image.tag=latest \
  --set env.NODE_ENV=development

# 배포 상태 확인
kubectl get pods -n saas-dev
kubectl get svc -n saas-dev
```

### 8.3 로컬 이미지 빌드 및 적재

```bash
# Docker 이미지 빌드
docker build -t auth-service:latest platform/services/auth-service/

# k3s에 이미지 적재
sudo k3s ctr images import <(docker save auth-service:latest)

# 또는 스크립트 사용
bash scripts/load-images-k3s.sh auth-service
```

---

## 9. 자주 발생하는 오류와 해결법

### 9.1 `EADDRINUSE: Port already in use`

포트가 이미 사용 중입니다.

```bash
# 사용 중인 포트 확인
lsof -i :3001

# 프로세스 종료
kill -9 $(lsof -ti :3001)

# 또는 모든 Node 프로세스 종료 (주의: 실행 중인 모든 Node.js 종료)
pkill -f node
```

### 9.2 `PrismaClientKnownRequestError: Connection refused`

데이터베이스 연결 실패입니다.

```bash
# Docker 컨테이너 상태 확인
docker compose ps

# PostgreSQL 재시작
docker compose restart postgres

# 연결 테스트
psql postgresql://saas:localdev-password-change-in-production@localhost:5432/saas_platform -c "SELECT 1"
```

### 9.3 `Cannot find module '@public-saas/auth-sdk'`

공유 패키지가 빌드되지 않았습니다.

```bash
# 의존 패키지 먼저 빌드
pnpm --filter @public-saas/auth-sdk build

# 또는 전체 빌드
pnpm build
```

### 9.4 `Turbo: task not found`

Turbo 캐시 문제입니다.

```bash
# Turbo 캐시 초기화
rm -rf .turbo
rm -rf platform/services/*/dist
rm -rf platform/packages/*/dist
pnpm build
```

### 9.5 `JWT_PRIVATE_KEY is not set`

환경 변수 누락입니다.

```bash
# .env 파일 존재 확인
ls -la .env

# 환경 변수 로드 확인
source .env
echo $JWT_PRIVATE_KEY  # 내용 출력되면 정상 (보안상 터미널에서만 확인)
```

### 9.6 pnpm 버전 불일치

```bash
# 현재 버전 확인
pnpm --version

# 프로젝트 요구 버전 설치
npm install -g pnpm@9.15.0

# 또는 corepack 사용
corepack prepare pnpm@9.15.0 --activate
```

---

## 10. 개발 치트시트

자주 사용하는 명령어를 빠르게 참고할 수 있도록 정리했습니다.

### 10.1 일상 개발 명령어

```bash
# ============================================================
# 설치 / 빌드
# ============================================================
pnpm install                    # 전체 의존성 설치
pnpm build                      # 전체 빌드 (Turbo)
pnpm --filter <pkg> build       # 특정 패키지 빌드

# ============================================================
# 개발 서버 실행
# ============================================================
pnpm dev                                        # 전체 서비스 실행
pnpm --filter @public-saas/auth-service dev    # 단일 서비스 실행
cd platform/services/auth-service && pnpm dev  # 디렉토리 이동 후 실행

# ============================================================
# 테스트
# ============================================================
pnpm test                       # 전체 테스트
pnpm test:coverage              # 커버리지 포함
pnpm --filter <pkg> test        # 특정 패키지 테스트
pnpm typecheck                  # TypeScript 타입 검사
pnpm run lint                   # ESLint 검사

# ============================================================
# 데이터베이스
# ============================================================
pnpm db:migrate                 # 마이그레이션 실행
pnpm db:seed                    # 시드 데이터 삽입
npx prisma studio               # Prisma Studio (GUI)
npx prisma migrate dev --name <이름>  # 새 마이그레이션 생성
npx prisma generate             # Prisma 클라이언트 재생성

# ============================================================
# Docker
# ============================================================
docker compose up -d postgres redis    # DB + Redis 실행
docker compose ps                      # 컨테이너 상태 확인
docker compose logs -f postgres        # 로그 스트리밍
docker compose down                    # 컨테이너 중지 및 제거

# ============================================================
# 보안 감사
# ============================================================
pnpm run audit:security         # 보안 감사
pnpm run audit:dead-code        # Dead code 탐지

# ============================================================
# Git
# ============================================================
git checkout -b feat/FR-X.Y-기능명   # 기능 브랜치 생성
git add platform/services/auth-service/src/  # 특정 경로만 스테이징
git commit -m "feat(auth): FR-X.Y 기능 설명"  # Conventional Commits
```

### 10.2 API 테스트 (curl)

```bash
# 로그인
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@dev.example.com","password":"Admin1234!@#$","tenantSlug":"dev"}'

# 토큰으로 인증된 요청
ACCESS_TOKEN="eyJ..."
curl http://localhost:3003/users/me \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# 헬스체크
curl http://localhost:3001/health | jq .
```

### 10.3 로그 확인

```bash
# 실행 중인 서비스 로그 확인 (pnpm dev 실행 시 콘솔 출력됨)
# 또는 서비스를 직접 실행하여 확인

# Docker 서비스 로그
docker compose logs -f

# k3s Pod 로그
kubectl logs -f -n saas-dev deploy/auth-service
kubectl logs -f -n saas-dev deploy/auth-service --previous  # 재시작 전 로그
```

### 10.4 의존성 관리

```bash
# 패키지 추가 (특정 서비스에)
pnpm --filter @public-saas/auth-service add zod

# 개발 의존성 추가
pnpm --filter @public-saas/auth-service add -D vitest

# 내부 패키지 의존성 추가
pnpm --filter @public-saas/auth-service add @public-saas/rbac

# 미사용 패키지 탐지
npx depcheck
```

---

## 11. 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-11 | 최초 작성 | Implementer (Sonnet) |
