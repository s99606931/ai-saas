# 13. HashiCorp Vault 심화 가이드

> 대상 독자: 공공기관 SaaS 프레임워크 개발자 (초급~중급)
> 선행 지식: `10-secret-management-guide.md` 완독
> CSAP 연관 통제: D-09 암호화, D-06 감사 로깅, D-08 접근 통제
> 최종 수정: 2026-04-13

---

## 목차

1. [Vault 심화란?](#1-vault-심화란)
2. [KV v2 엔진 심화](#2-kv-v2-엔진-심화)
3. [Database Engine — 동적 시크릿](#3-database-engine--동적-시크릿)
4. [PKI — 인증서 자동화](#4-pki--인증서-자동화)
5. [Vault Agent Sidecar](#5-vault-agent-sidecar)
6. [AppRole 인증](#6-approle-인증)
7. [Vault 감사 로그 (CSAP D-06)](#7-vault-감사-로그-csap-d-06)
8. [침해 대응 — 시크릿 누출 시 절차](#8-침해-대응--시크릿-누출-시-절차)
9. [실습: ai-service Dynamic DB 크리덴셜 적용](#9-실습-ai-service-dynamic-db-크리덴셜-적용)

---

## 1. Vault 심화란?

### 1.1 입문자를 위한 비유

Vault를 처음 접하면 "비밀번호를 저장하는 곳"으로 이해합니다. 맞습니다. 그런데 Vault의 진짜 강력함은 **비밀번호를 직접 저장하지 않고 필요할 때만 생성**하는 데 있습니다.

일반 회사 열쇠 시스템을 생각해 보십시오.

- **정적 시크릿 방식**: 모든 직원에게 동일한 마스터 키를 복사해서 줍니다. 키를 잃어버리면 건물 전체의 자물쇠를 교체해야 합니다.
- **동적 시크릿 방식**: 직원이 필요할 때 경비실에 요청하면 그 직원 전용 임시 키가 발급됩니다. 키는 8시간 후 자동 만료됩니다. 키를 잃어버려도 8시간만 기다리면 됩니다.

Vault의 Dynamic Secrets가 바로 이 개념입니다.

### 1.2 정적 시크릿 vs 동적 시크릿

| 구분 | 정적 시크릿 (KV 엔진) | 동적 시크릿 (Database/PKI 엔진) |
|------|----------------------|-------------------------------|
| 생성 시점 | 관리자가 미리 생성 | 애플리케이션 요청 시 즉시 생성 |
| 수명 | 무기한 (수동 갱신) | TTL 기반 자동 만료 |
| 공유 여부 | 여러 인스턴스가 동일 크리덴셜 공유 | Pod별 고유 크리덴셜 |
| 유출 피해 | 전체 서비스 영향 | 해당 Pod만 영향, 자동 만료 |
| CSAP 적합성 | 기본 요건 충족 | D-09 고급 요건 충족 |
| 감사 추적 | "누가 사용했나" 파악 어려움 | Pod별 크리덴셜로 정확한 추적 |

### 1.3 왜 동적 시크릿이 더 안전한가

공공기관 SaaS 환경에서 동적 시크릿이 중요한 이유를 구체적으로 설명합니다.

**시나리오**: ai-service Pod가 PostgreSQL에 접속해야 합니다.

정적 방식에서는 `ai_service_user` / `password123!`가 KV에 저장되고, 모든 ai-service Pod 10개가 이 동일한 크리덴셜을 사용합니다. 만약 Pod 중 하나가 해킹당하면 공격자는 이 크리덴셜로 영구적으로 DB에 접속할 수 있습니다.

동적 방식에서는 각 Pod가 시작할 때 Vault에 요청하여 `v-k8s-ai-service-xK7mN2pQ`와 같은 고유 사용자와 임시 비밀번호를 받습니다. 이 크리덴셜은 1시간 후 자동으로 PostgreSQL에서 삭제됩니다. 해킹당한 Pod의 크리덴셜은 최대 1시간만 유효합니다.

---

## 2. KV v2 엔진 심화

KV(Key-Value) v2 엔진은 가장 기본적인 Vault 엔진입니다. 버전 관리, 메타데이터, 낙관적 잠금 기능을 제공합니다.

### 2.1 KV v1 vs KV v2 차이점

KV v1은 단순 키-값 저장소입니다. 덮어쓰면 이전 값은 사라집니다.

KV v2는 버전 관리를 지원합니다. 이전 버전을 조회하고 롤백할 수 있습니다.

```bash
# KV v2 엔진 활성화
vault secrets enable -path=saas-secrets kv-v2

# 시크릿 저장 (버전 1 생성)
vault kv put saas-secrets/ai-service/database \
  host="postgres.saas.svc.cluster.local" \
  port="5432" \
  dbname="aidb" \
  username="ai_service" \
  password="$(openssl rand -base64 32)"

# 버전 2 저장 (새 비밀번호로 갱신)
vault kv put saas-secrets/ai-service/database \
  host="postgres.saas.svc.cluster.local" \
  port="5432" \
  dbname="aidb" \
  username="ai_service" \
  password="$(openssl rand -base64 32)"

# 현재 버전 조회
vault kv get saas-secrets/ai-service/database

# 버전 1 조회 (이전 버전)
vault kv get -version=1 saas-secrets/ai-service/database

# 버전 목록 조회
vault kv metadata get saas-secrets/ai-service/database
```

### 2.2 버전 관리 및 롤백

```bash
# 특정 버전으로 롤백 (v2를 삭제하고 v1을 최신으로)
vault kv rollback -version=1 saas-secrets/ai-service/database

# 특정 버전 영구 삭제 (복구 불가)
vault kv destroy -versions=2 saas-secrets/ai-service/database

# 소프트 삭제 (복구 가능)
vault kv delete -versions=2 saas-secrets/ai-service/database

# 소프트 삭제 복구
vault kv undelete -versions=2 saas-secrets/ai-service/database
```

실제 운영에서는 버전을 무한정 보관하면 스토리지가 소모됩니다. 최대 버전 수를 설정합니다.

```bash
# 최대 10개 버전만 보관하도록 설정
vault write saas-secrets/config max_versions=10

# 특정 경로만 설정
vault kv metadata put \
  -max-versions 5 \
  saas-secrets/ai-service/database
```

### 2.3 메타데이터 태깅 (N2SF 데이터 등급)

N2SF 규정에 따라 모든 시크릿에 데이터 등급을 태깅합니다. 이렇게 하면 감사 시 "이 시크릿은 어떤 등급 데이터인가"를 바로 확인할 수 있습니다.

```bash
# N2SF 등급 메타데이터 태깅
vault kv metadata put \
  -custom-metadata "n2sf-grade=O" \
  -custom-metadata "service=ai-service" \
  -custom-metadata "owner=platform-team" \
  -custom-metadata "review-date=2026-10-01" \
  -custom-metadata "csap-control=D-09" \
  saas-secrets/ai-service/database

# 메타데이터 조회
vault kv metadata get saas-secrets/ai-service/database
```

출력 예시:

```
Key                     Value
---                     -----
cas_required            false
created_time            2026-04-13T09:00:00.000Z
current_version         2
custom_metadata         map[csap-control:D-09 n2sf-grade:O owner:platform-team review-date:2026-10-01 service:ai-service]
delete_version_after    0s
max_versions            10
oldest_version          1
updated_time            2026-04-13T10:00:00.000Z
```

N2SF C/S 등급 시크릿은 Vault에 저장은 허용되나, 애플리케이션이 AI API에 전달하는 것은 절대 금지입니다. 메타데이터의 `n2sf-grade` 필드로 자동 검사가 가능합니다.

### 2.4 Check-and-Set (CAS) — 낙관적 잠금

여러 프로세스가 동시에 동일한 시크릿을 갱신하면 경쟁 조건이 발생합니다. CAS(Check-and-Set)는 이를 방지합니다.

CAS란 "내가 알고 있는 버전이 현재 버전과 같을 때만 저장하라"는 명령입니다.

```bash
# CAS 필수 설정 (이후 모든 쓰기는 버전 번호 필요)
vault kv metadata put \
  -cas-required=true \
  saas-secrets/ai-service/critical-config

# CAS로 저장 (현재 버전이 3인 경우)
vault kv put -cas=3 saas-secrets/ai-service/critical-config \
  api-key="new-value"

# 버전이 맞지 않으면 오류 발생:
# Error writing data to saas-secrets/data/ai-service/critical-config:
# Error making API request.
# * check-and-set parameter did not match the current version
```

TypeScript에서 CAS를 사용하는 방법입니다.

```typescript
// CSAP D-09 준수 — 낙관적 잠금으로 시크릿 갱신
// Design Ref: §2.4 CAS 낙관적 잠금
import { NodeVault } from 'node-vault';

interface SecretMetadata {
  current_version: number;
  cas_required: boolean;
}

async function updateSecretWithCAS(
  vault: NodeVault.client,
  path: string,
  newData: Record<string, string>,
): Promise<void> {
  // 1. 현재 메타데이터에서 버전 조회
  const meta = await vault.read(`saas-secrets/metadata/${path}`) as { data: SecretMetadata };
  const currentVersion = meta.data.current_version;

  // 2. CAS를 이용한 조건부 저장
  await vault.write(`saas-secrets/data/${path}`, {
    options: { cas: currentVersion },
    data: newData,
  });
}
```

---

## 3. Database Engine — 동적 시크릿

Database Engine은 Vault의 핵심 기능입니다. PostgreSQL에 접속하여 요청 시마다 임시 사용자를 생성하고, TTL이 만료되면 자동으로 삭제합니다.

### 3.1 Database Engine 활성화

```bash
# Database 시크릿 엔진 활성화
vault secrets enable database

# PostgreSQL 연결 설정 (CNPG 클러스터 대상)
vault write database/config/saas-postgres \
  plugin_name="postgresql-database-plugin" \
  connection_url="postgresql://{{username}}:{{password}}@cnpg-cluster-rw.database.svc.cluster.local:5432/saasdb?sslmode=require" \
  allowed_roles="ai-service-role,compliance-role,security-role" \
  username="vault_admin" \
  password="${VAULT_POSTGRES_ADMIN_PASSWORD}" \
  password_authentication="scram-sha-256"

# 연결 테스트
vault write -force database/rotate-root/saas-postgres
```

`vault_admin` 사용자는 PostgreSQL에서 미리 생성해야 합니다.

```sql
-- PostgreSQL에서 Vault 관리자 계정 생성
CREATE USER vault_admin WITH PASSWORD 'strong-password-from-vault';

-- Vault가 사용자를 생성/삭제할 수 있도록 권한 부여
GRANT CREATE ON DATABASE saasdb TO vault_admin;
GRANT USAGE ON SCHEMA public TO vault_admin;
GRANT CREATE ON SCHEMA public TO vault_admin;

-- Vault가 부여할 권한의 권한자가 되도록 설정
ALTER ROLE vault_admin CREATEROLE;
```

### 3.2 역할(Role) 생성 및 TTL 설정

Vault에서 "역할"은 "어떤 권한을 가진 임시 사용자를 어떻게 만들까"를 정의합니다.

```bash
# ai-service 전용 역할 생성
# TTL: 1시간 (임시 크리덴셜 유효 시간)
# Max TTL: 4시간 (갱신 포함 최대 시간)
vault write database/roles/ai-service-role \
  db_name="saas-postgres" \
  creation_statements="
    CREATE ROLE \"{{name}}\" WITH LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}';
    GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA ai TO \"{{name}}\";
    GRANT USAGE ON ALL SEQUENCES IN SCHEMA ai TO \"{{name}}\";
  " \
  revocation_statements="
    REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA ai FROM \"{{name}}\";
    DROP ROLE IF EXISTS \"{{name}}\";
  " \
  default_ttl="1h" \
  max_ttl="4h"

# compliance-service 역할 (읽기 전용)
vault write database/roles/compliance-role \
  db_name="saas-postgres" \
  creation_statements="
    CREATE ROLE \"{{name}}\" WITH LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}';
    GRANT SELECT ON ALL TABLES IN SCHEMA public TO \"{{name}}\";
    GRANT SELECT ON ALL TABLES IN SCHEMA audit TO \"{{name}}\";
  " \
  revocation_statements="
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM \"{{name}}\";
    REVOKE ALL ON ALL TABLES IN SCHEMA audit FROM \"{{name}}\";
    DROP ROLE IF EXISTS \"{{name}}\";
  " \
  default_ttl="30m" \
  max_ttl="2h"
```

### 3.3 동적 크리덴셜 발급 및 임대(Lease) 관리

```bash
# ai-service용 임시 크리덴셜 발급
vault read database/creds/ai-service-role
```

발급 결과 예시:

```
Key                Value
---                -----
lease_id           database/creds/ai-service-role/AbCdEfGhIjKlMnOpQrStUvWx
lease_duration     1h
lease_renewable    true
password           A1b2C3d4E5f6G7h8I9j0K1l2
username           v-k8s-ai-service-xK7mN2pQrS1
```

`username`은 매번 고유하게 생성됩니다. 이 사용자는 1시간 후 PostgreSQL에서 자동 삭제됩니다.

```bash
# 임대 갱신 (만료 전에 갱신하지 않으면 접속 불가)
vault lease renew database/creds/ai-service-role/AbCdEfGhIjKlMnOpQrStUvWx

# 임대 갱신 시 TTL 연장 (최대 max_ttl까지)
vault lease renew -increment=2h \
  database/creds/ai-service-role/AbCdEfGhIjKlMnOpQrStUvWx

# 임대 강제 해지 (크리덴셜 즉시 무효화)
vault lease revoke database/creds/ai-service-role/AbCdEfGhIjKlMnOpQrStUvWx

# 특정 역할의 모든 임대 해지 (침해사고 대응)
vault lease revoke -prefix database/creds/ai-service-role/
```

임대 갱신을 자동화하려면 Vault Agent를 사용합니다 (5절 참조).

---

## 4. PKI — 인증서 자동화

PKI(Public Key Infrastructure) 엔진은 TLS 인증서를 자동으로 발급합니다. 이를 통해 Linkerd mTLS(상호 TLS)와 서비스 간 암호화 통신을 자동화합니다.

### 4.1 CA 계층 구조

공공기관 SaaS 프레임워크는 3계층 CA 구조를 사용합니다.

```
루트 CA (오프라인, HSM 보관)
  └── 중간 CA (Vault PKI 엔진 관리)
        ├── ai-service TLS 인증서
        ├── compliance-service TLS 인증서
        ├── security-service TLS 인증서
        └── Linkerd mTLS 인증서
```

루트 CA는 오프라인 상태로 보관합니다. 중간 CA에 서명만 할 때 꺼냅니다. 이는 루트 CA가 침해되는 최악의 시나리오를 방지합니다.

### 4.2 Vault PKI 엔진 설정

```bash
# PKI 엔진 활성화 (중간 CA용)
vault secrets enable -path=pki pki

# 최대 인증서 유효기간 설정 (CSAP D-09 권고: 1년 이하)
vault secrets tune -max-lease-ttl=8760h pki

# 중간 CA CSR(인증서 서명 요청) 생성
vault write -format=json pki/intermediate/generate/internal \
  common_name="SaaS Platform Intermediate CA" \
  organization="공공기관 SaaS 플랫폼" \
  country="KR" \
  key_type="ec" \
  key_bits=384 \
  | jq -r '.data.csr' > /tmp/intermediate-ca.csr

# 루트 CA로 CSR에 서명 (오프라인 루트 CA 사용)
# 이 단계는 보안 담당자가 오프라인 환경에서 수행
openssl ca -config /secure/root-ca.conf \
  -in /tmp/intermediate-ca.csr \
  -out /tmp/intermediate-ca.crt \
  -days 1825  # 5년

# 서명된 중간 CA 인증서를 Vault에 업로드
vault write pki/intermediate/set-signed \
  certificate=@/tmp/intermediate-ca.crt

# 인증서 발급 역할 생성 (서비스별)
vault write pki/roles/ai-service \
  allowed_domains="ai-service.saas.svc.cluster.local,ai-service.platform.svc.cluster.local" \
  allow_subdomains=false \
  allow_bare_domains=true \
  max_ttl="72h" \
  key_type="ec" \
  key_bits=256 \
  require_cn=true

# 인증서 발급 테스트
vault write pki/issue/ai-service \
  common_name="ai-service.saas.svc.cluster.local"
```

### 4.3 cert-manager Vault Issuer 통합

Kubernetes에서 cert-manager가 자동으로 Vault에서 인증서를 발급받도록 설정합니다.

```yaml
# Vault ClusterIssuer 설정
# /data/ai-saas/platform/k8s/vault/cluster-issuer.yaml
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: vault-issuer
  namespace: cert-manager
spec:
  vault:
    server: https://vault.vault.svc.cluster.local:8200
    path: pki/sign/ai-service
    caBundle: |  # Vault TLS CA 인증서 (base64)
      LS0tLS1CRUdJTi...
    auth:
      kubernetes:
        mountPath: /v1/auth/kubernetes
        role: cert-manager
        secretRef:
          name: vault-cert-manager-sa-token
          key: token
---
# 서비스 인증서 요청
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: ai-service-tls
  namespace: saas
spec:
  secretName: ai-service-tls-secret
  issuerRef:
    name: vault-issuer
    kind: ClusterIssuer
  commonName: ai-service.saas.svc.cluster.local
  dnsNames:
    - ai-service.saas.svc.cluster.local
    - ai-service.platform.svc.cluster.local
  duration: 72h       # 3일 유효
  renewBefore: 24h    # 만료 24시간 전 갱신
  privateKey:
    algorithm: ECDSA
    size: 256
```

### 4.4 Linkerd mTLS 인증서 자동 갱신

Linkerd는 서비스 메시에서 모든 Pod 간 통신을 mTLS로 암호화합니다. 인증서는 24시간마다 자동 갱신되어야 합니다.

```bash
# Linkerd trust anchor (루트 CA) 설정
kubectl create secret tls linkerd-trust-anchor \
  --cert=/tmp/linkerd-root-ca.crt \
  --key=/tmp/linkerd-root-ca.key \
  --namespace=linkerd

# Linkerd issuer 인증서 (cert-manager가 Vault에서 자동 발급)
kubectl apply -f - <<EOF
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: linkerd-identity-issuer
  namespace: linkerd
spec:
  secretName: linkerd-identity-issuer
  issuerRef:
    name: vault-issuer
    kind: ClusterIssuer
  commonName: identity.linkerd.cluster.local
  isCA: true
  duration: 48h
  renewBefore: 12h
  privateKey:
    algorithm: ECDSA
  usages:
    - cert sign
    - crl sign
    - server auth
    - client auth
EOF
```

---

## 5. Vault Agent Sidecar

Vault Agent Sidecar는 애플리케이션 코드를 수정하지 않고도 시크릿을 자동으로 주입하는 도구입니다. Kubernetes에서 Pod에 사이드카 컨테이너로 주입됩니다.

### 5.1 동작 원리 다이어그램

```mermaid
flowchart TD
    A([Pod 생성 요청]) --> B{Vault Agent Injector<br/>Webhook 감지}
    B -- 어노테이션 없음 --> C[일반 Pod 시작]
    B -- vault.hashicorp.com/agent-inject: true --> D[Init Container 주입]

    D --> E[Vault Agent Init Container 시작]
    E --> F{Kubernetes 서비스 계정\n토큰으로 Vault 인증}
    F -- 인증 성공 --> G[시크릿 렌더링\n/vault/secrets/db.env]
    F -- 인증 실패 --> H[Pod 시작 실패\nCrashLoopBackOff]

    G --> I[Init Container 완료]
    I --> J[애플리케이션 컨테이너 시작]
    J --> K[환경 변수 또는 파일로\n시크릿 읽기]

    K --> L[Vault Agent Sidecar 실행 중]
    L --> M{TTL 만료 감지}
    M -- TTL 75% 경과 --> N[Vault에 갱신 요청]
    N --> O[시크릿 파일 자동 갱신]
    O --> L

    M -- 갱신 실패 --> P[알림 전송 후 재시도]
    P --> L

    style A fill:#e8f5e9
    style C fill:#f5f5f5
    style H fill:#ffebee
    style K fill:#e3f2fd
    style O fill:#e8f5e9
```

### 5.2 Vault Agent Injector 설치

```bash
# Helm으로 Vault 설치 (Agent Injector 포함)
helm repo add hashicorp https://helm.releases.hashicorp.com
helm repo update

helm install vault hashicorp/vault \
  --namespace vault \
  --create-namespace \
  --set "injector.enabled=true" \
  --set "server.ha.enabled=true" \
  --set "server.ha.replicas=3" \
  --set "injector.image.tag=1.4.0" \
  -f /data/ai-saas/platform/k8s/vault/values.yaml
```

### 5.3 ai-service에 Sidecar 적용

ai-service의 Kubernetes Deployment에 어노테이션을 추가하면 Vault Agent가 자동으로 주입됩니다.

```yaml
# /data/ai-saas/platform/k8s/ai-service/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ai-service
  namespace: saas
spec:
  replicas: 3
  selector:
    matchLabels:
      app: ai-service
  template:
    metadata:
      labels:
        app: ai-service
      annotations:
        # Vault Agent Sidecar 활성화
        vault.hashicorp.com/agent-inject: "true"
        vault.hashicorp.com/role: "ai-service"

        # KV 시크릿 주입 (정적 설정값)
        vault.hashicorp.com/agent-inject-secret-config: "saas-secrets/data/ai-service/config"
        vault.hashicorp.com/agent-inject-template-config: |
          {{- with secret "saas-secrets/data/ai-service/config" -}}
          INTERNAL_SERVICE_KEY={{ .Data.data.internal_service_key }}
          AI_GATEWAY_URL={{ .Data.data.ai_gateway_url }}
          REDIS_URL={{ .Data.data.redis_url }}
          {{- end }}

        # Database Dynamic Secret 주입 (동적 크리덴셜)
        vault.hashicorp.com/agent-inject-secret-db-creds: "database/creds/ai-service-role"
        vault.hashicorp.com/agent-inject-template-db-creds: |
          {{- with secret "database/creds/ai-service-role" -}}
          DATABASE_URL=postgresql://{{ .Data.username }}:{{ .Data.password }}@cnpg-cluster-rw.database.svc.cluster.local:5432/aidb?sslmode=require
          {{- end }}

        # 파일 권한 설정 (비밀 파일은 600으로 제한)
        vault.hashicorp.com/secret-volume-path: "/vault/secrets"
        vault.hashicorp.com/agent-inject-file-config: "config.env"
        vault.hashicorp.com/agent-inject-file-db-creds: "db.env"

        # 갱신 설정
        vault.hashicorp.com/agent-cache-enable: "true"
        vault.hashicorp.com/agent-revoke-on-shutdown: "true"

    spec:
      serviceAccountName: ai-service-sa
      containers:
        - name: ai-service
          image: saas/ai-service:latest
          command:
            - /bin/sh
            - -c
            # 환경 변수 파일 로드 후 앱 시작
            - |
              set -a
              source /vault/secrets/config.env
              source /vault/secrets/db.env
              set +a
              exec node dist/main.js
          ports:
            - containerPort: 3000
          readinessProbe:
            httpGet:
              path: /ready
              port: 3000
            initialDelaySeconds: 15
            periodSeconds: 10
```

### 5.4 파일 기반 시크릿 마운트

환경 변수 대신 파일로 시크릿을 마운트하면 더 안전합니다. 환경 변수는 프로세스 목록에서 보일 수 있지만 파일은 접근 권한으로 제어됩니다.

```typescript
// Design Ref: §5.4 파일 기반 시크릿 마운트
// 파일에서 DATABASE_URL을 읽는 TypeScript 코드
import { readFileSync } from 'fs';
import * as dotenv from 'dotenv';

function loadVaultSecrets(): void {
  const secretPaths = [
    '/vault/secrets/config.env',
    '/vault/secrets/db.env',
  ];

  for (const secretPath of secretPaths) {
    try {
      const content = readFileSync(secretPath, 'utf-8');
      const parsed = dotenv.parse(content);
      Object.assign(process.env, parsed);
    } catch (error) {
      // 프로덕션에서는 시크릿 파일 필수
      if (process.env['NODE_ENV'] === 'production') {
        throw new Error(`[SECURITY] Vault 시크릿 파일 읽기 실패: ${secretPath}`);
      }
      // 개발 환경에서는 .env 폴백 허용
      console.warn(`[DEV] Vault 시크릿 없음, .env 파일 사용: ${secretPath}`);
    }
  }
}

// 앱 시작 전 시크릿 로드
loadVaultSecrets();
```

### 5.5 갱신 자동화 (Lease Renewal)

Vault Agent는 TTL의 2/3 시점에 자동으로 갱신을 시도합니다. 갱신이 실패하면 앱이 스스로 감지하고 재연결해야 합니다.

```typescript
// Design Ref: §5.5 동적 크리덴셜 갱신 감지
// Prisma 클라이언트가 크리덴셜 갱신 후 재연결

import { PrismaClient } from '@prisma/client';
import { watch } from 'fs';

let prisma: PrismaClient;

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    datasources: {
      db: {
        // DATABASE_URL은 Vault Agent가 파일에 갱신
        url: process.env['DATABASE_URL'],
      },
    },
    log: ['error'],
  });
}

// Vault Agent가 /vault/secrets/db.env를 갱신하면 Prisma 재연결
watch('/vault/secrets/db.env', async (eventType) => {
  if (eventType === 'change') {
    console.log('[VAULT] DB 크리덴셜 갱신 감지, Prisma 재연결...');

    // 1. 환경 변수 재로드
    const dotenv = await import('dotenv');
    const { readFileSync } = await import('fs');
    const content = readFileSync('/vault/secrets/db.env', 'utf-8');
    const parsed = dotenv.parse(content);
    process.env['DATABASE_URL'] = parsed['DATABASE_URL'];

    // 2. 기존 연결 종료
    await prisma.$disconnect();

    // 3. 새 크리덴셜로 재연결
    prisma = createPrismaClient();
    await prisma.$connect();
    console.log('[VAULT] Prisma 재연결 완료');
  }
});

prisma = createPrismaClient();
export { prisma };
```

---

## 6. AppRole 인증

AppRole은 애플리케이션이 Vault에 인증하는 방법입니다. Kubernetes 환경이 아닌 외부 서비스나 CI/CD 파이프라인에서 사용합니다.

### 6.1 AppRole 개념

AppRole 인증은 두 가지 비밀로 구성됩니다.

- **RoleID**: 누가 접속하는지 나타내는 공개 식별자 (아이디에 해당)
- **SecretID**: 일회성 비밀번호 (패스워드에 해당, 사용 횟수/시간 제한)

이 두 가지를 모두 알아야 Vault 토큰을 발급받을 수 있습니다. RoleID만 탈취해도 SecretID 없이는 접속 불가합니다.

### 6.2 AppRole 설정

```bash
# AppRole 인증 활성화
vault auth enable approle

# Gitea CI/CD용 AppRole 생성
vault write auth/approle/role/gitea-ci \
  token_policies="gitea-ci-policy" \
  secret_id_ttl="30m" \  # SecretID는 30분만 유효
  token_ttl="1h" \
  token_max_ttl="4h" \
  secret_id_num_uses=1 \  # SecretID는 1회만 사용 가능
  bind_secret_id=true

# 정책 생성 (CI/CD가 접근 가능한 경로 제한)
vault policy write gitea-ci-policy - <<EOF
path "saas-secrets/data/cicd/*" {
  capabilities = ["read"]
}
path "pki/issue/ci-tls" {
  capabilities = ["create", "update"]
}
EOF

# RoleID 조회 (고정값, 공개 가능)
vault read auth/approle/role/gitea-ci/role-id
# role_id: a1b2c3d4-e5f6-7890-abcd-ef1234567890

# SecretID 발급 (동적, 30분 유효)
vault write -f auth/approle/role/gitea-ci/secret-id
# secret_id: s.AbCdEfGhIjKlMnOpQrStUv
```

### 6.3 응답 래핑 (Response Wrapping)

SecretID를 직접 전달하면 네트워크에서 노출될 수 있습니다. 응답 래핑은 SecretID 대신 "래핑 토큰"을 전달하고, 수신자가 이 토큰을 한 번만 언래핑(풀기)할 수 있게 합니다.

```bash
# SecretID를 응답 래핑으로 발급 (5분 유효 래핑 토큰 생성)
vault write -wrap-ttl=5m -f auth/approle/role/gitea-ci/secret-id

# 출력:
# Key                              Value
# ---                              -----
# wrapping_token:                  s.WrapXxYyZz...  (이것만 전달)
# wrapping_accessor:               ...
# wrapping_token_ttl:              5m
# wrapping_token_creation_time:    2026-04-13T09:00:00Z

# CI/CD 환경에서 래핑 토큰을 언래핑하여 실제 SecretID 획득
vault unwrap s.WrapXxYyZz...

# 언래핑은 1회만 가능. 두 번째 시도 시:
# Error unwrapping: wrapping token is not valid or does not exist
```

Gitea CI/CD 워크플로우에서 AppRole 사용 예시입니다.

```yaml
# .gitea/workflows/csap-evidence.yml (실제 파일 참조)
name: CSAP Evidence Collection

jobs:
  collect-evidence:
    runs-on: ubuntu-latest
    steps:
      - name: Vault 인증 (AppRole + 응답 래핑)
        env:
          VAULT_ADDR: https://vault.vault.svc.cluster.local:8200
          VAULT_ROLE_ID: ${{ secrets.VAULT_ROLE_ID }}
          VAULT_WRAP_TOKEN: ${{ secrets.VAULT_WRAP_TOKEN }}  # 래핑 토큰
        run: |
          # 1. 래핑 토큰으로 SecretID 언래핑 (1회성)
          SECRET_ID=$(vault unwrap -field=secret_id ${VAULT_WRAP_TOKEN})

          # 2. RoleID + SecretID로 Vault 토큰 발급
          VAULT_TOKEN=$(vault write -field=token auth/approle/login \
            role_id=${VAULT_ROLE_ID} \
            secret_id=${SECRET_ID})

          # 3. 시크릿 읽기
          export VAULT_TOKEN
          SIGNING_KEY=$(vault kv get -field=signing_key saas-secrets/cicd/evidence)

          # 메모리에서만 사용, 파일에 저장 금지
          echo "::add-mask::${SIGNING_KEY}"
```

---

## 7. Vault 감사 로그 (CSAP D-06)

CSAP D-06(침해사고 관리) 요건에 따라 모든 Vault 접근은 감사 로그에 기록되어야 합니다.

### 7.1 감사 장치 활성화

```bash
# 파일 기반 감사 로그 활성화
vault audit enable file \
  file_path="/var/log/vault/audit.log" \
  log_raw=false \  # 시크릿 값을 로그에 저장하지 않음 (HMAC 해시로 저장)
  format=jsonl

# syslog 기반 감사 로그 (SIEM 연동)
vault audit enable syslog \
  tag="vault" \
  facility="AUTH"

# 감사 장치 목록 확인
vault audit list -detailed
```

감사 로그 예시 (민감 정보는 HMAC으로 마스킹):

```json
{
  "time": "2026-04-13T09:15:30Z",
  "type": "request",
  "auth": {
    "client_token": "hmac-sha256:a1b2c3...",
    "accessor": "hmac-sha256:d4e5f6...",
    "display_name": "kubernetes-saas/ai-service",
    "policies": ["ai-service-policy"],
    "token_policies": ["ai-service-policy"]
  },
  "request": {
    "id": "req-uuid-1234",
    "operation": "read",
    "path": "database/creds/ai-service-role",
    "remote_address": "10.0.1.42"
  }
}
```

### 7.2 감사 로그 보존 및 SIEM 연동

CSAP D-06은 감사 로그를 최소 1년 보존하고 수정/삭제를 방지하도록 요구합니다.

```bash
# Loki로 Vault 감사 로그 전송 설정
# /data/ai-saas/platform/k8s/vault/fluent-bit-vault.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: fluent-bit-vault-config
  namespace: vault
data:
  fluent-bit.conf: |
    [INPUT]
      Name              tail
      Path              /var/log/vault/audit.log
      Tag               vault.audit
      Multiline         Off
      Refresh_Interval  5

    [FILTER]
      Name    record_modifier
      Match   vault.audit
      Record  source vault
      Record  csap_control D-06
      Record  retention_days 365

    [OUTPUT]
      Name          loki
      Match         vault.audit
      Host          loki.monitoring.svc.cluster.local
      Port          3100
      Labels        job=vault-audit,env=production
      Label_keys    $type,$auth.display_name,$request.operation,$request.path
```

### 7.3 감사 로그 분석 쿼리 (Grafana)

```logql
# Vault 비정상 접근 탐지 (1분에 10회 이상 실패)
sum by (remote_address) (
  rate({job="vault-audit", type="response"} |= "errors" [1m])
) > 10

# 특정 서비스의 시크릿 접근 이력
{job="vault-audit"}
  | json
  | auth_display_name =~ "kubernetes-saas/ai-service"
  | request_operation = "read"
  | line_format "{{.time}} | {{.request_path}} | {{.remote_address}}"
```

---

## 8. 침해 대응 — 시크릿 누출 시 절차

시크릿이 누출된 것이 발견되었을 때의 즉각 대응 절차입니다.

### 8.1 대응 단계

```
1단계: 탐지 (0분)
  - Git 커밋에서 시크릿 발견, 또는 이상 접근 알림 수신

2단계: 격리 (5분 이내)
  - 해당 토큰/크리덴셜 즉시 해지

3단계: 조사 (30분 이내)
  - 감사 로그에서 해당 크리덴셜 사용 이력 조회

4단계: 복구 (1시간 이내)
  - 새 크리덴셜 발급 및 배포

5단계: 보고 (24시간 이내)
  - CSAP D-06 침해사고 보고서 작성
```

### 8.2 긴급 시크릿 해지 명령

```bash
# 1. 특정 Vault 토큰 즉시 해지
vault token revoke s.CompromisedToken123

# 2. AppRole SecretID 특정 Accessor로 해지
vault write auth/approle/role/gitea-ci/secret-id-accessor/destroy \
  secret_id_accessor="abc-def-123"

# 3. 특정 역할의 모든 DB 크리덴셜 즉시 해지 (위험: 해당 서비스 중단)
vault lease revoke -prefix -force database/creds/ai-service-role/

# 4. Vault 루트 토큰 해지 (최후 수단)
vault token revoke -self

# 5. Git 커밋에서 시크릿이 노출된 경우 — Git 히스토리 정리
# (CLAUDE.md 제약: --force 금지이므로 팀장 승인 필요)
git filter-repo --path-glob '*.env' --invert-paths
```

### 8.3 자동 알림 설정

```yaml
# Prometheus AlertManager 규칙
# /data/ai-saas/platform/k8s/monitoring/vault-alerts.yaml
groups:
  - name: vault-security
    rules:
      - alert: VaultAuthFailureSpike
        expr: |
          sum(rate(vault_audit_log_request_total{
            operation="read",
            error!=""
          }[5m])) > 5
        for: 2m
        labels:
          severity: critical
          csap_control: D-06
        annotations:
          summary: "Vault 인증 실패 급증 (침해 시도 의심)"
          description: "5분간 {{ $value }}회 인증 실패. 즉시 확인 필요."
          runbook: "https://wiki.internal/vault-security-runbook"
```

---

## 9. 실습: ai-service Dynamic DB 크리덴셜 적용

이 실습에서는 현재 ai-service가 정적 크리덴셜을 사용하는 것을 동적 크리덴셜로 전환합니다.

### 9.1 현재 상태 확인

ai-service의 실제 코드를 보면 `routes.ts`에서 `INTERNAL_SERVICE_KEY` 환경 변수를 사용합니다.

```typescript
// 실제 코드 (platform/services/ai-service/src/routes.ts 라인 59-61)
const internalKey = process.env['INTERNAL_SERVICE_KEY'];
if (!internalKey && process.env['NODE_ENV'] === 'production') {
  throw new Error('[SECURITY] INTERNAL_SERVICE_KEY 환경변수가 설정되지 않았습니다.');
}
```

현재는 Kubernetes Secret에 정적으로 저장된 `INTERNAL_SERVICE_KEY`를 사용합니다. 이를 Vault Dynamic Secret으로 전환합니다.

### 9.2 Vault Kubernetes 인증 설정

```bash
# Kubernetes 인증 활성화
vault auth enable kubernetes

# Kubernetes API 서버 정보 설정
vault write auth/kubernetes/config \
  kubernetes_host="https://$(kubectl get svc kubernetes -o jsonpath='{.spec.clusterIP}'):443" \
  kubernetes_ca_cert=@/tmp/k8s-ca.crt \
  token_reviewer_jwt="$(kubectl get secret vault-reviewer-token -n vault -o jsonpath='{.data.token}' | base64 -d)"

# ai-service Kubernetes 인증 역할 생성
vault write auth/kubernetes/role/ai-service \
  bound_service_account_names=ai-service-sa \
  bound_service_account_namespaces=saas \
  policies=ai-service-policy \
  ttl=1h

# ServiceAccount 생성
kubectl create serviceaccount ai-service-sa -n saas
```

### 9.3 Vault 정책 작성

```bash
# ai-service 정책 — 필요한 경로만 허용
vault policy write ai-service-policy - <<'EOF'
# 정적 설정값 읽기
path "saas-secrets/data/ai-service/config" {
  capabilities = ["read"]
}

# 동적 DB 크리덴셜 발급
path "database/creds/ai-service-role" {
  capabilities = ["read"]
}

# 임대 갱신
path "sys/leases/renew" {
  capabilities = ["update"]
}

# PKI 인증서 발급 (ai-service 도메인만)
path "pki/issue/ai-service" {
  capabilities = ["create", "update"]
}
EOF
```

### 9.4 시크릿 저장

```bash
# ai-service 정적 설정값 저장
vault kv put saas-secrets/ai-service/config \
  internal_service_key="$(openssl rand -hex 32)" \
  ai_gateway_url="http://lmstudio.ai-platform.svc.cluster.local:1234" \
  redis_url="redis://redis.saas.svc.cluster.local:6379"

# N2SF 등급 메타데이터 태깅
vault kv metadata put \
  -custom-metadata "n2sf-grade=O" \
  -custom-metadata "service=ai-service" \
  -custom-metadata "csap-control=D-09" \
  saas-secrets/ai-service/config
```

### 9.5 Deployment 어노테이션 적용

```bash
# 기존 Secret 마운트 제거 후 Vault 어노테이션 적용
kubectl patch deployment ai-service -n saas --type=json -p='[
  {
    "op": "add",
    "path": "/spec/template/metadata/annotations/vault.hashicorp.com~1agent-inject",
    "value": "true"
  },
  {
    "op": "add",
    "path": "/spec/template/metadata/annotations/vault.hashicorp.com~1role",
    "value": "ai-service"
  },
  {
    "op": "add",
    "path": "/spec/template/metadata/annotations/vault.hashicorp.com~1agent-inject-secret-config",
    "value": "saas-secrets/data/ai-service/config"
  },
  {
    "op": "add",
    "path": "/spec/template/metadata/annotations/vault.hashicorp.com~1agent-inject-template-config",
    "value": "{{- with secret \"saas-secrets/data/ai-service/config\" -}}\nINTERNAL_SERVICE_KEY={{ .Data.data.internal_service_key }}\nAI_GATEWAY_URL={{ .Data.data.ai_gateway_url }}\nREDIS_URL={{ .Data.data.redis_url }}\n{{- end }}"
  },
  {
    "op": "add",
    "path": "/spec/template/metadata/annotations/vault.hashicorp.com~1agent-inject-secret-db-creds",
    "value": "database/creds/ai-service-role"
  },
  {
    "op": "add",
    "path": "/spec/template/metadata/annotations/vault.hashicorp.com~1agent-inject-template-db-creds",
    "value": "{{- with secret \"database/creds/ai-service-role\" -}}\nDATABASE_URL=postgresql://{{ .Data.username }}:{{ .Data.password }}@cnpg-cluster-rw.database.svc.cluster.local:5432/aidb?sslmode=require\n{{- end }}"
  }
]'

# 롤아웃 확인
kubectl rollout status deployment/ai-service -n saas
```

### 9.6 검증

```bash
# Pod 내부에서 시크릿 파일 확인
kubectl exec -n saas \
  $(kubectl get pod -n saas -l app=ai-service -o jsonpath='{.items[0].metadata.name}') \
  -c ai-service \
  -- ls -la /vault/secrets/

# 예상 출력:
# -rw-r--r-- 1 vault vault 156 Apr 13 09:00 config.env
# -rw-r--r-- 1 vault vault 203 Apr 13 09:00 db.env

# DB 크리덴셜 내용 확인 (실제 값 확인)
kubectl exec -n saas \
  $(kubectl get pod -n saas -l app=ai-service -o jsonpath='{.items[0].metadata.name}') \
  -c ai-service \
  -- cat /vault/secrets/db.env

# 예상 출력:
# DATABASE_URL=postgresql://v-k8s-ai-service-xK7mN2-1680000000://...

# Dynamic DB 크리덴셜이 PostgreSQL에 실제 생성되었는지 확인
kubectl exec -n database cnpg-cluster-1 -- \
  psql -U postgres -c "\du v-k8s-ai-service*"
```

### 9.7 시퀀스 다이어그램 — Dynamic DB Credential 생명주기

```mermaid
sequenceDiagram
    participant K as Kubernetes API
    participant VA as Vault Agent<br/>(Init Container)
    participant V as Vault Server
    participant PG as PostgreSQL<br/>(CNPG)
    participant AI as ai-service<br/>Container

    Note over K,AI: Pod 시작 단계

    K->>VA: Init Container 시작
    VA->>K: ServiceAccount Token 조회
    K-->>VA: JWT Token 반환

    VA->>V: POST /auth/kubernetes/login<br/>(role=ai-service, jwt=...)
    V->>K: JWT 검증 (TokenReview API)
    K-->>V: 검증 완료
    V-->>VA: Vault Client Token (TTL=1h)

    VA->>V: GET /database/creds/ai-service-role
    V->>PG: CREATE ROLE v-k8s-ai-xK7mN2<br/>WITH LOGIN PASSWORD '...' VALID UNTIL '...'
    PG-->>V: 사용자 생성 완료
    V-->>VA: {username: v-k8s-ai-xK7mN2, password: ..., lease_id: ..., ttl: 1h}

    VA->>VA: /vault/secrets/db.env 파일 작성
    Note right of VA: DATABASE_URL=postgresql://v-k8s-ai-xK7mN2:...

    VA-->>K: Init Container 완료 (exit 0)
    K->>AI: ai-service Container 시작

    AI->>AI: source /vault/secrets/db.env
    AI->>PG: 접속 (동적 크리덴셜 사용)
    PG-->>AI: 접속 성공

    Note over VA,PG: TTL 75% 경과 (45분 후)

    VA->>V: PUT /sys/leases/renew<br/>(lease_id=..., increment=1h)
    V->>PG: ALTER ROLE v-k8s-ai-xK7mN2<br/>VALID UNTIL '새 만료시간'
    PG-->>V: 갱신 완료
    V-->>VA: {lease_duration: 1h}
    VA->>VA: /vault/secrets/db.env 갱신

    Note over K,PG: Pod 종료 또는 TTL 만료

    VA->>V: DELETE /sys/leases/revoke<br/>(lease_id=...)
    V->>PG: REVOKE ALL FROM v-k8s-ai-xK7mN2<br/>DROP ROLE v-k8s-ai-xK7mN2
    PG-->>V: 사용자 삭제 완료
    Note right of PG: 크리덴셜 완전 소멸
```

---

## 부록 A: Vault 관련 명령어 빠른 참조

| 작업 | 명령어 |
|------|--------|
| 시크릿 저장 | `vault kv put PATH key=value` |
| 시크릿 조회 | `vault kv get PATH` |
| 이전 버전 조회 | `vault kv get -version=N PATH` |
| 롤백 | `vault kv rollback -version=N PATH` |
| 동적 크리덴셜 발급 | `vault read database/creds/ROLE` |
| 임대 갱신 | `vault lease renew LEASE_ID` |
| 임대 해지 | `vault lease revoke LEASE_ID` |
| 전체 해지 (긴급) | `vault lease revoke -prefix PATH` |
| 토큰 해지 | `vault token revoke TOKEN` |
| 감사 로그 확인 | `vault audit list` |
| 정책 확인 | `vault policy read POLICY` |

## 부록 B: CSAP D-09 Vault 준수 체크리스트

- [ ] 모든 시크릿은 KV v2 엔진에 저장 (암호화 at-rest)
- [ ] 동적 시크릿은 최대 TTL 4시간 이하
- [ ] 인증서는 최대 유효기간 365일 이하
- [ ] 감사 장치 2개 이상 활성화 (file + syslog)
- [ ] 감사 로그 1년 이상 보존 (Loki 또는 S3)
- [ ] N2SF C/S 등급 시크릿에 메타데이터 태깅
- [ ] 루트 토큰 사용 금지 (AppRole 또는 Kubernetes 인증 사용)
- [ ] Vault HA 3노드 이상 구성
- [ ] 자동 언실(Unseal) 설정 (AWS KMS 또는 GCP KMS)

---

*문의: 플랫폼팀 Slack `#platform-vault` | CSAP D-09 관련: 보안팀 `#security-csap`*
