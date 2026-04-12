# MTU-N106: API 문서 자동 생성 (OpenAPI + Docusaurus) — Plan

> **MTU ID**: MTU-N106
> **Phase**: 9라운드 CI/CD DevOps 고도화
> **작성일**: 2026-04-10
> **복잡도**: MED

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | API 문서와 코드 동기화 자동화, 감리 산출물 자동 생성 |
| 기술 | OpenAPI 스펙 -> docusaurus-plugin-openapi-docs -> 자동 MDX 생성 |
| 보안 | API 엔드포인트 문서화로 접근 통제 가시성 확보 (CSAP D-08) |
| 운영 | CI 파이프라인에서 API 변경 시 문서 자동 업데이트 |

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | 수동 API 문서 관리 = 코드-문서 불일치, 감리 지적 위험 |
| WHO | 개발팀, API 소비자, 감리관 |
| RISK | API 변경 시 문서 미갱신, 구버전 API 문서 유통 |
| SUCCESS | OpenAPI 스펙 변경 -> 문서 자동 재생성 -> 포털 자동 배포 |
| SCOPE | OpenAPI 스펙 통합, Docusaurus 플러그인 설정, CI 자동화 |

## 기능 요구사항

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-N106.1 | 통합 OpenAPI 스펙 파일 (전체 서비스) | HIGH |
| FR-N106.2 | docusaurus-plugin-openapi-docs 설치 및 설정 | HIGH |
| FR-N106.3 | API 문서 자동 생성 스크립트 | HIGH |
| FR-N106.4 | Gitea Actions CI 연동 (API 변경 시 문서 재생성) | HIGH |
| FR-N106.5 | E2E 검증 테스트 | HIGH |

## 산출물 목록

| # | 산출물 | 경로 |
|---|--------|------|
| 1 | 통합 OpenAPI 스펙 | docs-portal/static/openapi/ai-saas-api.yaml |
| 2 | Docusaurus 플러그인 설정 | docs-portal/docusaurus.config.js (수정) |
| 3 | API 문서 생성 스크립트 | scripts/generate-api-docs.sh |
| 4 | CI 워크플로우 | .gitea/workflows/api-docs-gen.yaml |
| 5 | E2E 테스트 | tests/e2e/api-doc-autogen.test.sh |
