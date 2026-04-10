# 리포트: MTU-N170 Keycloak SSO/OIDC 통합

> 버전: 1.0 | 작성일: 2026-04-10

## Executive Summary

| 관점 | 계획 | 달성 |
|------|------|------|
| 비즈니스 | 공공기관 표준 통합 인증 | Keycloak 26+ Self-hosted IAM |
| 기술 | OIDC + LDAP + K8s RBAC | Helm 차트 + Realm JSON + RBAC 매핑 |
| 보안 | CSAP D-08/D-09 준수 | PKCE, 브루트포스 보호, PSS Restricted |
| 운영 | Realm Export/Import 자동화 | 스크립트 2건 + GitOps 연동 |

## 산출물

| 파일 | 용도 |
|------|------|
| infra/helm/keycloak-sso/ | Helm 차트 (4개 파일) |
| infra/keycloak/realm-config/public-saas-realm.json | Realm 설정 |
| infra/helm/keycloak-sso/templates/rbac-mapping.yaml | K8s RBAC 매핑 |
| scripts/keycloak/realm-export.sh | Realm 내보내기 |
| scripts/keycloak/realm-import.sh | Realm 가져오기 |
| tests/e2e/keycloak-sso.test.ts | E2E 테스트 16건 |

## matchRate: 95%
