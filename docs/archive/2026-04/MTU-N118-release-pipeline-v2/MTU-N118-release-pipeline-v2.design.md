# MTU-N118: E2E 릴리스 파이프라인 v2 — 설계 문서

> 작성일: 2026-04-10

## Design Anchor

| 항목 | 내용 |
|------|------|
| 패턴 | GitOps 기반 완전 자동 릴리스 + SLO 기반 롤백 |
| 의존성 | Gitea Actions, Argo Rollouts (기 구축), Flagger (기 구축), Prometheus SLO (기 구축) |
