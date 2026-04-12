# 환경 변수 및 환경 관리 완전 가이드

> **문서 ID**: ONBOARD-03-18
> **버전**: 1.0.0 | **작성일**: 2026-04-12 | **작성자**: Implementer (Sonnet)
> **학습 대상**: 프로젝트에 합류한 개발자 (로컬 개발 경험 보유)
> **예상 소요 시간**: 2~3시간
> **선행 문서**: `01-getting-started/02-environment-setup.md`, `03-development/01-local-setup.md`
> **CSAP 연관**: D-09 암호화, D-12 시스템 개발 보안

---

## 목차

1. [이 프로젝트의 환경 전략](#1-이-프로젝트의-환경-전략)
2. [로컬 개발 환경 심화](#2-로컬-개발-환경-심화)
3. [환경 변수 완전 목록](#3-환경-변수-완전-목록)
4. [Vault 연동 심화](#4-vault-연동-심화)
5. [환경별 배포 설정 차이](#5-환경별-배포-설정-차이)
6. [실습: 새 환경 변수 추가하기](#6-실습-새-환경-변수-추가하기)
7. [학습 체크리스트](#7-학습-체크리스트)
8. [다음 단계](#다음-단계)

---

## 1. 이 프로젝트의 환경 전략

### 1.1 세 가지 환경 개요

이 프로젝트는 **dev(로컬 개발)**, **stg(스테이징)**, **prod(프로덕션)** 세 가지 환경으로 구성됩니다. 각 환경은 목적이 다르며, 그에 따라 설정도 다릅니다.

```mermaid
flowchart LR
    subgraph DEV["개발자 PC (로컬)"]
        direction TB
        D1["dev 환경\n.env.local 파일\n또는 .env 파일"]
        D2["docker-compose\nPostgres + Redis + MinIO"]
    end

    subgraph STG["스테이징 서버 (k3s)"]
        direction TB
        S1["stg 환경\nKubernetes Secret\n또는 Vault"]
        S2["실제 인프라\n운영과 동일 구성"]
    end

    subgraph PROD["프로덕션 서버 (k3s)"]
        direction TB
        P1["prod 환경\nHashiCorp Vault\n(운영 시크릿)"]
        P2["실제 인프라\n고가용성 구성"]
    end

    DEV -->|"feat/* 브랜치 PR"| STG
    STG -->|"릴리스 태그 v*"| PROD

    style DEV fill:#e3f2fd
    style STG fill:#fff8e1
    style PROD fill:#fce4ec
```

| 항목 | dev (로컬) | stg (스테이징) | prod (프로덕션) |
|------|-----------|-------------|--------------|
| 시크릿 관리 | `.env` 파일 (로컬 전용) | Kubernetes Secret / Vault | HashiCorp Vault (필수) |
| DB | 로컬 Docker PostgreSQL | 스테이징 전용 DB | 고가용성 PostgreSQL |
| 데이터 | 더미/시드 데이터 | 운영 유사 마스킹 데이터 | 실제 사용자 데이터 |
| 로그 레벨 | `debug` 허용 | `info` 권장 | `warn` 이상만 |
| HTTPS | 선택 사항 | 필수 | 필수 (TLS 1.3+) |
| 디버그 도구 | 활성화 가능 | 비활성화 | 비활성화 (CSAP D-12) |
| Swagger UI | 활성화 | 비활성화 | 비활성화 |

### 1.2 환경별 설정 관리 방법

설정은 **민감도**에 따라 두 가지 저장소로 나뉩니다.

```
[설정 종류]
  ├── 일반 설정 (포트, URL, 기능 플래그 등)
  │     └── 환경 변수 파일 (.env, k8s ConfigMap)
  └── 시크릿 (비밀번호, API 키, 암호화 키 등)
        ├── 로컬: .env 파일 (git 추적 제외)
        ├── 스테이징: Kubernetes Secret
        └── 프로덕션: HashiCorp Vault (필수)
```

💡 **원칙**: 코드에 설정 값을 하드코딩하지 않습니다. 모든 설정은 환경 변수로 주입합니다. 이는 CSAP D-12 요건이기도 합니다.

### 1.3 `.env.local` vs Vault 시크릿의 역할 분담

| 구분 | `.env` / `.env.local` | Vault 시크릿 |
|------|----------------------|------------|
| 사용 환경 | 로컬 개발 전용 | 스테이징 / 프로덕션 |
| 저장 위치 | 개발자 PC (git 제외) | Vault 서버 (암호화 저장) |
| 갱신 방법 | 파일 직접 수정 후 서비스 재시작 | Vault UI/CLI → 자동 주입 |
| 접근 권한 | 파일을 가진 모든 사람 | Vault 정책에 따라 제한 |
| 감사 로그 | 없음 | Vault 감사 로그 자동 기록 |
| CSAP 적합 | 개발 단계만 허용 | 운영 단계 필수 |

❌ 절대 금지: `.env` 파일을 git 커밋하거나, 시크릿 값을 코드에 직접 작성하는 것

---

## 2. 로컬 개발 환경 심화

### 2.1 초기 설정: `.env` 파일 준비

저장소를 처음 클론한 후 가장 먼저 해야 할 일은 `.env` 파일 생성입니다.

```bash
# 1. .env.example 파일을 복사하여 .env 파일 생성
cp /data/ai-saas/.env.example /data/ai-saas/.env

# 2. .env 파일을 열어 실제 값으로 수정
# (예: DB_PASSWORD, REDIS_PASSWORD, JWT 키 등)
nano /data/ai-saas/.env
# 또는
code /data/ai-saas/.env
```

⚠️ `.env` 파일은 `.gitignore`에 이미 등록되어 있습니다. git status에 나타나지 않는 것이 정상입니다.

```bash
# .gitignore 확인
grep ".env" /data/ai-saas/.gitignore
# 출력 예시: .env
#            .env.local
#            .env.*.local
```

### 2.2 로컬 인프라 시작: Docker Compose

개발 시 필요한 PostgreSQL, Redis, MinIO는 Docker Compose로 실행합니다.

```bash
# /data/ai-saas 디렉토리에서 실행

# 인프라 서비스만 시작 (DB + Redis + MinIO)
docker compose up postgres redis minio -d

# 서비스 상태 확인
docker compose ps

# 예상 출력:
# NAME              STATUS    PORTS
# saas-postgres     Up        0.0.0.0:5432->5432/tcp
# saas-redis        Up        0.0.0.0:6379->6379/tcp
# saas-minio        Up        0.0.0.0:9000->9000/tcp

# 로그 확인
docker compose logs postgres -f
```

> 참조: `/data/ai-saas/docker-compose.yml` — 전체 서비스 정의

### 2.3 `pnpm dev` 실행 시 내부에서 일어나는 일

`pnpm dev`를 루트에서 실행하면 Turbo가 전체 워크스페이스의 dev 스크립트를 병렬로 실행합니다.

```mermaid
sequenceDiagram
    participant Dev as 개발자
    participant Turbo as Turbo (빌드 오케스트레이터)
    participant Pkg as packages/* (공유 라이브러리)
    participant Svc as platform/services/* (백엔드)
    participant App as platform/apps/portal (Next.js)

    Dev->>Turbo: pnpm dev
    Turbo->>Pkg: packages 빌드 (의존성 먼저)
    Note over Pkg: @public-saas/feature-flag-sdk 등
    Pkg-->>Turbo: 빌드 완료
    Turbo->>Svc: 서비스 dev 서버 시작 (병렬)
    Note over Svc: Fastify + ts-node watch 모드
    Turbo->>App: Next.js dev 서버 시작
    Svc-->>Dev: API 서버들 준비 완료
    App-->>Dev: http://localhost:4000 준비 완료
```

실제 실행 과정:

```bash
# 1. 루트에서 전체 실행 (Turbo 사용 — 모든 서비스 동시 시작)
cd /data/ai-saas
pnpm dev

# 2. 특정 서비스만 실행 (권장: 개발 중인 서비스만)
pnpm --filter @public-saas/auth-service dev
pnpm --filter @public-saas/api-gateway dev

# 3. 여러 서비스 선택 실행
pnpm --filter @public-saas/auth-service --filter @public-saas/user-service dev
```

### 2.4 서비스별 독립 실행 vs 전체 실행 전략

개발 상황에 따라 두 가지 방법 중 선택합니다.

**전체 실행 (처음 합류 시, 통합 테스트 시)**

```bash
# 전제: docker compose로 인프라 서비스 먼저 시작
docker compose up postgres redis minio -d

# 전체 서비스 실행
pnpm dev

# 메모리 사용량: 약 4~6GB (전체 서비스 + 인프라)
```

**특정 서비스만 실행 (기능 개발 시 권장)**

```bash
# 예: auth-service만 수정 중인 경우

# 1. 인프라 시작
docker compose up postgres redis -d

# 2. api-gateway + auth-service만 실행
pnpm --filter @public-saas/api-gateway dev &
pnpm --filter @public-saas/auth-service dev

# 메모리 사용량: 약 500MB~1GB
```

💡 **팁**: 어떤 서비스를 실행해야 하는지 모를 때는 `docker compose up -d`로 전체를 컨테이너로 올리고, 수정 중인 서비스만 로컬에서 실행합니다. 나머지는 컨테이너가 처리합니다.

### 2.5 로컬 DB/Redis vs 원격 연결 설정

**로컬 Docker 사용 (기본값)**

```bash
# .env 파일의 기본 설정 (Docker Compose 실행 시)
DATABASE_URL="postgresql://saas:your-db-password-here@localhost:5432/saas_platform"
REDIS_URL="redis://default:your-redis-password-here@localhost:6379"
```

**원격 스테이징 DB 연결 (통합 테스트 시)**

```bash
# .env.stg 파일 (로컬에만 보관, git 커밋 금지)
DATABASE_URL="postgresql://saas:<stg-password>@stg-db.internal:5432/saas_platform"
REDIS_URL="redis://default:<stg-password>@stg-redis.internal:6379"

# 스테이징 설정으로 실행
env $(cat .env.stg | xargs) pnpm --filter @public-saas/auth-service dev
```

⚠️ 스테이징 DB에 직접 연결할 경우 실제 스테이징 데이터를 변경할 수 있습니다. 반드시 팀 리드 승인 후 사용하십시오.

### 2.6 Hot Reload 설정 (Fastify + TypeScript)

이 프로젝트의 백엔드 서비스는 Fastify + TypeScript로 작성되어 있으며, 개발 모드에서는 파일 변경 감지 후 자동 재시작합니다.

```bash
# 서비스 package.json의 dev 스크립트 예시
# platform/services/auth-service/package.json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  }
}
```

`tsx watch`는 TypeScript 파일을 JIT 컴파일하면서 변경을 감지합니다. 컴파일 과정 없이 변경사항이 즉시 반영됩니다.

```bash
# 변경 감지 동작 확인
# src/index.ts를 수정하면 아래와 같이 자동 재시작됩니다:
# [tsx] restarting due to changes: src/handlers/auth.handler.ts
# Server listening on port 3001
```

---

## 3. 환경 변수 완전 목록

> **출처**: `/data/ai-saas/.env.example` (실제 파일 기반)

### 3.1 필수 환경 변수 그룹별 정리

#### 그룹 1: 공통 (전 서비스 공유)

| 변수명 | 예시 값 | 설명 | 시크릿 여부 |
|--------|---------|------|-----------|
| `NODE_ENV` | `development` | 실행 환경 구분 | 아니오 |
| `LOG_LEVEL` | `info` | 로그 상세 수준 (`debug`/`info`/`warn`/`error`) | 아니오 |

#### 그룹 2: PostgreSQL 데이터베이스

| 변수명 | 예시 값 | 설명 | 시크릿 여부 |
|--------|---------|------|-----------|
| `DB_USER` | `saas` | DB 사용자명 | 아니오 |
| `DB_PASSWORD` | `your-db-password` | DB 비밀번호 | **예** |
| `DB_NAME` | `saas_platform` | DB 이름 | 아니오 |
| `DB_PORT` | `5432` | DB 포트 | 아니오 |
| `DATABASE_URL` | `postgresql://saas:pw@localhost:5432/saas_platform` | Prisma 연결 문자열 (위 값 조합) | **예** |

#### 그룹 3: Redis (세션/블랙리스트)

| 변수명 | 예시 값 | 설명 | 시크릿 여부 |
|--------|---------|------|-----------|
| `REDIS_PASSWORD` | `your-redis-password` | Redis 인증 비밀번호 | **예** |
| `REDIS_PORT` | `6379` | Redis 포트 | 아니오 |
| `REDIS_URL` | `redis://default:pw@localhost:6379` | Redis 연결 문자열 | **예** |

#### 그룹 4: JWT 인증 키 (CSAP D-08)

| 변수명 | 설명 | 생성 방법 |
|--------|------|---------|
| `JWT_PRIVATE_KEY` | RSA 2048 개인 키 (서명용) | `openssl genrsa -out private.pem 2048` |
| `JWT_PUBLIC_KEY` | RSA 2048 공개 키 (검증용) | `openssl rsa -in private.pem -pubout -out public.pem` |
| `JWT_KEY_ID` | 키 식별자 | `saas-key-1` (고정값) |

```bash
# JWT 키 쌍 생성 방법
openssl genrsa -out private.pem 2048
openssl rsa -in private.pem -pubout -out public.pem

# .env에 붙여넣기 (줄바꿈 유지 필수)
# PEM 파일 내용을 그대로 복사하여 환경 변수에 설정합니다
```

#### 그룹 5: 암호화 키 (CSAP D-09 — AES-256)

| 변수명 | 설명 | 생성 방법 |
|--------|------|---------|
| `MFA_ENCRYPTION_KEY` | MFA 시크릿 암호화 키 (64자 hex) | `openssl rand -hex 32` |
| `FILE_ENCRYPTION_KEY` | 파일 암호화 키 (64자 hex) | `openssl rand -hex 32` |
| `ENCRYPTION_KEY` | 범용 암호화 키 (최소 32자) | `openssl rand -base64 32` |

```bash
# 암호화 키 생성 예시
openssl rand -hex 32
# 출력: a3f8b2c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1

# 이 값을 .env 파일의 MFA_ENCRYPTION_KEY에 설정
```

#### 그룹 6: MinIO 오브젝트 스토리지

| 변수명 | 예시 값 | 설명 |
|--------|---------|------|
| `MINIO_USER` | `minio_admin` | MinIO 관리자 계정 |
| `MINIO_PASSWORD` | `your-minio-password` | MinIO 비밀번호 |
| `MINIO_ENDPOINT` | `localhost` | MinIO 서버 주소 |
| `MINIO_PORT` | `9000` | MinIO API 포트 |
| `MINIO_CONSOLE_PORT` | `9001` | MinIO 웹 콘솔 포트 |
| `MINIO_BUCKET` | `saas-files` | 기본 버킷 이름 |

#### 그룹 7: API Gateway 및 서비스 URL

| 변수명 | 예시 값 | 설명 |
|--------|---------|------|
| `API_GATEWAY_PORT` | `3000` | API Gateway 포트 |
| `API_GATEWAY_URL` | `http://localhost:3000` | 클라이언트가 접속할 URL |
| `CORS_ORIGIN` | `http://localhost:4000` | CORS 허용 출처 |
| `INTERNAL_SERVICE_KEY` | `your-internal-key` | 서비스 간 인증 키 |
| `AUTH_SVC_URL` | `http://localhost:3001` | auth-service 내부 URL |
| `USER_SVC_URL` | `http://localhost:3002` | user-service 내부 URL |

> 전체 서비스 URL 목록은 `.env.example`의 "서비스 간 URL" 섹션을 참고하십시오.

#### 그룹 8: AI Gateway (N2SF N-05)

| 변수명 | 예시 값 | 설명 |
|--------|---------|------|
| `AI_GATEWAY_URL` | `http://ai-gateway.internal/v1` | AI 게이트웨이 URL (직접 호출 금지) |
| `AI_GATEWAY_TOKEN` | `your-gateway-token` | 게이트웨이 인증 토큰 |
| `LM_STUDIO_URL` | `http://host.docker.internal:1234` | 로컬 LM Studio URL |
| `AI_DAILY_TOKEN_LIMIT` | `100000` | 일일 AI 토큰 사용 한도 |

#### 그룹 9: Portal (Next.js)

| 변수명 | 예시 값 | 설명 |
|--------|---------|------|
| `NEXTAUTH_SECRET` | `your-secret-32chars+` | NextAuth 세션 암호화 키 |
| `NEXTAUTH_URL` | `http://localhost:4000` | Portal 접속 URL |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3000` | 클라이언트가 API 호출할 URL |

#### 그룹 10: 보안 및 Rate Limit (CSAP D-08, D-10)

| 변수명 | 기본값 | 설명 |
|--------|--------|------|
| `RATE_LIMIT_LOGIN_MAX` | `5` | 로그인 시도 최대 횟수 |
| `RATE_LIMIT_LOGIN_WINDOW` | `300000` | 로그인 시도 시간 창 (ms, 5분) |
| `PASSWORD_HISTORY_COUNT` | `5` | 비밀번호 이력 보관 수 |
| `INACTIVE_THRESHOLD_DAYS` | `90` | 비활성 계정 잠금 기준 (일) |

### 3.2 환경 변수 유효성 검사 (Zod 스키마)

이 프로젝트는 서비스 시작 시 환경 변수를 Zod 스키마로 검사합니다. 필수 변수가 없으면 서비스가 시작되지 않습니다.

```typescript
// 예시: platform/services/auth-service/src/config.ts
// Design Ref: §D-12 — 시크릿 환경 변수 검증

import { z } from 'zod'

const envSchema = z.object({
  // 필수 값 (값 없으면 서비스 시작 실패)
  DATABASE_URL: z.string().url('유효한 PostgreSQL URL이어야 합니다'),
  REDIS_URL: z.string().url('유효한 Redis URL이어야 합니다'),
  JWT_PRIVATE_KEY: z.string().min(100, 'RSA 개인 키가 필요합니다'),
  JWT_PUBLIC_KEY: z.string().min(100, 'RSA 공개 키가 필요합니다'),
  MFA_ENCRYPTION_KEY: z.string().length(64, '64자 hex 키여야 합니다'),

  // 기본값이 있는 선택 변수
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  AUTH_SERVICE_PORT: z.coerce.number().default(3001),
})

// 서비스 시작 시 검증 (오류 시 즉시 종료)
const parsed = envSchema.safeParse(process.env)
if (!parsed.success) {
  console.error('환경 변수 오류:', parsed.error.format())
  process.exit(1)  // 환경 변수 없으면 시작 안 함
}

export const config = parsed.data
```

### 3.3 시크릿 vs 일반 설정 구분 기준

아래 기준에 따라 변수를 분류합니다.

| 분류 | 기준 | 예시 | 관리 방법 |
|------|------|------|---------|
| **시크릿** | 유출 시 보안 피해 발생 | 비밀번호, API 키, 암호화 키, JWT 키 | Vault / `.env` (로컬만) |
| **일반 설정** | 유출해도 보안 피해 없음 | 포트, URL, 로그 레벨, 타임아웃 | ConfigMap / `.env` |
| **공개 설정** | 의도적으로 공개 | `NEXT_PUBLIC_*` 변수 | 코드에 직접 포함 가능 |

💡 **판단 기준**: "이 값이 외부에 노출된다면 서비스를 새로 만들어야 하는가?" 라면 시크릿입니다.

---

## 4. Vault 연동 심화

### 4.1 Vault 아키텍처 이해

HashiCorp Vault는 스테이징/프로덕션 환경에서 시크릿을 중앙 관리합니다.

```mermaid
flowchart TD
    subgraph LOCAL["로컬 개발"]
        L1[".env 파일\n(git 제외)"]
        L2["서비스 프로세스\n(tsx watch)"]
        L1 -->|"환경 변수 주입"| L2
    end

    subgraph STG_PROD["스테이징 / 프로덕션 (k3s)"]
        V1["HashiCorp Vault\n(시크릿 저장소)"]
        VA["Vault Agent\n(사이드카 컨테이너)"]
        CM["ConfigMap\n(일반 설정)"]
        POD["서비스 Pod"]

        V1 -->|"시크릿 조회\n(Vault Agent Token)"| VA
        VA -->|"파일로 주입\n/vault/secrets/"| POD
        CM -->|"환경 변수 주입"| POD
    end

    style LOCAL fill:#e3f2fd
    style STG_PROD fill:#f3e5f5
```

### 4.2 로컬에서 Vault 없이 개발하는 방법

로컬 개발에서는 Vault 없이 `.env` 파일만으로 개발합니다. Vault가 없어도 서비스가 정상 동작합니다.

```bash
# Vault 없이 로컬 개발 방법

# 1. .env 파일에 직접 값 설정
cat /data/ai-saas/.env | grep -E "^(DB_|REDIS_|JWT_|ENCRYPTION_)"

# 2. 서비스 실행 (.env 파일 자동 로드)
pnpm --filter @public-saas/auth-service dev

# 3. 환경 변수가 제대로 로드되었는지 확인 (서비스 로그에서)
# [INFO] auth-service 시작: port=3001 env=development
# [INFO] DB 연결 완료: saas_platform@localhost:5432
# [INFO] Redis 연결 완료: localhost:6379
```

서비스가 환경 변수를 로드하는 순서:

```
1. process.env (이미 설정된 OS 환경 변수)
2. .env.local (존재하는 경우 — 최우선)
3. .env (기본 환경 변수 파일)
4. .env.example (참조용, 실제 로드 안 함)
```

### 4.3 시크릿 갱신 시 서비스 재시작 없이 적용

Vault Agent Sidecar 패턴을 사용하면 시크릿이 변경될 때 서비스를 재시작하지 않고 적용할 수 있습니다.

```yaml
# Kubernetes Pod 어노테이션 예시 (스테이징/프로덕션)
# Design Ref: §Vault-Sidecar — 동적 시크릿 갱신

apiVersion: apps/v1
kind: Deployment
metadata:
  name: auth-service
spec:
  template:
    metadata:
      annotations:
        # Vault Agent Sidecar 활성화
        vault.hashicorp.com/agent-inject: "true"
        vault.hashicorp.com/role: "auth-service"
        # 시크릿을 파일로 마운트
        vault.hashicorp.com/agent-inject-secret-db: "secret/data/saas/db"
        # 파일 내용 템플릿 (Consul Template 형식)
        vault.hashicorp.com/agent-inject-template-db: |
          {{- with secret "secret/data/saas/db" -}}
          DB_PASSWORD={{ .Data.data.password }}
          DATABASE_URL=postgresql://saas:{{ .Data.data.password }}@postgres:5432/saas_platform
          {{- end }}
```

서비스 코드에서 파일 기반 시크릿 읽기:

```typescript
// platform/services/auth-service/src/config.ts
// Design Ref: §Vault-Sidecar — 파일 기반 시크릿

import { readFileSync, existsSync } from 'fs'

function loadVaultSecret(secretPath: string): Record<string, string> {
  const vaultFile = `/vault/secrets/${secretPath}`
  if (existsSync(vaultFile)) {
    // 프로덕션: Vault Agent가 주입한 파일 읽기
    const content = readFileSync(vaultFile, 'utf-8')
    return Object.fromEntries(
      content.split('\n')
        .filter(line => line.includes('='))
        .map(line => line.split('=', 2) as [string, string])
    )
  }
  // 로컬: 환경 변수 직접 사용
  return {}
}

// Vault 파일 → 환경 변수 우선순위로 합치기
const vaultSecrets = loadVaultSecret('db')
const dbPassword = vaultSecrets['DB_PASSWORD'] ?? process.env.DB_PASSWORD
```

### 4.4 Vault Agent Sidecar 패턴 동작 원리

```
[Vault Agent 동작 흐름]

1. Pod 시작 시 Vault Agent Init Container 실행
   - Kubernetes ServiceAccount 토큰으로 Vault 인증
   - 권한에 맞는 시크릿 조회 및 파일로 저장
   - /vault/secrets/ 디렉토리에 마운트

2. 메인 컨테이너 시작 (Init Container 완료 후)
   - /vault/secrets/db 파일 읽기 → 환경 변수 대체

3. 백그라운드 Vault Agent Sidecar 실행 중
   - TTL 만료 전 시크릿 자동 갱신
   - 파일 업데이트 → 서비스는 파일을 다시 읽음
   - 서비스 재시작 불필요
```

---

## 5. 환경별 배포 설정 차이

### 5.1 스테이징 환경 사용 목적과 데이터 정책

스테이징은 프로덕션 배포 전 최종 검증 환경입니다.

| 목적 | 설명 |
|------|------|
| 통합 테스트 | 마이크로서비스 간 실제 연동 검증 |
| 성능 테스트 | 프로덕션 유사 부하로 SLO 검증 |
| QA 검증 | 기획/QA팀의 기능 수동 검증 |
| 릴리스 승인 | PM, 보안팀의 배포 전 최종 확인 |

**스테이징 데이터 정책**:

```
✅ 허용:
  - 마스킹된 운영 데이터 (개인정보 제거/치환)
  - 생성된 더미 데이터 (Faker 사용)
  - 운영 유사 볼륨의 테스트 데이터

❌ 금지:
  - 실제 개인정보가 포함된 운영 데이터 복사
  - 실제 주민번호, 전화번호, 이메일 (CSAP D-09, 개인정보보호법)
  - 실제 결제 카드 정보
```

**스테이징 전용 설정**:

```bash
# stg 환경의 주요 설정 차이 (k8s ConfigMap 예시)
NODE_ENV=staging
LOG_LEVEL=info
ENABLE_SWAGGER=false          # 스테이징에서도 Swagger 비활성화
AI_DAILY_TOKEN_LIMIT=10000    # 스테이징은 토큰 한도 낮춤
SLOW_REQUEST_THRESHOLD_MS=3000  # SLO 임계값 동일 적용
```

### 5.2 프로덕션 환경 접근 제한 규칙

프로덕션 환경은 CSAP D-08 요건에 따라 엄격하게 접근이 제한됩니다.

```
[프로덕션 접근 규칙]

1. 직접 접속 금지 원칙
   - 개발자 → 프로덕션 서버에 SSH 직접 접속 금지
   - 모든 변경은 GitOps (Flux) 통해서만

2. DB 접속 제한
   - 읽기: DBA 팀장 이상 + 감사 로그 필수
   - 쓰기: 긴급 상황 + 변경 관리 위원회 승인

3. 시크릿 접근 제한
   - Vault 정책으로 역할별 접근 범위 제한
   - 시크릿 조회 이벤트 전수 감사 로그 기록

4. kubectl 접근 제한
   - 읽기 전용: 시니어 개발자 이상
   - 쓰기: 인프라팀 + 팀 리드

5. 배포 승인 프로세스 (자세한 내용: 06-cicd/07-release-management.md)
   - stg QA 완료 → PM 승인 → 보안팀 확인 → 배포
```

**환경 변수 비교표**:

| 변수 | 로컬 dev | 스테이징 stg | 프로덕션 prod |
|------|---------|------------|-------------|
| `NODE_ENV` | `development` | `staging` | `production` |
| `LOG_LEVEL` | `debug` | `info` | `warn` |
| `ENABLE_SWAGGER` | `true` | `false` | `false` |
| `OTEL_ENABLED` | `false` | `true` | `true` |
| `AI_DAILY_TOKEN_LIMIT` | `100000` | `10000` | `100000` |
| DB 연결 | 로컬 Docker | 스테이징 RDS | 프로덕션 RDS HA |
| 시크릿 관리 | `.env` 파일 | Kubernetes Secret | HashiCorp Vault |

---

## 6. 실습: 새 환경 변수 추가하기

이 실습에서는 새 외부 서비스 API 키를 환경 변수로 추가하는 전체 프로세스를 따라합니다.

### 시나리오

`notification-service`에서 SMS 발송을 위한 외부 API 키가 새로 필요해졌습니다. 변수명은 `SMS_API_KEY`입니다.

### Step 1: `.env.example` 파일에 문서화

```bash
# .env.example 파일에 추가 (실제 값 없이 설명만)
# 파일 끝 부분에 추가

# ----------------------------------------------------------------
# SMS 발송 서비스 (notification-service)
# 발급: 운영팀 → SMS 게이트웨이 계정 → API 키 발급 요청
# ----------------------------------------------------------------
SMS_API_KEY=your-sms-api-key-here
SMS_API_URL=https://sms-gateway.internal/api/v1
```

```bash
# git에 .env.example 변경사항 커밋 (실제 값이 없으므로 커밋 가능)
git add .env.example
git commit -m "feat(notification): SMS_API_KEY 환경 변수 추가 (.env.example)"
```

### Step 2: 로컬 `.env`에 실제 값 추가

```bash
# .env 파일에 실제 값 추가 (git 커밋 금지)
echo "SMS_API_KEY=실제-api-키-값" >> /data/ai-saas/.env
echo "SMS_API_URL=https://sms-gateway.internal/api/v1" >> /data/ai-saas/.env
```

### Step 3: 서비스 코드에 Zod 검증 추가

```typescript
// platform/services/notification-service/src/config.ts

import { z } from 'zod'

const envSchema = z.object({
  // 기존 변수...
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),

  // 새로 추가하는 SMS 변수
  SMS_API_KEY: z.string().min(10, 'SMS API 키가 필요합니다'),
  SMS_API_URL: z.string().url('유효한 SMS 게이트웨이 URL이어야 합니다'),
})

const parsed = envSchema.safeParse(process.env)
if (!parsed.success) {
  console.error('환경 변수 오류:', parsed.error.format())
  process.exit(1)
}

export const config = parsed.data
```

### Step 4: Kubernetes Secret 추가 (스테이징/프로덕션)

```bash
# 스테이징 환경에 Kubernetes Secret으로 추가
kubectl create secret generic notification-secrets \
  --from-literal=SMS_API_KEY="실제-스테이징-api-키" \
  --namespace saas-services \
  --dry-run=client -o yaml | kubectl apply -f -

# 또는 Vault CLI로 추가 (프로덕션)
vault kv put secret/saas/notification SMS_API_KEY="실제-운영-api-키"
```

### Step 5: Kubernetes Deployment에 환경 변수 주입 설정

```yaml
# platform/services/notification-service/k8s/deployment.yaml

apiVersion: apps/v1
kind: Deployment
metadata:
  name: notification-service
spec:
  template:
    spec:
      containers:
        - name: notification-service
          env:
            # ConfigMap에서 일반 설정 주입
            - name: NODE_ENV
              valueFrom:
                configMapKeyRef:
                  name: saas-config
                  key: NODE_ENV
            # Secret에서 시크릿 주입
            - name: SMS_API_KEY
              valueFrom:
                secretKeyRef:
                  name: notification-secrets
                  key: SMS_API_KEY
```

### Step 6: 검증

```bash
# 로컬에서 서비스 재시작 후 변수 로드 확인
pnpm --filter @public-saas/notification-service dev

# 예상 출력:
# [INFO] notification-service 시작: port=3010 env=development
# [INFO] SMS 게이트웨이 연결 확인: https://sms-gateway.internal/api/v1

# 환경 변수 누락 시 즉시 실패 (Zod 검증)
# [ERROR] 환경 변수 오류: { SMS_API_KEY: [ 'SMS API 키가 필요합니다' ] }
# Process exited with code 1
```

### 전체 흐름 요약

```mermaid
flowchart TD
    A["1. .env.example에\n변수 문서화\n(실제 값 없이)"] --> B

    B["2. 로컬 .env에\n실제 값 추가\n(git 제외)"] --> C

    C["3. 서비스 config.ts에\nZod 스키마 추가\n(검증 코드)"] --> D

    D["4. Kubernetes Secret\n또는 Vault에 추가\n(stg/prod)"] --> E

    E["5. k8s Deployment에\n환경 변수 주입 설정"] --> F

    F["6. 서비스 재시작 후\n로드 확인"]

    style A fill:#e8f5e9
    style B fill:#fff3e0
    style C fill:#e3f2fd
    style D fill:#f3e5f5
    style E fill:#fce4ec
    style F fill:#e0f2f1
```

---

## 7. 학습 체크리스트

아래 항목을 모두 완료하면 환경 관리를 이해한 것입니다.

```
기본 이해
  [ ] dev / stg / prod 세 환경의 목적과 차이를 설명할 수 있다
  [ ] .env 파일을 git에 커밋하지 않는 이유를 설명할 수 있다
  [ ] 시크릿과 일반 설정의 차이를 구분할 수 있다

로컬 개발 환경
  [ ] .env.example → .env 파일 생성을 직접 완료했다
  [ ] docker compose up postgres redis minio -d 로 인프라를 시작했다
  [ ] pnpm dev 또는 특정 서비스 dev 실행을 해봤다
  [ ] 환경 변수 누락 시 Zod 에러가 발생하는 것을 확인했다

환경 변수 관리
  [ ] JWT 키 쌍 생성 명령어(openssl)를 사용해봤다
  [ ] 암호화 키 생성 명령어(openssl rand -hex 32)를 사용해봤다
  [ ] .env 파일에서 DATABASE_URL 구조를 이해했다

Vault 이해 (개념)
  [ ] Vault Agent Sidecar 패턴을 그림으로 설명할 수 있다
  [ ] 로컬은 .env 파일, 운영은 Vault를 사용하는 이유를 설명할 수 있다

실습
  [ ] 실습 Step 1~6을 따라서 새 환경 변수를 추가해봤다
  [ ] 추가한 환경 변수가 서비스에서 정상 로드되는 것을 확인했다
```

---

## 다음 단계

환경 관리를 이해했다면 다음 주제로 이동하십시오.

- **[19-dependency-management.md]** — pnpm 워크스페이스와 의존성 관리
- **[03-testing-guide.md]** — 환경 변수를 활용한 테스트 설정
- **[06-cicd/02-quality-gate.md]** — CI/CD에서 환경 변수 검사 방법

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|------|
| 1.0.0 | 2026-04-12 | 최초 작성 — .env.example 기반 전체 환경 변수 목록 포함 | Implementer (Sonnet) |
