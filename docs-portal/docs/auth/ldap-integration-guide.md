# LDAP/Active Directory 연동 가이드

> **문서 버전**: 1.0 | **작성일**: 2026-04-10
> **Design Ref**: MTU-N235 | **Plan SC**: FR-LDAP.6

## 개요

공공기관 SaaS 플랫폼은 Keycloak LDAP Federation을 통해 기존 Active Directory/LDAP 인프라와 연동합니다.

## 사전 요구사항

| 항목 | 요구사항 |
|------|---------|
| LDAP 서버 | Active Directory 또는 OpenLDAP |
| 프로토콜 | LDAPS (포트 636) 필수. 평문 LDAP 사용 불가 |
| 서비스 계정 | 읽기 전용 서비스 계정 (최소 권한 원칙) |
| 인증서 | LDAP 서버 TLS 인증서 (자체 서명 시 Keycloak truststore 등록) |

## 설정 절차

### 1단계: 시크릿 생성

```bash
# LDAP 서비스 계정 시크릿 생성 (kubeseal 암호화)
kubectl create secret generic keycloak-ldap-credentials \
  --namespace keycloak \
  --from-literal=LDAP_HOST=ldaps://ad.agency.go.kr \
  --from-literal=LDAP_BIND_DN="CN=svc-keycloak,OU=ServiceAccounts,DC=agency,DC=go,DC=kr" \
  --from-literal=LDAP_BIND_PASSWORD="<비밀번호>" \
  --from-literal=LDAP_USERS_DN="OU=Users,DC=agency,DC=go,DC=kr" \
  --from-literal=LDAP_GROUPS_DN="OU=Groups,DC=agency,DC=go,DC=kr" \
  --dry-run=client -o yaml | kubeseal > infra/keycloak/ldap-federation/sealed-secret.yaml
```

### 2단계: Federation 설정 적용

```bash
# Keycloak Admin REST API로 LDAP Federation 생성
KEYCLOAK_URL="https://auth.saas.go.kr"
REALM="public-saas"
TOKEN=$(curl -s -X POST "$KEYCLOAK_URL/realms/master/protocol/openid-connect/token" \
  -d "grant_type=client_credentials" \
  -d "client_id=admin-cli" \
  -d "client_secret=$KEYCLOAK_ADMIN_SECRET" | jq -r '.access_token')

curl -X POST "$KEYCLOAK_URL/admin/realms/$REALM/components" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d @infra/keycloak/ldap-federation/realm-ldap-config.json
```

### 3단계: 동기화 실행

```bash
# 전체 동기화
curl -X POST "$KEYCLOAK_URL/admin/realms/$REALM/user-storage/$FEDERATION_ID/sync?action=triggerFullSync" \
  -H "Authorization: Bearer $TOKEN"

# 변경분 동기화 (5분 주기 자동 실행)
curl -X POST "$KEYCLOAK_URL/admin/realms/$REALM/user-storage/$FEDERATION_ID/sync?action=triggerChangedUsersSync" \
  -H "Authorization: Bearer $TOKEN"
```

## 속성 매핑 (공공기관 표준)

| AD 속성 | Keycloak 속성 | 설명 |
|---------|-------------|------|
| sAMAccountName | username | 로그인 ID |
| cn | fullName | 성명 |
| mail | email | 이메일 |
| department | department | 부서 |
| title | jobTitle | 직급 |
| employeeNumber | employeeNumber | 직원번호 |

## 그룹-역할 매핑

| AD 그룹 | Keycloak 역할 | 권한 |
|---------|-------------|------|
| CN=SaaS-Admins | saas-admin | 전체 관리 |
| CN=SaaS-Users | saas-user | 일반 사용 |
| CN=SaaS-Viewers | saas-viewer | 읽기 전용 |

## 트러블슈팅

### LDAP 연결 실패

```bash
# LDAPS 연결 테스트
openssl s_client -connect ad.agency.go.kr:636 -showcerts

# Keycloak 로그 확인
kubectl logs -n keycloak deployment/keycloak | grep -i ldap
```

### 동기화 상태 확인

```bash
# Prometheus 메트릭 확인
curl -s http://prometheus:9090/api/v1/query?query=keycloak:ldap_sync:last_success_time

# Grafana 대시보드: Keycloak > LDAP 동기화 패널
```

## 보안 유의사항

- LDAPS (포트 636) 필수 사용. 평문 LDAP (389) 절대 금지
- 서비스 계정: 읽기 전용 최소 권한
- 비밀번호: SealedSecret으로 암호화 관리
- PII 로그 마스킹 필수 (사용자 이름, 이메일 등)
