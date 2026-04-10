# MTU-N111: 아키텍처 다이어그램 자동 업데이트 — Plan

> **MTU ID**: MTU-N111
> **Phase**: 9라운드 CI/CD DevOps 고도화
> **작성일**: 2026-04-10
> **복잡도**: MED

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 인프라 변경 시 아키텍처 다이어그램 자동 갱신, 감리 산출물 최신화 |
| 기술 | Mermaid + k8s 리소스 스캔 -> 자동 다이어그램 생성 -> Docusaurus 반영 |
| 보안 | 아키텍처 가시성 확보로 보안 경계 관리 용이 |
| 운영 | CI 파이프라인에서 인프라 변경 감지 시 자동 업데이트 |

## 기능 요구사항

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-N111.1 | 인프라 컴포넌트 스캔 스크립트 | HIGH |
| FR-N111.2 | Mermaid 다이어그램 자동 생성 | HIGH |
| FR-N111.3 | CI 파이프라인 연동 | HIGH |
| FR-N111.4 | Docusaurus 아키텍처 페이지 업데이트 | MED |
| FR-N111.5 | E2E 검증 테스트 | HIGH |

## 산출물

| # | 산출물 | 경로 |
|---|--------|------|
| 1 | 스캔 스크립트 | scripts/generate-arch-diagram.sh |
| 2 | Mermaid 템플릿 | docs-portal/docs/architecture/platform-overview.md |
| 3 | CI 워크플로우 | .gitea/workflows/arch-diagram-update.yaml |
| 4 | E2E 테스트 | tests/e2e/arch-diagram-auto.test.sh |
