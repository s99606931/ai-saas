# MTU-N79: Renovate Bot 의존성 자동 갱신 — Plan

> **MTU ID**: MTU-N79
> **Phase**: 6라운드 CI/CD·DevOps 고도화
> **작성일**: 2026-04-10
> **상태**: Plan 완료

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 의존성 관리 자동화로 보안 취약점 노출 시간(MTTR) 최소화 |
| 기술 | Renovate Bot CronJob + Gitea 연동 + Flux/Helm 자동 업데이트 |
| 보안 | CSAP D-12 공급망 보안, CVE 자동 탐지 및 갱신 PR 생성 |
| 운영 | 주간 그룹 PR 자동 생성, 자동 테스트 + 머지 정책 적용 |

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | 수동 의존성 관리는 CVE 노출 시간 증가, 공급망 공격 위험 |
| WHO | DevOps 엔지니어, 보안 담당자, 개발팀 |
| RISK | 자동 업데이트가 호환성 문제 유발 가능 → 스테이징 검증 필수 |
| SUCCESS | 의존성 갱신 자동화율 95%+, PR 자동생성 + CI 자동검증 |
| SCOPE | Renovate CronJob, renovate.json 설정, Gitea 웹훅 연동 |

## 기능 요구사항

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-N79.1 | Renovate Bot K8s CronJob 배포 | HIGH |
| FR-N79.2 | renovate.json5 전역 설정 (그룹 PR, 자동 머지 정책) | HIGH |
| FR-N79.3 | Helm Chart 버전 자동 감지 및 PR 생성 | HIGH |
| FR-N79.4 | Docker 이미지 태그 자동 갱신 | MED |
| FR-N79.5 | npm/pip 패키지 보안 업데이트 자동화 | MED |
| FR-N79.6 | Gitea 웹훅 연동 (PR 자동 생성/라벨링) | HIGH |
| FR-N79.7 | 취약점 심각도별 자동머지 정책 (low/med 자동, high/critical 수동) | HIGH |

## 비기능 요구사항

| ID | 요구사항 |
|----|---------|
| NFR-N79.1 | CronJob 실행 주기: 매일 02:00 UTC |
| NFR-N79.2 | PR 생성 시 CI 파이프라인 자동 트리거 |
| NFR-N79.3 | 자동머지 전 스테이징 환경 검증 필수 |

## 산출물 목록

| # | 산출물 | 경로 |
|---|--------|------|
| 1 | Renovate CronJob 매니페스트 | infra/renovate/cronjob.yaml |
| 2 | Renovate 전역 설정 | renovate.json5 |
| 3 | Gitea 연동 설정 | infra/renovate/gitea-config.yaml |
| 4 | 자동머지 정책 문서 | infra/renovate/automerge-policy.yaml |
| 5 | E2E 테스트 스크립트 | tests/e2e/test-renovate.sh |

## 추적성 매트릭스

| FR | 산출물 | 테스트 | CSAP |
|----|--------|--------|------|
| FR-N79.1 | cronjob.yaml | test-renovate.sh | D-12 |
| FR-N79.2 | renovate.json5 | test-renovate.sh | D-12 |
| FR-N79.3 | renovate.json5 | test-renovate.sh | D-12 |
| FR-N79.6 | gitea-config.yaml | test-renovate.sh | D-12 |
| FR-N79.7 | automerge-policy.yaml | test-renovate.sh | D-12 |
