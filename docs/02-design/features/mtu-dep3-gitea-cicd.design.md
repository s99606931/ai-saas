# MTU-DEP3 Design: Gitea CI/CD 파이프라인

> **버전**: 1.0.0 | **일자**: 2026-04-06 | **작성자**: PM Agent
> **Plan 참조**: docs/01-plan/features/mtu-dep3-gitea-cicd.plan.md
> **아키텍처**: Gitea Actions (GitHub Actions 호환 문법)

---

## Design Anchor

| 항목 | 결정 |
|------|------|
| **CI 엔진** | Gitea Actions (act runner) — GitHub Actions YAML 호환 |
| **러너** | Self-hosted (WSL2 or Docker-in-Docker) |
| **패키지 매니저** | pnpm 9.x + store 캐시 |
| **빌드 도구** | TypeScript + turbo (모노레포) |
| **보안** | npm audit + gitleaks (시크릿 스캔) |
| **배포** | Docker 이미지 빌드 + Harbor/로컬 레지스트리 푸시 |

---

## 1. CI 파이프라인 (ci.yml)

### 트리거

- push: main, stg, feat/*, fix/*
- pull_request: main

### 단계

```
1. checkout
2. pnpm install (캐시 복원)
3. typecheck (turbo run typecheck)
4. lint (turbo run lint)  
5. build (turbo run build)
6. test (turbo run test)
```

### 캐시 전략

pnpm store 경로를 actions/cache로 캐시.

---

## 2. 보안 파이프라인 (security.yml)

### 트리거

- push: main
- schedule: 매주 월요일 09:00 KST

### 단계

```
1. checkout
2. pnpm install
3. npm audit (--audit-level=high)
4. gitleaks detect (시크릿 스캔)
5. 결과 아티팩트 저장
```

---

## 3. 배포 파이프라인 (deploy.yml)

### 트리거

- push: main (태그 포함)

### 단계

```
1. checkout
2. Docker 이미지 빌드 (15 서비스 + 1 포털)
3. 이미지 태깅 (git SHA + latest)
4. 로컬 레지스트리 or Harbor 푸시
5. k3s 배포 트리거 (kubectl apply)
```

---

## Session Guide

1. .gitea/workflows/ 디렉토리 생성
2. ci.yml 작성
3. security.yml 작성
4. deploy.yml 작성
5. 검증: YAML 문법 유효성

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-06 | 최초 작성 | PM Agent |
