# MTU-N94: 통합 릴리스 노트 + 마이그레이션 가이드 자동화 — Plan

> **MTU ID**: MTU-N94
> **Phase**: 7라운드 CI/CD·DevOps 고도화
> **작성일**: 2026-04-10

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | v2.0 출시 준비, 릴리스 노트 자동 생성, 업그레이드 가이드 |
| 기술 | Git 커밋 기반 릴리스 노트 생성 + Helm 마이그레이션 스크립트 |
| 보안 | 보안 패치 내역 자동 포함, CVE 수정 이력 추적 |
| 운영 | 릴리스 프로세스 자동화, 수동 작업 최소화 |

## 기능 요구사항

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-N94.1 | Git 커밋 기반 릴리스 노트 자동 생성 스크립트 | HIGH |
| FR-N94.2 | 마이그레이션 가이드 자동 생성 (breaking changes 감지) | HIGH |
| FR-N94.3 | Helm 차트 업그레이드 스크립트 | MED |
| FR-N94.4 | UAT 체크리스트 자동 생성 | MED |
| FR-N94.5 | E2E 테스트 | HIGH |

## 산출물 목록

| # | 산출물 | 경로 |
|---|--------|------|
| 1 | 릴리스 노트 생성 스크립트 | scripts/generate-release-notes.sh |
| 2 | 마이그레이션 가이드 생성 | scripts/generate-migration-guide.sh |
| 3 | UAT 체크리스트 템플릿 | docs/release/uat-checklist-template.md |
| 4 | 릴리스 워크플로우 | .gitea/workflows/release-notes.yaml |
| 5 | E2E 테스트 | tests/e2e/test-release-automation.sh |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 초기 작성 | PM Agent |
