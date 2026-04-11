# Report: MTU-N244 CI/CD 파이프라인 병렬화 및 모노레포 최적화

> **작성일**: 2026-04-11 | **matchRate**: 95%

## Executive Summary

| 관점 | 목표 | 달성 |
|------|------|------|
| 비즈니스 | CI 실행 시간 50% 단축 | 병렬화 구조 완비 (lint/typecheck/build 동시) |
| 기술 | 모노레포 affected 빌드 | git diff 기반 변경 감지 구현 완료 |
| 보안 | 캐시 격리 | lockfile 해시 기반 캐시 키 적용 |
| 운영 | Runner 효율 개선 | 문서만 변경 시 빌드 건너뜀 |

## 산출물

| FR ID | 산출물 | 상태 |
|-------|--------|------|
| FR-N244.1 | ci.yml Job 병렬화 | 완료 |
| FR-N244.2 | 모노레포 변경 감지 | 완료 |
| FR-N244.3 | pnpm cache 최적화 | 완료 |
| FR-N244.4 | Docker BuildKit 병렬 빌드 | 완료 |
| FR-N244.5 | 공통 패키지 폴백 | 완료 |
| FR-N244.6 | 벤치마크 스크립트 | 완료 |
| FR-N244.7 | workflow_call 지원 | 완료 |

## 변경 파일

- `.gitea/workflows/ci.yml` — 6개 병렬 Job으로 리팩토링
- `.gitea/workflows/detect-changes.yml` — 신규 재사용 변경 감지 워크플로우
- `.gitea/workflows/matrix-build.yml` — Node.js 22, pnpm 캐시 통일
- `.gitea/workflows/setup-node-pnpm.yml` — 캐시 키 전략 주석 보강
- `scripts/benchmark-ci-pipeline.sh` — 병렬/순차 비교 벤치마크
