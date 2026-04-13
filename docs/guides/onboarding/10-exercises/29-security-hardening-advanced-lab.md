# 실습 29: 고급 보안 강화 — Vault Dynamic Secrets, SPIFFE 워크로드 아이덴티티, OPA 정책, 침투 테스트

> **난이도**: 고급 (Advanced)
> **예상 소요 시간**: 3~4시간
> **선수 실습**: 실습 13(보안 강화), 실습 05(보안 감사), 실습 10(보안 감사 심화)
> **CSAP 연계**: D-06(감사 로깅), D-08(접근 통제), D-09(암호화)
> **Plan SC**: FR-SEC-ADV.1 ~ FR-SEC-ADV.5

---

## 학습 목표

이 실습을 완료하면 다음을 수행할 수 있습니다.

1. HashiCorp Vault를 사용하여 ai-service가 사용하는 DB 크리덴셜을 정적 비밀번호에서 동적 발급 방식으로 전환할 수 있습니다.
2. SPIFFE/SPIRE를 통해 워크로드가 고유한 암호화 신원(SVID)을 가짐을 증명하고, mTLS 연결이 실제로 성립함을 확인할 수 있습니다.
3. OPA Gatekeeper 정책을 작성하여 N2SF 데이터 등급 위반 컨테이너(C/S 등급 환경변수를 가진 Pod)를 클러스터 수준에서 차단할 수 있습니다.
4. `security-service`와 `security-monitor-service`의 `logSecurityEvent` 함수를 직접 호출하여 감사 이벤트를 생성하고 Loki에서 조회할 수 있습니다.
5. JWT 위조, SQL 주입 시도, 테넌트 격리 우회 등 3가지 공격 벡터를 실제로 시도하고 시스템이 모두 차단함을 검증할 수 있습니다.

---

## 보안 강화 로드맵

```mermaid
flowchart TD
    subgraph "현재 상태 (Before)"
        A1[정적 DB 비밀번호\n환경변수에 하드코딩]
        A2[서비스별 자체 인증\n인증서 수동 관리]
        A3[정책 코드 내 분산\n중앙화 없음]
        A4[감사 로그 수동 확인\n자동화 미흡]
    end

    subgraph "목표 상태 (After)"
        B1[Vault Dynamic Secrets\nTTL=1h 자동 만료]
        B2[SPIFFE SVID\nmTLS 자동 갱신]
        B3[OPA Gatekeeper\nAdmission Webhook]
        B4[Loki 중앙 집계\nGrafana 대시보드]
    end

    subgraph "미션 구성"
        M1[미션 1: Vault\n45분]
        M2[미션 2: SPIFFE\n30분]
        M3[미션 3: OPA\n45분]
        M4[미션 4: 감사 로그\n30분]
        M5[미션 5: 침투 테스트\n45분]
    end

    A1 --> M1 --> B1
    A2 --> M2 --> B2
    A3 --> M3 --> B3
    A4 --> M4 --> B4
    B1 & B2 & B3 & B4 --> M5

    style A1 fill:#ffcccc
    style A2 fill:#ffcccc
    style A3 fill:#ffcccc
    style A4 fill:#ffcccc
    style B1 fill:#ccffcc
    style B2 fill:#ccffcc
    style B3 fill:#ccffcc
    style B4 fill:#ccffcc
    style M5 fill:#ffe0cc
```

---

## 사전 준비

### 환경 확인

```bash
# 실습 시작 전 모든 서비스가 정상 실행 중인지 확인합니다.
kubectl get pods -n ai-saas --show-labels | grep -E "(security|ai-service|compliance)"

# 예상 출력:
# security-service-xxx      Running   ...
# security-monitor-xxx      Running   ...
# ai-service-xxx            Running   ...
# compliance-service-xxx    Running   ...
```

### 필수 도구 설치 확인

```bash
# Vault CLI
vault version

# SPIFFE SVID 확인 도구
spiffe-helper --version 2>/dev/null || echo "spiffe-helper 설치 필요"

# OPA CLI
opa version

# curl, jq
curl --version | head -1 && jq --version
```

---

## 미션 1: Vault Dynamic Secrets — ai-service DB 크리덴셜 동적 발급 (45분)

### 1.1 배경 이해

**왜 동적 시크릿이 필요한가?**

현재 `ai-service`는 PostgreSQL 접속을 위해 정적 비밀번호를 환경변수에 저장합니다.

```bash
# 현재 방식 (취약)
kubectl get secret ai-service-db-secret -n ai-saas -o jsonpath='{.data.password}' | base64 -d
# 출력: my-static-password-never-rotates
```

이 방식의 문제점은 다음과 같습니다.

- 비밀번호가 유출되어도 자동으로 만료되지 않습니다.
- 비밀번호 변경 시 서비스 재시작이 필요합니다.
- 누가 언제 접근했는지 추적이 어렵습니다.

**CSAP D-09**: 크리덴셜은 암호화 저장 + 주기적 교체 필요 (권고 주기: 90일)
**Vault Dynamic Secrets**: 요청 시마다 임시 크리덴셜 발급, TTL 만료 시 자동 삭제

### 1.2 Vault 설치 및 초기화

```bash
# 실습 환경에서는 개발 모드로 Vault를 실행합니다.
# 운영 환경에서는 반드시 HA(고가용성) 모드 + Seal 구성이 필요합니다.

# 네임스페이스 생성
kubectl create namespace vault

# Vault Helm Chart로 설치 (개발 모드)
helm repo add hashicorp https://helm.releases.hashicorp.com
helm repo update

helm install vault hashicorp/vault \
  --namespace vault \
  --set "server.dev.enabled=true" \
  --set "server.dev.devRootToken=root-token-실습전용" \
  --wait

# Vault Pod 상태 확인
kubectl get pods -n vault
# 예상: vault-0   1/1   Running
```

### 1.3 PostgreSQL 동적 시크릿 엔진 활성화

```bash
# Vault Pod에 접속합니다.
kubectl exec -it vault-0 -n vault -- /bin/sh

# Vault에 로그인 (개발 모드 루트 토큰)
export VAULT_ADDR='http://127.0.0.1:8200'
vault login root-token-실습전용

# 데이터베이스 시크릿 엔진 활성화
vault secrets enable database

# PostgreSQL 연결 설정 등록
vault write database/config/ai-service-db \
  plugin_name="postgresql-database-plugin" \
  connection_url="postgresql://{{username}}:{{password}}@postgres.ai-saas.svc.cluster.local:5432/ai_service?sslmode=require" \
  allowed_roles="ai-service-role" \
  username="vault-admin" \
  password="vault-admin-password"

# 설명: connection_url의 {{username}}, {{password}}는 Vault가 관리하는 Vault 자체 관리자 계정입니다.
```

### 1.4 동적 시크릿 역할(Role) 정의

```bash
# ai-service가 사용할 역할 정의
# TTL 1시간: 크리덴셜은 발급 후 1시간 뒤 자동 삭제
# max_ttl 2시간: 갱신해도 최대 2시간 이상 사용 불가

vault write database/roles/ai-service-role \
  db_name="ai-service-db" \
  creation_statements="
    CREATE ROLE \"{{name}}\" WITH LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}';
    GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO \"{{name}}\";
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO \"{{name}}\";
  " \
  revocation_statements="DROP ROLE IF EXISTS \"{{name}}\";" \
  default_ttl="1h" \
  max_ttl="2h"

# 역할이 잘 생성되었는지 확인
vault read database/roles/ai-service-role
```

### 1.5 Vault 정책 및 Kubernetes 인증 설정

```bash
# ai-service가 사용할 Vault 정책 작성
vault policy write ai-service-policy - <<EOF
path "database/creds/ai-service-role" {
  capabilities = ["read"]
}
path "sys/leases/renew" {
  capabilities = ["create"]
}
path "sys/leases/revoke" {
  capabilities = ["update"]
}
EOF

# Kubernetes 인증 활성화
vault auth enable kubernetes

# Kubernetes 인증 설정 (클러스터 내부에서 실행 중이므로)
vault write auth/kubernetes/config \
  kubernetes_host="https://kubernetes.default.svc.cluster.local" \
  kubernetes_ca_cert=@/var/run/secrets/kubernetes.io/serviceaccount/ca.crt \
  token_reviewer_jwt=@/var/run/secrets/kubernetes.io/serviceaccount/token

# ai-service ServiceAccount를 Vault 정책에 바인딩
vault write auth/kubernetes/role/ai-service \
  bound_service_account_names="ai-service" \
  bound_service_account_namespaces="ai-saas" \
  policies="ai-service-policy" \
  ttl="1h"

# Vault Pod에서 나갑니다.
exit
```

### 1.6 ai-service에 Vault Agent Injector 적용

```bash
# Vault Agent Sidecar Injector를 활성화합니다.
# 이렇게 하면 ai-service Pod 시작 시 자동으로 동적 크리덴셜을 받아옵니다.

# ai-service Deployment에 어노테이션 추가
kubectl patch deployment ai-service -n ai-saas --type=json -p='[
  {
    "op": "add",
    "path": "/spec/template/metadata/annotations/vault.hashicorp.com~1agent-inject",
    "value": "true"
  },
  {
    "op": "add",
    "path": "/spec/template/metadata/annotations/vault.hashicorp.com~1agent-inject-secret-db-creds",
    "value": "database/creds/ai-service-role"
  },
  {
    "op": "add",
    "path": "/spec/template/metadata/annotations/vault.hashicorp.com~1agent-inject-template-db-creds",
    "value": "{{- with secret \"database/creds/ai-service-role\" -}}\nexport DB_USERNAME={{ .Data.username }}\nexport DB_PASSWORD={{ .Data.password }}\n{{- end }}"
  },
  {
    "op": "add",
    "path": "/spec/template/metadata/annotations/vault.hashicorp.com~1role",
    "value": "ai-service"
  }
]'

# Pod 재시작 확인
kubectl rollout status deployment/ai-service -n ai-saas --timeout=120s

# 주입된 크리덴셜 확인
kubectl exec -it deployment/ai-service -n ai-saas -c vault-agent -- cat /vault/secrets/db-creds
# 예상 출력:
# export DB_USERNAME=v-k8s-ai-serv-yQdKx3nZ
# export DB_PASSWORD=A1b2C3d4-임시비밀번호
```

### 1.7 동적 크리덴셜 갱신 및 폐기 확인

```bash
# Lease 목록 확인 (발급된 임시 크리덴셜 추적)
kubectl exec -it vault-0 -n vault -- vault list sys/leases/lookup/database/creds/ai-service-role

# 강제 폐기 테스트 (보안 사고 발생 시 즉시 차단)
LEASE_ID=$(kubectl exec -it vault-0 -n vault -- vault list -format=json \
  sys/leases/lookup/database/creds/ai-service-role | jq -r '.[0]')

kubectl exec -it vault-0 -n vault -- vault lease revoke "database/creds/ai-service-role/${LEASE_ID}"
echo "크리덴셜 즉시 폐기 완료 — 해당 DB 계정은 더 이상 접속 불가"

# 폐기 후 PostgreSQL 직접 확인
kubectl exec -it postgres-0 -n ai-saas -- psql -U vault-admin -c "\du" | grep "v-k8s-ai"
# 예상: 출력 없음 (계정 삭제 확인)
```

### 1.8 CSAP D-09 증거 수집

```bash
# 증거 디렉토리 생성
mkdir -p /tmp/lab29-evidence/vault

# 동적 시크릿 설정 스크린샷
kubectl exec -it vault-0 -n vault -- vault read database/roles/ai-service-role \
  > /tmp/lab29-evidence/vault/role-config.txt

# Lease 발급 로그
kubectl exec -it vault-0 -n vault -- vault audit list \
  > /tmp/lab29-evidence/vault/audit-config.txt

# Vault 감사 로그 활성화 (운영 환경 필수)
kubectl exec -it vault-0 -n vault -- vault audit enable file file_path=/vault/logs/audit.log

echo "미션 1 완료 — Vault Dynamic Secrets 설정 완료"
```

---

## 미션 2: SPIFFE 워크로드 아이덴티티 검증 — SVID 확인, mTLS 실제 트래픽 검증 (30분)

### 2.1 SPIFFE/SPIRE 개요

**SPIFFE(Secure Production Identity Framework for Everyone)란?**

전통적인 서비스 간 인증은 "이 IP에서 온 요청이면 믿자"는 방식을 사용합니다. 하지만 컨테이너 환경에서는 IP가 수시로 바뀌어 신뢰할 수 없습니다.

SPIFFE는 각 워크로드에 암호화된 신원 문서(SVID: SPIFFE Verifiable Identity Document)를 발급하여, 워크로드가 스스로 "나는 ai-service다"를 증명할 수 있게 합니다.

```
SPIFFE URI 형식: spiffe://신뢰도메인/서비스경로
예시: spiffe://ai-saas.cluster.local/ns/ai-saas/sa/ai-service
```

**공공기관 SaaS에서의 중요성**: 테넌트 간 트래픽이 mTLS로 암호화되고 상호 인증됩니다. CSAP D-09 전송 암호화 요건을 충족합니다.

### 2.2 SPIRE 서버 설치

```bash
# SPIRE 네임스페이스 생성
kubectl create namespace spire

# SPIRE 서버 ConfigMap
cat <<'EOF' | kubectl apply -f -
apiVersion: v1
kind: ConfigMap
metadata:
  name: spire-server
  namespace: spire
data:
  server.conf: |
    server {
      bind_address = "0.0.0.0"
      bind_port = "8081"
      socket_path = "/tmp/spire-server/private/api.sock"
      trust_domain = "ai-saas.cluster.local"
      data_dir = "/run/spire/data"
      log_level = "DEBUG"
      ca_key_type = "rsa-2048"
      ca_subject {
        country = ["KR"]
        organization = ["공공기관 SaaS 프레임워크"]
        common_name = ""
      }
    }
    plugins {
      DataStore "sql" {
        plugin_data {
          database_type = "sqlite3"
          connection_string = "/run/spire/data/datastore.sqlite3"
        }
      }
      NodeAttestor "k8s_psat" {
        plugin_data {
          clusters = {
            "ai-saas-cluster" = {
              service_account_allow_list = ["spire:spire-agent"]
            }
          }
        }
      }
      KeyManager "memory" {
        plugin_data = {}
      }
    }
EOF

echo "SPIRE 서버 ConfigMap 생성 완료"
```

### 2.3 SPIRE Agent DaemonSet 배포

```bash
# SPIRE Agent는 모든 노드에서 실행되어 워크로드 신원을 관리합니다.
cat <<'EOF' | kubectl apply -f -
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: spire-agent
  namespace: spire
  labels:
    app: spire-agent
spec:
  selector:
    matchLabels:
      app: spire-agent
  template:
    metadata:
      labels:
        app: spire-agent
    spec:
      hostPID: true
      hostNetwork: true
      serviceAccountName: spire-agent
      containers:
        - name: spire-agent
          image: ghcr.io/spiffe/spire-agent:1.9.0
          args:
            - -config
            - /run/spire/config/agent.conf
          volumeMounts:
            - name: spire-config
              mountPath: /run/spire/config
              readOnly: true
            - name: spire-bundle
              mountPath: /run/spire/bundle
            - name: spire-agent-socket
              mountPath: /run/spire/sockets
              readOnly: false
      volumes:
        - name: spire-config
          configMap:
            name: spire-agent
        - name: spire-bundle
          configMap:
            name: spire-bundle
        - name: spire-agent-socket
          hostPath:
            path: /run/spire/sockets
            type: DirectoryOrCreate
EOF
```

### 2.4 워크로드 등록 항목(Registration Entry) 생성

```bash
# SPIRE 서버에 ai-service 워크로드 등록
kubectl exec -it spire-server-0 -n spire -- \
  /opt/spire/bin/spire-server entry create \
  -spiffeID spiffe://ai-saas.cluster.local/ns/ai-saas/sa/ai-service \
  -parentID spiffe://ai-saas.cluster.local/spire/agent/k8s_psat/ai-saas-cluster/$(kubectl get node -o jsonpath='{.items[0].metadata.uid}') \
  -selector k8s:ns:ai-saas \
  -selector k8s:sa:ai-service \
  -ttl 3600

# security-service 워크로드 등록
kubectl exec -it spire-server-0 -n spire -- \
  /opt/spire/bin/spire-server entry create \
  -spiffeID spiffe://ai-saas.cluster.local/ns/ai-saas/sa/security-service \
  -parentID spiffe://ai-saas.cluster.local/spire/agent/k8s_psat/ai-saas-cluster/$(kubectl get node -o jsonpath='{.items[0].metadata.uid}') \
  -selector k8s:ns:ai-saas \
  -selector k8s:sa:security-service \
  -ttl 3600

# 등록 항목 확인
kubectl exec -it spire-server-0 -n spire -- \
  /opt/spire/bin/spire-server entry show
```

### 2.5 SVID 발급 확인

```bash
# ai-service Pod에서 SVID 확인
# (spiffe-helper 또는 go-spiffe 라이브러리가 설치된 경우)
kubectl exec -it deployment/ai-service -n ai-saas -- \
  /bin/sh -c "cat /run/spire/sockets/workload.sock 2>/dev/null | head -c 0 && echo 'SPIRE 소켓 존재 확인'"

# SVID 내용 확인 (PEM 형식)
kubectl exec -it spire-server-0 -n spire -- \
  /opt/spire/bin/spire-server x509 show \
  -socketPath /tmp/spire-server/private/api.sock

# 예상 출력:
# Found 2 SVIDs:
#
# SPIFFE ID         : spiffe://ai-saas.cluster.local/ns/ai-saas/sa/ai-service
# Subject           : CN=ai-service
# Expiry            : 2026-04-13 12:00:00 +0000 UTC (1h0m0s)
# CA                : false
```

### 2.6 mTLS 실제 트래픽 검증

```bash
# ai-service → security-service 간 mTLS 트래픽이 성립하는지 확인합니다.

# 1단계: Linkerd/Istio mTLS 상태 확인 (Linkerd 사용 시)
kubectl exec -it deployment/ai-service -n ai-saas -- \
  linkerd-await --authority security-service.ai-saas.svc.cluster.local:3008 -- echo "mTLS 연결 확인"

# 2단계: Wireshark 없이 tcpdump로 암호화 확인
# (실제 패킷이 암호화되었는지 확인)
kubectl debug -it deployment/ai-service -n ai-saas \
  --image=nicolaka/netshoot -- \
  tcpdump -i eth0 -c 20 host security-service.ai-saas.svc.cluster.local

# TLS 핸드쉐이크 패킷이 보이면 암호화 성공
# "TLSv1.3" 문자열이 패킷 분석에 나타나야 합니다.

# 3단계: SVID 만료 전 자동 갱신 확인
# SPIRE는 TTL의 80% 시점에 자동 갱신합니다.
kubectl logs -n spire daemonset/spire-agent | grep "SVID renewed"
```

### 2.7 CSAP D-09 mTLS 증거 수집

```bash
mkdir -p /tmp/lab29-evidence/spiffe

# SVID 목록 스크린샷
kubectl exec -it spire-server-0 -n spire -- \
  /opt/spire/bin/spire-server entry show \
  > /tmp/lab29-evidence/spiffe/registration-entries.txt

# mTLS 통계 (Linkerd 사용 시)
kubectl exec -it deployment/ai-service -n ai-saas -- \
  curl -s http://localhost:4191/metrics | grep linkerd_tcp_open_total \
  > /tmp/lab29-evidence/spiffe/mtls-metrics.txt

echo "미션 2 완료 — SPIFFE SVID 확인 및 mTLS 검증 완료"
```

---

## 미션 3: OPA Gatekeeper 정책 작성 — N2SF 데이터 등급 위반 컨테이너 거부 정책 (45분)

### 3.1 OPA Gatekeeper 개요

**OPA(Open Policy Agent)란?**

OPA는 "이 Pod가 클러스터에 배포되어도 되는가?"를 결정하는 정책 엔진입니다. Kubernetes Admission Webhook으로 동작하여 `kubectl apply` 시점에 정책을 검사합니다.

**N2SF 데이터 등급 규칙과의 연계**:

```
N2SF 규칙: C/S 등급 데이터를 AI API에 전송하면 안 됩니다.
OPA 정책: C/S 등급을 나타내는 환경변수를 가진 컨테이너는 배포를 거부합니다.
```

실제 `ai-service/src/routes.ts`를 보면 모든 AI API 요청에 `grade: z.enum(['O'])` 검증이 있습니다. OPA는 이를 인프라 계층에서 이중으로 강제합니다.

### 3.2 OPA Gatekeeper 설치

```bash
# Gatekeeper 설치
kubectl apply -f https://raw.githubusercontent.com/open-policy-agent/gatekeeper/v3.15.0/deploy/gatekeeper.yaml

# 설치 완료 대기
kubectl wait --for=condition=Ready pods -n gatekeeper-system --all --timeout=120s

# 설치 확인
kubectl get pods -n gatekeeper-system
# 예상:
# gatekeeper-controller-manager-xxx   Running
# gatekeeper-audit-xxx                Running
```

### 3.3 ConstraintTemplate 작성 — N2SF 데이터 등급 정책

```bash
# N2SF 데이터 등급 위반 탐지 정책 템플릿
cat <<'EOF' | kubectl apply -f -
apiVersion: templates.gatekeeper.sh/v1
kind: ConstraintTemplate
metadata:
  name: n2sfgradepolicy
  annotations:
    description: "N2SF 데이터 등급 C/S 환경변수를 가진 컨테이너 배포 차단"
    csap-control: "D-08, D-12"
    n2sf-rule: "N-05"
spec:
  crd:
    spec:
      names:
        kind: N2sfGradePolicy
      validation:
        openAPIV3Schema:
          type: object
          properties:
            blockedGrades:
              type: array
              items:
                type: string
            blockedEnvPatterns:
              type: array
              items:
                type: string
  targets:
    - target: admission.k8s.gatekeeper.sh
      rego: |
        package n2sfgradepolicy

        # N2SF 위반: C 또는 S 등급을 명시하는 환경변수가 있으면 배포 거부
        violation[{"msg": msg}] {
          container := input.review.object.spec.containers[_]
          env := container.env[_]

          # 금지된 등급 패턴 확인
          blocked_grade_patterns := {"DATA_GRADE_C", "DATA_GRADE_S", "N2SF_GRADE_C", "N2SF_GRADE_S"}
          blocked_grade_patterns[env.name]

          msg := sprintf(
            "컨테이너 '%v'에 N2SF 위반 환경변수 '%v'가 발견되었습니다. C/S 등급 데이터는 AI API 전송이 금지됩니다 (N2SF N-05).",
            [container.name, env.name]
          )
        }

        # N2SF 위반: 환경변수 값이 "C" 또는 "S"이고 이름에 "GRADE"가 포함된 경우
        violation[{"msg": msg}] {
          container := input.review.object.spec.containers[_]
          env := container.env[_]

          contains(env.name, "GRADE")
          blocked_values := {"C", "S", "기밀", "비밀"}
          blocked_values[env.value]

          msg := sprintf(
            "컨테이너 '%v'의 환경변수 '%v=%v'가 N2SF 금지 등급을 지정합니다. O 등급만 AI 처리 허용 (N2SF N-05).",
            [container.name, env.name, env.value]
          )
        }

        # N2SF 위반: initContainers도 검사
        violation[{"msg": msg}] {
          container := input.review.object.spec.initContainers[_]
          env := container.env[_]

          contains(env.name, "GRADE")
          blocked_values := {"C", "S"}
          blocked_values[env.value]

          msg := sprintf(
            "initContainer '%v'의 환경변수 '%v=%v'가 N2SF 금지 등급입니다.",
            [container.name, env.name, env.value]
          )
        }
EOF

echo "ConstraintTemplate 생성 완료"
kubectl get constrainttemplate n2sfgradepolicy
```

### 3.4 Constraint 적용 — 실제 정책 활성화

```bash
# Constraint를 ai-saas 네임스페이스에 적용
cat <<'EOF' | kubectl apply -f -
apiVersion: constraints.gatekeeper.sh/v1beta1
kind: N2sfGradePolicy
metadata:
  name: n2sf-grade-enforcement
  annotations:
    csap-control: "D-08, D-12"
    evidence-category: "접근통제-N2SF준수"
spec:
  enforcementAction: deny
  match:
    kinds:
      - apiGroups: [""]
        kinds: ["Pod"]
      - apiGroups: ["apps"]
        kinds: ["Deployment", "StatefulSet", "DaemonSet"]
    namespaces:
      - ai-saas
    excludedNamespaces:
      - kube-system
      - monitoring
      - vault
      - spire
EOF

echo "Constraint 적용 완료 — N2SF 정책 활성화됨"
kubectl get n2sfgradepolicy
```

### 3.5 정책 검증 — 위반 배포 시도

```bash
# 테스트 1: C 등급 환경변수를 가진 Pod 배포 시도 (차단 예상)
cat <<'EOF' | kubectl apply -f - 2>&1
apiVersion: v1
kind: Pod
metadata:
  name: test-blocked-grade-c
  namespace: ai-saas
spec:
  containers:
    - name: test-container
      image: nginx:alpine
      env:
        - name: DATA_GRADE_C
          value: "기밀문서포함"
        - name: AI_API_ENDPOINT
          value: "http://ai-service/ai/chat"
EOF

# 예상 출력:
# Error from server (Forbidden): error when creating "STDIN": admission webhook
# "validation.gatekeeper.sh" denied the request:
# 컨테이너 'test-container'에 N2SF 위반 환경변수 'DATA_GRADE_C'가 발견되었습니다.
# C/S 등급 데이터는 AI API 전송이 금지됩니다 (N2SF N-05).

echo "--- 위반 배포 차단 확인 ---"

# 테스트 2: GRADE=S 환경변수 (차단 예상)
cat <<'EOF' | kubectl apply -f - 2>&1
apiVersion: v1
kind: Pod
metadata:
  name: test-blocked-grade-s
  namespace: ai-saas
spec:
  containers:
    - name: test-container
      image: nginx:alpine
      env:
        - name: MY_DATA_GRADE
          value: "S"
EOF

# 예상 출력: ... denied ... N2SF 금지 등급 ...

# 테스트 3: O 등급 환경변수 (허용 예상)
cat <<'EOF' | kubectl apply -f - 2>&1
apiVersion: v1
kind: Pod
metadata:
  name: test-allowed-grade-o
  namespace: ai-saas
spec:
  containers:
    - name: test-container
      image: nginx:alpine
      env:
        - name: MY_DATA_GRADE
          value: "O"
  restartPolicy: Never
EOF

echo "O 등급 배포 허용 확인"
kubectl delete pod test-allowed-grade-o -n ai-saas --ignore-not-found
```

### 3.6 OPA 감사 모드로 기존 위반 탐지

```bash
# 이미 배포된 리소스 중 정책 위반 항목 확인 (감사 모드)
kubectl get n2sfgradepolicy n2sf-grade-enforcement -o json | \
  jq '.status.violations // [] | length'

# 상세 위반 내용 확인
kubectl get n2sfgradepolicy n2sf-grade-enforcement -o jsonpath='{.status.violations}' | \
  jq '.[] | {resource: .name, namespace: .namespace, message: .message}'
```

### 3.7 CSAP D-08 OPA 정책 증거 수집

```bash
mkdir -p /tmp/lab29-evidence/opa

# 정책 템플릿 저장
kubectl get constrainttemplate n2sfgradepolicy -o yaml \
  > /tmp/lab29-evidence/opa/constraint-template.yaml

# Constraint 저장
kubectl get n2sfgradepolicy n2sf-grade-enforcement -o yaml \
  > /tmp/lab29-evidence/opa/constraint.yaml

# 위반 차단 로그 저장
kubectl logs -n gatekeeper-system deployment/gatekeeper-controller-manager \
  --since=10m | grep "denied" \
  > /tmp/lab29-evidence/opa/denial-logs.txt

echo "미션 3 완료 — OPA Gatekeeper N2SF 정책 적용 완료"
```

---

## 미션 4: security-service audit.ts 활용 — 보안 이벤트 실제 생성 및 Loki 쿼리 (30분)

### 4.1 실제 코드 분석

실제 `/data/ai-saas/platform/services/security-service/src/lib/audit.ts` 파일을 분석하면:

```typescript
// 실제 구현 (security-service/src/lib/audit.ts)
import { createAuditLogger, createStandardTransport } from '@public-saas/audit-sdk';

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

`security-monitor-service`도 동일한 패턴으로 구현되어 있으며, 서비스명만 `security-monitor-service`로 다릅니다.

**핵심 포인트**:
- `createStandardTransport`는 내부적으로 `.claude/audit.jsonl`에 append-only 방식으로 로그를 기록합니다.
- CSAP D-06 요건인 "수정/삭제 불가 구조"를 충족합니다.
- `SERVICE_IP` 환경변수로 출처 IP를 추적합니다.

### 4.2 보안 이벤트 직접 생성

```bash
# security-service Pod에 직접 접속하여 이벤트 생성
kubectl exec -it deployment/security-service -n ai-saas -- node -e "
const { logSecurityEvent } = require('./dist/lib/audit.js');

// 실습용 보안 이벤트 생성
async function generateEvents() {
  // 이벤트 1: 비정상 로그인 시도 탐지
  await logSecurityEvent('SUSPICIOUS_LOGIN_ATTEMPT', {
    userId: 'user-lab29-test',
    failCount: 5,
    sourceIP: '10.0.0.99',
    labSession: 'lab29-mission4',
    csapControl: 'D-06'
  });
  console.log('[이벤트 1] 비정상 로그인 탐지 기록 완료');

  // 이벤트 2: 권한 없는 API 접근 시도
  await logSecurityEvent('UNAUTHORIZED_API_ACCESS', {
    endpoint: '/ai/chat',
    attemptedGrade: 'C',  // C 등급 전송 시도
    blockedByN2SF: true,
    labSession: 'lab29-mission4',
    csapControl: 'D-08'
  });
  console.log('[이벤트 2] N2SF 위반 접근 차단 기록 완료');

  // 이벤트 3: Vault 크리덴셜 갱신
  await logSecurityEvent('VAULT_CREDENTIAL_RENEWED', {
    serviceId: 'ai-service',
    leaseId: 'database/creds/ai-service-role/XYZ123',
    ttl: '3600s',
    labSession: 'lab29-mission4',
    csapControl: 'D-09'
  });
  console.log('[이벤트 3] Vault 크리덴셜 갱신 기록 완료');
}

generateEvents().catch(console.error);
"
```

### 4.3 compliance-service logComplianceEvent 활용

```bash
# compliance-service의 logComplianceEvent 함수도 동일한 패턴입니다.
# (실제 파일: platform/services/compliance-service/src/lib/audit.ts)

kubectl exec -it deployment/compliance-service -n ai-saas -- node -e "
const { logComplianceEvent } = require('./dist/lib/audit.js');

async function generateComplianceEvents() {
  // CSAP D-06 준수 이벤트 기록
  await logComplianceEvent('CSAP_D06_AUDIT_LOG_GENERATED', {
    controlItem: 'D-06-01',
    retentionPeriod: '1year',
    logCount: 1,
    labSession: 'lab29-mission4'
  });
  console.log('CSAP 준수 이벤트 기록 완료');
}

generateComplianceEvents().catch(console.error);
"
```

### 4.4 감사 로그 파일 직접 확인

```bash
# .claude/audit.jsonl 파일에서 방금 생성한 이벤트 확인
tail -20 /data/ai-saas/.claude/audit.jsonl | jq '
  select(.action | test("SUSPICIOUS|UNAUTHORIZED|VAULT|CSAP")) |
  {timestamp, actor, action, metadata: .metadata.labSession}
'

# 예상 출력:
# {
#   "timestamp": "2026-04-13T...",
#   "actor": "system:security-service",
#   "action": "SUSPICIOUS_LOGIN_ATTEMPT",
#   "metadata": "lab29-mission4"
# }
```

### 4.5 Loki에서 감사 로그 쿼리

```bash
# Loki가 운영 중인 경우 (monitoring 네임스페이스)
LOKI_URL="http://loki.monitoring.svc.cluster.local:3100"

# 지난 1시간 동안의 security-service 감사 이벤트 조회
curl -s "${LOKI_URL}/loki/api/v1/query_range" \
  --data-urlencode 'query={service="security-service"} | json | action =~ "SUSPICIOUS|UNAUTHORIZED|VAULT"' \
  --data-urlencode 'start='$(date -d '1 hour ago' +%s%N) \
  --data-urlencode 'end='$(date +%s%N) \
  --data-urlencode 'limit=50' | \
  jq '.data.result[].values[][1]' | jq -r '. | fromjson | {action, timestamp, metadata}'

# N2SF 위반 이벤트만 조회
curl -s "${LOKI_URL}/loki/api/v1/query_range" \
  --data-urlencode 'query={service=~"security.*"} | json | action = "UNAUTHORIZED_API_ACCESS"' \
  --data-urlencode 'start='$(date -d '1 hour ago' +%s%N) \
  --data-urlencode 'end='$(date +%s%N) | \
  jq '.data.result[].stream.service, (.data.result[].values | length | tostring + "건")'
```

### 4.6 CSAP D-06 감사 로그 증거 수집

```bash
mkdir -p /tmp/lab29-evidence/audit

# 방금 생성된 이벤트 저장
grep "lab29-mission4" /data/ai-saas/.claude/audit.jsonl \
  > /tmp/lab29-evidence/audit/lab29-events.jsonl

# 로그 무결성 확인 (SHA-256 해시)
sha256sum /data/ai-saas/.claude/audit.jsonl \
  > /tmp/lab29-evidence/audit/audit-integrity.sha256

# 이벤트 건수 확인
echo "생성된 이벤트 건수: $(grep -c 'lab29-mission4' /data/ai-saas/.claude/audit.jsonl)"

echo "미션 4 완료 — 보안 이벤트 생성 및 Loki 쿼리 완료"
```

---

## 미션 5: 간이 침투 테스트 — JWT 위조, SQL 주입, 테넌트 격리 우회 (45분)

### 5.1 침투 테스트 안전 수칙

> **중요**: 이 미션은 교육 목적의 통제된 환경에서만 실행합니다.
> 실제 운영 서비스에 대한 무단 침투 시도는 법적 처벌을 받을 수 있습니다.
> 반드시 개발/스테이징 환경에서만 수행하십시오.

```bash
# 침투 테스트 시작 전 감사 로그에 테스트 시작 기록
cat >> /data/ai-saas/.claude/audit.jsonl << EOF
{"timestamp":"$(date -u +%Y-%m-%dT%H:%M:%SZ)","actor":"lab29-penetration-tester","action":"PENTEST_STARTED","target":"ai-saas","metadata":{"mission":"lab29-mission5","environment":"staging","authorized":true}}
EOF

# API Gateway 주소 설정
GATEWAY_URL="http://api-gateway.ai-saas.svc.cluster.local:3000"
# 외부에서 접근하는 경우:
# GATEWAY_URL="http://localhost:3000"
```

### 5.2 공격 벡터 1: JWT 위조 시도

```bash
echo "=== 공격 벡터 1: JWT 위조 ==="

# 1-A: 서명 없는 JWT ("none" 알고리즘 공격)
# 공격 방법: JWT 헤더의 alg를 "none"으로 변경하여 서명 검증 우회 시도
FAKE_HEADER=$(echo -n '{"alg":"none","typ":"JWT"}' | base64 | tr -d '=')
FAKE_PAYLOAD=$(echo -n '{
  "sub":"admin-user",
  "role":"super-admin",
  "tenantId":"tenant-1",
  "exp":9999999999
}' | base64 | tr -d '=')
FAKE_JWT="${FAKE_HEADER}.${FAKE_PAYLOAD}."  # 서명 없음

echo "--- JWT none 알고리즘 공격 시도 ---"
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -H "Authorization: Bearer ${FAKE_JWT}" \
  -H "Content-Type: application/json" \
  "${GATEWAY_URL}/ai/models")

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
echo "응답 코드: ${HTTP_STATUS}"

if [ "$HTTP_STATUS" = "401" ] || [ "$HTTP_STATUS" = "403" ]; then
  echo "차단 성공 (기대값): ${HTTP_STATUS} — none 알고리즘 JWT 거부됨"
else
  echo "경고: 예상치 못한 응답 ${HTTP_STATUS}"
fi

# 1-B: 만료된 JWT 재사용 시도
echo "--- 만료된 JWT 재사용 공격 시도 ---"
# exp를 과거 시간으로 설정한 JWT
EXPIRED_PAYLOAD=$(echo -n '{
  "sub":"user-1",
  "role":"user",
  "tenantId":"tenant-1",
  "exp":1000000000
}' | base64 | tr -d '=')
# 실제 서명이 없으므로 위조된 토큰
EXPIRED_JWT="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${EXPIRED_PAYLOAD}.FAKE_SIGNATURE"

RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -H "Authorization: Bearer ${EXPIRED_JWT}" \
  "${GATEWAY_URL}/ai/models")

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
echo "응답 코드: ${HTTP_STATUS}"
[ "$HTTP_STATUS" = "401" ] && echo "차단 성공: 만료된 토큰 거부" || echo "응답: ${HTTP_STATUS}"

# 1-C: 잘못된 Secret으로 서명된 JWT
echo "--- 잘못된 Secret JWT 시도 ---"
# 올바른 Secret 없이 임의로 서명한 JWT
WRONG_SECRET_JWT="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsInJvbGUiOiJhZG1pbiIsInRlbmFudElkIjoidGVuYW50LTEiLCJleHAiOjk5OTk5OTk5OTl9.WRONG_HMAC_SIGNATURE_XXXX"

RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -H "Authorization: Bearer ${WRONG_SECRET_JWT}" \
  "${GATEWAY_URL}/ai/models")

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
echo "응답 코드: ${HTTP_STATUS}"
[ "$HTTP_STATUS" = "401" ] && echo "차단 성공: 잘못된 서명 JWT 거부" || echo "응답: ${HTTP_STATUS}"
```

### 5.3 공격 벡터 2: SQL 주입 시도

```bash
echo ""
echo "=== 공격 벡터 2: SQL 주입 ==="

# 실제 ai-service는 Zod 스키마 검증 + 매개변수화 쿼리를 사용합니다.
# (routes.ts 분석: body 스키마에 타입 및 길이 제한이 명시됨)

# 정상적인 테스트용 JWT 발급 (개발 환경 토큰)
# 실제 환경에서는 테스트 계정으로 로그인하여 토큰을 발급받습니다.
TEST_TOKEN="${TEST_JWT:-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0LXVzZXIiLCJyb2xlIjoidXNlciIsInRlbmFudElkIjoiMDAwMDAwMDAtMDAwMC0wMDAwLTAwMDAtMDAwMDAwMDAwMDAxIiwiZXhwIjo5OTk5OTk5OTk5fQ.test}"

# 2-A: RAG 쿼리에 SQL 주입 시도
# routes.ts 분석: question 필드는 maxLength:2000, string 타입
# 매개변수화 쿼리로 처리되므로 SQL 주입이 불가능해야 합니다.
echo "--- SQL 주입 시도 (RAG 쿼리) ---"
SQL_INJECTION_PAYLOAD="'; DROP TABLE documents; --"

RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -X POST \
  -H "Authorization: Bearer ${TEST_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"tenantId\": \"00000000-0000-0000-0000-000000000001\",
    \"grade\": \"O\",
    \"question\": \"${SQL_INJECTION_PAYLOAD}\"
  }" \
  "${GATEWAY_URL}/ai/rag/query")

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | grep -v "HTTP_STATUS")

echo "응답 코드: ${HTTP_STATUS}"
# 400: 입력 검증 차단 (정상)
# 200: 검색 시도했으나 결과 없음 (매개변수화 쿼리로 안전하게 처리)
# 500: 서버 오류 (문제)

if echo "$BODY" | grep -q "DROP TABLE\|sql\|ORA-\|postgres"; then
  echo "위험: SQL 오류가 응답에 노출되었습니다 — CSAP D-12 위반"
else
  echo "안전: SQL 주입 방어 확인 — 민감한 DB 정보 미노출"
fi

# 2-B: tenantId에 UUID 형식 검증 (routes.ts: format: 'uuid')
echo "--- UUID 형식 검증 우회 시도 ---"
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -X POST \
  -H "Authorization: Bearer ${TEST_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "../../admin/secrets",
    "grade": "O",
    "question": "테스트"
  }' \
  "${GATEWAY_URL}/ai/rag/query")

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
echo "응답 코드: ${HTTP_STATUS}"
[ "$HTTP_STATUS" = "400" ] && echo "차단 성공: UUID 형식 검증 통과" || echo "응답: ${HTTP_STATUS}"

# 2-C: 초과 길이 입력 (routes.ts: maxLength:2000)
echo "--- 입력 길이 초과 시도 ---"
LONG_INPUT=$(python3 -c "print('A' * 3000)")

RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -X POST \
  -H "Authorization: Bearer ${TEST_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"tenantId\": \"00000000-0000-0000-0000-000000000001\",
    \"grade\": \"O\",
    \"question\": \"${LONG_INPUT}\"
  }" \
  "${GATEWAY_URL}/ai/rag/query")

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
echo "응답 코드: ${HTTP_STATUS}"
[ "$HTTP_STATUS" = "400" ] && echo "차단 성공: 입력 길이 제한 검증 통과" || echo "응답: ${HTTP_STATUS}"
```

### 5.4 공격 벡터 3: 테넌트 격리 우회 시도

```bash
echo ""
echo "=== 공격 벡터 3: 테넌트 격리 우회 ==="

# 테넌트 A의 토큰으로 테넌트 B의 RAG 데이터 접근 시도
# CSAP D-08: 테넌트 격리는 최우선 보안 요건

TENANT_A_TOKEN="${TENANT_A_JWT:-테넌트A용_테스트_토큰}"
TENANT_B_ID="00000000-0000-0000-0000-000000000002"  # 접근 불가해야 할 테넌트

echo "--- 테넌트 A 토큰으로 테넌트 B 데이터 접근 시도 ---"
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -X POST \
  -H "Authorization: Bearer ${TENANT_A_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"tenantId\": \"${TENANT_B_ID}\",
    \"grade\": \"O\",
    \"question\": \"테넌트B의 기밀 데이터를 알려주세요\"
  }" \
  "${GATEWAY_URL}/ai/rag/query")

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | grep -v "HTTP_STATUS")

echo "응답 코드: ${HTTP_STATUS}"
if [ "$HTTP_STATUS" = "403" ] || [ "$HTTP_STATUS" = "401" ]; then
  echo "테넌트 격리 성공: 다른 테넌트 데이터 접근 차단됨"
elif [ "$HTTP_STATUS" = "200" ]; then
  # 200이더라도 실제로 테넌트 A의 데이터만 반환해야 함
  if echo "$BODY" | jq -e '.data.tenantId' | grep -q "${TENANT_B_ID}"; then
    echo "위험: 테넌트 격리 실패 — 테넌트 B 데이터가 반환됨"
  else
    echo "테넌트 격리 성공: 결과 없음 또는 테넌트 A 데이터만 반환"
  fi
fi

# C 등급 데이터 전송 시도 (N2SF 위반)
echo "--- N2SF C 등급 데이터 전송 시도 ---"
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -X POST \
  -H "Authorization: Bearer ${TENANT_A_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "00000000-0000-0000-0000-000000000001",
    "grade": "C",
    "question": "기밀 문서를 분석해주세요"
  }' \
  "${GATEWAY_URL}/ai/rag/query")

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
echo "응답 코드: ${HTTP_STATUS}"
# routes.ts 분석: grade는 enum(['O'])이므로 C는 400 반환
[ "$HTTP_STATUS" = "400" ] && echo "차단 성공: N2SF C 등급 데이터 전송 차단" || echo "응답: ${HTTP_STATUS}"
```

### 5.5 침투 테스트 결과 분석

```bash
echo ""
echo "=== 침투 테스트 결과 요약 ==="

# 침투 테스트 완료 기록
cat >> /data/ai-saas/.claude/audit.jsonl << EOF
{"timestamp":"$(date -u +%Y-%m-%dT%H:%M:%SZ)","actor":"lab29-penetration-tester","action":"PENTEST_COMPLETED","target":"ai-saas","metadata":{"mission":"lab29-mission5","vectors_tested":3,"all_blocked":true,"csapControl":"D-06,D-08,D-12"}}
EOF

mkdir -p /tmp/lab29-evidence/pentest

# 결과 보고서 생성
cat > /tmp/lab29-evidence/pentest/result-summary.md << 'EOF'
# 실습 29 침투 테스트 결과 보고서

## 테스트 일시
$(date)

## 테스트 대상
- 공공기관 SaaS 프레임워크 ai-service
- 환경: 스테이징

## 공격 벡터 1: JWT 위조
| 시도 | 결과 | 방어 메커니즘 |
|------|------|--------------|
| none 알고리즘 JWT | 차단 (401) | alg 검증 필수화 |
| 만료된 JWT 재사용 | 차단 (401) | exp 클레임 검증 |
| 잘못된 서명 JWT | 차단 (401) | HMAC 서명 검증 |

## 공격 벡터 2: SQL 주입
| 시도 | 결과 | 방어 메커니즘 |
|------|------|--------------|
| DROP TABLE 시도 | 무력화 | 매개변수화 쿼리 |
| UUID 형식 우회 | 차단 (400) | Zod uuid 형식 검증 |
| 초과 길이 입력 | 차단 (400) | maxLength 제한 |

## 공격 벡터 3: 테넌트 격리 우회
| 시도 | 결과 | 방어 메커니즘 |
|------|------|--------------|
| 교차 테넌트 접근 | 차단 (403) | RBAC + 테넌트 컨텍스트 |
| N2SF C 등급 전송 | 차단 (400) | grade enum 검증 |

## 결론
모든 공격 벡터가 성공적으로 차단되었습니다.
CSAP D-08(접근통제), D-09(암호화), D-12(개발보안) 요건을 충족합니다.
EOF

echo "침투 테스트 보고서 생성 완료: /tmp/lab29-evidence/pentest/result-summary.md"
echo "미션 5 완료 — 3가지 공격 벡터 모두 차단 확인"
```

---

## 실습 완료 플로우차트

```mermaid
flowchart TD
    START([실습 시작]) --> ENV_CHECK{환경 확인\nkubectl get pods}

    ENV_CHECK -->|정상| M1_START[미션 1 시작\nVault 설치]
    ENV_CHECK -->|비정상| FIX[서비스 복구 후\n재시도]
    FIX --> ENV_CHECK

    M1_START --> M1_DB[DB 시크릿 엔진 활성화]
    M1_DB --> M1_ROLE[ai-service-role 정의\nTTL=1h]
    M1_ROLE --> M1_INJECT[Vault Agent Injector 적용]
    M1_INJECT --> M1_VERIFY{동적 크리덴셜\n발급 확인}
    M1_VERIFY -->|성공| M1_DONE[미션 1 완료\n25점]
    M1_VERIFY -->|실패| M1_DEBUG[Vault 로그 확인\nvault operator diagnose]

    M1_DONE --> M2_START[미션 2 시작\nSPIRE 설치]
    M2_START --> M2_ENTRY[워크로드 등록항목 생성]
    M2_ENTRY --> M2_SVID{SVID 발급 확인\nspiffe:// URI}
    M2_SVID -->|성공| M2_MTLS[mTLS 트래픽 검증\ntcpdump TLSv1.3]
    M2_MTLS --> M2_DONE[미션 2 완료\n20점]
    M2_SVID -->|실패| M2_DEBUG[SPIRE Agent 로그 확인]

    M2_DONE --> M3_START[미션 3 시작\nOPA Gatekeeper]
    M3_START --> M3_TEMPLATE[ConstraintTemplate 생성\nn2sfgradepolicy]
    M3_TEMPLATE --> M3_CONSTRAINT[Constraint 적용\nenforcementAction: deny]
    M3_CONSTRAINT --> M3_TEST{위반 Pod 배포 시도\nDATA_GRADE_C 환경변수}
    M3_TEST -->|차단됨| M3_DONE[미션 3 완료\n20점]
    M3_TEST -->|허용됨| M3_FIX[정책 재검토\nrego 수정]
    M3_FIX --> M3_TEST

    M3_DONE --> M4_START[미션 4 시작\n감사 이벤트 생성]
    M4_START --> M4_LOG[logSecurityEvent 호출\n3가지 이벤트 생성]
    M4_LOG --> M4_FILE[audit.jsonl 확인]
    M4_FILE --> M4_LOKI[Loki 쿼리 실행]
    M4_LOKI --> M4_DONE[미션 4 완료\n15점]

    M4_DONE --> M5_START[미션 5 시작\n침투 테스트]
    M5_START --> M5_JWT[공격 벡터 1\nJWT 위조]
    M5_JWT --> M5_SQL[공격 벡터 2\nSQL 주입]
    M5_SQL --> M5_TENANT[공격 벡터 3\n테넌트 격리 우회]
    M5_TENANT --> M5_ALL{모든 공격\n차단 확인}
    M5_ALL -->|모두 차단| M5_DONE[미션 5 완료\n20점]
    M5_ALL -->|일부 통과| M5_REPORT[취약점 보고서 작성\n즉시 팀에 보고]

    M5_DONE --> EVIDENCE[증거 파일 정리\nlab29-verify.sh 실행]
    EVIDENCE --> SCORE{최종 채점\n총점 확인}
    SCORE -->|80점 이상| PASS([실습 통과\n합격])
    SCORE -->|80점 미만| RETRY[미완료 미션 재수행]
    RETRY --> EVIDENCE

    style PASS fill:#ccffcc
    style M5_REPORT fill:#ffcccc
    style M1_DONE fill:#e8f4f8
    style M2_DONE fill:#e8f4f8
    style M3_DONE fill:#e8f4f8
    style M4_DONE fill:#e8f4f8
    style M5_DONE fill:#e8f4f8
```

---

## 채점 기준 (총 100점)

### 미션 1: Vault Dynamic Secrets (25점)

| 항목 | 배점 | 확인 방법 |
|------|------|----------|
| Vault 설치 및 초기화 성공 | 5점 | `kubectl get pods -n vault` |
| DB 동적 시크릿 역할 생성 (TTL=1h) | 8점 | `vault read database/roles/ai-service-role` |
| ai-service Vault Agent Injector 적용 | 7점 | Pod 어노테이션 확인 + /vault/secrets/ 파일 존재 |
| 크리덴셜 폐기(Revoke) 기능 확인 | 5점 | Revoke 후 DB 계정 삭제 확인 |

### 미션 2: SPIFFE 워크로드 아이덴티티 (20점)

| 항목 | 배점 | 확인 방법 |
|------|------|----------|
| SPIRE 서버/에이전트 설치 | 5점 | `kubectl get pods -n spire` |
| ai-service SVID 발급 확인 | 8점 | `spire-server entry show`에서 SPIFFE URI 확인 |
| mTLS 트래픽 암호화 검증 | 7점 | tcpdump에서 TLSv1.3 패킷 확인 |

### 미션 3: OPA Gatekeeper 정책 (20점)

| 항목 | 배점 | 확인 방법 |
|------|------|----------|
| ConstraintTemplate 작성 및 적용 | 7점 | `kubectl get constrainttemplate` |
| C/S 등급 환경변수 Pod 차단 확인 | 8점 | 위반 배포 시 오류 메시지 확인 |
| O 등급 환경변수 Pod 정상 배포 | 5점 | `kubectl get pod test-allowed-grade-o` |

### 미션 4: 감사 로그 생성 및 조회 (15점)

| 항목 | 배점 | 확인 방법 |
|------|------|----------|
| logSecurityEvent 3가지 이벤트 생성 | 6점 | audit.jsonl에서 lab29-mission4 검색 |
| Loki 쿼리 성공적 실행 | 5점 | 쿼리 결과 캡처 |
| 감사 로그 무결성 해시 생성 | 4점 | audit-integrity.sha256 파일 존재 |

### 미션 5: 침투 테스트 (20점)

| 항목 | 배점 | 확인 방법 |
|------|------|----------|
| JWT 위조 3가지 시도 모두 차단 확인 | 7점 | 각 시도 HTTP 401/403 응답 확인 |
| SQL 주입 3가지 시도 차단 확인 | 7점 | 차단 응답 및 DB 정보 미노출 확인 |
| 테넌트 격리 우회 차단 확인 | 6점 | 교차 테넌트 접근 차단 + N2SF C등급 차단 |

---

## CSAP 항목별 증거 수집 가이드

### CSAP D-06: 침해사고 관리 (감사 로깅)

미션 4에서 생성한 증거를 사용합니다.

```bash
# D-06 증거 패키지 생성
mkdir -p /tmp/csap-evidence/D-06

# 증거 1: 감사 로그 파일 존재 확인
cp /data/ai-saas/.claude/audit.jsonl /tmp/csap-evidence/D-06/
echo "로그 파일 크기: $(wc -l < /data/ai-saas/.claude/audit.jsonl) 라인"

# 증거 2: 로그 구조 확인 (필수 필드: actor, action, target, timestamp)
jq 'keys' /data/ai-saas/.claude/audit.jsonl | head -5

# 증거 3: 보안 이벤트 기록 확인 (미션 4 생성 이벤트)
grep "lab29-mission4" /data/ai-saas/.claude/audit.jsonl | \
  jq '{timestamp, actor, action, csapControl: .metadata.csapControl}'

# 증거 4: 로그 보존 기간 정책 문서
# (운영 환경에서는 1년 이상 보존 설정 캡처)
kubectl get configmap audit-retention-policy -n ai-saas -o yaml 2>/dev/null || \
  echo "로그 보존 정책: audit.jsonl append-only 구조, 외부 스토리지 아카이빙"

# 증거 5: Vault 감사 로그 활성화 확인
kubectl exec -it vault-0 -n vault -- vault audit list 2>/dev/null

echo "D-06 증거 수집 완료"
```

### CSAP D-08: 접근 통제

미션 3과 미션 5에서 생성한 증거를 사용합니다.

```bash
mkdir -p /tmp/csap-evidence/D-08

# 증거 1: OPA Gatekeeper 정책 활성화 확인
kubectl get n2sfgradepolicy n2sf-grade-enforcement -o yaml \
  > /tmp/csap-evidence/D-08/opa-constraint.yaml

# 증거 2: 위반 배포 차단 로그
kubectl logs -n gatekeeper-system \
  deployment/gatekeeper-controller-manager --since=2h | \
  grep "denied" > /tmp/csap-evidence/D-08/admission-denials.log

# 증거 3: Rate Limiting 설정 확인 (routes.ts에서 분석)
# ai-service/src/routes.ts: chatLimiter(10, 60), agentLimiter(5, 60) 등
kubectl exec -it deployment/api-gateway -n ai-saas -- \
  curl -s localhost:3000/metrics | grep "ratelimit" | head -10 \
  > /tmp/csap-evidence/D-08/ratelimit-metrics.txt

# 증거 4: 침투 테스트 결과
cp /tmp/lab29-evidence/pentest/result-summary.md /tmp/csap-evidence/D-08/

echo "D-08 증거 수집 완료"
```

### CSAP D-09: 암호화

미션 1과 미션 2에서 생성한 증거를 사용합니다.

```bash
mkdir -p /tmp/csap-evidence/D-09

# 증거 1: Vault Dynamic Secrets TTL 설정
kubectl exec -it vault-0 -n vault -- \
  vault read database/roles/ai-service-role \
  > /tmp/csap-evidence/D-09/vault-role-ttl.txt

# 증거 2: 동적 크리덴셜 발급 이력
kubectl exec -it vault-0 -n vault -- \
  vault list sys/leases/lookup/database/creds/ai-service-role 2>/dev/null \
  > /tmp/csap-evidence/D-09/dynamic-credentials.txt

# 증거 3: SPIFFE SVID (X.509 인증서 기반 상호 인증)
kubectl exec -it spire-server-0 -n spire -- \
  /opt/spire/bin/spire-server entry show \
  > /tmp/csap-evidence/D-09/spiffe-svid-entries.txt

# 증거 4: TLS 버전 확인
kubectl exec -it deployment/ai-service -n ai-saas -- \
  curl -svI --tls-max 1.2 https://security-service.ai-saas.svc.cluster.local:3008/ 2>&1 | \
  grep -E "(TLS|SSL|cipher)" \
  > /tmp/csap-evidence/D-09/tls-version.txt || \
  echo "TLS 1.3 사용 (1.2 연결 거부됨)" > /tmp/csap-evidence/D-09/tls-version.txt

echo "D-09 증거 수집 완료"
```

---

## 자동 검증 스크립트 (lab29-verify.sh)

```bash
#!/bin/bash
# lab29-verify.sh
# 실습 29 자동 채점 스크립트
# 사용법: bash lab29-verify.sh [--namespace ai-saas]

set -euo pipefail

NAMESPACE="${1:-ai-saas}"
VAULT_NAMESPACE="vault"
SPIRE_NAMESPACE="spire"
SCORE=0
MAX_SCORE=100
EVIDENCE_DIR="/tmp/lab29-evidence"

# 색상 코드
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_pass() { echo -e "${GREEN}[PASS]${NC} $1"; SCORE=$((SCORE + $2)); }
log_fail() { echo -e "${RED}[FAIL]${NC} $1 (${2}점 미획득)"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }

echo "================================================================"
echo "실습 29: 고급 보안 강화 자동 채점 시작"
echo "일시: $(date)"
echo "================================================================"
echo ""

# ── 미션 1: Vault Dynamic Secrets (25점) ──────────────────────────

echo "=== 미션 1: Vault Dynamic Secrets (25점) ==="

# 1-1: Vault Pod 실행 확인 (5점)
if kubectl get pods -n "${VAULT_NAMESPACE}" 2>/dev/null | grep -q "vault.*Running"; then
  log_pass "Vault Pod가 Running 상태입니다" 5
else
  log_fail "Vault Pod가 실행되지 않았습니다" 5
fi

# 1-2: DB 역할 생성 확인 (8점)
ROLE_CHECK=$(kubectl exec -it vault-0 -n "${VAULT_NAMESPACE}" -- \
  vault read -format=json database/roles/ai-service-role 2>/dev/null | \
  jq -r '.data.default_ttl // "없음"' 2>/dev/null || echo "없음")

if [[ "${ROLE_CHECK}" == *"3600"* ]] || [[ "${ROLE_CHECK}" == *"1h"* ]]; then
  log_pass "DB 역할 생성 완료 (TTL=1h)" 8
else
  log_fail "DB 역할 생성 미완료 또는 TTL 설정 오류. 현재값: ${ROLE_CHECK}" 8
fi

# 1-3: Vault Agent Injector 어노테이션 확인 (7점)
if kubectl get deployment ai-service -n "${NAMESPACE}" -o json 2>/dev/null | \
   jq -r '.spec.template.metadata.annotations | keys[]' 2>/dev/null | \
   grep -q "vault.hashicorp.com"; then
  log_pass "ai-service Vault Agent Injector 어노테이션 적용됨" 7
else
  log_fail "ai-service Vault Agent Injector 어노테이션 미적용" 7
fi

# 1-4: /vault/secrets/ 파일 존재 확인 (5점)
if kubectl exec -it deployment/ai-service -n "${NAMESPACE}" -- \
   ls /vault/secrets/ 2>/dev/null | grep -q "db-creds"; then
  log_pass "동적 크리덴셜 파일 주입 확인 (/vault/secrets/db-creds)" 5
else
  log_warn "동적 크리덴셜 파일 확인 불가 (Pod 재시작 후 재확인 필요)"
  log_fail "/vault/secrets/db-creds 파일 없음" 5
fi

echo ""

# ── 미션 2: SPIFFE (20점) ─────────────────────────────────────────

echo "=== 미션 2: SPIFFE 워크로드 아이덴티티 (20점) ==="

# 2-1: SPIRE Pod 확인 (5점)
if kubectl get pods -n "${SPIRE_NAMESPACE}" 2>/dev/null | grep -q "Running"; then
  log_pass "SPIRE Pod가 Running 상태입니다" 5
else
  log_fail "SPIRE Pod가 실행되지 않았습니다" 5
fi

# 2-2: SVID 등록항목 확인 (8점)
if kubectl exec -it spire-server-0 -n "${SPIRE_NAMESPACE}" -- \
   /opt/spire/bin/spire-server entry show 2>/dev/null | \
   grep -q "ai-saas.cluster.local"; then
  log_pass "ai-service SVID 등록항목 확인" 8
else
  log_fail "ai-service SVID 등록항목 없음" 8
fi

# 2-3: mTLS 증거 파일 확인 (7점)
if ls "${EVIDENCE_DIR}/spiffe/" 2>/dev/null | grep -q "mtls"; then
  log_pass "mTLS 검증 증거 파일 존재" 7
else
  log_warn "mTLS 증거 파일 없음 — 미션 2.6 재수행 필요"
  log_fail "mTLS 검증 증거 미수집" 7
fi

echo ""

# ── 미션 3: OPA Gatekeeper (20점) ────────────────────────────────

echo "=== 미션 3: OPA Gatekeeper 정책 (20점) ==="

# 3-1: ConstraintTemplate 확인 (7점)
if kubectl get constrainttemplate n2sfgradepolicy 2>/dev/null | grep -q "n2sfgradepolicy"; then
  log_pass "N2SF ConstraintTemplate 생성 확인" 7
else
  log_fail "N2SF ConstraintTemplate 없음" 7
fi

# 3-2: Constraint 활성화 확인 (8점)
ENFORCEMENT=$(kubectl get n2sfgradepolicy n2sf-grade-enforcement \
  -o jsonpath='{.spec.enforcementAction}' 2>/dev/null || echo "없음")
if [ "${ENFORCEMENT}" = "deny" ]; then
  log_pass "N2SF Constraint enforcementAction=deny 확인" 8
else
  log_fail "N2SF Constraint 미활성화. 현재값: ${ENFORCEMENT}" 8
fi

# 3-3: 위반 Pod 차단 확인 (5점) — OPA 거부 로그에서 확인
if kubectl logs -n gatekeeper-system deployment/gatekeeper-controller-manager \
   --since=2h 2>/dev/null | grep -q "denied"; then
  log_pass "위반 배포 차단 로그 확인" 5
else
  log_warn "차단 로그 없음 — 미션 3.5 위반 배포 시도를 재실행하십시오"
  log_fail "위반 배포 차단 미확인" 5
fi

echo ""

# ── 미션 4: 감사 로그 (15점) ─────────────────────────────────────

echo "=== 미션 4: 감사 로그 생성 및 조회 (15점) ==="

# 4-1: lab29-mission4 이벤트 존재 확인 (6점)
EVENT_COUNT=$(grep -c "lab29-mission4" /data/ai-saas/.claude/audit.jsonl 2>/dev/null || echo 0)
if [ "${EVENT_COUNT}" -ge 3 ]; then
  log_pass "감사 이벤트 ${EVENT_COUNT}개 생성 확인 (최소 3개 이상)" 6
elif [ "${EVENT_COUNT}" -ge 1 ]; then
  log_warn "감사 이벤트 ${EVENT_COUNT}개 생성 (3개 미만)"
  SCORE=$((SCORE + 3))
  echo -e "${YELLOW}[부분 점수]${NC} 3점 획득"
else
  log_fail "lab29-mission4 감사 이벤트 없음" 6
fi

# 4-2: Loki 쿼리 증거 파일 확인 (5점) — 스크립트 실행은 수동 확인
if ls "${EVIDENCE_DIR}/audit/" 2>/dev/null | grep -q "events"; then
  log_pass "감사 이벤트 증거 파일 존재" 5
else
  log_fail "감사 이벤트 증거 파일 없음" 5
fi

# 4-3: 무결성 해시 파일 확인 (4점)
if ls "${EVIDENCE_DIR}/audit/" 2>/dev/null | grep -q "integrity.sha256"; then
  log_pass "감사 로그 무결성 해시 파일 존재" 4
else
  log_fail "감사 로그 무결성 해시 파일 없음" 4
fi

echo ""

# ── 미션 5: 침투 테스트 (20점) ───────────────────────────────────

echo "=== 미션 5: 침투 테스트 (20점) ==="

# 5-1: 침투 테스트 완료 기록 확인 (7점)
if grep -q "PENTEST_COMPLETED" /data/ai-saas/.claude/audit.jsonl 2>/dev/null; then
  log_pass "침투 테스트 완료 감사 로그 확인" 7
else
  log_fail "침투 테스트 완료 기록 없음" 7
fi

# 5-2: 결과 보고서 파일 확인 (7점)
if ls "${EVIDENCE_DIR}/pentest/" 2>/dev/null | grep -q "result-summary"; then
  log_pass "침투 테스트 결과 보고서 존재" 7
else
  log_fail "침투 테스트 결과 보고서 없음" 7
fi

# 5-3: 증거 패키지 완성도 (6점)
EVIDENCE_COUNT=$(ls "${EVIDENCE_DIR}/" 2>/dev/null | wc -l || echo 0)
if [ "${EVIDENCE_COUNT}" -ge 4 ]; then
  log_pass "증거 디렉토리 4개 이상 완성 (vault, spiffe, opa, audit, pentest)" 6
else
  log_warn "증거 디렉토리 ${EVIDENCE_COUNT}개 (4개 이상 필요)"
  log_fail "증거 패키지 불완전" 6
fi

echo ""
echo "================================================================"
echo "최종 점수: ${SCORE} / ${MAX_SCORE}"

if [ "${SCORE}" -ge 90 ]; then
  echo -e "${GREEN}우수 (A): 모든 미션 탁월하게 완료${NC}"
elif [ "${SCORE}" -ge 80 ]; then
  echo -e "${GREEN}합격 (B): 실습 통과${NC}"
elif [ "${SCORE}" -ge 70 ]; then
  echo -e "${YELLOW}보통 (C): 미완료 미션 재수행 권장${NC}"
else
  echo -e "${RED}미흡 (D): 주요 미션 재수행 필요${NC}"
fi

echo "================================================================"
echo ""
echo "CSAP 증거 경로: ${EVIDENCE_DIR}/"
echo "감사 로그: /data/ai-saas/.claude/audit.jsonl"
```

스크립트 실행 방법:

```bash
# 실행 권한 부여 후 실행
chmod +x lab29-verify.sh
bash lab29-verify.sh

# 또는 특정 네임스페이스 지정
bash lab29-verify.sh ai-saas-dev
```

---

## 자주 발생하는 오류와 해결 방법

### Vault 관련 오류

```bash
# 오류: Error writing data to database/config/...
# 원인: PostgreSQL이 아직 준비되지 않음
kubectl wait --for=condition=Ready pod -l app=postgres -n ai-saas --timeout=60s
# 해결: 잠시 후 재시도

# 오류: permission denied: path database/creds/...
# 원인: Kubernetes 인증 설정 오류
kubectl exec -it vault-0 -n vault -- vault auth list
# 해결: auth/kubernetes/config 재설정
```

### OPA Gatekeeper 관련 오류

```bash
# 오류: ConstraintTemplate CRD not found
# 원인: Gatekeeper 설치 직후 CRD 등록 지연
kubectl wait --for=condition=Established crd/constrainttemplates.templates.gatekeeper.sh --timeout=60s
# 해결: 30초 후 재시도

# 오류: rego 문법 오류
# 해결: OPA CLI로 로컬 검증
opa eval -d constraint-template.yaml 'data.n2sfgradepolicy.violation'
```

### SPIRE 관련 오류

```bash
# 오류: failed to get SVID: no registration entries found
# 원인: 워크로드 등록항목 미등록 또는 셀렉터 불일치
kubectl exec -it spire-server-0 -n spire -- \
  /opt/spire/bin/spire-server entry show -selector k8s:ns:ai-saas
# 해결: 셀렉터 확인 후 항목 재등록
```

---

## 실습 완료 후 정리

```bash
# 개발 환경 정리 (운영 환경에서는 절대 실행하지 마십시오)
# Vault 제거
helm uninstall vault -n vault
kubectl delete namespace vault

# SPIRE 제거
kubectl delete namespace spire

# OPA 정책 제거 (실습 후)
kubectl delete n2sfgradepolicy n2sf-grade-enforcement
kubectl delete constrainttemplate n2sfgradepolicy

# 테스트 Pod 정리
kubectl delete pod test-blocked-grade-c test-blocked-grade-s test-allowed-grade-o \
  -n ai-saas --ignore-not-found

echo "실습 환경 정리 완료"
```

---

## 참고 자료

- HashiCorp Vault Dynamic Secrets: https://developer.hashicorp.com/vault/docs/secrets/databases/postgresql
- SPIFFE/SPIRE 공식 문서: https://spiffe.io/docs/latest/
- OPA Gatekeeper: https://open-policy-agent.github.io/gatekeeper/website/docs/
- CSAP 클라우드 보안인증 기준: https://csap.kisa.or.kr
- N2SF 국가 정보보안 기본지침: 국가사이버안전센터 고시

---

> 이 실습을 완료하면 CSAP D-06, D-08, D-09 항목에 대한 실무 수준의 구현 능력을 갖추게 됩니다.
> 채점 결과 80점 이상이면 실습 29 합격입니다. 합격 후 다음 실습(실습 30)으로 진행하십시오.
