# Design: MTU-N170 Keycloak SSO/OIDC 통합

> 버전: 1.0 | 작성일: 2026-04-10 | 작성자: PM Lead

## 1. Design Anchor

- Plan 참조: docs/01-plan/mtus/MTU-N170-keycloak-sso.plan.md
- 아키텍처 옵션: Pragmatic Balance 선택
- 핵심 결정: Keycloak 26+ Helm 공식 차트 + LDAP Federation + OIDC PKCE

## 2. 아키텍처 개요

```
사용자 브라우저 ──→ Traefik Ingress (TLS)
         │
         ▼
   Keycloak SSO ──→ LDAP Server (기관 AD)
         │
         ▼
   OIDC Token 발급
         │
    ┌────┴────┐
    ▼         ▼
 API Gateway  Kubernetes API
 (JWT 검증)   (OIDC 인증)
```

## 3. 상세 설계

### 3.1 Keycloak Helm 배포

- 공식 Bitnami Keycloak Helm 차트 사용
- PostgreSQL HA 백엔드 (CloudNativePG 연동)
- 리소스 제한: 1 CPU / 1Gi Memory (k3s 환경 최적화)
- Replica: 2 (HA)

### 3.2 Realm 설정

```json
{
  "realm": "public-saas",
  "enabled": true,
  "sslRequired": "all",
  "registrationAllowed": false,
  "bruteForceProtected": true,
  "maxFailureWaitSeconds": 900,
  "minimumQuickLoginWaitSeconds": 60,
  "maxDeltaTimeSeconds": 43200,
  "failureFactor": 5
}
```

Client 설정:
- `saas-web`: 웹 프론트엔드 (public client, PKCE 필수)
- `saas-api`: API 게이트웨이 (confidential client)
- `k8s-auth`: Kubernetes OIDC (confidential client)

### 3.3 LDAP User Federation

```yaml
# Keycloak LDAP 프로바이더 설정
providerType: ldap
config:
  vendor: "ad"  # Active Directory 호환
  connectionUrl: "ldaps://ldap.example.go.kr:636"
  bindDn: "cn=keycloak-bind,ou=service-accounts,dc=example,dc=go,dc=kr"
  usersDn: "ou=users,dc=example,dc=go,dc=kr"
  userObjectClasses: "person,organizationalPerson,user"
  usernameAttribute: "sAMAccountName"
  rdnAttribute: "cn"
  uuidAttribute: "objectGUID"
  searchScope: "2"  # SUBTREE
  pagination: true
  batchSizeForSync: 1000
  fullSyncPeriod: 3600      # 1시간 주기 전체 동기화
  changedSyncPeriod: 300    # 5분 주기 변경 동기화
```

### 3.4 OIDC 인증 흐름 (Authorization Code + PKCE)

1. 사용자 → /auth/realms/public-saas/protocol/openid-connect/auth
2. code_challenge (SHA256) + state + nonce 포함
3. Keycloak 로그인 화면 표시
4. 인증 성공 → authorization_code 발급
5. 백엔드에서 code + code_verifier로 토큰 교환
6. access_token (15분) + refresh_token (7일) 발급

### 3.5 Kubernetes RBAC 매핑

```yaml
# kube-apiserver OIDC 설정
apiServer:
  extraArgs:
    oidc-issuer-url: "https://sso.example.go.kr/realms/public-saas"
    oidc-client-id: "k8s-auth"
    oidc-username-claim: "preferred_username"
    oidc-groups-claim: "groups"
    oidc-ca-file: "/etc/kubernetes/pki/keycloak-ca.pem"

# ClusterRoleBinding - 관리자 그룹
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: keycloak-admin-binding
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: cluster-admin
subjects:
  - kind: Group
    name: "kc-cluster-admins"
    apiGroup: rbac.authorization.k8s.io
```

### 3.6 세션 관리

- Access Token: 15분 (CSAP D-08 준수)
- Refresh Token: 7일
- SSO Session Idle: 30분
- SSO Session Max: 8시간
- 동시 세션 제한: 3개

### 3.7 보안 설정

- TLS 1.3 필수 (Traefik Ingress)
- NetworkPolicy: Keycloak ↔ PostgreSQL, Keycloak ↔ LDAP만 허용
- Pod Security: PSS Restricted
- 비밀번호 정책: 최소 12자, 복잡도 필수

### 3.8 Realm Export/Import 자동화

- `scripts/keycloak-export.sh`: Realm JSON 전체 내보내기
- `scripts/keycloak-import.sh`: 초기 설정 자동 적용
- GitOps 연동: Realm 설정 변경 → Git commit → 자동 적용
