# MTU-N51: 빌드 매트릭스 병렬화 + CI 최적화 — Plan

> **버전**: 1.0.0 | **작성일**: 2026-04-09 | **작성자**: PM Lead (Opus)

---

## Executive Summary (4관점)

| 관점 | 내용 |
|------|------|
| 비즈니스 | CI 파이프라인 소요 시간 50% 단축으로 개발 생산성 극대화 |
| 기술 | Gitea Actions matrix strategy + 멀티스테이지 Dockerfile + 증분 테스트 |
| 보안 | 빌드 캐시 격리, matrix 각 잡 독립 실행 (SLSA L3 호환) |
| 운영 | 병렬 빌드 모니터링 + 실패 빠른 피드백 |

---

## 기능 요구사항

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-N51.1 | Matrix strategy CI 워크플로우 (다중 서비스 병렬 빌드) | 필수 |
| FR-N51.2 | 멀티스테이지 Dockerfile 최적화 (공통 base 레이어) | 필수 |
| FR-N51.3 | 증분 테스트 전략 (변경된 서비스만) | 필수 |
| FR-N51.4 | 빌드 캐시 전략 고도화 | 필수 |
| FR-N51.5 | CI 성능 메트릭 수집 + 벤치마크 | 필수 |
| FR-N51.6 | 테스트 스크립트 | 필수 |

---

## 산출물

| 산출물 | 경로 |
|--------|------|
| Matrix CI 워크플로우 | `.gitea/workflows/matrix-build.yml` |
| 멀티스테이지 Dockerfile | `docker/Dockerfile.optimized` |
| 증분 테스트 스크립트 | `scripts/incremental-test.sh` |
| CI 최적화 가이드 | `docs/operations/ci-optimization-guide.md` |
| 테스트 스크립트 | `scripts/test-matrix-build.sh` |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-09 | 최초 작성 | PM Lead |
