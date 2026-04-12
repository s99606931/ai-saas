# Plan: MTU-N38 Gitea Actions 워크플로우 최적화

> **버전**: 1.0.0 | **작성일**: 2026-04-09 | **작성자**: PM Lead

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | CI/CD 빌드 시간 30% 단축, Runner 자원 효율 개선 |
| 기술 | pnpm 캐싱, Docker BuildKit, 재사용 워크플로우 |
| 보안 | 캐시 오염 방지 (브랜치 격리, 읽기 전용 캐시) |
| 운영 | 워크플로우 유지보수 코스트 50% 감소 |

---

## 기능 요구사항

| FR ID | 요구사항 | 우선순위 | 검증 방법 |
|-------|---------|---------|---------|
| FR-N38.1 | pnpm store 캐싱 (actions/cache 활용) | P0 | 캐시 히트 로그 |
| FR-N38.2 | Docker BuildKit 레이어 캐싱 최적화 | P0 | cache-from/cache-to 설정 |
| FR-N38.3 | 공통 설정 (pnpm+Node.js) 재사용 워크플로우 분리 | P1 | reusable workflow 호출 |
| FR-N38.4 | 불필요한 중복 워크플로우 통합 정리 | P1 | 파일 수 감소 |
| FR-N38.5 | 캐시 키 전략 (lock 파일 해시 기반) | P0 | 해시 키 사용 확인 |
| FR-N38.6 | concurrency 그룹 설정 최적화 | P1 | 동일 브랜치 자동 취소 |

---

## 산출물

| 번호 | 산출물 | 경로 |
|------|--------|------|
| 1 | 최적화된 ci.yml | `.gitea/workflows/ci.yml` (수정) |
| 2 | 최적화된 ci-cd-pipeline.yml | `.gitea/workflows/ci-cd-pipeline.yml` (수정) |
| 3 | 재사용 가능 setup-action | `.gitea/workflows/setup-node-pnpm.yml` |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-09 | 최초 작성 | PM Lead |
