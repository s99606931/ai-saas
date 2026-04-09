# Plan: MTU-N42 Semantic Release + CHANGELOG 자동화

> **버전**: 1.0.0 | **작성일**: 2026-04-09

## 기능 요구사항

| FR ID | 요구사항 | 우선순위 |
|-------|---------|---------|
| FR-N42.1 | semantic-release 설정 (.releaserc.yaml) | P0 |
| FR-N42.2 | Gitea Actions release.yml 워크플로우 | P0 |
| FR-N42.3 | Conventional Commits 가이드 문서 | P1 |
| FR-N42.4 | commitlint 설정 (커밋 메시지 검증) | P1 |
| FR-N42.5 | CHANGELOG 자동 생성 플러그인 | P0 |

## 산출물

| 번호 | 산출물 | 경로 |
|------|--------|------|
| 1 | semantic-release 설정 | `.releaserc.yaml` |
| 2 | commitlint 설정 | `commitlint.config.js` |
| 3 | Release 워크플로우 | `.gitea/workflows/release.yml` |
| 4 | 릴리스 가이드 | `docs/framework/08-infra/release-automation-guide.md` |
