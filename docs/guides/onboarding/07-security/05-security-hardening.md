# 보안 강화 (Security Hardening) 완전 가이드

> **문서 ID**: ONBOARD-07-05
> **버전**: 1.0.0 | **작성일**: 2026-04-12 | **작성자**: Implementer (Sonnet)
> **학습 대상**: 보안 코딩 패턴과 OWASP Top 10을 학습한 신규 팀원
> **선행 문서**:
> - `07-security/coding/01-secure-patterns.md` — 보안 코딩 패턴
> - `07-security/coding/02-owasp-patterns.md` — OWASP Top 10 패턴
> **예상 소요 시간**: 약 120분
> **CSAP**: D-08 (접근 통제), D-09 (암호화), D-11 (가상화 보안), D-12 (시스템 개발 보안)
> **Design Ref**: `infra/security/pod-security-standards/security-context-template.yaml`,
> `infra/gateway-api/middlewares/security-headers.yaml`

---

## 목차

1. [보안 강화(Hardening) 개념](#1-보안-강화hardening-개념)
2. [Kubernetes 보안 강화](#2-kubernetes-보안-강화)
3. [NetworkPolicy로 Pod 간 통신 제한](#3-networkpolicy로-pod-간-통신-제한)
4. [etcd Secrets 암호화](#4-etcd-secrets-암호화)
5. [애플리케이션 보안 강화 — HTTP 보안 헤더](#5-애플리케이션-보안-강화--http-보안-헤더)
6. [의존성 보안 — Trivy + SBOM](#6-의존성-보안--trivy--sbom)
7. [컨테이너 이미지 서명 — Cosign + Sigstore](#7-컨테이너-이미지-서명--cosign--sigstore)
8. [런타임 보안 — Falco](#8-런타임-보안--falco)
9. [시크릿 관리 강화 — Vault Dynamic Secrets](#9-시크릿-관리-강화--vault-dynamic-secrets)
10. [보안 패치 관리](#10-보안-패치-관리)
11. [학습 체크리스트](#학습-체크리스트)
12. [다음 단계](#다음-단계)

---

## 1. 보안 강화(Hardening) 개념

### 1.1 Hardening이란?

보안 강화(Hardening)는 시스템의 **공격 표면(Attack Surface)**을 최소화하는 과정입니다. 쉽게 말하면, 문을 잠그고 창문을 닫고 불필요한 입구를 모두 막는 것과 같습니다.

기본 설치 상태의 소프트웨어나 인프라는 편의성을 위해 많은 기능이 활성화되어 있습니다. 이 중 불필요한 기능은 공격자가 악용할 수 있는 취약점이 됩니다. Hardening은 "필요한 것만 허용하고 나머지는 모두 차단"하는 방식으로 이 공격 표면을 줄입니다.

### 1.2 세 가지 핵심 원칙

#### 원칙 1: Default Deny (기본 거부)

모든 접근을 기본적으로 거부하고, 명시적으로 허용된 것만 통과시키는 방식입니다.

```
❌ Default Allow (기본 허용):
   모든 것을 허용 → 차단 목록에 있는 것만 막음
   "블랙리스트 방식"
   문제점: 새로운 공격 유형은 블랙리스트에 없으므로 통과

✅ Default Deny (기본 거부):
   모든 것을 차단 → 허용 목록에 있는 것만 통과
   "화이트리스트 방식"
   장점: 알려지지 않은 공격도 자동으로 차단
```

이 프로젝트에서 Default Deny 구현 사례:
- **Kubernetes NetworkPolicy**: 지정된 Pod 간 통신만 허용
- **Kyverno 정책**: 허용된 레지스트리(Harbor)의 이미지만 배포 가능
- **Traefik 미들웨어**: 정의된 HTTP 메서드만 허용 (GET, POST, PUT, DELETE, OPTIONS)
- **RBAC**: 명시적으로 부여된 권한만 가능

#### 원칙 2: Principle of Least Privilege (최소 권한 원칙)

사용자, 프로세스, 서비스는 자신의 임무를 수행하는 데 필요한 최소한의 권한만 가져야 합니다.

```
❌ 과도한 권한:
   모든 서비스가 DB 읽기/쓰기/삭제 권한 보유
   앱 서버가 root로 실행
   모든 개발자가 프로덕션 시크릿 접근 가능

✅ 최소 권한:
   읽기 전용 서비스는 SELECT만 가능 (INSERT/DELETE 불가)
   앱 서버는 UID 1000 비루트 사용자로 실행
   개발자는 개발 환경 시크릿만 접근 가능
```

이 프로젝트의 최소 권한 구현:
- Pod `securityContext`: `runAsUser: 1000`, `capabilities.drop: ["ALL"]`
- Vault 정책: 서비스별 필요한 경로만 읽기 가능
- Kubernetes ServiceAccount: 각 서비스별 별도 SA, RBAC으로 최소 권한 부여
- DB 접근: 서비스별 별도 DB 사용자, 필요한 테이블만 접근

#### 원칙 3: Defense in Depth (심층 방어)

단일 보안 계층이 뚫렸을 때를 대비해 여러 계층의 방어막을 구성합니다. 성의 해자, 성벽, 문, 성채로 이루어진 여러 겹의 방어와 같습니다.

```mermaid
graph TB
    subgraph "공격자의 침투 경로"
        ATK[공격자]
    end

    subgraph "계층 1: 네트워크 경계"
        FW[방화벽 / Traefik 인그레스]
        DDoS[DDoS 방어 / Rate Limit]
    end

    subgraph "계층 2: 애플리케이션"
        AUTH[인증 / JWT 검증]
        RBAC[인가 / RBAC 검사]
        INPUT[입력 검증 / Zod]
        WAF[보안 헤더 / CSP / HSTS]
    end

    subgraph "계층 3: 컨테이너 / 런타임"
        PSS[Pod Security Standards]
        NET[NetworkPolicy]
        FALCO[Falco 런타임 모니터링]
    end

    subgraph "계층 4: 데이터"
        ENC[AES-256 암호화]
        ETCD[etcd 암호화]
        VAULT[Vault 시크릿 관리]
    end

    subgraph "계층 5: 감사 / 탐지"
        AUDIT[감사 로그 / audit.jsonl]
        MONITOR[Grafana 대시보드]
        ALERT[AlertManager 알림]
    end

    ATK -->|시도| FW
    FW -->|통과| AUTH
    AUTH -->|통과| PSS
    PSS -->|통과| ENC
    ENC -->|이상 감지| AUDIT

    style ATK fill:#ff4444,color:#fff
    style FW fill:#ff8800,color:#fff
    style AUTH fill:#ffaa00,color:#000
    style PSS fill:#88bb00,color:#fff
    style ENC fill:#0088bb,color:#fff
    style AUDIT fill:#8844bb,color:#fff
```

한 계층이 뚫리더라도 다음 계층이 공격을 막습니다. 모든 계층을 동시에 뚫기는 매우 어렵습니다.

---

## 2. Kubernetes 보안 강화

### 2.1 Pod Security Standards (PSS)

Kubernetes는 세 가지 보안 정책 레벨을 제공합니다.

| 레벨 | 설명 | 이 프로젝트 적용 |
|------|------|----------------|
| **Privileged** | 모든 권한 허용 (사실상 보안 없음) | 금지 |
| **Baseline** | 최소한의 제한 (명백히 위험한 설정만 차단) | 개발 환경 일부 |
| **Restricted** | 강력한 제한 (대부분의 권한 차단) | 모든 서비스 적용 |

> **CSAP D-11 요건**: 가상화(컨테이너) 보안 — Restricted 정책 적용 의무

```bash
# 네임스페이스에 Restricted 정책 적용
kubectl label namespace saas \
  pod-security.kubernetes.io/enforce=restricted \
  pod-security.kubernetes.io/enforce-version=latest \
  pod-security.kubernetes.io/warn=restricted \
  pod-security.kubernetes.io/audit=restricted
```

### 2.2 securityContext 필수 설정

모든 서비스 Pod에 다음 보안 설정을 반드시 적용합니다. 이 설정들은 실제 코드베이스의 `/data/ai-saas/infra/security/pod-security-standards/security-context-template.yaml`에서 가져왔습니다.

```yaml
# Design Ref: infra/security/pod-security-standards/security-context-template.yaml
# CSAP D-11 (가상화 보안), D-12-03 (개발 보안)

apiVersion: apps/v1
kind: Deployment
metadata:
  name: auth-service
  namespace: saas
spec:
  template:
    spec:
      # Pod 레벨 보안 설정
      securityContext:
        runAsNonRoot: true       # root 실행 금지
        runAsUser: 1000          # UID 1000으로 실행
        runAsGroup: 3000         # GID 3000으로 실행
        fsGroup: 2000            # 파일 시스템 그룹 ID
        seccompProfile:
          type: RuntimeDefault   # seccomp 필터 적용

      containers:
        - name: auth-service
          image: harbor.saas-platform.local/public-saas/auth-service:main-abc1234

          # 컨테이너 레벨 보안 설정
          securityContext:
            allowPrivilegeEscalation: false  # 권한 상승 금지
            readOnlyRootFilesystem: true     # 루트 파일시스템 읽기 전용
            runAsNonRoot: true               # root 실행 금지
            runAsUser: 1000                  # UID 1000 강제
            capabilities:
              drop:
                - ALL                        # 모든 Linux 능력 제거
            seccompProfile:
              type: RuntimeDefault

          # readOnlyRootFilesystem: true 시 임시 디렉토리 필요
          volumeMounts:
            - name: tmp-dir
              mountPath: /tmp
            - name: app-logs
              mountPath: /app/logs

      volumes:
        - name: tmp-dir
          emptyDir: {}
        - name: app-logs
          emptyDir: {}
```

#### 각 설정의 의미

| 설정 | 왜 필요한가 | 없으면 어떤 위험? |
|------|-----------|-----------------|
| `runAsNonRoot: true` | root로 실행된 컨테이너는 호스트 시스템에 더 쉽게 접근 가능 | 컨테이너 탈출 시 호스트 root 권한 획득 위험 |
| `allowPrivilegeEscalation: false` | setuid 비트, sudo 등으로 권한 상승 방지 | 일반 사용자 → root로 권한 상승 공격 가능 |
| `readOnlyRootFilesystem: true` | 파일 시스템 변조 방지 | 악성 코드가 바이너리 파일을 덮어쓸 수 있음 |
| `capabilities.drop: ["ALL"]` | NET_RAW, SYS_ADMIN 등 Linux 능력 제거 | 능력 악용으로 네트워크 스니핑, 커널 수정 가능 |
| `seccompProfile: RuntimeDefault` | 위험한 시스템 콜 필터링 | 커널 취약점 직접 공격 가능 |

### 2.3 Restricted 정책 위반 시 발생하는 일

```bash
# 잘못된 Deployment 배포 시도 (root 실행)
kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: bad-app
  namespace: saas
spec:
  template:
    spec:
      containers:
        - name: bad-app
          image: harbor.saas-platform.local/public-saas/bad-app:latest
          # securityContext 미설정
EOF

# 결과: 배포 거부
# Error: pods "bad-app-xxx" is forbidden:
#   violates PodSecurity "restricted:latest":
#   allowPrivilegeEscalation != false (containers "bad-app" must set
#   securityContext.allowPrivilegeEscalation=false),
#   unrestricted capabilities (containers "bad-app" must set
#   securityContext.capabilities.drop=["ALL"])
```

> ⚠️ 이 오류가 발생하면 `securityContext` 설정을 추가해야 합니다. `09-troubleshooting/01-common-errors.md`의 "Pod Security Standards 위반" 항목을 참조하십시오.

---

## 3. NetworkPolicy로 Pod 간 통신 제한

### 3.1 NetworkPolicy의 필요성

기본적으로 Kubernetes 클러스터 내의 모든 Pod는 서로 자유롭게 통신할 수 있습니다. 이는 편리하지만, 한 서비스가 침해당하면 공격자가 내부 네트워크를 자유롭게 이동(Lateral Movement)할 수 있음을 의미합니다.

NetworkPolicy는 Pod 간 통신을 명시적으로 허용된 경우만 허용합니다.

```mermaid
graph LR
    subgraph "NetworkPolicy 없을 때 (위험)"
        A1[auth-service] -->|자유 통신| B1[billing-service]
        A1 -->|자유 통신| C1[ai-service]
        B1 -->|자유 통신| C1
        C1 -->|직접 접근 가능!| D1[(DB)]
    end

    subgraph "NetworkPolicy 적용 후 (안전)"
        A2[auth-service] -->|허용| B2[api-gateway]
        B2 -->|허용| C2[user-service]
        X2[ai-service] -->|차단 ❌| D2[(user DB)]
        AI2[ai-service] -->|허용| AIDB2[(ai DB만 접근)]
    end
```

### 3.2 Default Deny NetworkPolicy

먼저 모든 트래픽을 차단하는 기본 정책을 적용합니다.

```yaml
# infra/network-policies/default-deny.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: saas
spec:
  podSelector: {}       # 네임스페이스의 모든 Pod에 적용
  policyTypes:
    - Ingress           # 들어오는 트래픽 차단
    - Egress            # 나가는 트래픽 차단
```

### 3.3 서비스별 허용 정책

기본 차단 후, 필요한 통신만 허용합니다.

```yaml
# auth-service: API Gateway에서만 수신, DB에만 송신
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: auth-service-network-policy
  namespace: saas
spec:
  podSelector:
    matchLabels:
      app: auth-service
  policyTypes:
    - Ingress
    - Egress

  ingress:
    # API Gateway에서 오는 트래픽만 허용
    - from:
        - podSelector:
            matchLabels:
              app: api-gateway
      ports:
        - protocol: TCP
          port: 3001

  egress:
    # PostgreSQL DB에만 연결 가능
    - to:
        - podSelector:
            matchLabels:
              app: postgresql
      ports:
        - protocol: TCP
          port: 5432

    # Redis에만 연결 가능 (세션/블랙리스트)
    - to:
        - podSelector:
            matchLabels:
              app: redis
      ports:
        - protocol: TCP
          port: 6379

    # DNS 조회 허용 (모든 서비스 필수)
    - ports:
        - protocol: UDP
          port: 53
```

### 3.4 NetworkPolicy 적용 확인

```bash
# 정책이 적용되었는지 확인
kubectl get networkpolicies -n saas

# auth-service에서 ai-service로 통신이 차단되는지 확인
kubectl exec -n saas deployment/auth-service -- \
  curl -m 3 http://ai-service:3010/health

# 예상 결과: connection timed out (차단됨)

# auth-service에서 api-gateway로 통신 확인
kubectl exec -n saas deployment/auth-service -- \
  curl -m 3 http://postgresql:5432
# 예상 결과: 연결 성공 (허용됨)
```

---

## 4. etcd Secrets 암호화

### 4.1 왜 etcd 암호화가 필요한가?

Kubernetes의 Secret 오브젝트는 base64 인코딩만 되어 있고 실제로는 평문입니다. etcd(Kubernetes 데이터 저장소)에 접근하면 모든 Secret을 읽을 수 있습니다.

```bash
# etcd에서 Secret을 직접 읽으면 평문으로 보임 (암호화 전)
ETCDCTL_API=3 etcdctl get /registry/secrets/saas/auth-service-secrets \
  --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key | strings
# JWT_SECRET=my-actual-jwt-secret-key ← 평문 노출!
```

### 4.2 etcd 암호화 설정 (k3s 기준)

```yaml
# /etc/rancher/k3s/encryption-config.yaml
apiVersion: apiserver.config.k8s.io/v1
kind: EncryptionConfiguration
resources:
  - resources:
      - secrets
    providers:
      # AES-256-CBC로 암호화 (CSAP D-09)
      - aescbc:
          keys:
            - name: key1
              secret: <base64로 인코딩된 32바이트 키>
      # 암호화되지 않은 기존 Secret을 위한 fallback
      - identity: {}
```

```bash
# 암호화 키 생성 (32바이트 = 256비트)
head -c 32 /dev/urandom | base64

# k3s 재시작 (설정 적용)
systemctl restart k3s

# 기존 Secret 재암호화 (암호화 설정 적용 후)
kubectl get secrets -A -o json | kubectl replace -f -

# 암호화 확인
ETCDCTL_API=3 etcdctl get /registry/secrets/saas/auth-service-secrets ...
# 결과: 암호화된 바이너리 데이터 (평문 없음)
```

> 💡 **실무 팁**: k3s 환경에서 etcd 암호화 키 자체는 Vault에 보관하고, Vault는 HSM(Hardware Security Module) 또는 강력한 마스터 키로 보호합니다. 이것이 "키 관리의 핵심 문제"이며, 완벽한 해결책은 존재하지 않습니다. 현실적으로는 Vault Seal 키를 안전하게 보관하는 것이 우선입니다.

---

## 5. 애플리케이션 보안 강화 — HTTP 보안 헤더

### 5.1 보안 헤더의 역할

HTTP 보안 헤더는 브라우저에게 "이 사이트를 어떻게 처리해야 하는지"를 지시합니다. 제대로 설정하면 XSS, 클릭재킹, 정보 노출 등 많은 공격을 방어합니다.

이 프로젝트는 Traefik 미들웨어로 중앙 집중식 헤더 관리를 합니다.

```yaml
# Design Ref: infra/gateway-api/middlewares/security-headers.yaml
# CSAP D-08 접근통제 + OWASP 보안 헤더
apiVersion: traefik.io/v1alpha1
kind: Middleware
metadata:
  name: security-headers
  namespace: saas
  labels:
    csap: D-08
spec:
  headers:
    # XSS 방지 (구형 브라우저용)
    browserXssFilter: true

    # Content-Type 스니핑 방지 (MIME 타입 혼동 공격 방어)
    contentTypeNosniff: true

    # 클릭재킹 방지 (iframe으로 사이트를 숨겨 클릭 유도하는 공격)
    frameDeny: true
    customFrameOptionsValue: "SAMEORIGIN"

    # HSTS: 1년간 HTTPS만 허용 (HTTP 다운그레이드 공격 방어)
    stsIncludeSubdomains: true
    stsPreload: true
    stsSeconds: 31536000       # 1년 = 365 * 24 * 3600

    # CSP: 허용된 리소스 출처만 로드 (XSS 추가 방어층)
    contentSecurityPolicy: >-
      default-src 'self';
      script-src 'self';
      style-src 'self' 'unsafe-inline';
      img-src 'self' data:;
      font-src 'self'

    # Referrer 정보 제한 (내부 URL 유출 방지)
    referrerPolicy: "strict-origin-when-cross-origin"

    # 서버 정보 숨김 (공격자에게 기술 스택 정보 제공 방지)
    customResponseHeaders:
      X-Powered-By: ""   # "Express" 같은 프레임워크 정보 숨김
      Server: ""          # "nginx/1.x" 같은 서버 정보 숨김
```

### 5.2 각 헤더 설명

| 헤더 | 방어하는 공격 | 쉬운 설명 |
|------|-------------|---------|
| `Content-Security-Policy` | XSS | "이 도메인에서 온 스크립트만 실행해" |
| `Strict-Transport-Security` | 중간자 공격, 다운그레이드 | "앞으로 1년간 HTTPS만 사용해" |
| `X-Frame-Options` | 클릭재킹 | "이 페이지를 iframe 안에 넣지 마" |
| `X-Content-Type-Options` | MIME 혼동 공격 | "Content-Type 무시하고 추측하지 마" |
| `Referrer-Policy` | 정보 유출 | "링크 클릭 시 내 URL 정보 너무 많이 알려주지 마" |
| `Server: ""` | 정보 수집 방지 | "서버가 뭔지 알려주지 마" |

### 5.3 헤더 설정 확인

```bash
# 실제 응답 헤더 확인
curl -I https://saas.local/api/health

# 응답 예시:
# HTTP/2 200
# content-security-policy: default-src 'self'; script-src 'self'; ...
# strict-transport-security: max-age=31536000; includeSubDomains; preload
# x-frame-options: DENY
# x-content-type-options: nosniff
# referrer-policy: strict-origin-when-cross-origin
# x-powered-by:       ← 비어 있음 (숨겨짐)
# server:             ← 비어 있음 (숨겨짐)
```

> 💡 **OWASP Secure Headers Project**: https://owasp.org/www-project-secure-headers/ 에서 헤더 등급을 확인할 수 있습니다. 이 프로젝트의 설정은 "A 등급"을 목표로 합니다.

---

## 6. 의존성 보안 — Trivy + SBOM

### 6.1 의존성 취약점이란?

우리가 작성하는 코드는 수십~수백 개의 외부 라이브러리(npm 패키지)에 의존합니다. 이 라이브러리 중 하나에서 취약점이 발견되면, 우리 서비스도 그 취약점에 노출됩니다.

예를 들어 2021년 Log4Shell(CVE-2021-44228) 사건에서 수천만 개의 시스템이 영향을 받은 것은 Log4j 라이브러리 하나의 취약점 때문이었습니다.

### 6.2 pnpm audit — Node.js 의존성 검사

```bash
# 전체 의존성 취약점 검사
pnpm audit

# 결과 예시:
# ┌─────────────────────────────────────────────────────────────────────────────────┐
# │                                   === npm audit security report ===              │
# │  found 2 vulnerabilities (1 moderate, 1 high)                                   │
# └─────────────────────────────────────────────────────────────────────────────────┘
#
# High            Regular Expression Denial of Service
# Package         minimatch
# Patched in      >=3.0.8
# Dependency of   mocha
# More info       https://github.com/advisories/GHSA-f8q6-p94x-37v3

# 심각도별 필터링 (high 이상만)
pnpm audit --audit-level=high

# JSON으로 출력 (CI 파이프라인용)
pnpm audit --json > audit-results.json

# 자동 수정 시도 (호환성 확인 필수)
pnpm audit --fix
```

### 6.3 Trivy — 컨테이너 이미지 취약점 스캔

```bash
# 컨테이너 이미지 스캔
trivy image harbor.saas-platform.local/public-saas/auth-service:main-abc1234

# 결과 예시:
# ┌──────────────────────────────────────────────────────────┐
# │  auth-service:main-abc1234 (debian 11.6)                 │
# ├──────────────────┬────────────┬─────────────────────────┤
# │ Library          │ Severity   │ CVE                     │
# ├──────────────────┼────────────┼─────────────────────────┤
# │ libssl1.1        │ HIGH       │ CVE-2023-0464           │
# │ curl             │ MEDIUM     │ CVE-2023-27538          │
# └──────────────────┴────────────┴─────────────────────────┘

# High/Critical만 표시 (CI 파이프라인에서 사용)
trivy image --severity HIGH,CRITICAL \
  --exit-code 1 \           # HIGH 이상 발견 시 파이프라인 실패
  harbor.saas-platform.local/public-saas/auth-service:main-abc1234

# Dockerfile 스캔 (빌드 전 취약점 확인)
trivy config ./platform/services/auth-service/Dockerfile

# 파일 시스템 스캔 (소스코드 의존성 검사)
trivy fs ./platform/services/auth-service
```

### 6.4 SBOM (Software Bill of Materials) 생성

SBOM은 소프트웨어의 "재료 목록"입니다. 식품 성분표처럼 소프트웨어에 포함된 모든 구성요소(라이브러리, 버전)를 나열합니다. CSAP 감사 시 공급망 보안 증거로 제출합니다.

```bash
# Syft로 SBOM 생성 (CycloneDX JSON 형식)
syft harbor.saas-platform.local/public-saas/auth-service:main-abc1234 \
  -o cyclonedx-json=auth-service-sbom.cdx.json \
  -o spdx-json=auth-service-sbom.spdx.json

# SBOM 내용 확인 (포함된 라이브러리 목록)
cat auth-service-sbom.cdx.json | python3 -c "
import json, sys
data = json.load(sys.stdin)
components = data.get('components', [])
print(f'총 컴포넌트 수: {len(components)}')
for c in components[:10]:
    print(f'  {c[\"name\"]}@{c.get(\"version\", \"unknown\")}')
"

# Grype로 SBOM 기반 취약점 스캔
grype sbom:auth-service-sbom.cdx.json

# 결과는 CI 파이프라인에서 365일 보관 (CSAP D-06 요건)
```

> 💡 이 프로젝트의 SBOM 자동화: `.gitea/workflows/sbom-scan.yml`에서 매주 월요일과 PR 머지 시 자동으로 모든 서비스의 SBOM을 생성하고 Grype로 스캔합니다.

---

## 7. 컨테이너 이미지 서명 — Cosign + Sigstore

### 7.1 이미지 서명이 왜 필요한가?

컨테이너 이미지에 서명이 없으면 다음 위협이 존재합니다:
- 이미지 레지스트리가 해킹되어 악성 이미지로 교체될 수 있음
- 이미지 태그(`latest`, `main`)는 변경될 수 있음 (같은 태그, 다른 내용)
- CI/CD 파이프라인이 조작된 이미지를 배포할 수 있음

이미지 서명(Cosign)은 "이 이미지가 우리 CI 파이프라인에서 빌드되었고 변조되지 않았음"을 암호학적으로 보장합니다.

```mermaid
sequenceDiagram
    participant CI as CI 파이프라인
    participant Harbor as Harbor 레지스트리
    participant Cosign as Cosign 서명
    participant Kyverno as Kyverno 정책
    participant K8s as Kubernetes

    CI->>Harbor: 이미지 푸시 (auth-service:main-abc1234)
    CI->>Cosign: 서명 요청 (cosign.key 사용)
    Cosign->>Harbor: 서명 데이터 첨부 (OCI Referrers API)

    Note over Harbor: 이미지 + 서명 모두 저장

    K8s->>Kyverno: Pod 생성 요청 검증
    Kyverno->>Harbor: 이미지 서명 조회
    Kyverno->>Cosign: 서명 검증 (cosign.pub 사용)

    alt 서명 유효
        Kyverno->>K8s: 배포 허용
    else 서명 없음 또는 위조
        Kyverno->>K8s: 배포 거부 (정책 위반)
    end
```

### 7.2 CI 파이프라인에서 자동 서명

이 프로젝트의 자동 서명 파이프라인(`.gitea/workflows/sign-image.yml`):

```yaml
# 실제 워크플로우에서 발췌
- name: Sign Image with Cosign
  env:
    COSIGN_PASSWORD: ${{ secrets.COSIGN_PASSWORD }}
  run: |
    cosign sign \
      --key /opt/cosign/cosign.key \
      --signing-config /opt/cosign/signing-config.json \
      --allow-insecure-registry \
      ${IMAGE_REF}

- name: Verify Signature
  run: |
    cosign verify \
      --key infra/cosign/cosign.pub \
      --insecure-ignore-tlog \
      --allow-insecure-registry \
      ${IMAGE_REF}
```

### 7.3 Kyverno로 서명 검증 정책 적용

```yaml
# 서명되지 않은 이미지 배포 차단
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: verify-image-signature
  annotations:
    policies.kyverno.io/title: "이미지 서명 검증"
    policies.kyverno.io/severity: high
spec:
  validationFailureAction: Enforce    # 위반 시 배포 차단
  rules:
    - name: verify-cosign-signature
      match:
        any:
          - resources:
              kinds:
                - Pod
              namespaces:
                - saas
      verifyImages:
        - imageReferences:
            - "harbor.saas-platform.local/public-saas/*"
          attestors:
            - count: 1
              entries:
                - keys:
                    publicKeys: |-
                      -----BEGIN PUBLIC KEY-----
                      MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE... (cosign.pub 내용)
                      -----END PUBLIC KEY-----
```

### 7.4 서명 확인 방법

```bash
# 이미지 서명 확인
cosign verify \
  --key infra/cosign/cosign.pub \
  --insecure-ignore-tlog \
  harbor.saas-platform.local/public-saas/auth-service:main-abc1234

# 성공 시 출력:
# Verification for harbor.saas-platform.local/public-saas/auth-service:main-abc1234 --
# The following checks were performed on each of these signatures:
#   - The cosign claims were validated
#   - The signatures were verified against the specified public key

# 서명 없는 이미지 확인 시 오류:
# Error: no signatures found
```

---

## 8. 런타임 보안 — Falco

### 8.1 Falco란?

Falco는 컨테이너 내부에서 발생하는 시스템 콜을 실시간으로 모니터링하여 이상 행동을 탐지하는 런타임 보안 도구입니다. 빌드 시점이 아닌 **실행 중**에 공격을 감지합니다.

```
비유: 건물 내부의 CCTV

   정적 분석(Trivy, Semgrep) = 건물 설계도 검토 (입주 전 검사)
   런타임 보안(Falco) = 건물 내부 CCTV (실시간 감시)
```

이 프로젝트의 Falco 설정: `infra/falco/falcosidekick-values.yaml`, `infra/monitoring/dashboards/falco-runtime-security.json`

### 8.2 Falco 규칙 예시

Falco 규칙은 "이런 일이 발생하면 알림을 보내라"를 정의합니다.

```yaml
# 실제 운영에서 사용하는 Falco 규칙 예시

# 규칙 1: 컨테이너 내에서 쉘 실행 탐지
# (정상적인 앱은 bash/sh를 실행하지 않음)
- rule: Terminal shell in container
  desc: A shell was used as the entrypoint/exec point into a container
  condition: >
    spawned_process and container
    and shell_procs
    and proc.tty != 0
    and container_entrypoint
  output: >
    A shell was spawned in a container with an attached terminal
    (user=%user.name user_loginuid=%user.loginuid
     container_id=%container.id image=%container.image.repository:%container.image.tag
     shell=%proc.name parent=%proc.pname cmdline=%proc.cmdline terminal=%proc.tty)
  priority: WARNING
  tags: [container, shell, security]

# 규칙 2: 민감한 파일 접근 탐지
# /etc/passwd, /etc/shadow, /proc/*/environ 등)
- rule: Read sensitive file untrusted
  desc: >
    An attempt to read any sensitive file (e.g. files containing user/password/auth
    information). Sensitive files are those listed in the sensitive_files macro.
  condition: >
    open_read and sensitive_files and proc_name_exists
    and not proc.name in (known_sensitive_file_readers)
    and not container.image.repository in (trusted_images)
  output: >
    Sensitive file opened for reading by non-trusted program
    (user=%user.name user_loginuid=%user.loginuid program=%proc.name
     command=%proc.cmdline file=%fd.name parent=%proc.pname
     container_id=%container.id image=%container.image.repository)
  priority: WARNING
  tags: [filesystem, security]

# 규칙 3: 새 프로세스가 네트워크 연결 시도 탐지
# (웹서버가 예상치 못한 외부 서버에 연결하면 의심)
- rule: Unexpected outbound connection destination
  desc: Detect any outbound network connection to unexpected destination
  condition: >
    outbound and not (
      proc.name in (allowed_network_tools)
      or fd.sip.name in (allowed_external_destinations)
    )
  output: >
    Unexpected outbound connection
    (command=%proc.cmdline connection=%fd.name
     container_id=%container.id image=%container.image.repository)
  priority: NOTICE
  tags: [network, security]

# 규칙 4: 권한 상승 시도 탐지
- rule: Privilege escalation via setuid
  desc: Detect attempt to escalate privilege using setuid binary
  condition: >
    spawned_process
    and proc.is_suid_exe = true
    and not proc.name in (allowed_setuid_binaries)
  output: >
    Privilege escalation via setuid binary
    (user=%user.name command=%proc.cmdline
     container_id=%container.id image=%container.image.repository)
  priority: CRITICAL
  tags: [privilege_escalation, security]
```

### 8.3 탐지 → 알림 → 자동 대응 플로우

```mermaid
flowchart TD
    EVENT[이상 이벤트 발생\n예: 컨테이너에서 bash 실행]
    FALCO[Falco 탐지]
    SIDEKICK[Falcosidekick 포워더]

    subgraph "알림 채널"
        PROM[Prometheus 메트릭\nfalco_events 카운터]
        ALERT[AlertManager\n→ 슬랙/이메일]
        WEBUI[Falcosidekick UI\n웹 대시보드]
    end

    subgraph "자동 대응 (선택)"
        KILL[Pod 강제 삭제\nkubectl delete pod]
        ISOLATE[NetworkPolicy 차단\n해당 Pod 격리]
        TICKET[인시던트 티켓 생성\nJira/GitLab]
    end

    subgraph "조사"
        LOG[로그 수집\nLoki 쿼리]
        AUDIT[감사 로그 확인\naudit.jsonl]
        FORENSIC[포렌식 분석]
    end

    EVENT --> FALCO
    FALCO -->|우선순위 Warning 이상| SIDEKICK
    SIDEKICK --> PROM
    SIDEKICK --> ALERT
    SIDEKICK --> WEBUI

    ALERT -->|Critical 이벤트| KILL
    ALERT -->|Critical 이벤트| ISOLATE
    ALERT -->|담당자 호출| TICKET

    KILL --> LOG
    LOG --> AUDIT
    AUDIT --> FORENSIC

    style EVENT fill:#ff4444,color:#fff
    style FALCO fill:#ff8800,color:#fff
    style KILL fill:#cc0000,color:#fff
    style FORENSIC fill:#8844bb,color:#fff
```

### 8.4 Falco 이벤트 확인

```bash
# Falco 로그 실시간 확인
kubectl logs -n falco-system -l app=falco -f

# Falco 이벤트 카운터 확인 (Prometheus 메트릭)
kubectl exec -n monitoring deployment/prometheus -- \
  promtool query instant \
  'sum(increase(falco_events{priority="Critical"}[24h])) or vector(0)'

# Falcosidekick UI 접근
kubectl port-forward -n falco-system svc/falcosidekick-ui 2802:2802
# 브라우저에서 http://localhost:2802 접속
```

### 8.5 False Positive 줄이기

Falco를 처음 도입하면 많은 False Positive(정상 행동을 이상으로 탐지)가 발생합니다. 이를 줄이는 방법:

```yaml
# Falco 규칙에 예외 목록 추가
- list: allowed_network_tools
  items: [wget, curl, node, npm]

- list: trusted_images
  items:
    - harbor.saas-platform.local/public-saas/auth-service
    - harbor.saas-platform.local/public-saas/ai-service

# 특정 프로세스 예외
- macro: known_sensitive_file_readers
  condition: >
    proc.name in (
      ps,
      grep,
      lsof,
      node
    )
```

> ⚠️ 예외 목록은 최소화해야 합니다. 너무 많은 예외는 Falco를 무력화합니다. 실제 위협을 예외로 처리하지 않도록 주의하십시오.

---

## 9. 시크릿 관리 강화 — Vault Dynamic Secrets

### 9.1 Static Secret vs Dynamic Secret

기존 방식(Static Secret):
```
DB 비밀번호를 한 번 설정 → 모든 서비스가 같은 비밀번호 사용 → 유출 시 전체 DB 접근 가능
```

Vault Dynamic Secrets(동적 시크릿):
```
서비스가 Vault에 요청 → Vault가 임시 비밀번호 생성 → 서비스에 전달
→ TTL 만료 시 자동 비밀번호 삭제 → 유출되어도 짧은 시간 내 무효화
```

```mermaid
sequenceDiagram
    participant SVC as auth-service Pod
    participant VAULT as HashiCorp Vault
    participant DB as PostgreSQL

    SVC->>VAULT: "DB 접근 권한 필요" (ServiceAccount 토큰)
    VAULT->>VAULT: auth-service 정책 확인 (DB 읽기 권한 있음)
    VAULT->>DB: CREATE USER vault_auth_abc123 WITH PASSWORD 'x7k2m...'
    VAULT->>SVC: 임시 자격증명 반환\n(username: vault_auth_abc123\n password: x7k2m...\n TTL: 1시간)

    SVC->>DB: 임시 자격증명으로 연결

    Note over VAULT: 1시간 후 TTL 만료

    VAULT->>DB: DROP USER vault_auth_abc123
    Note over DB: 자격증명 자동 삭제\n(유출되어도 이미 무효)
```

### 9.2 Vault 동적 DB 자격증명 설정

```bash
# 1. Vault DB 시크릿 엔진 활성화
vault secrets enable database

# 2. PostgreSQL 연결 설정
vault write database/config/saas-postgres \
  plugin_name=postgresql-database-plugin \
  allowed_roles="auth-service,user-service,ai-service" \
  connection_url="postgresql://{{username}}:{{password}}@postgres:5432/saas" \
  username="vault-root" \
  password="$(vault kv get -field=password secret/db-root)"

# 3. 역할별 자격증명 정책 정의
vault write database/roles/auth-service \
  db_name=saas-postgres \
  creation_statements="CREATE ROLE \"{{name}}\" WITH LOGIN
    PASSWORD '{{password}}' VALID UNTIL '{{expiration}}';
    GRANT SELECT, INSERT, UPDATE ON users, sessions TO \"{{name}}\";" \
  revocation_statements="REVOKE ALL ON ALL TABLES IN SCHEMA public FROM \"{{name}}\";
    DROP ROLE IF EXISTS \"{{name}}\";" \
  default_ttl="1h" \
  max_ttl="24h"

# 4. 자격증명 요청 테스트
vault read database/creds/auth-service
# Key                Value
# ---                -----
# lease_id           database/creds/auth-service/AbCdEf...
# lease_duration     1h
# lease_renewable    true
# password           A1a-2bB3cCdDeE (임시 비밀번호)
# username           v-k8s-auth-AbCdEf (임시 사용자명)
```

### 9.3 시크릿 로테이션 자동화

```bash
# Vault Agent Sidecar로 자동 로테이션 설정
# (Pod 재시작 없이 새 자격증명 주입)

# annotations를 통해 Vault Agent 활성화
kubectl annotate deployment auth-service \
  vault.hashicorp.com/agent-inject="true" \
  vault.hashicorp.com/role="auth-service" \
  vault.hashicorp.com/agent-inject-secret-db="database/creds/auth-service" \
  vault.hashicorp.com/agent-inject-template-db='{{- with secret "database/creds/auth-service" -}}
    DATABASE_URL=postgresql://{{ .Data.username }}:{{ .Data.password }}@postgres:5432/saas
  {{- end }}'

# TTL 만료 전 자동 갱신
vault write sys/leases/renew \
  lease_id="database/creds/auth-service/AbCdEf..."
```

### 9.4 Sealed Secret vs Vault — 언제 무엇을 사용?

| 상황 | 권장 방법 | 이유 |
|------|---------|------|
| JWT 서명 키 | Vault Static Secret | 변경이 드물고 앱 시작 시 1회 로드 |
| DB 비밀번호 | Vault Dynamic Secret | 주기적 로테이션 필요 |
| TLS 인증서 | cert-manager + Vault PKI | 자동 갱신 |
| Git 저장소에 저장해야 하는 시크릿 | Sealed Secret | 암호화 후 커밋 가능 |
| 개발 환경 임시 시크릿 | `.env.local` (커밋 금지) | 빠른 개발 |

---

## 10. 보안 패치 관리

### 10.1 취약점 스캔 주기

```
매일 자동 스캔:
  - pnpm audit (의존성 취약점)
  - Trivy (컨테이너 이미지)
  - Semgrep (소스코드 정적 분석)

매주:
  - Grype + SBOM 전체 서비스 스캔 (월요일 02:00)
  - 취약점 리포트 검토 및 패치 계획

매월:
  - 베이스 이미지 업데이트 검토
  - Kubernetes 버전 업데이트 확인
  - Vault, Traefik 등 인프라 컴포넌트 패치 검토
```

### 10.2 CVE 심각도별 패치 기한

CSAP D-12 요건에 따라 다음 기한 내에 패치해야 합니다.

| CVSS 점수 | 심각도 | 패치 기한 | 조치 |
|----------|--------|---------|------|
| 9.0~10.0 | Critical | **24시간 이내** | 즉시 패치 또는 서비스 임시 중단 |
| 7.0~8.9 | High | **72시간 이내** | 긴급 핫픽스 배포 |
| 4.0~6.9 | Medium | **2주 이내** | 다음 정기 배포 포함 |
| 0.1~3.9 | Low | **다음 분기** | 정기 업데이트 시 포함 |

```bash
# CVE 발견 시 즉시 확인 명령어
trivy image --severity CRITICAL \
  harbor.saas-platform.local/public-saas/auth-service:main-latest

# CVSS 점수 확인
grype sbom:auth-service-sbom.cdx.json \
  --fail-on critical \
  --by-cve
```

### 10.3 패치 적용 프로세스

```mermaid
flowchart LR
    subgraph "탐지"
        SCAN[자동 스캔\nTrivy/Grype]
        MANUAL[수동 발견\nNVD/GitHub Advisory]
    end

    subgraph "평가"
        CVSS[CVSS 점수 확인]
        IMPACT[실제 영향도 평가\n해당 코드 경로 사용 여부]
        PLAN[패치 계획 수립\n기한 결정]
    end

    subgraph "패치"
        UPDATE[패키지 업데이트\npnpm up lib@latest]
        BUILD[이미지 재빌드\n베이스 이미지 업데이트]
        TEST[테스트 실행\npnpm test]
    end

    subgraph "배포"
        PR[PR 생성\nfeat/security-patch-CVE-XXXX]
        REVIEW[보안 리뷰]
        DEPLOY[핫픽스 배포\n.gitea/workflows/hotfix-pipeline.yaml]
    end

    subgraph "기록"
        AUDIT[감사 로그 기록\naudit.jsonl]
        CSAP[CSAP 증거 보관\n365일]
    end

    SCAN --> CVSS
    MANUAL --> CVSS
    CVSS --> IMPACT
    IMPACT --> PLAN
    PLAN --> UPDATE
    UPDATE --> BUILD
    BUILD --> TEST
    TEST --> PR
    PR --> REVIEW
    REVIEW --> DEPLOY
    DEPLOY --> AUDIT
    AUDIT --> CSAP

    style SCAN fill:#ff8800,color:#fff
    style DEPLOY fill:#0088bb,color:#fff
    style CSAP fill:#8844bb,color:#fff
```

### 10.4 베이스 이미지 업데이트

```dockerfile
# Dockerfile 예시 — 베이스 이미지 핀 고정 (태그 대신 다이제스트 사용)
# ❌ 태그는 변경될 수 있음
FROM node:20-slim

# ✅ 다이제스트로 정확한 이미지 지정 (재현 가능한 빌드)
FROM node:20-slim@sha256:abc123def456...

# 비루트 사용자로 실행 (CSAP D-11)
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1000 --ingroup nodejs nextjs

USER 1000
```

```bash
# 베이스 이미지 취약점 확인
trivy image node:20-slim --severity HIGH,CRITICAL

# 최신 이미지 다이제스트 확인
docker inspect node:20-slim --format='{{index .RepoDigests 0}}'
# node:20-slim@sha256:abc123...

# Dockerfile 업데이트 후 모든 서비스 재빌드
pnpm build:docker
```

---

## 학습 체크리스트

이 가이드를 마친 후 다음 항목을 직접 확인해 보십시오.

### 개념 이해

```
[ ] "Default Deny"와 "Default Allow"의 차이를 동료에게 설명할 수 있다
[ ] "최소 권한 원칙"이 왜 중요한지 실제 공격 시나리오로 설명할 수 있다
[ ] "Defense in Depth"가 이 프로젝트에서 몇 개 계층으로 구현되어 있는지 말할 수 있다
[ ] Falco가 Trivy와 어떻게 다른지 (빌드 시점 vs 런타임) 설명할 수 있다
```

### Kubernetes 보안

```
[ ] Pod Security Standards 세 가지 레벨을 설명할 수 있다
[ ] securityContext의 각 설정이 왜 필요한지 이해한다
[ ] runAsNonRoot, readOnlyRootFilesystem, capabilities.drop의 의미를 안다
[ ] NetworkPolicy "Default Deny" 설정을 직접 작성할 수 있다
[ ] etcd 암호화가 왜 필요한지 설명할 수 있다
```

### 실습

```
[ ] 개발 환경에서 취약한 Pod 배포를 시도하고 PSS 오류를 확인했다
    명령어: kubectl apply -f (securityContext 없는 Deployment)

[ ] pnpm audit을 실행하고 결과를 해석했다
    명령어: cd /data/ai-saas && pnpm audit

[ ] Falco 대시보드에 접근했다
    명령어: kubectl port-forward -n falco-system svc/falcosidekick-ui 2802:2802

[ ] 보안 헤더가 올바르게 설정되었는지 확인했다
    명령어: curl -I https://saas.local/api/health | grep -E "security|strict|frame"

[ ] Trivy로 이미지를 스캔해 보았다
    명령어: trivy image harbor.saas-platform.local/public-saas/auth-service:latest
```

### CSAP 연결

```
[ ] 각 Hardening 설정이 어느 CSAP 항목과 연결되는지 이해한다
    - securityContext → D-11 (가상화 보안)
    - NetworkPolicy → D-08 (접근 통제)
    - 이미지 서명 → D-12 (개발 보안)
    - 감사 로그 → D-06 (침해사고 관리)

[ ] CSAP 감사 시 어떤 증거를 제출할 수 있는지 목록을 작성해 보았다
```

---

## 다음 단계

보안 강화 가이드를 완료했습니다.

**다음 권장 학습 경로**:
- `07-security/csap/02-dev-checklist.md` — CSAP D-12 개발 보안 체크리스트
- `07-security/audit/01-audit-logging.md` — 감사 로그 작성 가이드
- `06-cicd/06-supply-chain-security.md` — 소프트웨어 공급망 보안 (다음 파일)

**관련 실습**:
- `10-exercises/05-security-audit.md` — 보안 감사 실습
- `10-exercises/10-security-audit-exercise.md` — 보안 감사 심화 실습

**참조 파일**:
- `infra/security/pod-security-standards/security-context-template.yaml` — PSS 템플릿
- `infra/gateway-api/middlewares/security-headers.yaml` — 보안 헤더 설정
- `infra/falco/falcosidekick-values.yaml` — Falco 알림 설정
- `.gitea/workflows/sign-image.yml` — 이미지 서명 자동화

---

> **CSAP 연관**: D-08 (접근 통제), D-09 (암호화), D-11 (가상화 보안), D-12 (시스템 개발 보안)
> **Design Ref**: MTU-N71 §3 (Pod Security Standards), MTU-N45 (Falco), MTU-N37 (SBOM)
> **Plan SC**: FR-N71.3, FR-N45.2, FR-N37.1~FR-N37.8
