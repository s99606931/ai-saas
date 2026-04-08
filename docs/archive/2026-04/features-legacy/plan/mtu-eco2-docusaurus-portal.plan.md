# MTU-ECO2 — Docusaurus 문서 포털 배포 설정

> **문서 ID**: MTU-ECO2-PLAN
> **버전**: 1.0.0 | **일자**: 2026-04-06 | **작성자**: PM Agent

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| **비즈니스** | 프레임워크 문서 포털로 공공기관 접근성 제고 |
| **기술** | Docusaurus v3 + GitHub Pages 자동 배포 |
| **보안** | 정적 사이트 전용, 동적 데이터 없음 (N2SF O등급) |
| **감리** | 문서 포털과 원본 문서 동기화 절차 정의 |

## Context Anchor

| 항목 | 내용 |
|------|------|
| **WHY** | 프레임워크 사용자에게 체계적인 문서 탐색 환경 제공 |
| **WHO** | 공공기관 개발자, SI 사업자, 프레임워크 사용자 |
| **RISK** | 문서 미동기화로 포털과 원본 불일치 |
| **SUCCESS** | Docusaurus 설정 + GitHub Pages 배포 워크플로우 완비 |
| **SCOPE** | docs-portal/ 디렉토리 구성 + 배포 설정 |

## 기능 요구사항

| FR ID | 요구사항 | 우선순위 | 검증 방법 |
|-------|---------|---------|---------|
| FR-ECO2.1 | Docusaurus v3 프로젝트 초기 설정 | MUST | docs-portal/ 디렉토리 존재 |
| FR-ECO2.2 | 사이드바 구성 (프레임워크 문서 카테고리별) | MUST | sidebars.js 카테고리 5개+ |
| FR-ECO2.3 | GitHub Pages 배포 워크플로우 | MUST | .github/workflows/docs-deploy.yml 존재 |
| FR-ECO2.4 | 메인 페이지 (프레임워크 소개 + 빠른 시작) | MUST | 랜딩 페이지 존재 |
| FR-ECO2.5 | 검색 기능 설정 (Algolia 또는 로컬 검색) | SHOULD | 검색 플러그인 설정 |

## 산출물

| 산출물 | 경로 | 형식 |
|--------|------|------|
| Docusaurus 설정 | `docs-portal/docusaurus.config.js` | JavaScript |
| 사이드바 | `docs-portal/sidebars.js` | JavaScript |
| 배포 워크플로우 | `.github/workflows/docs-deploy.yml` | YAML |
| 랜딩 페이지 | `docs-portal/src/pages/index.tsx` | TypeScript |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-06 | 최초 작성 | PM Agent |
