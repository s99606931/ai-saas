# Plan: MTU-N244 CI/CD 파이프라인 병렬화 및 모노레포 최적화

> **버전**: 1.0.0 | **작성일**: 2026-04-11 | **작성자**: PM Lead

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | CI/CD 파이프라인 실행 시간 50% 단축, 개발 생산성 향상 |
| 기술 | 모노레포 변경 감지(affected 빌드), Job 병렬화, pnpm 캐시 통합 |
| 보안 | 캐시 격리(브랜치별), 빌드 재현성 보장 (frozen-lockfile) |
| 운영 | Runner 자원 효율 개선, 불필요한 빌드 제거로 CI 큐 대기 감소 |

---

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | 현재 모든 push에서 전체 서비스를 빌드하여 시간 낭비. 변경된 서비스만 빌드하면 50%+ 시간 단축 가능 |
| WHO | DevOps 엔지니어, 전체 개발팀 |
| RISK | 변경 감지 로직 오류 시 필요한 빌드 누락 가능 → 공통 패키지 변경 시 전체 빌드 폴백 |
| SUCCESS | CI 파이프라인 평균 실행 시간 50% 감소, 캐시 히트율 80%+ |
| SCOPE | .gitea/workflows/ci.yml 최적화, 신규 affected-services 감지 액션 |

---

## 기능 요구사항

| FR ID | 요구사항 | 우선순위 | 검증 방법 |
|-------|---------|---------|---------|
| FR-N244.1 | ci.yml Job 병렬화 (lint/typecheck/build 동시 실행) | P0 | 워크플로우 실행 로그 확인 |
| FR-N244.2 | 모노레포 변경 감지 (affected 서비스만 빌드/테스트) | P0 | 부분 변경 시 해당 서비스만 빌드 확인 |
| FR-N244.3 | pnpm store 캐시 최적화 (restore-keys 체인) | P0 | 캐시 히트 로그 확인 |
| FR-N244.4 | Docker BuildKit 병렬 빌드 (matrix 전략) | P1 | 병렬 빌드 실행 확인 |
| FR-N244.5 | 공통 패키지 변경 시 전체 빌드 폴백 | P0 | packages/ 변경 시 전체 빌드 확인 |
| FR-N244.6 | 빌드 타임라인 시각화 스크립트 | P2 | 벤치마크 스크립트 실행 |
| FR-N244.7 | ci-cd-pipeline.yml 에서 CI Job을 별도 워크플로우로 참조 | P1 | workflow_call 호출 확인 |

---

## 산출물

| 번호 | 산출물 | 경로 |
|------|--------|------|
| 1 | 최적화된 CI 워크플로우 | `.gitea/workflows/ci.yml` (수정) |
| 2 | 변경 감지 워크플로우 | `.gitea/workflows/detect-changes.yml` (신규) |
| 3 | 통합 파이프라인 최적화 | `.gitea/workflows/ci-cd-pipeline.yml` (수정) |
| 4 | Matrix 빌드 최적화 | `.gitea/workflows/matrix-build.yml` (수정) |
| 5 | 파이프라인 벤치마크 스크립트 | `scripts/benchmark-ci-pipeline.sh` (수정/신규) |

---

## 추적성 매트릭스

| FR ID | Design 섹션 | 구현 파일 | 테스트 | CSAP |
|-------|------------|----------|--------|------|
| FR-N244.1 | S3.1 | ci.yml | 병렬 실행 확인 | D-12 |
| FR-N244.2 | S3.2 | detect-changes.yml | 부분 빌드 검증 | D-12 |
| FR-N244.3 | S3.3 | ci.yml | 캐시 히트율 | D-12 |
| FR-N244.4 | S3.4 | ci-cd-pipeline.yml | 매트릭스 빌드 | D-12 |
| FR-N244.5 | S3.2 | detect-changes.yml | 폴백 검증 | D-12 |
| FR-N244.6 | S3.5 | benchmark-ci-pipeline.sh | 스크립트 실행 | D-12 |
| FR-N244.7 | S3.6 | ci-cd-pipeline.yml | 워크플로우 호출 | D-12 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-11 | 최초 작성 | PM Lead |
