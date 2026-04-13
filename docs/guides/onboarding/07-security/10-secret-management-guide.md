# 시크릿 관리 완전 가이드 — Vault + ESO + 환경 변수 관리 운영

---

| 항목 | 내용 |
|------|------|
| 문서 ID | GUIDE-SEC-07-10 |
| 버전 | 1.0.0 |
| 작성일 | 2026-04-13 |
| 목적 | 공공기관 SaaS 환경에서 시크릿을 안전하게 생성·주입·로테이션·감사하는 방법 완전 이해 |
| 선행 학습 | `04-infrastructure/01-k3s-setup.md`, `04-infrastructure/11-helm-advanced.md` |
| CSAP 참조 | D-09 암호화, D-06 침해사고 관리, D-08 접근 통제, D-12 시스템 개발 보안 |

---

## 목차

1. [시크릿 관리 철학](#1-시크릿-관리-철학)
2. [HashiCorp Vault 운영](#2-hashicorp-vault-운영)
3. [External Secrets Operator (ESO)](#3-external-secrets-operator-eso)
4. [개발 환경 시크릿 관리](#4-개발-환경-시크릿-관리)
5. [CI/CD 시크릿 주입](#5-cicd-시크릿-주입)
6. [시크릿 침해 대응](#6-시크릿-침해-대응)
7. [감사 및 컴플라이언스](#7-감사-및-컴플라이언스)
8. [변경 이력](#변경-이력)

---

## 1. 시크릿 관리 철학

### 1.1 왜 환경 변수에 시크릿을 하드코딩하면 안 되는가

많은 개발자가 처음에는 이렇게 코드를 작성합니다:

```typescript
// ❌ 절대 금지 — CSAP D-09, D-12 위반
const jwtSecret = 'my-super-secret-jwt-key-2026';
const dbPassword = 'postgres_admin_pass';
const apiKey = 'sk-1234567890abcdef';
```

이것이 왜 위험한지 구체적으로 설명합니다.

**Git 히스토리 영구 노출**: `git commit`으로 코드에 시크릿이 포함되면, 나중에 해당 줄을 삭제해도 `git log` 또는 `git blame`으로 영구히 조회됩니다. Gitea, GitHub 같은 원격 저장소에 푸시되면 삭제가 사실상 불가능합니다.

**빌드 아티팩트 포함**: 코드를 Docker 이미지로 빌드하면 이미지 레이어 안에 시크릿이 박힙니다. `docker history --no-trunc` 또는 `docker inspect`로 이미지를 분석하면 노출됩니다.

**로그 유출**: 예외 처리 중 스택 트레이스에 환경 변수 값이 포함되면 로그 집계 시스템(Loki, Elasticsearch)을 통해 시크릿이 퍼집니다.

**팀원 전체 접근**: 코드 저장소 접근 권한이 있는 모든 팀원이 시크릿을 볼 수 있습니다. 퇴사한 직원도 Git 히스토리를 통해 접근 가능합니다.

**감사 추적 불가**: 누가 언제 시크릿에 접근했는지 기록이 없습니다. CSAP D-06(침해사고 관리)과 D-09(암호화) 요건을 충족할 수 없습니다.

이 프로젝트의 실제 코드는 올바른 방식을 보여줍니다:

```typescript
// platform/services/auth-service/src/lib/jwt.ts (실제 코드)
// Design Ref: DESIGN-MTU-P01 Section 3
// CSAP: D-08-01 인증 관리

async function getPrivateKey(): Promise<KeyLike> {
  if (!cachedPrivateKey) {
    const keyData = process.env['JWT_PRIVATE_KEY'];  // ✅ 환경 변수 참조
    if (!keyData) {
      throw new Error('JWT_PRIVATE_KEY 환경 변수가 설정되지 않았습니다');
    }
    cachedPrivateKey = await importPKCS8(keyData, ALGORITHM);
  }
  return cachedPrivateKey;
}
```

환경 변수를 사용해도, 그 환경 변수가 어디서 오는지가 중요합니다. 이 가이드는 시크릿을 안전하게 주입하는 전체 파이프라인을 설명합니다.

### 1.2 시크릿 관리 전체 아키텍처

```mermaid
graph TB
    subgraph "시크릿 원천 (Source of Truth)"
        VAULT[HashiCorp Vault\nKV v2 + PKI + Database]
        GITEA_SEC[Gitea Secrets\nCI/CD 전용]
    end

    subgraph "시크릿 배포 레이어"
        ESO[External Secrets Operator\nESO Controller]
        COSIGN_KEY[Cosign 서명 키\n/opt/cosign/]
    end

    subgraph "k3s 클러스터"
        K8S_SECRET[쿠버네티스 Secret\n암호화 저장 etcd]
        POD_AUTH[auth-service Pod\nJWT_PRIVATE_KEY 환경 변수]
        POD_SEC[security-service Pod\nSERVICE_IP 환경 변수]
        POD_AI[ai-service Pod\nAI Gateway 자격증명]
    end

    subgraph "감사 추적"
        VAULT_AUDIT[Vault 감사 로그\n/vault/audit/]
        AUDIT_LOG[.claude/audit.jsonl\nCSAP D-06]
    end

    VAULT -->|시크릿 동기화| ESO
    ESO -->|ExternalSecret CRD| K8S_SECRET
    K8S_SECRET -->|envFrom / volumeMount| POD_AUTH
    K8S_SECRET -->|envFrom| POD_SEC
    K8S_SECRET -->|envFrom| POD_AI
    GITEA_SEC -->|워크플로우 환경 변수| COSIGN_KEY
    VAULT -->|접근 로그| VAULT_AUDIT
    VAULT_AUDIT -->|CSAP 증거| AUDIT_LOG
```

### 1.3 시크릿 등급 분류

CSAP D-09와 N2SF 기준으로 시크릿을 등급별로 관리합니다:

| 등급 | 예시 | 저장 위치 | 로테이션 주기 |
|------|------|---------|-------------|
| 최고 (CRITICAL) | JWT 비밀키, DB 루트 비밀번호 | Vault KV v2 (최고 보안) | 90일 |
| 높음 (HIGH) | 서비스 API 키, OAuth 시크릿 | Vault KV v2 | 180일 |
| 중간 (MEDIUM) | 내부 서비스 간 토큰 | Vault 또는 ESO | 365일 |
| 낮음 (LOW) | 비민감 설정값 | ConfigMap | 변경 시 |

---

## 2. HashiCorp Vault 운영

### 2.1 Vault 구조 이해

HashiCorp Vault는 시크릿을 중앙에서 저장하고 배포하는 시스템입니다. 이 프로젝트에서 사용하는 주요 Secret Engine은 다음과 같습니다.

**KV v2 (Key-Value Version 2)**: 가장 기본적인 시크릿 저장소입니다. 버전 관리 기능이 있어 이전 값으로 롤백할 수 있습니다.

**PKI (Public Key Infrastructure)**: 인증서 발급 및 관리입니다. auth-service의 JWT RS256 키를 PKI 엔진으로 관리합니다.

**Database Secret Engine**: PostgreSQL 등 데이터베이스의 임시 자격증명을 동적으로 생성합니다. 각 서비스마다 다른 계정이 발급되고 자동 만료됩니다.

### 2.2 Vault KV v2 구성

```bash
# Vault KV v2 활성화
vault secrets enable -path=saas/secrets kv-v2

# 테넌트별 네임스페이스 구조
# saas/secrets/
# ├── auth-service/          # auth-service 전용 시크릿
# ├── security-service/      # security-service 전용 시크릿
# ├── ai-service/            # ai-service 전용 시크릿 (N2SF O등급 제한)
# ├── shared/                # 공용 시크릿
# └── infra/                 # 인프라 시크릿 (DB, Redis)
```

```bash
# auth-service JWT 키 저장
vault kv put saas/secrets/auth-service \
  JWT_PRIVATE_KEY=@/tmp/jwt-private.pem \
  JWT_PUBLIC_KEY=@/tmp/jwt-public.pem \
  JWT_KEY_ID="key-1"

# 버전 확인
vault kv metadata get saas/secrets/auth-service
# Key              Value
# created_time     2026-04-13T09:00:00Z
# current_version  1
# max_versions     5     # 최근 5개 버전 보존

# 이전 버전 조회 (롤백용)
vault kv get -version=1 saas/secrets/auth-service

# 보안 서비스 시크릿 저장
vault kv put saas/secrets/security-service \
  SERVICE_IP="127.0.0.1" \
  AUDIT_TRANSPORT_URL="http://audit-service:3009"
```

### 2.3 테넌트별 정책

각 서비스는 자신의 시크릿에만 접근할 수 있도록 최소 권한 정책을 적용합니다.

```hcl
# policy/auth-service.hcl
# auth-service는 자신의 시크릿에만 읽기 접근 허용
path "saas/secrets/data/auth-service" {
  capabilities = ["read"]
}

# 자신의 시크릿 메타데이터 조회 허용
path "saas/secrets/metadata/auth-service" {
  capabilities = ["read"]
}

# 공용 시크릿 읽기
path "saas/secrets/data/shared/*" {
  capabilities = ["read"]
}

# 다른 서비스 시크릿 접근 금지 (명시적 거부)
path "saas/secrets/data/security-service" {
  capabilities = ["deny"]
}
```

```hcl
# policy/security-service.hcl
path "saas/secrets/data/security-service" {
  capabilities = ["read"]
}

path "saas/secrets/data/shared/*" {
  capabilities = ["read"]
}

# CSAP D-06: 보안 서비스는 감사 로그 경로 쓰기 권한 추가
path "saas/audit/*" {
  capabilities = ["create", "update"]
}
```

정책 등록:

```bash
vault policy write auth-service policy/auth-service.hcl
vault policy write security-service policy/security-service.hcl
```

### 2.4 시크릿 임대(Lease) 만료 및 갱신

Vault의 동적 시크릿은 임대 기간이 있습니다. 임대 만료 전에 갱신하거나, ESO가 자동으로 처리합니다.

```bash
# 현재 임대 목록 조회
vault list sys/leases/lookup/database/creds/auth-service-role

# 특정 임대 갱신
vault lease renew database/creds/auth-service-role/xxxx-yyyy-zzzz

# 임대 폐기 (시크릿 유출 시 즉시 무효화)
vault lease revoke database/creds/auth-service-role/xxxx-yyyy-zzzz

# 특정 역할의 모든 임대 폐기
vault lease revoke -prefix database/creds/auth-service-role/
```

### 2.5 시크릿 로테이션 자동화

JWT 키 로테이션은 90일마다 실행됩니다.

```bash
#!/bin/bash
# scripts/rotate-jwt-keys.sh
# CSAP D-09: 암호화 키 주기적 교체 자동화

set -euo pipefail

NEW_KEY_ID="key-$(date +%Y%m%d)"

# 1. 새 RSA 4096 키 쌍 생성
openssl genrsa -out /tmp/jwt-private-new.pem 4096
openssl rsa -in /tmp/jwt-private-new.pem -pubout -out /tmp/jwt-public-new.pem

# 2. Vault에 새 키 저장 (이전 버전 보존)
vault kv put saas/secrets/auth-service \
  JWT_PRIVATE_KEY=@/tmp/jwt-private-new.pem \
  JWT_PUBLIC_KEY=@/tmp/jwt-public-new.pem \
  JWT_KEY_ID="$NEW_KEY_ID"

# 3. ESO가 자동으로 쿠버네티스 Secret 업데이트 (refreshInterval 내)
echo "[OK] JWT 키 로테이션 완료: $NEW_KEY_ID"

# 4. 감사 로그 기록
vault audit-backends  # Vault 자체 감사 로그에도 기록됨

# 5. 임시 키 파일 즉시 삭제
rm -f /tmp/jwt-private-new.pem /tmp/jwt-public-new.pem
```

`auth-service/src/lib/jwt.ts`는 `JWT_KEY_ID` 환경 변수를 읽어서 JWT 헤더의 `kid` 필드에 포함합니다. 이를 통해 키 회전 중에도 이전 키로 서명된 토큰이 만료될 때까지 검증이 가능합니다.

### 2.6 Vault App → 시크릿 발급 시퀀스

```mermaid
sequenceDiagram
    participant APP as auth-service Pod
    participant SA as K8s ServiceAccount
    participant VAULT as HashiCorp Vault
    participant KV as KV v2 Engine

    APP->>SA: 서비스 어카운트 JWT 토큰 읽기
    SA-->>APP: /var/run/secrets/kubernetes.io/serviceaccount/token
    APP->>VAULT: POST /auth/kubernetes/login\n{role: "auth-service", jwt: "<sa-token>"}
    VAULT->>VAULT: ServiceAccount 검증\n(k3s API로 확인)
    VAULT->>VAULT: auth-service 정책 적용
    VAULT-->>APP: Vault 클라이언트 토큰 발급 (15분 TTL)
    APP->>VAULT: GET /v1/saas/secrets/data/auth-service\nAuthorization: Bearer <vault-token>
    VAULT->>KV: 시크릿 조회
    KV-->>VAULT: {JWT_PRIVATE_KEY, JWT_PUBLIC_KEY, JWT_KEY_ID}
    VAULT-->>APP: 시크릿 데이터 반환
    APP->>APP: 환경 변수로 주입\n(JWT_PRIVATE_KEY, JWT_PUBLIC_KEY)
    Note over APP,KV: 이 과정은 ESO가 대신 처리합니다.\n개발자가 직접 구현할 필요 없음.
```

### 2.7 Database Secret Engine 설정

PostgreSQL 임시 자격증명을 서비스별로 동적 발급합니다.

```bash
# Database Secret Engine 활성화
vault secrets enable database

# PostgreSQL 연결 설정
vault write database/config/saas-postgres \
  plugin_name=postgresql-database-plugin \
  allowed_roles="auth-service-role,security-service-role" \
  connection_url="postgresql://{{username}}:{{password}}@postgres-svc:5432/saas_platform" \
  username="vault_admin" \
  password="$VAULT_PG_PASSWORD"

# auth-service 전용 역할 (최소 권한)
vault write database/roles/auth-service-role \
  db_name=saas-postgres \
  creation_statements="
    CREATE ROLE \"{{name}}\" WITH LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}';
    GRANT SELECT, INSERT, UPDATE ON users, sessions TO \"{{name}}\";
  " \
  revocation_statements="DROP ROLE IF EXISTS \"{{name}}\";" \
  default_ttl="1h" \
  max_ttl="24h"

# 임시 자격증명 발급 테스트
vault read database/creds/auth-service-role
# Key         Value
# username    v-auth-service-xxxxx
# password    A1b2C3d4...
# lease_duration  1h
```

---

## 3. External Secrets Operator (ESO)

### 3.1 ESO란 무엇인가

External Secrets Operator는 외부 시크릿 저장소(Vault, AWS Secrets Manager 등)의 시크릿을 쿠버네티스 Secret 자원으로 자동 동기화하는 컨트롤러입니다. 개발자는 `ExternalSecret` CRD를 Git에 커밋하기만 하면, ESO가 Vault에서 값을 가져와 쿠버네티스 Secret을 생성합니다.

**핵심 이점**:
- Vault 시크릿이 변경되면 ESO가 자동으로 쿠버네티스 Secret 업데이트
- 개발자가 Vault에 직접 접근할 필요 없음 (최소 권한 원칙)
- Git에는 시크릿 경로만 저장하고 실제 값은 저장 안 함

### 3.2 ClusterSecretStore 설정

```yaml
# gitops/externalsecrets/clustersecretstore-vault.yaml
apiVersion: external-secrets.io/v1beta1
kind: ClusterSecretStore
metadata:
  name: vault-backend
spec:
  provider:
    vault:
      # Vault 서버 주소 (내부 네트워크)
      server: "http://vault.vault-system.svc.cluster.local:8200"
      path: "saas/secrets"          # KV v2 마운트 경로
      version: "v2"                 # KV v2 사용
      auth:
        # Kubernetes 서비스 어카운트 인증
        kubernetes:
          mountPath: "kubernetes"
          role: "eso-controller"    # ESO 전용 Vault 역할
          serviceAccountRef:
            name: external-secrets
            namespace: external-secrets
```

### 3.3 ExternalSecret CRD 작성법

각 서비스마다 `ExternalSecret`을 정의합니다. Git에 커밋되며 실제 시크릿 값은 포함되지 않습니다.

```yaml
# gitops/externalsecrets/auth-service.yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: auth-service-secrets
  namespace: saas-staging
  annotations:
    # Reloader: Secret 변경 시 Deployment 자동 재시작
    reloader.stakater.com/auto: "true"
spec:
  # refreshInterval: Vault 폴링 주기
  # 운영환경: 5m (잦은 폴링 방지)
  # 개발환경: 30s (빠른 반영)
  refreshInterval: 5m

  # secretStoreRef: 어떤 ClusterSecretStore를 사용할지
  secretStoreRef:
    name: vault-backend
    kind: ClusterSecretStore

  # target: 생성될 쿠버네티스 Secret 정보
  target:
    name: auth-service-secrets      # Secret 이름 (Deployment에서 참조)
    creationPolicy: Owner           # ESO가 소유권 가짐 (삭제 시 자동 정리)
    template:
      # Secret 타입 (Opaque: 일반 키-값)
      type: Opaque

  # data: Vault 경로 → Secret 키 매핑
  data:
    - secretKey: JWT_PRIVATE_KEY    # 쿠버네티스 Secret의 키 이름
      remoteRef:
        key: auth-service           # Vault KV 경로 (saas/secrets/auth-service)
        property: JWT_PRIVATE_KEY   # Vault KV 내 필드 이름

    - secretKey: JWT_PUBLIC_KEY
      remoteRef:
        key: auth-service
        property: JWT_PUBLIC_KEY

    - secretKey: JWT_KEY_ID
      remoteRef:
        key: auth-service
        property: JWT_KEY_ID
```

```yaml
# gitops/externalsecrets/security-service.yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: security-service-secrets
  namespace: saas-staging
spec:
  refreshInterval: 5m
  secretStoreRef:
    name: vault-backend
    kind: ClusterSecretStore
  target:
    name: security-service-secrets
    creationPolicy: Owner
  data:
    - secretKey: SERVICE_IP
      remoteRef:
        key: security-service
        property: SERVICE_IP

    - secretKey: AUDIT_TRANSPORT_URL
      remoteRef:
        key: security-service
        property: AUDIT_TRANSPORT_URL
```

### 3.4 Deployment에서 ESO Secret 참조

```yaml
# Helm 템플릿에서 ESO Secret 환경 변수로 주입
# templates/microservices.yaml 발췌
spec:
  template:
    spec:
      containers:
        - name: auth-service
          # envFrom: Secret의 모든 키를 환경 변수로 주입
          envFrom:
            - secretRef:
                name: auth-service-secrets   # ESO가 생성한 Secret

          # env: 특정 키만 선택해서 주입
          env:
            - name: JWT_ALGORITHM
              value: RS256
            - name: NODE_ENV
              value: production
```

### 3.5 ESO 동기화 상태 확인

```bash
# ExternalSecret 동기화 상태 확인
kubectl get externalsecret -n saas-staging
# NAME                     STORE          REFRESH INTERVAL   STATUS    READY
# auth-service-secrets     vault-backend  5m                 SecretSynced   True
# security-service-secrets vault-backend  5m                 SecretSynced   True

# 상세 상태 (마지막 동기화 시간, 오류 정보)
kubectl describe externalsecret auth-service-secrets -n saas-staging

# 강제 재동기화 (Vault 값 변경 후 즉시 반영)
kubectl annotate externalsecret auth-service-secrets \
  -n saas-staging \
  force-sync=$(date +%s) --overwrite
```

### 3.6 Vault Agent Sidecar vs ESO 선택 기준

| 기준 | Vault Agent Sidecar | External Secrets Operator |
|------|-------------------|--------------------------|
| 동작 방식 | 각 Pod 옆에 Vault Agent 컨테이너 실행 | 클러스터 수준 컨트롤러 |
| 자원 소비 | Pod마다 사이드카 컨테이너 추가 | 단일 컨트롤러로 전체 관리 |
| 업데이트 | 실시간 파일 업데이트 가능 | `refreshInterval` 주기로 업데이트 |
| K8s Secret | 생성 안 함 (파일/환경 변수 직접 주입) | K8s Secret 생성 |
| GitOps 통합 | 어려움 | 우수 (ExternalSecret CRD를 Git에 커밋) |
| 이 프로젝트 | 미사용 | **사용 (권장)** |

이 프로젝트는 GitOps 워크플로우와의 통합성이 높은 ESO를 선택했습니다.

---

## 4. 개발 환경 시크릿 관리

### 4.1 .env 워크플로우

개발 환경에서는 실제 Vault 없이 `.env.local` 파일을 사용합니다.

```bash
# 저장소에 커밋된 예시 파일 (실제 값 없음)
# .env.example
NODE_ENV=development
DATABASE_URL=postgresql://saas:CHANGE_ME@localhost:5432/saas_platform
REDIS_URL=redis://localhost:6379
JWT_PRIVATE_KEY=GENERATE_WITH_openssl_genrsa_4096
JWT_PUBLIC_KEY=GENERATE_WITH_openssl_rsa_pubout
JWT_KEY_ID=key-dev-1
JWT_ACCESS_EXPIRES_SECONDS=900
JWT_REFRESH_EXPIRES_SECONDS=604800
# AI 서비스 (N2SF O등급 데이터만, 마스킹 후)
AI_GATEWAY_URL=http://localhost:8080/ai-gateway
# CSAP D-09: 아래 값은 반드시 환경별로 생성하십시오
ENCRYPTION_KEY=GENERATE_WITH_openssl_rand_-hex_32
```

```bash
# 실제 개발용 파일 생성 (git에 포함 안 됨)
cp .env.example .env.local

# JWT 키 생성
openssl genrsa -out /tmp/dev-private.pem 4096
openssl rsa -in /tmp/dev-private.pem -pubout -out /tmp/dev-public.pem

# 단일 라인으로 변환 (환경 변수에 개행 포함 불가)
JWT_PRIVATE_KEY=$(cat /tmp/dev-private.pem | base64 -w 0)
JWT_PUBLIC_KEY=$(cat /tmp/dev-public.pem | base64 -w 0)

# .env.local에 설정
echo "JWT_PRIVATE_KEY=$JWT_PRIVATE_KEY" >> .env.local
echo "JWT_PUBLIC_KEY=$JWT_PUBLIC_KEY" >> .env.local
echo "ENCRYPTION_KEY=$(openssl rand -hex 32)" >> .env.local
```

### 4.2 로컬 개발: Vault dev 서버

팀 전체가 동일한 개발 환경을 사용하려면 Vault dev 서버를 Docker로 실행합니다.

```bash
# Vault dev 서버 실행 (개발 전용)
docker run -d \
  --name vault-dev \
  -p 8200:8200 \
  -e VAULT_DEV_ROOT_TOKEN_ID=dev-root-token \
  -e VAULT_DEV_LISTEN_ADDRESS=0.0.0.0:8200 \
  hashicorp/vault:1.16 server -dev

# Vault 접속 설정
export VAULT_ADDR=http://localhost:8200
export VAULT_TOKEN=dev-root-token

# 개발용 시크릿 초기화 스크립트
./scripts/init-vault-dev.sh
```

```bash
#!/bin/bash
# scripts/init-vault-dev.sh

vault secrets enable -path=saas/secrets kv-v2

# auth-service 시크릿 (개발용 더미 키)
vault kv put saas/secrets/auth-service \
  JWT_PRIVATE_KEY="$(cat /tmp/dev-private.pem)" \
  JWT_PUBLIC_KEY="$(cat /tmp/dev-public.pem)" \
  JWT_KEY_ID="key-dev-1"

# security-service 시크릿
vault kv put saas/secrets/security-service \
  SERVICE_IP="127.0.0.1" \
  AUDIT_TRANSPORT_URL="http://localhost:3009"

echo "[OK] 개발용 Vault 시크릿 초기화 완료"
```

### 4.3 시크릿 커밋 방지 (pre-commit hook)

실수로 시크릿이 커밋되는 것을 방지합니다. 이 프로젝트는 `block-no-verify` 훅이 있어 `--no-verify` 우회를 차단합니다.

```bash
# .git/hooks/pre-commit (자동 설치: pnpm prepare 시)
#!/bin/bash
set -e

echo "=== 시크릿 하드코딩 검사 (pre-commit) ==="

# 패턴 목록: API 키, 비밀번호, 토큰
PATTERNS=(
  "sk-[a-zA-Z0-9]{20,}"
  "PRIVATE.KEY.*-{5}"
  "password\s*=\s*['\"][^'\"]{8,}['\"]"
  "secret\s*=\s*['\"][^'\"]{8,}['\"]"
  "token\s*=\s*['\"][^'\"]{16,}['\"]"
)

STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM)
FOUND=0

for file in $STAGED_FILES; do
  # node_modules, test 파일, .env.example 제외
  if echo "$file" | grep -qE "(node_modules|\.test\.|\.spec\.|\.env\.example)"; then
    continue
  fi

  for pattern in "${PATTERNS[@]}"; do
    if grep -qE "$pattern" "$file" 2>/dev/null; then
      echo "[BLOCKED] $file 에서 시크릿 패턴 발견: $pattern"
      FOUND=1
    fi
  done
done

# .env 파일 자체 커밋 차단
for file in $STAGED_FILES; do
  if echo "$file" | grep -qE "^\.env$|^\.env\.(local|production|staging|dev)$|secrets\.(json|yaml|yml)$"; then
    echo "[BLOCKED] 시크릿 파일 커밋 시도: $file"
    FOUND=1
  fi
done

if [ "$FOUND" -eq 1 ]; then
  echo ""
  echo "커밋이 차단되었습니다. 시크릿을 제거한 후 다시 시도하십시오."
  echo "이미 git add한 경우: git reset HEAD <file>"
  exit 1
fi

echo "[OK] 시크릿 미탐지. 커밋 진행."
```

### 4.4 .gitignore 필수 항목

```gitignore
# .gitignore — 시크릿 파일 제외 목록
# CSAP D-09: 시크릿 파일 버전관리 제외

# 환경 변수 파일 (모든 형태)
.env
.env.local
.env.*.local
.env.development
.env.staging
.env.production

# 시크릿 파일
secrets.yaml
secrets.json
secrets.env
*credential*
*.pem          # RSA 키 파일
*.key          # 비밀 키 파일
cosign.key     # Cosign 서명 키

# Vault 관련
vault-token
.vault-token

# 예외: .env.example은 커밋 허용 (실제 값 없음)
!.env.example
```

---

## 5. CI/CD 시크릿 주입

### 5.1 Gitea Secrets 설정

CI/CD 파이프라인에서 사용하는 시크릿은 Gitea 저장소의 Secrets에 저장합니다. 이 프로젝트의 `ci-cd-pipeline.yml`에서 실제 사용되는 시크릿 목록:

| 시크릿 이름 | 용도 | 사용 위치 |
|-----------|------|---------|
| `HARBOR_URL` | Harbor 레지스트리 URL | Stage 3: 이미지 빌드 |
| `HARBOR_USERNAME` | Harbor 로그인 사용자 | Stage 3, 4 |
| `HARBOR_PASSWORD` | Harbor 로그인 비밀번호 | Stage 3, 4 |
| `COSIGN_PASSWORD` | Cosign 서명 키 비밀번호 | Stage 4: 이미지 서명 |
| `KUBECONFIG` | k3s 클러스터 접근 설정 | Stage 5: 배포 |

```yaml
# .gitea/workflows/ci-cd-pipeline.yml 발췌
# Harbor 로그인 — 시크릿은 ${{ secrets.HARBOR_PASSWORD }} 형식으로 참조
- name: Login to Harbor
  run: |
    echo "${{ secrets.HARBOR_PASSWORD }}" | docker login \
      "${{ env.HARBOR_REGISTRY }}" \
      -u "${{ secrets.HARBOR_USERNAME }}" \
      --password-stdin

# Cosign 서명 — 비밀번호는 환경 변수로 전달
- name: Sign Image
  env:
    COSIGN_PASSWORD: ${{ secrets.COSIGN_PASSWORD }}
  run: |
    cosign sign \
      --key ${{ env.COSIGN_KEY_PATH }} \
      --allow-insecure-registry \
      -y "${{ steps.meta.outputs.image }}"
```

**중요**: `${{ secrets.XXX }}`로 참조된 시크릿은 워크플로우 로그에서 자동으로 마스킹(`***`)됩니다.

### 5.2 빌드 타임 vs 런타임 시크릿 분리

**빌드 타임 시크릿 (Docker 빌드 중 필요)**:
- Harbor 레지스트리 자격증명 (이미지 베이스 이미지 pull)
- npm registry 인증 토큰 (private 패키지 설치)
- 이것들은 최종 이미지에 포함되면 안 됩니다.

```dockerfile
# Dockerfile — BuildKit secret mount 사용 (빌드 시 임시 주입, 이미지에 포함 안 됨)
# syntax=docker/dockerfile:1

FROM node:22-alpine AS builder

# BuildKit secret: 빌드 중에만 사용, 최종 이미지 레이어에 미포함
RUN --mount=type=secret,id=npm_token \
    NPM_TOKEN=$(cat /run/secrets/npm_token) \
    npm config set //registry.npmjs.org/:_authToken=$NPM_TOKEN && \
    pnpm install --frozen-lockfile && \
    npm config delete //registry.npmjs.org/:_authToken

FROM node:22-alpine AS production
# npm 토큰이 이 레이어에는 없음
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
```

```yaml
# .gitea/workflows/ci-cd-pipeline.yml에서 BuildKit secret 전달
- name: Build & Push Docker Image
  uses: docker/build-push-action@v5
  with:
    context: .
    file: platform/services/auth-service/Dockerfile
    push: true
    secrets: |
      npm_token=${{ secrets.NPM_TOKEN }}
```

**런타임 시크릿 (Pod 실행 중 필요)**:
- JWT 키, DB 비밀번호, Redis 비밀번호
- ESO → K8s Secret → envFrom 경로로 주입

### 5.3 Cosign 서명 키 관리

이 프로젝트는 이미지 무결성 검증을 위해 Cosign을 사용합니다(CSAP D-11).

```bash
# Cosign 키 쌍 최초 생성 (단 1회)
cosign generate-key-pair

# 생성된 파일:
# cosign.key    <- Gitea Secret에 저장 (COSIGN_PRIVATE_KEY)
# cosign.pub    <- Git에 커밋 (공개 키, 검증용)

# cosign.key는 절대 Git에 커밋하지 마십시오.
# .gitignore에 cosign.key 포함 필수.

# 검증 방법 (누구나 실행 가능)
cosign verify \
  --key infra/cosign/cosign.pub \
  --insecure-ignore-tlog \
  --allow-insecure-registry \
  "harbor.local/public-saas/auth-service:v1.0.0"
```

---

## 6. 시크릿 침해 대응

### 6.1 유출 탐지 도구

```bash
# git-secrets: 저장소 전체 이력에서 시크릿 패턴 검색
git secrets --scan-history

# truffleHog: 엔트로피 기반 시크릿 탐지 (딥 스캔)
# 이 도구는 단순 패턴 매칭이 아닌 통계적 방법으로 랜덤 문자열을 탐지합니다.
docker run -it trufflesecurity/trufflehog:latest \
  git file:///data/ai-saas \
  --only-verified

# gitleaks: .gitea/workflows/security.yml에서 자동 실행
gitleaks detect --source . --verbose
```

Q-Gate G5 단계에서 실행되는 시크릿 탐지 패턴 (`quality-gate.yml` 발췌):

```bash
# CI에서 실행되는 시크릿 탐지 스크립트
FOUND=0
for pattern in "sk-[a-zA-Z0-9]{20,}" "PRIVATE.KEY"; do
  if grep -rn --include="*.ts" --include="*.js" --include="*.tsx" \
    -E "$pattern" platform/ 2>/dev/null | grep -v "node_modules" | grep -v ".test." | grep -v ".spec."; then
    echo "[CRITICAL] 패턴 발견: $pattern"
    FOUND=1
  fi
done
```

### 6.2 즉시 대응 절차

시크릿 유출이 확인되면 다음 순서로 즉시 대응합니다.

**1단계 (0~5분): 시크릿 즉시 폐기**

```bash
# Vault에서 해당 시크릿 즉시 폐기
vault kv delete saas/secrets/auth-service

# Database 동적 시크릿이면 모든 임대 즉시 폐기
vault lease revoke -prefix database/creds/auth-service-role/

# JWT 토큰 블랙리스트 (session.ts의 blacklistToken 참조)
# Redis에서 모든 세션 무효화
redis-cli -n 0 KEYS "sessions:*" | xargs redis-cli DEL
redis-cli -n 0 KEYS "blacklist:*" | xargs redis-cli DEL
```

**2단계 (5~15분): 새 시크릿 발급 및 배포**

```bash
# 새 JWT 키 생성
./scripts/rotate-jwt-keys.sh

# ESO 강제 재동기화
kubectl annotate externalsecret auth-service-secrets \
  -n saas-production \
  force-sync=$(date +%s) --overwrite

# Pod 재시작
kubectl rollout restart deployment/auth-service -n saas-production
kubectl rollout status deployment/auth-service -n saas-production --timeout=120s
```

**3단계 (15~60분): 영향 범위 파악**

```bash
# Vault 감사 로그에서 유출된 시크릿 접근 이력 확인
vault audit enable file file_path=/vault/audit/audit.log
grep "auth-service" /vault/audit/audit.log | jq '.request.remote_address'

# Git 이력에서 유출 커밋 파악
git log --all --full-history -- "*.env*" "*.key" "secrets.*"

# 영향받은 서비스 목록 작성
echo "유출된 시크릿: JWT_PRIVATE_KEY"
echo "영향 서비스: auth-service (모든 사용자 세션 무효화됨)"
echo "유출 경로: Git 커밋 #$(git log --oneline | head -1 | cut -d' ' -f1)"
```

**4단계: CSAP D-09 보고**

```bash
# 감사 로그에 침해 사고 기록
cat >> .claude/audit.jsonl <<EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "action": "SECURITY_INCIDENT",
  "type": "SECRET_EXPOSURE",
  "actor": "system",
  "details": {
    "affected_secret": "JWT_PRIVATE_KEY",
    "affected_service": "auth-service",
    "detection_method": "git-history-scan",
    "remediation": "secret-rotated",
    "sessions_invalidated": true
  },
  "csap_ref": "D-09",
  "severity": "HIGH"
}
EOF
```

CSAP D-09에 따라 침해사고 발생 시 72시간 이내에 정보보호 담당자에게 보고해야 합니다.

---

## 7. 감사 및 컴플라이언스

### 7.1 Vault 감사 로그 설정

Vault의 모든 API 요청과 응답을 감사 로그에 기록합니다.

```bash
# 파일 감사 백엔드 활성화
vault audit enable file \
  file_path=/vault/audit/audit.log \
  log_raw=false     # 시크릿 값 자체는 마스킹하여 기록

# 감사 로그 형식 (JSON Lines)
# {
#   "time": "2026-04-13T09:30:00Z",
#   "type": "request",
#   "auth": {
#     "client_token": "hmac-sha256:...",  <- 토큰은 해시로 기록
#     "accessor": "hmac-sha256:...",
#     "display_name": "auth-service"
#   },
#   "request": {
#     "id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
#     "operation": "read",
#     "remote_address": "10.0.0.5",
#     "path": "saas/secrets/data/auth-service",
#     "namespace": {"id": "root"}
#   },
#   "response": {
#     "data": {
#       "JWT_PRIVATE_KEY": "hmac-sha256:..."  <- 값은 해시로 기록
#     }
#   }
# }
```

### 7.2 시크릿 접근 감사 추적 흐름

```mermaid
sequenceDiagram
    participant ESO as ESO Controller
    participant VAULT as HashiCorp Vault
    participant VAUDIT as Vault 감사 로그
    participant K8S as K8s Secret
    participant POD as auth-service Pod
    participant AUDIT as .claude/audit.jsonl

    Note over ESO,AUDIT: 정상 동기화 흐름 (5분 주기)
    ESO->>VAULT: GET /v1/saas/secrets/data/auth-service
    VAULT->>VAUDIT: 접근 기록\n{actor: eso-controller, path: auth-service, op: read, ip: 10.0.0.x}
    VAULT-->>ESO: {JWT_PRIVATE_KEY: "...", JWT_PUBLIC_KEY: "..."}
    ESO->>K8S: Secret 업데이트\n(auth-service-secrets)
    K8S-->>POD: 환경 변수 갱신 (Pod 재시작 시)

    Note over ESO,AUDIT: 침해 탐지 흐름
    ESO->>VAULT: GET /v1/saas/secrets/data/auth-service
    VAULT->>VAUDIT: 접근 기록 (이상 IP 탐지)
    VAULT->>VAUDIT: 경보: 비정상 접근 패턴
    VAUDIT->>AUDIT: CSAP D-09 침해 이벤트 기록\n{action: ANOMALY_DETECTED, severity: HIGH}
```

### 7.3 누가 언제 어떤 시크릿에 접근했는가 조회

```bash
# Vault 감사 로그 쿼리 (jq 활용)
# 특정 서비스의 시크릿 접근 이력
cat /vault/audit/audit.log | \
  jq -c 'select(.auth.display_name == "auth-service")' | \
  jq '{time: .time, path: .request.path, remote_address: .request.remote_address}'

# 시간 범위로 필터링 (오늘)
TODAY=$(date -u +%Y-%m-%d)
cat /vault/audit/audit.log | \
  jq -c "select(.time | startswith(\"$TODAY\"))" | \
  jq '{time: .time, actor: .auth.display_name, path: .request.path}'

# 거부된 접근 시도 (CSAP D-06 침해 탐지)
cat /vault/audit/audit.log | \
  jq -c 'select(.type == "response" and .response.auth == null)' | \
  jq '{time: .time, path: .request.path, ip: .request.remote_address}'
```

### 7.4 CSAP D-09 암호화 요건 충족 증거

```bash
# 증거 1: etcd 암호화 확인 (k3s)
cat /etc/rancher/k3s/config.yaml | grep -A 5 encryption
# encrypt: true  <- etcd 저장 시 암호화 활성화

# 증거 2: Secret 암호화 설정 확인
kubectl get secret auth-service-secrets -n saas-production -o yaml | \
  grep -v "JWT_PRIVATE_KEY"  # 값은 base64이므로 표시하지 않음
# 평문이 아닌 base64 인코딩 후 etcd에 AES-256으로 암호화 저장

# 증거 3: TLS 설정 확인 (전송 암호화)
openssl s_client -connect api-gateway.example.go.kr:443 2>/dev/null | \
  grep "Protocol\|Cipher"
# Protocol: TLSv1.3   <- CSAP D-09: TLS 1.3+ 필수

# 증거 수집 스크립트 (CSAP 심사 대비)
cat > /tmp/csap-d09-evidence.json <<EOF
{
  "csap_item": "D-09",
  "evidence_date": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "storage_encryption": {
    "method": "AES-256",
    "target": "etcd",
    "provider": "k3s built-in encryption"
  },
  "transit_encryption": {
    "protocol": "TLS 1.3",
    "cipher": "TLS_AES_256_GCM_SHA384"
  },
  "key_management": {
    "tool": "HashiCorp Vault",
    "rotation_period_days": 90,
    "distribution": "External Secrets Operator"
  },
  "secret_hardcoding": {
    "prevention": "pre-commit hook + Q-Gate G5",
    "scan_tool": "truffleHog + custom patterns"
  }
}
EOF
```

### 7.5 감사 로그 보존 정책

`platform/services/security-service/src/lib/audit.ts`에서 볼 수 있듯이, 이 프로젝트는 `@public-saas/audit-sdk`의 `createAuditLogger`를 사용하여 모든 보안 이벤트를 기록합니다.

```typescript
// platform/services/security-service/src/lib/audit.ts (실제 코드)
// Design Ref: DESIGN-MTU-P15
// CSAP: D-06

const auditLogger = createAuditLogger({
  serviceName: 'security-service',
  transport: createStandardTransport('security-service'),
});

export async function logSecurityEvent(
  action: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await auditLogger.log({
    actor: 'system:security-service',
    action,
    target: 'security',
    targetType: 'security',
    tenantId: 'system',
    ip: process.env.SERVICE_IP || '127.0.0.1',
    userAgent: 'security-service/1.0',
    metadata,
  });
}
```

CSAP D-06 요건에 따라:
- **보존 기간**: 최소 1년 (values.yaml: `csap.auditRetentionDays: 365`)
- **무결성**: append-only 구조, 수정/삭제 불가
- **접근 통제**: 감사 로그 조회는 감사 담당자 역할(`audit:read` 권한)만 가능
- **백업**: 30일 주기 오프사이트 백업

### 7.6 CSAP D-09 준수 자동 검증 워크플로우

`.gitea/workflows/csap-evidence.yml`을 활용하여 CSAP D-09 암호화 요건 충족 여부를 자동 수집합니다.

```yaml
# .gitea/workflows/csap-evidence.yml 활용 예
- name: D-09 암호화 증거 수집
  run: |
    # etcd 암호화 설정 확인
    kubectl get secret -n saas-production -o yaml | \
      grep -c "type: Opaque" > /tmp/d09-secret-count.txt

    # TLS 버전 확인
    echo | openssl s_client -connect api.example.go.kr:443 2>/dev/null | \
      grep "Protocol" > /tmp/d09-tls-version.txt

    # Vault 감사 로그 마지막 24시간 통계
    AUDIT_COUNT=$(wc -l < /vault/audit/audit.log)
    echo "Vault 감사 로그 엔트리 수: $AUDIT_COUNT" > /tmp/d09-vault-audit.txt

    # 증거 파일 아카이브
    tar czf csap-d09-evidence-$(date +%Y%m%d).tar.gz \
      /tmp/d09-*.txt
```

### 7.7 시크릿 접근 정기 리뷰

분기별로 시크릿 접근 권한을 재검토합니다. Vault 정책이 최소 권한 원칙을 유지하는지 확인합니다.

```bash
# 현재 Vault 정책 목록
vault policy list

# 각 서비스 정책 내용 확인
for policy in auth-service security-service ai-service user-service; do
  echo "=== $policy 정책 ==="
  vault policy read $policy
  echo ""
done

# 실제 접근 패턴과 정책 비교 (지난 30일)
cat /vault/audit/audit.log | \
  jq -c 'select(.time >= "2026-03-13") | {actor: .auth.display_name, path: .request.path}' | \
  sort | uniq -c | sort -rn | head -20
```

**불필요한 접근 권한 탐지 체크리스트**:

| 점검 항목 | 기준 | 조치 |
|---------|------|------|
| 퇴사자 Vault 계정 | 즉시 폐기 | vault token revoke |
| 3개월 이상 미사용 경로 | 정책에서 제거 | vault policy write |
| 서비스 계정이 다른 서비스 경로 접근 | 즉시 차단 | deny 정책 추가 |
| 임시 개발 자격증명 잔존 | 폐기 | vault kv delete |

### 7.8 멀티 테넌트 시크릿 격리

공공기관 SaaS는 여러 공공기관(테넌트)이 같은 플랫폼을 사용합니다. 테넌트 간 시크릿 격리가 핵심입니다.

```bash
# 테넌트별 Vault 네임스페이스 구조
# (Vault Enterprise 또는 KV 경로 기반 격리)
# saas/secrets/tenants/tenant-a/  ← tenant-a 전용
# saas/secrets/tenants/tenant-b/  ← tenant-b 전용
# saas/secrets/shared/            ← 공유 (민감 정보 없음)

# 테넌트 격리 정책 예시
cat > /tmp/tenant-a-policy.hcl <<'EOF'
# tenant-a 서비스는 자신의 테넌트 경로만 접근 가능
path "saas/secrets/data/tenants/tenant-a/*" {
  capabilities = ["read"]
}

# 다른 테넌트 접근 명시적 거부
path "saas/secrets/data/tenants/tenant-b/*" {
  capabilities = ["deny"]
}

# 공유 영역 읽기 허용
path "saas/secrets/data/shared/*" {
  capabilities = ["read"]
}
EOF

vault policy write tenant-a-service /tmp/tenant-a-policy.hcl
```

### 7.8.1 테넌트 시크릿 격리 검증

테넌트 간 격리가 실제로 동작하는지 주기적으로 검증합니다.

```bash
# tenant-a 역할로 tenant-b 경로 접근 시도 (거부되어야 함)
TENANT_A_TOKEN=$(vault token create \
  -policy=tenant-a-service \
  -ttl=5m \
  -format=json | jq -r '.auth.client_token')

# 이 명령은 403 Forbidden이 정상 결과
VAULT_TOKEN=$TENANT_A_TOKEN vault kv get saas/secrets/tenants/tenant-b/db-password
# Error reading saas/secrets/data/tenants/tenant-b/db-password:
# Error making API request.
# * 1 error occurred:
#   * permission denied  ← 정상: 격리 동작 확인

echo "[OK] 테넌트 격리 검증 통과"

# 격리 실패 시 즉시 플랫폼 팀에 에스컬레이션 필요 (CSAP D-08 위반)
```

### 7.10 Vault 고가용성 구성

운영 환경에서는 Vault를 HA(High Availability) 모드로 구성합니다. k3s 환경에서는 Vault Helm 차트를 사용하여 3개 레플리카로 배포합니다.

```yaml
# helm install vault hashicorp/vault -f vault-values.yaml
# vault-values.yaml (핵심 설정)
server:
  ha:
    enabled: true
    replicas: 3
    raft:
      enabled: true         # Raft 합의 알고리즘 (내장 스토리지)
      setNodeId: true

  # 자동 Unseal (AWS KMS 미사용 환경에서는 수동 또는 Transit Auto-Unseal)
  # 이 프로젝트는 k3s on-premise이므로 수동 Unseal 또는 별도 Vault를 Transit으로 사용
  extraEnvironmentVars:
    VAULT_ADDR: "http://0.0.0.0:8200"

  affinity: |
    podAntiAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
        - labelSelector:
            matchLabels:
              app.kubernetes.io/name: vault
          topologyKey: kubernetes.io/hostname
    # 각 노드에 하나씩 배치 (CSAP D-07 재해복구)

ui:
  enabled: true             # Vault UI 활성화 (관리자 접근)
```

```bash
# Vault 클러스터 상태 확인
kubectl exec vault-0 -n vault-system -- vault status
# Initialized     true
# Sealed          false      ← Unsealed 상태여야 정상
# Total Shares    5
# Threshold       3          ← 3/5 키로 Unseal
# Version         1.16.x
# HA Enabled      true
# HA Cluster      https://vault-0.vault-internal:8201
# HA Mode         active     ← vault-0이 리더

# 팔로워 상태 확인
kubectl exec vault-1 -n vault-system -- vault status | grep "HA Mode"
# HA Mode  standby            ← 리더 장애 시 자동 승격
```

### 7.9 시크릿 관리 운영 체크리스트

매월 수행하는 시크릿 관리 정기 점검 목록:

```markdown
## 월간 시크릿 관리 체크리스트

### 자동화 상태 확인
- [ ] ESO 컨트롤러 정상 동작 여부 (`kubectl get pods -n external-secrets`)
- [ ] 모든 ExternalSecret 상태가 SecretSynced=True인지 확인
- [ ] Vault 가용성 (`vault status`)
- [ ] Vault 감사 로그 적재 정상 여부

### 만료 임박 확인
- [ ] 90일 로테이션 대상 JWT 키 확인 (다음 로테이션: 변경일 + 90일)
- [ ] Vault 토큰 TTL 확인
- [ ] TLS 인증서 만료일 확인 (60일 전 갱신)
- [ ] Cosign 서명 키 유효성 확인

### 접근 감사
- [ ] 비정상 접근 패턴 없는지 Vault 감사 로그 검토
- [ ] 신규 팀원 시크릿 접근 권한 적절성 확인
- [ ] 퇴사자 자격증명 폐기 완료 여부

### CSAP 증거 수집
- [ ] D-09 암호화 설정 스크린샷/로그 보관
- [ ] 이번 달 시크릿 로테이션 기록 audit.jsonl에 저장
- [ ] 시크릿 커밋 시도 차단 건수 기록 (pre-commit 로그)
```

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|-------|
| 1.0.0 | 2026-04-13 | 최초 작성 — 시크릿 관리 완전 가이드 (온보딩 Iteration 21-B) | Implementer Agent |
