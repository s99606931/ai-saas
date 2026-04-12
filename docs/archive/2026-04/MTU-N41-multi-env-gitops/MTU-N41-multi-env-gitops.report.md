# Report: MTU-N41 멀티환경 GitOps 분리

> **작성일**: 2026-04-09

## 성공 기준 달성

| ID | 기준 | 상태 |
|----|------|------|
| SC-N41.1 | 3개 환경 Kustomization 분리 | PASS (dev/stg/prod) |
| SC-N41.2 | 환경별 values override | PASS (patches/) |
| SC-N41.3 | 승격 절차 문서 | PASS (가이드 3장) |
| SC-N41.4 | Flux Kustomization 3개 | PASS (environments/) |
| SC-N41.5 | N2SF 등급별 매핑 | PASS (O/S/C 매핑) |

## 산출물

| 산출물 | 경로 |
|--------|------|
| Base manifests | `deploy/base/` |
| Dev overlay | `deploy/envs/dev/` |
| Stg overlay | `deploy/envs/stg/` |
| Prod overlay | `deploy/envs/prod/` |
| Flux dev | `infra/flux/environments/dev-kustomization.yaml` |
| Flux stg | `infra/flux/environments/stg-kustomization.yaml` |
| Flux prod | `infra/flux/environments/prod-kustomization.yaml` |
| 운영 가이드 | `docs/framework/08-infra/multi-env-gitops-guide.md` |

## matchRate: 100%
