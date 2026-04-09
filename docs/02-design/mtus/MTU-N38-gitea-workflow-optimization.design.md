# Design: MTU-N38 Gitea Actions 워크플로우 최적화

> **버전**: 1.0.0 | **작성일**: 2026-04-09 | **작성자**: PM Lead (infra-architect)

---

## Design Anchor

| 항목 | 값 |
|------|---|
| 패턴 | Reusable Workflow + Action Cache |
| 캐시 도구 | actions/cache@v4 (Gitea 호환) |
| 빌드 캐시 | Docker BuildKit GHA cache |
| 캐시 키 전략 | pnpm-lock.yaml 해시 기반 |

---

## S3. 상세 설계

### S3.1 pnpm Store 캐싱

```yaml
# 캐시 키: OS + pnpm-lock.yaml 해시
# 복원 키: OS 기반 partial match
- name: Get pnpm store directory
  shell: bash
  run: echo "STORE_PATH=$(pnpm store path --silent)" >> $GITHUB_ENV

- name: Setup pnpm cache
  uses: actions/cache@v4
  with:
    path: ${{ env.STORE_PATH }}
    key: ${{ runner.os }}-pnpm-store-${{ hashFiles('**/pnpm-lock.yaml') }}
    restore-keys: |
      ${{ runner.os }}-pnpm-store-
```

### S3.2 Docker BuildKit 캐싱

```yaml
# GHA 캐시 백엔드 사용 (Gitea Act Runner 지원)
- uses: docker/build-push-action@v5
  with:
    cache-from: type=gha
    cache-to: type=gha,mode=max
```

### S3.3 재사용 워크플로우 (Reusable Workflow)

```yaml
# .gitea/workflows/setup-node-pnpm.yml
# 공통 Node.js + pnpm 설정을 한 곳에서 관리
on:
  workflow_call:
    inputs:
      node-version:
        type: string
        default: "22"
      pnpm-version:
        type: string
        default: "9.15.0"
```

### S3.4 ci.yml 최적화 포인트

1. pnpm store 캐싱 추가
2. 불필요한 서비스 재시작 방지
3. test --coverage 분리 (캐시 활용)
4. e2e 테스트 조건부 실행 (PR만)

### S3.5 ci-cd-pipeline.yml 이미 적용된 캐시

- Docker BuildKit GHA cache: 이미 `cache-from: type=gha` 적용됨
- pnpm cache: 미적용 -> 추가 필요

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-09 | 최초 설계 | PM Lead (infra-architect) |
