# MTU-N235: LDAP/AD 공공기관 표준 디렉토리 연동 -- Plan

> **버전**: 1.0 | **작성일**: 2026-04-10 | **작성자**: PM Lead

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 공공기관 기존 LDAP/AD 인프라와 SSO 통합으로 사용자 관리 비용 절감 |
| 기술 | Keycloak LDAP Federation + User Storage SPI, LDAPS (TLS 1.3) |
| 보안 | LDAPS 필수, 서비스 계정 최소 권한, PII 마스킹 |
| 운영 | 동기화 상태 모니터링, 연결 실패 알림 |

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | 공공기관 90%+ 기존 AD/LDAP 사용, 신규 SaaS 도입 시 기존 디렉토리 연동 필수 |
| WHO | 공공기관 IT 관리자, 시스템 운영자 |
| RISK | LDAP 서버 접근 불가 시 인증 실패 → Keycloak 로컬 캐시 + 오프라인 토큰 |
| SUCCESS | LDAP Federation 설정 자동화, 동기화 모니터링, 운영 가이드 |
| SCOPE | Keycloak LDAP 설정 + Helm values + 모니터링 + 가이드 |

## 기능 요구사항

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-LDAP.1 | Keycloak LDAP Federation Provider 설정 (Helm values) | P0 |
| FR-LDAP.2 | LDAPS (포트 636) + TLS 1.3 강제 설정 | P0 |
| FR-LDAP.3 | 사용자 속성 매핑 (공공기관 표준: 부서, 직급, 직원번호) | P0 |
| FR-LDAP.4 | 그룹 동기화 → Keycloak 역할 매핑 자동화 | P1 |
| FR-LDAP.5 | LDAP 동기화 상태 Prometheus 메트릭 | P1 |
| FR-LDAP.6 | 운영 가이드 (연결 설정, 트러블슈팅) | P1 |

## 산출물 목록

| 산출물 | 경로 |
|--------|------|
| Design | docs/02-design/mtus/MTU-N235-ldap-ad-integration.design.md |
| Helm 설정 | infra/keycloak/ldap-federation/ |
| 모니터링 | infra/monitoring/rules/ldap-sync-rules.yaml |
| 알림 | infra/monitoring/alerts/ldap-sync-alerts.yaml |
| 가이드 | docs-portal/docs/auth/ldap-integration-guide.md |
| 테스트 | scripts/test-ldap-integration.sh |
