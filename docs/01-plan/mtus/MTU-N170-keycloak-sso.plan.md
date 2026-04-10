# Plan: MTU-N170 Keycloak SSO/OIDC 통합

> 버전: 1.0 | 작성일: 2026-04-10 | 작성자: PM Lead

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 공공기관 표준 통합 인증 체계 구축 |
| 기술 | Keycloak + OIDC + LDAP Federation + Kubernetes RBAC |
| 보안 | CSAP D-08 접근통제, D-09 암호화, Self-hosted IAM |
| 운영 | Helm 기반 배포, Realm Export/Import 자동화 |

## 기능 요구사항

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-SSO.1 | Keycloak Helm 차트 배포 (PostgreSQL HA 백엔드) | HIGH |
| FR-SSO.2 | 공공기관 SaaS Realm 생성 + 기본 Client 설정 | HIGH |
| FR-SSO.3 | LDAP User Federation 프로바이더 설정 | HIGH |
| FR-SSO.4 | OIDC Authorization Code + PKCE 인증 흐름 | HIGH |
| FR-SSO.5 | Keycloak Role → Kubernetes RBAC ClusterRole 매핑 | HIGH |
| FR-SSO.6 | SSO 세션 관리 (JWT 15분/Refresh 7일) | MED |
| FR-SSO.7 | Keycloak NetworkPolicy + TLS 설정 | HIGH |
| FR-SSO.8 | Realm Export/Import 자동화 스크립트 | MED |

## 추적성 매트릭스

| FR ID | Design | 구현 | 테스트 | CSAP |
|-------|--------|------|--------|------|
| FR-SSO.1 | §3.1 | helm/keycloak/ | T-SSO-01 | D-12 |
| FR-SSO.2 | §3.2 | realm-config/ | T-SSO-02 | D-08 |
| FR-SSO.3 | §3.3 | ldap-federation/ | T-SSO-03 | D-08 |
| FR-SSO.4 | §3.4 | oidc-config/ | T-SSO-04 | D-08 |
| FR-SSO.5 | §3.5 | rbac-mapping/ | T-SSO-05 | D-08 |
| FR-SSO.6 | §3.6 | session-config/ | T-SSO-06 | D-08 |
| FR-SSO.7 | §3.7 | networkpolicy/ | T-SSO-07 | D-08,D-09 |
| FR-SSO.8 | §3.8 | scripts/ | T-SSO-08 | D-12 |
