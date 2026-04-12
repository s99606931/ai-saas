# MTU-N235: LDAP/AD 공공기관 표준 디렉토리 연동 -- Design

> **버전**: 1.0 | **작성일**: 2026-04-10
> **Plan 참조**: docs/01-plan/mtus/MTU-N235-ldap-ad-integration.plan.md

## 아키텍처

```
[공공기관 AD/LDAP] ←LDAPS(636)→ [Keycloak LDAP Federation]
                                       ↓
                                [Keycloak Realm]
                                       ↓
                              [SaaS 애플리케이션]
```

## 상세 설계

### 1. LDAP Federation Provider 설정 (FR-LDAP.1, FR-LDAP.2)

Keycloak Realm JSON 기반 자동 프로비저닝:
- connectionUrl: ldaps://{AD_HOST}:636
- bindDn: CN=svc-keycloak,OU=ServiceAccounts,DC=agency,DC=go,DC=kr
- 최소 권한: 읽기 전용 서비스 계정
- TLS 1.3 강제, 인증서 검증 필수

### 2. 사용자 속성 매핑 (FR-LDAP.3)

공공기관 표준 LDAP 스키마:
- cn → 성명
- department → 부서
- title → 직급
- employeeNumber → 직원번호
- mail → 이메일
- memberOf → 소속 그룹

### 3. 그룹-역할 매핑 (FR-LDAP.4)

LDAP 그룹 → Keycloak 역할 자동 매핑:
- CN=Admins → saas-admin
- CN=Users → saas-user
- CN=Viewers → saas-viewer

### 4. 보안 설계

- LDAPS 필수 (평문 LDAP 389 포트 차단)
- 서비스 계정 비밀번호: SealedSecret 관리
- LDAP 바인드 실패 3회 시 알림
- PII (사용자 정보) 로그 마스킹 필수
