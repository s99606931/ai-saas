# PRD: MTU-N170 Keycloak SSO/OIDC 통합

> 버전: 1.0 | 작성일: 2026-04-10 | 작성자: PM Lead

## WHY

공공기관 환경에서는 LDAP/Active Directory 기반 통합 인증이 표준이다.
Keycloak을 Self-hosted IAM으로 도입하여 SSO(Single Sign-On), OIDC 인증,
LDAP 연동을 구현한다. 데이터 주권 확보를 위해 외부 SaaS IAM 사용 불가 (N2SF 준수).

## WHO

- 시스템 관리자: Keycloak Realm/Client 관리
- 개발자: OIDC 토큰 기반 API 인증 활용
- 최종 사용자: SSO로 단일 로그인 경험

## RISK

- Keycloak JVM 리소스 사용량 (k3s 환경 제약)
- LDAP 스키마 호환성 (기관별 차이)
- 토큰 갱신/세션 관리 복잡도

## SUCCESS

- SC-1: Keycloak Helm 배포 + Kubernetes OIDC 인증 연동
- SC-2: LDAP User Federation 설정 자동화
- SC-3: SSO 로그인 흐름 (Authorization Code + PKCE)
- SC-4: RBAC 매핑 (Keycloak Role → Kubernetes RBAC)

## SCOPE

- 포함: Keycloak Helm 차트, OIDC 설정, LDAP 연동, RBAC 매핑, NetworkPolicy
- 제외: Active Directory 직접 연결 (LDAP 프로토콜로 추상화)
