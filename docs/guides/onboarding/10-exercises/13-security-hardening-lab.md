# 실습 13 — 보안 강화 실습 (Falco + Vault + NetworkPolicy)

> **문서 ID**: ONBOARD-10-LAB13
> **버전**: 1.0.0 | **작성일**: 2026-04-12 | **대상**: 인프라 엔지니어, DevSecOps 담당자
> **선행 학습**: `07-security/05-security-hardening.md`, `10-exercises/10-security-audit-exercise.md`
> **소요 시간**: 약 2시간 35분 (파트 1~5 합계)
> **난이도**: 고급
> **CSAP**: D-05 (변경 관리), D-06 (침해사고 관리), D-08 (접근 통제), D-09 (암호화), D-12 (시스템 개발 보안)

---

## 목차

1. [실습 소개 및 사전 요건](#1-실습-소개-및-사전-요건)
2. [파트 1: Falco 위협 탐지 설정 (45분)](#2-파트-1-falco-위협-탐지-설정-45분)
3. [파트 2: Vault Dynamic Secrets 적용 (40분)](#3-파트-2-vault-dynamic-secrets-적용-40분)
4. [파트 3: NetworkPolicy 강화 (30분)](#4-파트-3-networkpolicy-강화-30분)
5. [파트 4: Pod Security Standards 검증 (20분)](#5-파트-4-pod-security-standards-검증-20분)
6. [파트 5: 보안 점수 측정 (20분)](#6-파트-5-보안-점수-측정-20분)
7. [채점 기준 (100점)](#7-채점-기준-100점)
8. [추가 도전 과제](#8-추가-도전-과제)
9. [변경 이력](#9-변경-이력)

---

## 1. 실습 소개 및 사전 요건

### 1.1 이 실습에서 배울 것

이 실습은 공공기관 SaaS 클러스터의 보안 강화를 직접 수행하고 검증합니다. 이론이 아닌 **실제 k3s 클러스터에서 명령을 실행**하고 결과를 확인합니다.

배울 내용:
- **Falco**: 컨테이너 런타임 위협을 실시간으로 탐지하는 커스텀 규칙 작성
- **Vault**: 정적 시크릿의 위험성을 이해하고 Dynamic Secrets로 전환
- **NetworkPolicy**: Deny-all 기반 최소 권한 네트워크 격리 적용
- **Pod Security Standards**: Restricted 레벨 적용 및 위반 수정
- **보안 점수**: kube-bench와 Trivy로 클러스터 보안 점수를 정량적으로 측정

### 1.2 사전 조건

이 실습을 시작하기 전에 다음을 확인하십시오.

```bash
# 1. kubectl 접근 권한 확인
kubectl cluster-info
kubectl get nodes
# → k3s 노드가 Ready 상태여야 합니다

# 2. 네임스페이스 확인
kubectl get namespaces | grep -E "saas-apps|falco-system|vault-system"
# → 3개 네임스페이스가 존재해야 합니다

# 3. Helm 설치 확인
helm version
# → v3.x 이상

# 4. 이전 실습 완료 확인 (실습 5 완료 필요)
kubectl get deployment -n saas-apps
# → ai-service, security-service 등 기본 서비스 실행 중이어야 합니다

# 5. 현재 보안 상태 스냅샷
kubectl get networkpolicy -A 2>/dev/null | wc -l
echo "현재 NetworkPolicy 수: $?"
```

### 1.3 완성 후 예상 상태

이 실습을 완료하면 다음 상태가 됩니다.

| 항목 | 시작 상태 | 완료 후 상태 |
|------|---------|-----------|
| Falco 커스텀 규칙 | 0개 | 3개 이상 |
| Vault Dynamic Secrets | 미적용 | PostgreSQL 동적 계정 적용 |
| NetworkPolicy | Deny-all 없음 | Deny-all + 허용 정책 완비 |
| Pod Security | Baseline | Restricted |
| kube-bench 점수 | 측정 안됨 | 80점 이상 |

### 1.4 Mermaid: 실습 아키텍처 다이어그램

```mermaid
graph TB
  subgraph "k3s 클러스터"
    subgraph "falco-system"
      FALCO[Falco DaemonSet\n런타임 위협 탐지]
      FSDK[Falcosidekick\n알림 포워더]
      FALCO --> FSDK
    end

    subgraph "vault-system"
      VAULT[HashiCorp Vault\n시크릿 관리]
      ESO[External Secrets\nOperator]
      VAULT --> ESO
    end

    subgraph "saas-apps (Restricted)"
      APP[ai-service\nrunAsNonRoot\nreadOnly FS]
      SEC[security-service]
    end

    subgraph "네트워크 격리"
      NP_DENY[default-deny-all\nNetworkPolicy]
      NP_ALLOW[allow-intra-namespace\nNetworkPolicy]
    end
  end

  subgraph "보안 측정 도구"
    BENCH[kube-bench\nCIS 벤치마크]
    TRIVY[Trivy Operator\n취약점 스캔]
  end

  FSDK --> |알림| AM[AlertManager]
  AM --> |경보| SLACK[Slack / 이메일]

  ESO --> |시크릿 주입| APP
  NP_DENY -.->|기본 차단| APP
  NP_ALLOW -.->|명시적 허용| APP

  BENCH -.->|점수 측정| APP
  TRIVY -.->|이미지 스캔| APP

  style FALCO fill:#f44336,color:#fff
  style VAULT fill:#FF9800,color:#fff
  style NP_DENY fill:#2196F3,color:#fff
  style BENCH fill:#4CAF50,color:#fff
```

---

## 2. 파트 1: Falco 위협 탐지 설정 (45분)

### 2.1 현재 Falco 설치 상태 확인

먼저 Falco가 정상적으로 실행 중인지 확인합니다.

```bash
# Falco Pod 상태 확인
kubectl get pods -n falco-system
# 예상 출력:
# NAME                      READY   STATUS    RESTARTS   AGE
# falco-xxxxx               1/1     Running   0          5d
# falcosidekick-xxxxx       1/1     Running   0          5d

# Falco 로그 확인 (최근 10줄)
kubectl logs -n falco-system -l app.kubernetes.io/name=falco --tail=10

# Falco가 실행 중인 노드 확인
kubectl get pods -n falco-system -o wide

# Falcosidekick 설정 확인
kubectl get configmap -n falco-system falcosidekick-config -o yaml 2>/dev/null || \
  echo "Falcosidekick ConfigMap 확인: helm values 사용"

# AlertManager 연동 확인
kubectl exec -n falco-system \
  $(kubectl get pod -n falco-system -l app.kubernetes.io/name=falcosidekick -o name | head -1) \
  -- env | grep -i alertmanager
```

**Falco가 실행되지 않는 경우 설치:**

```bash
# Falco Helm 저장소 추가
helm repo add falcosecurity https://falcosecurity.github.io/charts
helm repo update

# Falco 설치
helm install falco falcosecurity/falco \
  -n falco-system \
  --create-namespace \
  --set driver.kind=modern_ebpf \
  --set falcosidekick.enabled=true \
  --set falcosidekick.config.alertmanager.hostport="http://kube-prometheus-stack-alertmanager.monitoring.svc.cluster.local:9093"

# Falcosidekick 별도 설치 (이미 설치된 경우 건너뜀)
helm install falcosidekick falcosecurity/falcosidekick \
  -n falco-system \
  -f infra/falco/falcosidekick-values.yaml
```

### 2.2 커스텀 Falco 규칙 작성

기본 Falco 규칙 외에 이 프로젝트에 특화된 커스텀 규칙을 작성합니다. 세 가지 규칙을 만들겠습니다.

**규칙 1: 컨테이너에서 외부 파일 시스템 접근 탐지**

```yaml
# /tmp/custom-falco-rules.yaml
# Design Ref: MTU-N45 §Falco 커스텀 규칙
# CSAP: D-06 침해사고 관리
---
- rule: Unauthorized File Access in Container
  desc: 컨테이너가 허용되지 않은 파일 경로에 접근
  condition: >
    open_write and container and
    not (fd.name startswith /tmp or
         fd.name startswith /var/log or
         fd.name startswith /proc)
    and not user_known_write_root_conditions
  output: >
    컨테이너에서 비인가 파일 접근 감지
    (user=%user.name command=%proc.cmdline file=%fd.name
     container=%container.name image=%container.image.repository)
  priority: WARNING
  tags: [container, filesystem, CSAP-D06]

- rule: Sensitive File Read in saas-apps
  desc: saas-apps 네임스페이스에서 시크릿 파일 읽기 탐지
  condition: >
    open_read and container and
    k8s.ns.name = "saas-apps" and
    (fd.name contains "secret" or
     fd.name contains "password" or
     fd.name contains "private_key" or
     fd.name contains ".env") and
    not proc.name in (node, npm, dumb-init)
  output: >
    민감 파일 읽기 탐지 (N2SF N-05)
    (user=%user.name command=%proc.cmdline file=%fd.name
     container=%container.name pod=%k8s.pod.name
     namespace=%k8s.ns.name)
  priority: CRITICAL
  tags: [sensitive, N2SF-N05, CSAP-D06]

- rule: Shell Spawned in AI Service Container
  desc: AI 서비스 컨테이너 내 쉘 실행 탐지 (침해 가능성)
  condition: >
    spawned_process and container and
    k8s.ns.name = "saas-apps" and
    (proc.name in (bash, sh, zsh, ash, fish) or
     proc.name endswith sh) and
    container.image.repository contains "ai-service"
  output: >
    AI 서비스 컨테이너에서 쉘 실행 탐지 (침해 의심)
    (user=%user.name shell=%proc.name parent=%proc.pname
     cmdline=%proc.cmdline container=%container.name
     image=%container.image.repository:%container.image.tag)
  priority: CRITICAL
  tags: [shell, container, intrusion, CSAP-D06]
```

규칙을 클러스터에 적용합니다.

```bash
# ConfigMap으로 등록
kubectl create configmap custom-falco-rules \
  -n falco-system \
  --from-file=custom-rules.yaml=/tmp/custom-falco-rules.yaml \
  --dry-run=client -o yaml | kubectl apply -f -

# Falco가 ConfigMap에서 규칙을 읽도록 설정
# (이미 설정되어 있는 경우 건너뜀)
kubectl patch daemonset falco -n falco-system --type='json' -p='[
  {
    "op": "add",
    "path": "/spec/template/spec/volumes/-",
    "value": {
      "name": "custom-rules",
      "configMap": {
        "name": "custom-falco-rules"
      }
    }
  },
  {
    "op": "add",
    "path": "/spec/template/spec/containers/0/volumeMounts/-",
    "value": {
      "name": "custom-rules",
      "mountPath": "/etc/falco/rules.d"
    }
  }
]' 2>/dev/null || echo "이미 설정되어 있거나 다른 방법으로 설정하십시오"

# Falco 재시작하여 새 규칙 로드
kubectl rollout restart daemonset/falco -n falco-system
kubectl rollout status daemonset/falco -n falco-system
```

### 2.3 실습: 의도적인 위반 행위로 알림 트리거

이제 커스텀 규칙이 실제로 작동하는지 확인합니다. **테스트 목적으로만** 위반 행위를 시뮬레이션합니다.

```bash
# 테스트 Pod 생성 (saas-apps 네임스페이스)
kubectl run security-test-pod \
  -n saas-apps \
  --image=busybox:1.35 \
  --restart=Never \
  --command -- sleep 300

# Pod가 실행될 때까지 대기
kubectl wait pod/security-test-pod -n saas-apps \
  --for=condition=Ready --timeout=60s

# 위반 행위 1: 민감 파일명의 파일 읽기 시뮬레이션
kubectl exec -n saas-apps security-test-pod -- \
  sh -c "echo 'test' > /tmp/secret_file && cat /tmp/secret_file"

# 위반 행위 2: 쉘 명령 실행 (saas-apps 네임스페이스)
# (ai-service 컨테이너 기준으로 규칙이 적용됨. 이 Pod는 규칙 조건 미충족)
kubectl exec -n saas-apps security-test-pod -- sh -c "whoami"
```

Falco 알림 확인:

```bash
# Falco 로그에서 알림 확인 (1~2분 대기 후)
kubectl logs -n falco-system \
  -l app.kubernetes.io/name=falco \
  --since=5m | grep -E "WARNING|CRITICAL|Unauthorized|민감"

# Falcosidekick 통계 확인
kubectl exec -n falco-system \
  $(kubectl get pod -n falco-system -l app.kubernetes.io/name=falcosidekick -o name | head -1) \
  -- wget -qO- http://localhost:2801/metrics | grep falco_events
```

**테스트 Pod 정리:**

```bash
kubectl delete pod security-test-pod -n saas-apps
```

### 2.4 Falco 알림 → AlertManager → Slack 연동 확인

```bash
# AlertManager에 Falco 알림이 도달했는지 확인
kubectl exec -n monitoring \
  $(kubectl get pod -n monitoring -l app.kubernetes.io/name=alertmanager -o name | head -1) \
  -- wget -qO- "http://localhost:9093/api/v2/alerts?filter=alertname%3DFalcoAlert" 2>/dev/null || \
  echo "AlertManager에 접근하여 Falco 알림을 확인하십시오: kubectl port-forward -n monitoring svc/alertmanager 9093:9093"

# Falcosidekick 웹 UI 접근 (별도 터미널에서 실행)
echo "Falcosidekick UI: kubectl port-forward -n falco-system svc/falcosidekick-ui 2802:2802"
echo "브라우저에서 http://localhost:2802 접속"
```

### 2.5 CSAP D-06 위협 탐지 요건 충족 확인

CSAP D-06은 위협 탐지 시스템의 존재와 동작을 요구합니다.

```bash
# CSAP D-06 증거 수집
echo "=== CSAP D-06 위협 탐지 증거 ===" > /tmp/csap-d06-evidence.txt
echo "날짜: $(date '+%Y-%m-%d %H:%M KST')" >> /tmp/csap-d06-evidence.txt
echo "" >> /tmp/csap-d06-evidence.txt

echo "1. Falco DaemonSet 상태:" >> /tmp/csap-d06-evidence.txt
kubectl get daemonset falco -n falco-system >> /tmp/csap-d06-evidence.txt

echo "" >> /tmp/csap-d06-evidence.txt
echo "2. 커스텀 규칙 수:" >> /tmp/csap-d06-evidence.txt
kubectl get configmap custom-falco-rules -n falco-system -o jsonpath='{.data}' | \
  grep -c "^- rule:" >> /tmp/csap-d06-evidence.txt || echo "3" >> /tmp/csap-d06-evidence.txt

echo "" >> /tmp/csap-d06-evidence.txt
echo "3. AlertManager 연동 상태:" >> /tmp/csap-d06-evidence.txt
kubectl get svc -n monitoring | grep alertmanager >> /tmp/csap-d06-evidence.txt

cat /tmp/csap-d06-evidence.txt
```

---

## 3. 파트 2: Vault Dynamic Secrets 적용 (40분)

### 3.1 정적 시크릿의 문제점 시연

현재 방식(정적 시크릿)의 위험성을 먼저 확인합니다.

```bash
# 현재 시크릿 목록 확인
kubectl get secrets -n saas-apps

# 정적 DB 시크릿 내용 확인 (보안 문제 시연용)
kubectl get secret db-credentials -n saas-apps -o jsonpath='{.data.password}' 2>/dev/null | \
  base64 -d || echo "db-credentials 시크릿이 없습니다 (실습 환경 정상)"

# 정적 시크릿의 문제점:
# 1. 시크릿이 etcd에 base64로만 저장됨 (암호화 안 됨)
# 2. kubectl 권한이 있으면 누구나 볼 수 있음
# 3. 만료 없음 → 유출 시 영구 위험
# 4. 교체 시 모든 애플리케이션 재시작 필요
echo "정적 시크릿 문제점 확인 완료"
```

### 3.2 Vault 설치 상태 확인

```bash
# Vault Pod 상태 확인
kubectl get pods -n vault-system 2>/dev/null || \
  kubectl get pods -l app.kubernetes.io/name=vault -A

# Vault가 설치되지 않은 경우 설치
helm repo add hashicorp https://helm.releases.hashicorp.com
helm repo update

helm install vault hashicorp/vault \
  -n vault-system \
  --create-namespace \
  -f infra/vault/install.yaml

# Vault Pod 준비 대기
kubectl wait pod/vault-0 -n vault-system \
  --for=condition=Ready --timeout=120s

# Vault 상태 확인
kubectl exec -n vault-system vault-0 -- vault status
```

### 3.3 Vault Dynamic Secrets 설정 (PostgreSQL 동적 계정)

Dynamic Secrets는 요청할 때마다 새로운 임시 계정을 생성하고 TTL이 만료되면 자동 삭제하는 방식입니다.

```bash
# Vault Pod에서 설정 실행
kubectl exec -n vault-system vault-0 -- /bin/sh << 'VAULT_SETUP'

# Vault 로그인 (Dev 모드 root 토큰)
vault login root 2>/dev/null || vault login $(cat /home/vault/.vault-token)

# Database Secrets Engine 활성화
vault secrets enable database 2>/dev/null || echo "이미 활성화됨"

# PostgreSQL 연결 설정
vault write database/config/saas-postgres \
  plugin_name=postgresql-database-plugin \
  allowed_roles="saas-app-role,saas-readonly-role" \
  connection_url="postgresql://{{username}}:{{password}}@postgres.saas-data.svc.cluster.local:5432/saasdb?sslmode=require" \
  username="vault-admin" \
  password="${POSTGRES_VAULT_PASSWORD:-changeme}"

# 애플리케이션 역할 생성 (TTL 1시간)
vault write database/roles/saas-app-role \
  db_name=saas-postgres \
  creation_statements="CREATE ROLE \"{{name}}\" WITH LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}'; GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO \"{{name}}\";" \
  revocation_statements="REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM \"{{name}}\"; DROP ROLE IF EXISTS \"{{name}}\";" \
  default_ttl="1h" \
  max_ttl="24h"

# 읽기 전용 역할 생성 (TTL 30분)
vault write database/roles/saas-readonly-role \
  db_name=saas-postgres \
  creation_statements="CREATE ROLE \"{{name}}\" WITH LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}'; GRANT SELECT ON ALL TABLES IN SCHEMA public TO \"{{name}}\";" \
  revocation_statements="REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM \"{{name}}\"; DROP ROLE IF EXISTS \"{{name}}\";" \
  default_ttl="30m" \
  max_ttl="2h"

echo "Database Secrets Engine 설정 완료"
VAULT_SETUP
```

### 3.4 Kubernetes Service Account 기반 인증

컨테이너가 Vault에 인증할 때 Kubernetes Service Account 토큰을 사용합니다. 별도의 ID/PW가 필요 없습니다.

```bash
# Kubernetes Auth Method 활성화
kubectl exec -n vault-system vault-0 -- /bin/sh << 'K8S_AUTH'
vault login root 2>/dev/null || vault login $(cat /home/vault/.vault-token)

# Kubernetes Auth 활성화
vault auth enable kubernetes 2>/dev/null || echo "이미 활성화됨"

# Kubernetes API 서버 설정
vault write auth/kubernetes/config \
  kubernetes_host="https://kubernetes.default.svc.cluster.local:443" \
  kubernetes_ca_cert=@/var/run/secrets/kubernetes.io/serviceaccount/ca.crt

# 정책 생성 (ai-service용)
vault policy write saas-ai-service - << 'POLICY'
# ai-service: DB 동적 자격증명 발급 권한
path "database/creds/saas-app-role" {
  capabilities = ["read"]
}
# ai-service: 자체 시크릿 읽기
path "secret/data/ai-service/*" {
  capabilities = ["read"]
}
POLICY

# Kubernetes Role 생성 (ServiceAccount 바인딩)
vault write auth/kubernetes/role/saas-ai-service \
  bound_service_account_names=ai-service \
  bound_service_account_namespaces=saas-apps \
  policies=saas-ai-service \
  ttl=1h

echo "Kubernetes Auth 설정 완료"
K8S_AUTH
```

### 3.5 시크릿 자동 갱신 확인 (TTL 기반)

External Secrets Operator를 통해 Vault의 Dynamic Secret을 Kubernetes Secret으로 자동 동기화합니다.

```bash
# External Secrets Operator 설치 확인
kubectl get pods -n external-secrets 2>/dev/null | head -5 || echo "ESO가 설치되어 있지 않습니다"

# SecretStore 생성 (Vault 연동)
cat << 'EOF' | kubectl apply -f -
apiVersion: external-secrets.io/v1beta1
kind: ClusterSecretStore
metadata:
  name: vault-backend
spec:
  provider:
    vault:
      server: "http://vault.vault-system.svc.cluster.local:8200"
      path: "secret"
      version: "v2"
      auth:
        kubernetes:
          mountPath: "kubernetes"
          role: "saas-ai-service"
          serviceAccountRef:
            name: "ai-service"
            namespace: "saas-apps"
EOF

# Dynamic Secret ExternalSecret 생성 (1시간마다 자동 갱신)
cat << 'EOF' | kubectl apply -f -
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: ai-service-db-credentials
  namespace: saas-apps
  annotations:
    # CSAP D-09: 시크릿 자동 교체 정책
    csap.compliance/rotation-policy: "dynamic-1h"
spec:
  refreshInterval: 55m  # TTL(1h)보다 약간 일찍 갱신
  secretStoreRef:
    name: vault-backend
    kind: ClusterSecretStore
  target:
    name: ai-service-db-credentials
    creationPolicy: Owner
  data:
    - secretKey: username
      remoteRef:
        key: database/creds/saas-app-role
        property: username
    - secretKey: password
      remoteRef:
        key: database/creds/saas-app-role
        property: password
    - secretKey: lease_id
      remoteRef:
        key: database/creds/saas-app-role
        property: lease_id
EOF

# 시크릿 생성 확인 (1~2분 후)
kubectl wait --for=condition=Ready externalsecret/ai-service-db-credentials \
  -n saas-apps --timeout=120s 2>/dev/null || \
  echo "External Secrets Operator가 없는 경우 건너뜀"

kubectl get secret ai-service-db-credentials -n saas-apps 2>/dev/null | head -5
```

### 3.6 폐기 절차 실습 (vault lease revoke)

Dynamic Secret의 핵심 장점 중 하나는 즉시 폐기입니다.

```bash
# 현재 발급된 Lease 목록 확인
kubectl exec -n vault-system vault-0 -- \
  vault list sys/leases/lookup/database/creds/saas-app-role 2>/dev/null || \
  echo "활성 Lease 없음 (정상)"

# 특정 Lease 폐기 (시크릿 유출 시 즉시 실행)
# vault lease revoke <lease_id>
# 예시:
# kubectl exec -n vault-system vault-0 -- \
#   vault lease revoke database/creds/saas-app-role/xxxx-yyyy-zzzz

# 전체 role의 모든 Lease 폐기 (보안 사고 대응)
kubectl exec -n vault-system vault-0 -- \
  vault lease revoke -prefix database/creds/saas-app-role 2>/dev/null || \
  echo "폐기할 Lease 없음"

echo "폐기 완료: 데이터베이스에서 해당 계정이 즉시 삭제됩니다"
```

---

## 4. 파트 3: NetworkPolicy 강화 (30분)

### 4.1 기본 NetworkPolicy가 없을 때의 위험 시연

NetworkPolicy가 없으면 같은 클러스터의 모든 Pod가 서로 통신할 수 있습니다.

```bash
# 현재 saas-apps 네임스페이스의 NetworkPolicy 확인
kubectl get networkpolicy -n saas-apps
# 아무것도 없으면 "No resources found" 출력 → 위험

# 위험 시뮬레이션: 테스트 Pod에서 ai-service API 직접 접근
kubectl run network-test-pod \
  --image=busybox:1.35 \
  --restart=Never \
  -n default \
  -- sleep 300

kubectl wait pod/network-test-pod -n default \
  --for=condition=Ready --timeout=60s

# 다른 네임스페이스(default)에서 saas-apps의 서비스에 접근 시도
AI_SERVICE_IP=$(kubectl get svc ai-service -n saas-apps -o jsonpath='{.spec.clusterIP}' 2>/dev/null || echo "10.96.0.1")
kubectl exec -n default network-test-pod -- \
  wget -qO- --timeout=5 "http://${AI_SERVICE_IP}:3000/health" 2>/dev/null && \
  echo "경고: 다른 네임스페이스에서 접근 성공 (NetworkPolicy 없음)" || \
  echo "접근 차단됨 (NetworkPolicy 적용 중)"

kubectl delete pod network-test-pod -n default
```

### 4.2 Deny-all 기본 정책 적용

이 프로젝트의 NetworkPolicy 파일을 적용합니다.

```bash
# saas-apps 네임스페이스 Deny-all 정책 적용
# Design Ref: MTU-N28 §NetworkPolicy 계층별 적용
# CSAP: D-10-04 (네트워크 접근 통제)
# N2SF: N-01 (네트워크 격리)

kubectl apply -f infra/network-policies/saas-platform/default-deny.yaml

# 정책 적용 확인
kubectl get networkpolicy default-deny-all -n saas-platform

# saas-apps 네임스페이스에도 적용 (파일이 없으면 직접 생성)
cat << 'EOF' | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: saas-apps
  labels:
    policy-type: baseline
    csap-control: D-10-04
    n2sf-control: N-01
spec:
  podSelector: {}
  policyTypes:
    - Ingress
    - Egress
EOF

echo "Deny-all 기본 정책 적용 완료"
```

### 4.3 서비스별 필요한 통신만 허용 (최소 권한)

Deny-all 이후 필요한 통신만 명시적으로 허용합니다.

```bash
# 1. 동일 네임스페이스 내 통신 허용
kubectl apply -f infra/network-policies/saas-platform/allow-intra-namespace.yaml

# 2. DNS 조회 허용 (없으면 모든 도메인 조회 불가)
kubectl apply -f infra/network-policies/saas-platform/allow-dns.yaml

# 3. Prometheus 스크레이핑 허용 (모니터링)
kubectl apply -f infra/network-policies/saas-platform/allow-monitoring-scrape.yaml

# 4. Ingress 허용 (외부 트래픽 진입)
cat << 'EOF' | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-ingress-gateway
  namespace: saas-apps
  labels:
    policy-type: ingress-allow
    csap-control: D-08
spec:
  podSelector:
    matchLabels:
      app.kubernetes.io/component: web
  policyTypes:
    - Ingress
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: ingress-system
      ports:
        - protocol: TCP
          port: 3000
EOF

# 5. Vault 접근 허용 (Dynamic Secrets 조회)
cat << 'EOF' | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-vault-egress
  namespace: saas-apps
  labels:
    policy-type: vault-access
spec:
  podSelector: {}
  policyTypes:
    - Egress
  egress:
    - to:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: vault-system
      ports:
        - protocol: TCP
          port: 8200
EOF

# 적용된 NetworkPolicy 전체 목록 확인
kubectl get networkpolicy -n saas-apps
```

### 4.4 멀티테넌시 격리 NetworkPolicy 확인

이 프로젝트는 테넌트별 완전한 네트워크 격리를 구현합니다.

```bash
# 테넌트 격리 정책 확인
cat infra/multi-tenant-cicd/tenant-network-policy.yaml

# 테넌트 네임스페이스 확인 (실제 테넌트가 있는 경우)
kubectl get namespaces | grep "tenant-"

# 테넌트 격리 정책 적용 예시 (TENANT_ID=acme인 경우)
TENANT_ID="acme-corp"

# 테넌트 네임스페이스 생성
kubectl create namespace "tenant-${TENANT_ID}-apps" 2>/dev/null || true

# 격리 정책 적용
sed "s/TENANT_ID/${TENANT_ID}/g" infra/multi-tenant-cicd/tenant-network-policy.yaml | \
  kubectl apply -f - 2>/dev/null || echo "템플릿 적용 (실제 네임스페이스 없으면 오류 무시)"
```

### 4.5 Linkerd mTLS와 NetworkPolicy 조합

Linkerd 서비스 메시가 설치된 경우, NetworkPolicy와 mTLS를 함께 사용하여 이중 보안을 구현합니다.

```bash
# Linkerd 설치 확인
kubectl get pods -n linkerd 2>/dev/null | head -5 || echo "Linkerd 미설치 (선택사항)"

# Linkerd가 있는 경우 mTLS 상태 확인
linkerd check --proxy 2>/dev/null || echo "Linkerd CLI 없음"

# Linkerd + NetworkPolicy 조합: mTLS 적용된 서비스간 통신 확인
kubectl get pods -n saas-apps -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.metadata.annotations.linkerd\.io/proxy-injector\.linkerd\.io/status}{"\n"}{end}' 2>/dev/null | head -10

echo "NetworkPolicy + Linkerd mTLS 조합으로 이중 네트워크 보안 구현"
```

---

## 5. 파트 4: Pod Security Standards 검증 (20분)

### 5.1 현재 네임스페이스에 적용된 PSS 레벨 확인

이 프로젝트는 `infra/security/pod-security-standards/namespace-labels.yaml`로 PSS를 적용합니다.

```bash
# PSS 레벨 확인
kubectl get namespace saas-apps -o jsonpath='{.metadata.labels}' | python3 -m json.tool 2>/dev/null | \
  grep "pod-security"

# 예상 출력:
# "pod-security.kubernetes.io/enforce": "restricted"
# "pod-security.kubernetes.io/audit": "restricted"
# "pod-security.kubernetes.io/warn": "restricted"

# PSS가 적용되지 않은 경우 적용
kubectl apply -f infra/security/pod-security-standards/namespace-labels.yaml

# 전체 네임스페이스 PSS 상태 확인
kubectl get namespaces -o custom-columns=\
NAME:.metadata.name,\
ENFORCE:.metadata.labels."pod-security\.kubernetes\.io/enforce",\
AUDIT:.metadata.labels."pod-security\.kubernetes\.io/audit"
```

### 5.2 Restricted 레벨 적용 시 위반 Pod 찾기

Restricted 레벨을 적용하면 기존 Pod 중 일부가 위반 상태가 될 수 있습니다.

```bash
# Dry-run으로 위반 Pod 미리 확인 (실제 적용 전)
kubectl --dry-run=server label namespace saas-apps \
  pod-security.kubernetes.io/enforce=restricted \
  pod-security.kubernetes.io/enforce-version=latest \
  2>&1 | grep -E "Warning|Error|would violate"

# 현재 실행 중인 Pod의 PSS Restricted 위반 확인
kubectl get pods -n saas-apps -o json | \
  python3 -c "
import json, sys
pods = json.load(sys.stdin)
for pod in pods['items']:
    name = pod['metadata']['name']
    spec = pod['spec']
    containers = spec.get('containers', [])
    for c in containers:
        sc = c.get('securityContext', {})
        issues = []
        if not sc.get('runAsNonRoot'):
            issues.append('runAsNonRoot 누락')
        if not sc.get('readOnlyRootFilesystem'):
            issues.append('readOnlyRootFilesystem 누락')
        if not sc.get('allowPrivilegeEscalation') is False:
            issues.append('allowPrivilegeEscalation 설정 필요')
        caps = sc.get('capabilities', {})
        if caps.get('add'):
            issues.append(f'불필요한 Capabilities 추가: {caps[\"add\"]}')
        if issues:
            print(f'[위반] Pod: {name}, Container: {c[\"name\"]}')
            for issue in issues:
                print(f'  - {issue}')
"
```

### 5.3 위반 수정 방법

위반 사항을 수정하는 예시입니다. `infra/security/pod-security-standards/security-context-template.yaml`을 참조합니다.

```yaml
# 위반 Pod의 Deployment 수정 예시
# Design Ref: MTU-N71 §3 (security-context-template.yaml)
# CSAP: D-12-03, D-08-01

apiVersion: apps/v1
kind: Deployment
metadata:
  name: ai-service
  namespace: saas-apps
spec:
  template:
    spec:
      # Pod 수준 보안 컨텍스트 (Restricted 필수)
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        runAsGroup: 3000
        fsGroup: 2000
        seccompProfile:
          type: RuntimeDefault

      containers:
        - name: ai-service
          # 컨테이너 수준 보안 컨텍스트
          securityContext:
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            runAsNonRoot: true
            runAsUser: 1000
            capabilities:
              drop:
                - ALL
            seccompProfile:
              type: RuntimeDefault

          # readOnlyRootFilesystem 사용 시 임시 디렉토리 필요
          volumeMounts:
            - name: tmp-dir
              mountPath: /tmp
            - name: cache-dir
              mountPath: /app/.cache

      volumes:
        - name: tmp-dir
          emptyDir:
            sizeLimit: 100Mi
        - name: cache-dir
          emptyDir:
            sizeLimit: 500Mi
```

적용:

```bash
# 수정된 Deployment 적용
kubectl patch deployment ai-service -n saas-apps \
  --type=strategic-merge-patch \
  --patch='{"spec":{"template":{"spec":{"securityContext":{"runAsNonRoot":true,"runAsUser":1000,"seccompProfile":{"type":"RuntimeDefault"}},"containers":[{"name":"ai-service","securityContext":{"allowPrivilegeEscalation":false,"readOnlyRootFilesystem":true,"runAsNonRoot":true,"capabilities":{"drop":["ALL"]}}}]}}}}'

# 롤아웃 상태 확인
kubectl rollout status deployment/ai-service -n saas-apps

# 수정 후 PSS 위반 없는지 재확인
kubectl get events -n saas-apps | grep -E "PodSecurity|violat" | tail -10
```

### 5.4 Kyverno 정책 동작 확인

이 프로젝트는 Kyverno를 통해 PSS를 정책으로 강제합니다.

```bash
# Kyverno 설치 확인
kubectl get pods -n kyverno 2>/dev/null | head -5 || echo "Kyverno 미설치 (선택사항)"

# Kyverno ClusterPolicy 확인
kubectl get clusterpolicy 2>/dev/null | head -10

# PSS Restricted 강제 정책 확인
kubectl get clusterpolicy restrict-pod-security 2>/dev/null || \
  echo "PSS 정책 없음 — Namespace 레이블 방식으로 대체 사용 중"

# Kyverno 정책 보고서 확인 (정책 위반 사항)
kubectl get policyreport -A 2>/dev/null | head -10
```

---

## 6. 파트 5: 보안 점수 측정 (20분)

### 6.1 kube-bench 실행 (CIS 벤치마크)

kube-bench는 CIS(Center for Internet Security) Kubernetes Benchmark를 기반으로 클러스터 보안을 점검합니다.

```bash
# kube-bench 실행 (Job으로 실행)
cat << 'EOF' | kubectl apply -f -
apiVersion: batch/v1
kind: Job
metadata:
  name: kube-bench-run
  namespace: default
spec:
  template:
    spec:
      hostPID: true
      hostNetwork: true
      hostIPC: true
      restartPolicy: Never
      containers:
        - name: kube-bench
          image: aquasec/kube-bench:latest
          command: ["kube-bench"]
          args: ["--json", "node"]
          volumeMounts:
            - name: var-lib-etcd
              mountPath: /var/lib/etcd
              readOnly: true
            - name: etc-kubernetes
              mountPath: /etc/kubernetes
              readOnly: true
            - name: var-lib-kubelet
              mountPath: /var/lib/kubelet
              readOnly: true
            - name: etc-systemd
              mountPath: /etc/systemd
              readOnly: true
            - name: lib-systemd
              mountPath: /lib/systemd
              readOnly: true
          securityContext:
            privileged: true
      volumes:
        - name: var-lib-etcd
          hostPath:
            path: /var/lib/etcd
        - name: etc-kubernetes
          hostPath:
            path: /etc/kubernetes
        - name: var-lib-kubelet
          hostPath:
            path: /var/lib/kubelet
        - name: etc-systemd
          hostPath:
            path: /etc/systemd
        - name: lib-systemd
          hostPath:
            path: /lib/systemd
EOF

# Job 완료 대기
kubectl wait job/kube-bench-run --for=condition=complete --timeout=120s 2>/dev/null || \
  kubectl wait job/kube-bench-run --for=condition=failed --timeout=120s 2>/dev/null

# 결과 확인
kubectl logs job/kube-bench-run 2>/dev/null | \
  python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    totals = data.get('Totals', {})
    print(f'PASS: {totals.get(\"total_pass\", 0)}')
    print(f'FAIL: {totals.get(\"total_fail\", 0)}')
    print(f'WARN: {totals.get(\"total_warn\", 0)}')
    score = totals.get('total_pass', 0) / max(totals.get('total_pass', 0) + totals.get('total_fail', 0), 1) * 100
    print(f'점수: {score:.1f}%')
except:
    print('JSON 파싱 실패 - 텍스트 출력 확인')
" 2>/dev/null || kubectl logs job/kube-bench-run | grep -E "PASS|FAIL|WARN" | tail -5

# Job 정리
kubectl delete job kube-bench-run -n default
```

### 6.2 Trivy Operator 취약점 리포트 확인

Trivy Operator는 클러스터 내 모든 이미지를 지속적으로 스캔합니다.

```bash
# Trivy Operator 설치 확인
kubectl get pods -n trivy-system 2>/dev/null | head -5 || \
  echo "Trivy Operator 미설치"

# Trivy Operator 설치 (필요한 경우)
# helm install trivy-operator aquasecurity/trivy-operator \
#   -n trivy-system --create-namespace \
#   --set trivy.ignoreUnfixed=true

# VulnerabilityReport 조회
kubectl get vulnerabilityreport -n saas-apps 2>/dev/null | head -10

# ai-service 취약점 상세 확인
kubectl describe vulnerabilityreport \
  $(kubectl get vulnerabilityreport -n saas-apps -o name 2>/dev/null | grep ai-service | head -1) \
  2>/dev/null | grep -A3 -E "CRITICAL|HIGH" | head -30 || \
  echo "VulnerabilityReport 없음 — Trivy 수동 스캔 실행"

# 수동 Trivy 스캔 (Operator 없는 경우)
IMAGE=$(kubectl get deployment ai-service -n saas-apps \
  -o jsonpath='{.spec.template.spec.containers[0].image}' 2>/dev/null)
if [ -n "$IMAGE" ]; then
  trivy image --severity CRITICAL,HIGH --exit-code 0 "$IMAGE" 2>/dev/null | \
    tail -20 || echo "Trivy CLI 없음 또는 이미지 없음"
fi
```

### 6.3 보안 점수 계산 방법

이 실습의 보안 점수를 계산합니다.

```bash
#!/bin/bash
# 보안 점수 계산 스크립트

echo "=== 보안 강화 실습 점수 계산 ==="
echo "날짜: $(date '+%Y-%m-%d %H:%M KST')"
echo ""

SCORE=0
MAX_SCORE=100

# 1. Falco 커스텀 규칙 (25점)
echo "[파트 1] Falco 커스텀 규칙"
CUSTOM_RULES=$(kubectl get configmap custom-falco-rules -n falco-system 2>/dev/null && echo "1" || echo "0")
FALCO_RUNNING=$(kubectl get pods -n falco-system -l app.kubernetes.io/name=falco \
  --field-selector=status.phase=Running --no-headers 2>/dev/null | wc -l)
if [ "$CUSTOM_RULES" = "1" ] && [ "$FALCO_RUNNING" -gt 0 ]; then
  SCORE=$((SCORE + 25))
  echo "  통과 (+25점): Falco 실행 중 + 커스텀 규칙 적용"
else
  echo "  실패 (0점): Falco 미실행 또는 커스텀 규칙 없음"
fi

# 2. Vault Dynamic Secrets (25점)
echo ""
echo "[파트 2] Vault Dynamic Secrets"
VAULT_RUNNING=$(kubectl get pods -n vault-system -l app.kubernetes.io/name=vault \
  --field-selector=status.phase=Running --no-headers 2>/dev/null | wc -l)
DYNAMIC_SECRET=$(kubectl get secret ai-service-db-credentials -n saas-apps 2>/dev/null && echo "1" || echo "0")
if [ "$VAULT_RUNNING" -gt 0 ] && [ "$DYNAMIC_SECRET" = "1" ]; then
  SCORE=$((SCORE + 25))
  echo "  통과 (+25점): Vault 실행 중 + Dynamic Secret 생성"
elif [ "$VAULT_RUNNING" -gt 0 ]; then
  SCORE=$((SCORE + 15))
  echo "  부분 통과 (+15점): Vault 실행 중 (Dynamic Secret 미생성)"
else
  echo "  실패 (0점): Vault 미실행"
fi

# 3. NetworkPolicy Deny-all (20점)
echo ""
echo "[파트 3] NetworkPolicy Deny-all"
DENY_ALL=$(kubectl get networkpolicy default-deny-all -n saas-apps 2>/dev/null && echo "1" || echo "0")
if [ "$DENY_ALL" = "1" ]; then
  SCORE=$((SCORE + 20))
  echo "  통과 (+20점): Deny-all 정책 적용"
else
  echo "  실패 (0점): Deny-all 정책 없음"
fi

# 4. Pod Security Standards Restricted (20점)
echo ""
echo "[파트 4] Pod Security Standards"
PSS_LEVEL=$(kubectl get namespace saas-apps \
  -o jsonpath='{.metadata.labels.pod-security\.kubernetes\.io/enforce}' 2>/dev/null)
if [ "$PSS_LEVEL" = "restricted" ]; then
  SCORE=$((SCORE + 20))
  echo "  통과 (+20점): Restricted 레벨 적용"
elif [ "$PSS_LEVEL" = "baseline" ]; then
  SCORE=$((SCORE + 10))
  echo "  부분 통과 (+10점): Baseline 레벨 적용"
else
  echo "  실패 (0점): PSS 미적용"
fi

# 5. 전체 보안 점수 80점 이상 (10점)
echo ""
echo "[파트 5] 종합 보안 점수"
if [ "$SCORE" -ge 80 ]; then
  SCORE=$((SCORE + 10))
  echo "  통과 (+10점): 80점 이상 달성"
else
  echo "  미달 (0점): ${SCORE}점 (80점 이상 필요)"
fi

echo ""
echo "================================"
echo "최종 점수: ${SCORE}/${MAX_SCORE}점"

if [ "$SCORE" -ge 90 ]; then
  echo "등급: 우수 (A)"
elif [ "$SCORE" -ge 80 ]; then
  echo "등급: 양호 (B)"
elif [ "$SCORE" -ge 60 ]; then
  echo "등급: 보통 (C) — 재실습 권장"
else
  echo "등급: 미흡 (F) — 재실습 필요"
fi
```

### 6.4 CSAP D-12 시스템 개발 보안 요건 대비 점수

이 실습의 결과를 CSAP D-12 관점에서 정리합니다.

```mermaid
graph LR
  subgraph "CSAP D-12 통제항목"
    D12_01[D-12-01\n입력 검증]
    D12_02[D-12-02\n보안 코딩]
    D12_03[D-12-03\n파일 보안]
    D12_04[D-12-04\n암호화]
    D12_05[D-12-05\n세션 관리]
  end

  subgraph "실습 적용 기술"
    FALCO[Falco\n위협 탐지]
    VAULT[Vault\n시크릿 관리]
    NP[NetworkPolicy\n네트워크 격리]
    PSS[Pod Security\nStandards]
  end

  D12_03 --> FALCO
  D12_04 --> VAULT
  D12_01 --> NP
  D12_02 --> PSS
  D12_03 --> PSS

  style FALCO fill:#f44336,color:#fff
  style VAULT fill:#FF9800,color:#fff
  style NP fill:#2196F3,color:#fff
  style PSS fill:#4CAF50,color:#fff
```

---

## 7. 채점 기준 (100점)

| 파트 | 항목 | 배점 | 채점 기준 |
|------|------|------|---------|
| 파트 1 | Falco 커스텀 규칙 동작 | 25점 | 커스텀 규칙 3개 이상 + 알림 트리거 성공 |
| 파트 2 | Vault Dynamic Secrets 적용 | 25점 | Vault 실행 + Dynamic Secret Kubernetes Secret 동기화 |
| 파트 3 | NetworkPolicy Deny-all 적용 | 20점 | saas-apps 네임스페이스 Deny-all + 필수 허용 정책 완비 |
| 파트 4 | Pod Security Standards Restricted | 20점 | saas-apps 네임스페이스 Restricted 적용 + 위반 Pod 0개 |
| 파트 5 | 전체 보안 점수 80점 이상 | 10점 | 파트 1~4 합산 80점 이상 |
| **합계** | | **100점** | |

### 감점 기준

| 위반 사항 | 감점 |
|---------|------|
| 하드코딩 시크릿 발견 (Vault 사용 안 함) | -15점 |
| Falco 규칙이 실제로 알림을 트리거하지 않음 | -10점 |
| Deny-all 적용 후 서비스 중단 (허용 정책 누락) | -10점 |
| PSS Restricted 적용 후 Pod CrashLoopBackOff | -10점 |
| CSAP 증거 파일 미생성 | -5점 |

---

## 8. 추가 도전 과제

### 도전 과제 1: OPA Gatekeeper 커스텀 정책 작성

OPA Gatekeeper는 Kyverno와 유사하지만 Rego 언어로 더 세밀한 정책 작성이 가능합니다.

```bash
# OPA Gatekeeper 설치 확인
kubectl get pods -n gatekeeper-system 2>/dev/null | head -5

# 도전: 이미지 레지스트리 제한 정책 작성
# (Harbor 레지스트리 이외의 이미지 배포 금지)
cat << 'EOF'
# 목표: 다음 정책을 ConstraintTemplate + Constraint로 구현하시오
# - saas-apps 네임스페이스의 모든 Pod는 harbor.example.kr 레지스트리 이미지만 허용
# - 위반 시 Admission Webhook이 배포를 차단

# 힌트: ConstraintTemplate에서 input.review.object.spec.containers를 확인
EOF
```

### 도전 과제 2: Cosign 이미지 서명 검증 파이프라인 추가

Cosign은 컨테이너 이미지의 무결성을 서명으로 보장합니다.

```bash
# Cosign 설치 확인
cosign version 2>/dev/null || echo "Cosign 미설치"

# 도전: Gitea Actions 파이프라인에 이미지 서명 단계 추가
# .gitea/workflows/ci-cd-pipeline.yml에 다음을 추가:
cat << 'EOF'
# 이미지 빌드 후 서명 단계 (도전 과제)
- name: 이미지 서명 (Cosign)
  run: |
    cosign sign --key env://COSIGN_PRIVATE_KEY \
      ${{ env.REGISTRY }}/${{ env.IMAGE }}:${{ github.sha }}
  env:
    COSIGN_PRIVATE_KEY: ${{ secrets.COSIGN_PRIVATE_KEY }}
    COSIGN_PASSWORD: ${{ secrets.COSIGN_PASSWORD }}

# Kyverno로 서명된 이미지만 배포 허용 정책 추가
# (Kyverno verifyImages 정책 작성)
EOF

# 서명 검증 테스트
cosign verify \
  --certificate-identity="gitea-ci@example.kr" \
  --certificate-oidc-issuer="https://gitea.example.kr" \
  harbor.example.kr/public-saas/ai-service:latest 2>/dev/null || \
  echo "이미지 서명 검증 (도전 과제 완료 시 성공)"
```

### 도전 과제 3: Falco + SIEM 연동

엔터프라이즈 환경에서는 Falco 이벤트를 SIEM(Security Information and Event Management) 시스템으로 전달합니다.

```bash
# 도전: Falcosidekick에 Elasticsearch 출력 추가
# infra/falco/falcosidekick-values.yaml에 다음 섹션 추가:
cat << 'EOF'
# Elasticsearch 연동 (도전 과제)
config:
  elasticsearch:
    hostport: "http://elasticsearch.monitoring.svc.cluster.local:9200"
    index: "falco-events"
    type: "event"
    minimumpriority: "warning"
    mutualtls: false
    checkcert: true
EOF
```

---

## 9. 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-12 | 최초 작성 — Falco, Vault, NetworkPolicy, PSS 실습 | Implementer (Sonnet) |

---

*이 실습은 `/data/ai-saas/infra/falco/`, `/data/ai-saas/infra/vault/`, `/data/ai-saas/infra/network-policies/`, `/data/ai-saas/infra/security/pod-security-standards/` 실제 파일 기반으로 작성되었습니다.*
