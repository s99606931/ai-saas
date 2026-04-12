# MTU-N234: Feature Flag 자체 호스팅 플랫폼 (Unleash) — Plan

> **버전**: 1.0 | **작성일**: 2026-04-10 | **작성자**: PM Lead
> **상태**: 승인됨

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 점진적 기능 배포로 릴리스 위험 최소화, 공공기관 SaaS 안정성 향상 |
| 기술 | Unleash OSS v6+ 자체 호스팅, k3s Helm 배포, PostgreSQL 백엔드 |
| 보안 | N2SF O등급 데이터만 처리, API 키 Sealed Secret 관리 |
| 운영 | Grafana 연동 플래그 상태 모니터링, 감사 로그 통합 |

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | LaunchDarkly 같은 외부 SaaS 사용 불가(CLAUDE.md 절대제약), 자체 호스팅 Feature Flag 필수 |
| WHO | 플랫폼 엔지니어, SRE팀, 개발팀 |
| RISK | Unleash DB 장애 시 플래그 평가 실패 → SDK 캐시 fallback 필수 |
| SUCCESS | Unleash 배포 완료, SDK 연동 예시, Helm Chart, 모니터링 대시보드 |
| SCOPE | 설계 + Helm Chart + SDK 연동 가이드 + 테스트 |

## 기능 요구사항

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-FF.1 | Unleash 서버 k3s Helm 배포 (PostgreSQL 백엔드) | P0 |
| FR-FF.2 | Unleash Proxy Edge 배포 (프론트엔드 SDK 지원) | P0 |
| FR-FF.3 | Node.js/TypeScript SDK 연동 예시 코드 | P0 |
| FR-FF.4 | 플래그 생성/활성화/비활성화 자동화 스크립트 | P1 |
| FR-FF.5 | Grafana 대시보드: 플래그 상태 + 평가 횟수 | P1 |
| FR-FF.6 | 감사 로그 연동 (플래그 변경 이벤트 → audit.jsonl) | P1 |

## 비기능 요구사항

| ID | 요구사항 |
|----|---------|
| NFR-1 | SDK 플래그 평가 응답 시간 < 10ms (로컬 캐시) |
| NFR-2 | Unleash 서버 장애 시 SDK fallback 동작 보장 |
| NFR-3 | API 키 Sealed Secret 관리 (하드코딩 금지) |

## 산출물 목록

| 산출물 | 경로 |
|--------|------|
| Design 문서 | docs/02-design/mtus/MTU-N234-feature-flag-platform.design.md |
| Helm Chart | infra/feature-flags/helm/unleash/ |
| Edge 배포 | infra/feature-flags/helm/unleash-edge/ |
| SDK 연동 예시 | packages/feature-flag-sdk/ |
| 대시보드 | infra/monitoring/dashboards/feature-flags-dashboard.json |
| 테스트 스크립트 | scripts/test-feature-flags.sh |
