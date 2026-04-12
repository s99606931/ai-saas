# MTU-N58: DevContainer 개발 환경 자동화

> **버전**: 1.0.0 | **작성일**: 2026-04-10 | **작성자**: PM Lead

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 신규 개발자 온보딩 3~4일 -> 30분, 환경 일관성 100% |
| 기술 | devcontainer.json + Dockerfile + post-create 스크립트 |
| 보안 | .env 마운트 차단, 시크릿 보호, 최소 권한 원칙 |
| 운영 | VS Code + Codespaces 호환, k3s 도구 사전 설치 |

---

## 기능 요구사항

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-N58.1 | devcontainer.json 메인 설정 | P0 |
| FR-N58.2 | Dockerfile (개발 이미지) | P0 |
| FR-N58.3 | post-create.sh 초기화 스크립트 | P0 |
| FR-N58.4 | VS Code 확장 사전 설치 (12개+) | P1 |
| FR-N58.5 | k3s/kubectl/helm/flux CLI 포함 | P0 |
| FR-N58.6 | 시크릿 마운트 보호 | P0 |
| FR-N58.7 | 온보딩 가이드 | P1 |
| FR-N58.8 | 통합 테스트 10건+ | P0 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 최초 작성 | PM Lead |
