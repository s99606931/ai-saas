# MTU-N236: Keycloak 멀티테넌트 Realm 자동 프로비저닝 -- Plan

> **버전**: 1.0 | **작성일**: 2026-04-10

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 신규 공공기관 테넌트 온보딩 시 Realm 자동 생성으로 시간 단축 (수일→분) |
| 기술 | Keycloak Organizations (v26+) + Admin REST API 자동화 스크립트 |
| 보안 | Realm 간 완전 격리, 테넌트별 IdP 독립 설정 |
| 운영 | 프로비저닝 상태 모니터링, 실패 시 자동 알림 |

## 기능 요구사항

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-MT.1 | 테넌트 프로비저닝 자동화 스크립트 (Realm 생성 + 기본 설정) | P0 |
| FR-MT.2 | Keycloak Organizations 활용 단일 Realm 멀티테넌시 설정 | P0 |
| FR-MT.3 | 테넌트별 IdP 자동 설정 (LDAP/SAML/OIDC) | P1 |
| FR-MT.4 | 기본 역할/그룹 자동 생성 | P0 |
| FR-MT.5 | 프로비저닝 모니터링 대시보드 | P1 |
| FR-MT.6 | 디프로비저닝 (테넌트 해지 시 정리) | P1 |

## 산출물

| 산출물 | 경로 |
|--------|------|
| Design | docs/02-design/mtus/MTU-N236-keycloak-multitenant-provisioning.design.md |
| 프로비저닝 스크립트 | scripts/tenant-provisioning/ |
| Helm values | infra/keycloak/multitenant/ |
| 대시보드 | infra/monitoring/dashboards/tenant-provisioning-dashboard.json |
| 테스트 | scripts/test-tenant-provisioning.sh |
