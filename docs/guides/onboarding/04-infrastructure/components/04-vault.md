# HashiCorp Vault — 시크릿 관리와 자동 주입

> **버전**: 1.0.0 | **작성일**: 2026-04-11
> **대상**: 신규 개발자, DevOps 엔지니어
> **CSAP**: D-08 (접근 통제), D-09 (암호화 — 시크릿 관리)
> **관련 문서**: `04-infrastructure.md` §5.4, `docs/07-infra/wsl-devops-complete-guide.md`

---

## 목차

1. [왜 .env를 쓰지 않는가](#1-왜-env를-쓰지-않는가)
2. [Vault 시크릿 읽는 방법](#2-vault-시크릿-읽는-방법)
3. [External Secrets Operator 연동](#3-external-secrets-operator-연동)
4. [시크릿 교체 방법](#4-시크릿-교체-방법)
5. [실습: 서비스에 DB 비밀번호 주입](#5-실습-서비스에-db-비밀번호-주입)
6. [Sealed Secrets — Git에 안전하게 시크릿 저장](#6-sealed-secrets--git에-안전하게-시크릿-저장)
7. [시크릿 관리 체크리스트](#7-시크릿-관리-체크리스트)

---

## 1. 왜 .env를 쓰지 않는가

### 1.1 .env 파일의 문제점

개인 프로젝트에서는 `.env` 파일로 환경변수를 관리하는 것이 편리합니다. 하지만 공공기관 SaaS에서는 심각한 문제가 있습니다.

```
.env 파일 방식의 문제:
  1. 보안 사고 위험
     - 실수로 Git에 커밋 → GitHub 크롤러가 수분 내 수집
     - 개발자 컴퓨터 분실 → 전체 DB 비밀번호 노출
     - 팀원 퇴사 시 비밀번호 회수 불가

  2. 감사 추적 불가
     - 누가 언제 비밀번호를 변경했는지 알 수 없음
     - CSAP D-08 접근 제어 요건 충족 불가

  3. 교체 어려움
     - 비밀번호 변경 시 모든 서버의 .env 파일을 수동으로 업데이트
     - 교체 중 서비스 중단 발생

  4. 환경별 관리 어려움
     - 개발/스테이징/프로덕션 마다 다른 .env 파일 관리
     - 어느 환경에 어떤 버전이 배포되었는지 추적 불가
```

### 1.2 Vault가 해결하는 것

```
HashiCorp Vault 방식:
  1. 시크릿 중앙 저장
     - 모든 비밀번호/API 키를 Vault 하나에서 관리
     - 접근 권한은 RBAC으로 세밀하게 제어 (CSAP D-08)

  2. 감사 추적
     - 누가 언제 어떤 시크릿에 접근했는지 전수 기록
     - CSAP D-06 감사 요건 자동 충족

  3. 동적 시크릿
     - DB 비밀번호를 요청할 때마다 새로 생성, 사용 후 자동 만료
     - 비밀번호 유출되어도 TTL 후 자동 무효화

  4. 자동 교체
     - 주기적으로 비밀번호 자동 변경 (사람이 개입하지 않아도 됨)
```

### 1.3 이 프레임워크의 시크릿 흐름

```
시크릿 관리 전체 흐름:

[개발자]
  → kubeseal로 시크릿 암호화
  → SealedSecret YAML을 Git에 커밋 (암호화 상태라 안전)
  → Flux가 SealedSecret 배포
  → SealedSecret Controller가 복호화 → Kubernetes Secret 생성
                ↓
[런타임 시크릿 동기화]
  External Secrets Operator
  → Vault/saas-secrets에서 시크릿 읽기
  → Kubernetes Secret 자동 동기화 (1시간마다)
                ↓
[애플리케이션]
  → 환경변수로 Secret 값 참조
  → 코드에 하드코딩 절대 없음
```

---

## 2. Vault 시크릿 읽는 방법

### 2.1 Vault CLI로 직접 읽기 (관리자용)

```bash
# Vault Pod에 접속
kubectl exec -it vault-0 -n external-secrets -- vault login

# 시크릿 경로 목록 확인
vault secrets list
# Path          Type     Accessor         Description
# saas/         kv       kv_xxxxxxxx      saas platform secrets
# auth/         token    token_xxxxxxxx   token based credentials

# 특정 시크릿 읽기
vault kv get saas/auth-service/database
# Key               Value
# database-url      postgresql://...
# database-password *** (마스킹됨)

# 시크릿 전체 내용 읽기 (JSON 형식)
vault kv get -format=json saas/auth-service/database | jq '.data.data'
```

### 2.2 시크릿 경로 구조

이 프레임워크에서 Vault 시크릿은 다음 경로 규칙을 따릅니다.

```
saas/{서비스명}/{카테고리}

예시:
  saas/auth-service/database     → DB 연결 정보
  saas/auth-service/jwt          → JWT 시크릿 키
  saas/ai-service/openai         → AI API 키
  saas/monitoring/grafana        → Grafana 관리자 비밀번호
  saas/infrastructure/harbor     → Harbor 레지스트리 인증
```

### 2.3 Vault UI 접근 (웹 인터페이스)

```bash
# Vault UI 포트 포워딩
kubectl port-forward -n external-secrets svc/vault 8200:8200

# 브라우저: http://localhost:8200
# Token으로 로그인 (관리자에게 토큰 요청)
```

---

## 3. External Secrets Operator 연동

External Secrets Operator(ESO)는 Vault에 있는 시크릿을 Kubernetes Secret으로 자동 동기화합니다.

### 3.1 시크릿 동기화 흐름

```mermaid
graph LR
    subgraph VAULT_SIDE["Vault (시크릿 저장소)"]
        V["HashiCorp Vault\nsaas/auth-service/database\n= {url: postgresql://...}"]
    end

    subgraph K8S["Kubernetes 클러스터"]
        subgraph ESO_NS["external-secrets 네임스페이스"]
            SS["SecretStore\nVault 연결 설정"]
            ESO_OP["ESO Controller\n1시간마다 동기화"]
        end

        subgraph APP_NS["saas-platform 네임스페이스"]
            ES["ExternalSecret\n어떤 Vault 경로의\n어떤 키를 가져올지 선언"]
            SECRET["Kubernetes Secret\n(자동 생성됨)\nauth-db-credentials"]
            POD["auth-service Pod\n환경변수로 Secret 참조"]
        end
    end

    V -->|시크릿 읽기| ESO_OP
    ESO_OP -->|Secret 생성/갱신| SECRET
    ES -->|동기화 지시| ESO_OP
    SS -->|Vault 인증| V
    SECRET -->|환경변수 주입| POD
```

### 3.2 SecretStore 설정

SecretStore는 ESO가 Vault에 접근하는 방법을 정의합니다.

```yaml
# infra/external-secrets/stores/vault-secret-store.yaml
apiVersion: external-secrets.io/v1beta1
kind: SecretStore
metadata:
  name: vault-backend
  namespace: saas-platform
spec:
  provider:
    vault:
      server: "http://vault.external-secrets.svc.cluster.local:8200"
      path: "saas"          # Vault KV 마운트 경로
      version: "v2"         # KV v2 사용
      auth:
        kubernetes:
          mountPath: "kubernetes"
          role: "saas-platform-role"    # Vault에 등록된 K8s 인증 역할
          serviceAccountRef:
            name: external-secrets-sa   # ESO가 사용하는 ServiceAccount
```

### 3.3 ExternalSecret 정의

ExternalSecret은 Vault의 어떤 경로에서 어떤 키를 가져와 Kubernetes Secret에 저장할지 선언합니다.

```yaml
# infra/external-secrets/manifests/auth-service-secrets.yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: auth-db-credentials
  namespace: saas-platform
spec:
  # 동기화 주기 (1시간마다 Vault에서 최신 값 가져오기)
  refreshInterval: 1h

  # 어떤 SecretStore를 사용할지
  secretStoreRef:
    name: vault-backend
    kind: SecretStore

  # 생성할 Kubernetes Secret 이름과 타입
  target:
    name: auth-db-credentials         # 생성될 Secret 이름
    creationPolicy: Owner             # ExternalSecret 삭제 시 Secret도 삭제

  # Vault에서 가져올 데이터 매핑
  data:
    - secretKey: database-url         # Kubernetes Secret의 키 이름
      remoteRef:
        key: auth-service/database    # Vault 경로 (saas/ 하위)
        property: url                 # Vault 경로 내 특정 필드

    - secretKey: database-password
      remoteRef:
        key: auth-service/database
        property: password

    - secretKey: jwt-secret
      remoteRef:
        key: auth-service/jwt
        property: secret
```

### 3.4 ExternalSecret 상태 확인

```bash
# ExternalSecret 동기화 상태
kubectl get externalsecret -n saas-platform
# NAME                    STORE          REFRESH INTERVAL   STATUS
# auth-db-credentials     vault-backend  1h                 SecretSynced

# 동기화된 Secret 확인
kubectl get secret auth-db-credentials -n saas-platform
# NAME                  TYPE     DATA   AGE
# auth-db-credentials   Opaque   3      2h

# Secret 키 목록 (값은 표시 안 됨)
kubectl describe secret auth-db-credentials -n saas-platform
# Data
# ====
# database-url:       76 bytes
# database-password:  32 bytes
# jwt-secret:         64 bytes
```

---

## 4. 시크릿 교체 방법

### 4.1 Vault에서 시크릿 업데이트

```bash
# Vault CLI로 시크릿 업데이트 (DB 비밀번호 변경 예시)
vault kv put saas/auth-service/database \
  url="postgresql://saas_app:NEW_PASSWORD@saas-main-db-rw.saas.svc.cluster.local:5432/saas_platform?sslmode=require" \
  password="NEW_PASSWORD"

# ESO가 다음 동기화 주기(최대 1시간)에 자동으로 Kubernetes Secret 업데이트
# 즉시 동기화 필요 시:
kubectl annotate externalsecret auth-db-credentials -n saas-platform \
  force-sync=$(date +%s) --overwrite
```

### 4.2 Sealed Secrets 교체

Git에 저장된 SealedSecret을 교체하는 절차:

```bash
# 1. 새 시크릿으로 평문 Secret YAML 생성 (임시 파일)
kubectl create secret generic auth-db-credentials \
  -n saas-platform \
  --from-literal=database-url="postgresql://..." \
  --from-literal=database-password="NEW_PASSWORD" \
  --dry-run=client -o yaml > /tmp/secret.yaml

# 2. kubeseal로 암호화
kubeseal --format yaml < /tmp/secret.yaml > infra/sealed-secrets/auth-db-credentials.yaml

# 3. 임시 파일 즉시 삭제 (평문 값 포함)
rm /tmp/secret.yaml

# 4. Git에 커밋 (암호화된 파일만)
git add infra/sealed-secrets/auth-db-credentials.yaml
git commit -m "fix(secret): auth-service DB 비밀번호 교체 (보안 사유)"

# 5. Flux가 자동 배포 → SealedSecret Controller가 복호화 → Secret 업데이트
```

### 4.3 자동 교체 정책 확인

```yaml
# infra/external-secrets/rotation-policies.yaml 확인
# 서비스별 시크릿 교체 주기 정책
```

```bash
# 시크릿 교체 감사 로그 확인 (CSAP D-08, D-09)
kubectl logs -n external-secrets deployment/external-secrets -f | grep -i "rotate\|sync"
```

---

## 5. 실습: 서비스에 DB 비밀번호 주입

새 서비스(notification-service)에 DB 비밀번호를 안전하게 주입하는 전체 절차입니다.

### 단계 1: Vault에 시크릿 저장

```bash
# Vault에 notification-service DB 인증 정보 저장
vault kv put saas/notification-service/database \
  url="postgresql://notification_app:SECURE_PASS@saas-main-db-rw.saas.svc.cluster.local/saas_notification?sslmode=require" \
  password="SECURE_PASS" \
  username="notification_app"

# 저장 확인
vault kv get saas/notification-service/database
```

### 단계 2: ExternalSecret 생성

```yaml
# infra/external-secrets/manifests/notification-service-secrets.yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: notification-db-credentials
  namespace: saas-platform
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: vault-backend
    kind: SecretStore
  target:
    name: notification-db-credentials
  data:
    - secretKey: database-url
      remoteRef:
        key: notification-service/database
        property: url
    - secretKey: database-password
      remoteRef:
        key: notification-service/database
        property: password
```

```bash
# Git에 커밋 후 Flux 배포
git add infra/external-secrets/manifests/notification-service-secrets.yaml
git commit -m "feat(secret): notification-service DB 시크릿 ESO 추가 (CSAP D-09)"
git push origin main
```

### 단계 3: Secret 동기화 확인

```bash
# ESO 동기화 대기 (최대 1분)
kubectl get externalsecret notification-db-credentials -n saas-platform -w
# STATUS가 SecretSynced로 바뀔 때까지 대기

# Secret 생성 확인
kubectl get secret notification-db-credentials -n saas-platform
```

### 단계 4: Deployment에서 Secret 참조

```yaml
# helm/notification-service/templates/deployment.yaml에 추가
spec:
  containers:
    - name: notification-service
      env:
        # CSAP D-12: 시크릿 하드코딩 금지 — Secret 참조 사용
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: notification-db-credentials   # 단계 3에서 생성된 Secret
              key: database-url

        - name: DATABASE_PASSWORD
          valueFrom:
            secretKeyRef:
              name: notification-db-credentials
              key: database-password
```

### 단계 5: 주입된 환경변수 확인

```bash
# Pod 배포 후 환경변수 확인 (값은 마스킹하여 확인)
kubectl exec -n saas-platform \
  $(kubectl get pods -n saas-platform -l app=notification-service -o jsonpath='{.items[0].metadata.name}') \
  -- env | grep DATABASE

# 예상 출력 (비밀번호는 마스킹됨):
# DATABASE_URL=postgresql://notification_app:***@saas-main-db-rw.saas.svc.cluster.local/saas_notification?sslmode=require
```

실습 완료 기준: Pod 환경변수에 `DATABASE_URL`이 주입되고, 애플리케이션이 DB에 정상 연결되면 성공입니다.

---

## 6. Sealed Secrets — Git에 안전하게 시크릿 저장

Sealed Secrets는 시크릿을 암호화하여 Git 저장소에 안전하게 저장하는 방법입니다.

### 6.1 kubeseal 설치

```bash
# kubeseal CLI 설치
wget https://github.com/bitnami-labs/sealed-secrets/releases/download/v0.27.0/kubeseal-0.27.0-linux-amd64.tar.gz
tar xzf kubeseal-0.27.0-linux-amd64.tar.gz
sudo mv kubeseal /usr/local/bin/

# 설치 확인
kubeseal --version
```

### 6.2 SealedSecret 생성 절차

```bash
# 1. 평문 Secret YAML 생성 (--dry-run 플래그로 클러스터에 적용 안 함)
kubectl create secret generic my-api-key \
  -n saas-platform \
  --from-literal=api-key="sk-abc123xyz789" \
  --dry-run=client -o yaml > /tmp/raw-secret.yaml

# 2. kubeseal로 암호화 (클러스터의 공개 키 사용)
kubeseal --format yaml < /tmp/raw-secret.yaml > infra/sealed-secrets/my-api-key.yaml

# 3. 평문 Secret 파일 즉시 삭제
rm /tmp/raw-secret.yaml
shred -u /tmp/raw-secret.yaml   # 더 안전한 삭제

# 4. 암호화된 파일만 Git에 커밋 (안전)
cat infra/sealed-secrets/my-api-key.yaml
# apiVersion: bitnami.com/v1alpha1
# kind: SealedSecret
# metadata:
#   name: my-api-key
#   namespace: saas-platform
# spec:
#   encryptedData:
#     api-key: AgAx...  ← 암호화된 값 (Git에 커밋해도 안전)

git add infra/sealed-secrets/my-api-key.yaml
git commit -m "feat(secret): my-api-key SealedSecret 추가"
```

### 6.3 SealedSecret 적용 확인

```bash
# Flux가 SealedSecret을 배포하면 컨트롤러가 자동 복호화
kubectl get sealedsecrets -n saas-platform
# NAME          AGE   STATUS   SYNCED
# my-api-key    5m    True     True

# 복호화된 Secret 확인
kubectl get secret my-api-key -n saas-platform
```

---

## 7. 시크릿 관리 체크리스트

서비스 배포 전 이 체크리스트를 확인합니다.

### 개발자 체크리스트

```
[ ] .env 파일이 .gitignore에 등록되어 있는가
[ ] values.yaml에 비밀번호, API 키, 토큰이 직접 기재되어 있지 않은가
[ ] 코드에 하드코딩된 시크릿이 없는가
[ ] Deployment에서 환경변수를 secretKeyRef로 참조하는가
[ ] Secret YAML (평문)을 Git에 커밋하지 않았는가
```

### DevOps 체크리스트

```
[ ] Vault에 서비스별 시크릿 경로가 생성되었는가
[ ] ExternalSecret이 SecretSynced 상태인가
[ ] SealedSecret이 Git에 커밋되어 있는가
[ ] 시크릿 교체 정책 (rotation-policies.yaml)이 설정되어 있는가
[ ] Vault 감사 로그가 수집되고 있는가 (CSAP D-08)
```

### 보안 점검 명령어

```bash
# Git 히스토리에서 시크릿 노출 여부 확인
git log --all -p | grep -iE "password|api.key|secret|token" | head -20

# Kubernetes Secret에 평문 값이 노출된 리소스 확인
kubectl get secrets -A -o json | jq '.items[] | select(.data != null) | .metadata.name'

# 코드베이스에서 하드코딩된 시크릿 패턴 검색
grep -rE "(password|api.key|secret)\s*=\s*['\"][^'\"]{8,}" \
  platform/services/ --include="*.ts" --include="*.js"

# ESO 동기화 실패한 ExternalSecret 확인
kubectl get externalsecret -A | grep -v SecretSynced
```

---

## 관련 문서

| 문서 | 내용 |
|------|------|
| `docs/07-infra/wsl-devops-complete-guide.md` | Vault 초기 설정 및 운영 심화 |
| `infra/external-secrets/ROLE-SEPARATION.md` | ESO 역할 분리 원칙 |
| `infra/vault/rotation-policies.yaml` | 시크릿 자동 교체 정책 |
| `infra/sealed-secrets/` | SealedSecret 매니페스트 |

---

**이것으로 04-infrastructure 심화 섹션 학습을 완료했습니다.**

전체 구조 요약:
- **Traefik**: 외부 트래픽 → 서비스 라우팅 (단일 진입점)
- **Cert-Manager**: TLS 인증서 자동 관리 (만료 30일 전 갱신)
- **CloudNativePG**: PostgreSQL HA (Primary + 2 Replica, 자동 장애 조치)
- **Vault + ESO**: 시크릿 중앙 관리 및 자동 주입 (.env 대체)

다음 단계: `05-monitoring.md`에서 Prometheus + Grafana + Loki 관측가능성 스택을 학습합니다.
