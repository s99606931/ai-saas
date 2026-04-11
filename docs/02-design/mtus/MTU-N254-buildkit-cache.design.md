# MTU-N254: 빌드 캐시 분산화 설계서

> **Plan 참조**: MTU-N254.plan.md

## 아키텍처

```
Gitea Runner → BuildKit → Harbor (OCI 캐시 백엔드)
                 ↓
              pnpm store (공유 볼륨)
                 ↓
              레이어 캐시 (--cache-from/--cache-to)
```

## 산출물

| # | 파일 | 설명 |
|---|------|------|
| 1 | `infra/buildkit/buildkitd.toml` | BuildKit 데몬 설정 (원격 캐시) |
| 2 | `infra/buildkit/cache-gc.sh` | 캐시 GC 자동화 스크립트 |
| 3 | `infra/monitoring/dashboards/build-cache.json` | 캐시 히트율 대시보드 |
| 4 | `infra/monitoring/build-cache-rules.yaml` | 빌드 캐시 Recording Rules |
| 5 | `docs/guides/dockerfile-cache-optimization.md` | Dockerfile 캐시 최적화 가이드 |
| 6 | `scripts/verify-buildkit-cache.sh` | 검증 스크립트 |
