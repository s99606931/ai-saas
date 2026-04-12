# Design: MTU-N41 멀티환경 GitOps 분리

> **버전**: 1.0.0 | **작성일**: 2026-04-09

## Design Anchor

| 항목 | 값 |
|------|---|
| 패턴 | Kustomize Overlay (base + env overlays) |
| GitOps | Flux Kustomization per environment |
| 환경 | dev (O등급), stg (O등급), prod (S/C등급) |
| 승격 | 이미지 태그 + PR 기반 promotion |

## S3. 디렉토리 구조

```
deploy/
  base/                    # 공통 base manifests
    kustomization.yaml
    namespace.yaml
    deployment.yaml        # 공통 deployment 템플릿
    service.yaml
  envs/
    dev/
      kustomization.yaml   # dev overlay
      patches/             # dev 특화 패치
    stg/
      kustomization.yaml   # stg overlay
      patches/
    prod/
      kustomization.yaml   # prod overlay
      patches/

infra/flux/environments/
  dev-kustomization.yaml   # Flux → deploy/envs/dev
  stg-kustomization.yaml   # Flux → deploy/envs/stg
  prod-kustomization.yaml  # Flux → deploy/envs/prod
```

## S3.2 N2SF 등급 매핑

| 환경 | N2SF 등급 | 격리 수준 | Kyverno 정책 |
|------|---------|---------|------------|
| dev | O (공개) | 최소 | 기본 정책 |
| stg | O (공개) | 중간 | 이미지 서명 검증 |
| prod | S/C (비밀/기밀) | 최대 | 전체 보안 정책 enforce |
