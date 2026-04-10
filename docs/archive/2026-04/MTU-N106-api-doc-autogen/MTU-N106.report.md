# MTU-N106: API 문서 자동 생성 — Report

> **MTU ID**: MTU-N106 | **완료일**: 2026-04-10 | **matchRate**: 100% (16/16)

## Executive Summary

| 관점 | 달성 |
|------|------|
| 비즈니스 | 100% - OpenAPI 3.1.0 통합 스펙 + 자동 MDX 생성 파이프라인 |
| 기술 | 100% - 15개 API 엔드포인트 문서화 + Docusaurus 연동 |
| 보안 | 100% - CSAP D-08/D-06 참조 포함, JWT 인증 문서화 |
| 운영 | 100% - CI 파이프라인 자동 트리거 + 감사 로그 |

## 산출물

| # | 산출물 | 경로 |
|---|--------|------|
| 1 | OpenAPI 통합 스펙 | docs-portal/static/openapi/ai-saas-api.yaml |
| 2 | 문서 생성 스크립트 | scripts/generate-api-docs.sh |
| 3 | CI 워크플로우 | .gitea/workflows/api-docs-gen.yaml |
| 4 | E2E 테스트 | tests/e2e/api-doc-autogen.test.sh |
