# MTU-N86: IDP Golden Path 템플릿 — Design

> **MTU ID**: MTU-N86
> **Plan 참조**: docs/01-plan/mtus/MTU-N86-golden-path.plan.md
> **작성일**: 2026-04-10

---

## Design Anchor

| 항목 | 결정 |
|------|------|
| 템플릿 엔진 | 셸 스크립트 기반 (envsubst) |
| 보안 기본값 | PSS Restricted, NetworkPolicy, RBAC |
| CI/CD | Gitea Actions 워크플로우 |
| 모니터링 | ServiceMonitor + PrometheusRule 포함 |

## Golden Path 구조

```
templates/golden-path/
├── nodejs/
│   ├── Dockerfile          # 멀티스테이지 빌드, 비특권 사용자
│   ├── package.json        # 기본 의존성 (보안 포함)
│   ├── src/
│   │   ├── index.ts        # 엔트리포인트
│   │   ├── health.ts       # /health, /ready 엔드포인트
│   │   └── middleware/
│   │       ├── auth.ts     # JWT 인증 미들웨어
│   │       ├── audit.ts    # 감사 로그 미들웨어
│   │       └── validate.ts # 입력 검증 (Zod)
│   └── tests/
├── helm/
│   ├── Chart.yaml
│   ├── values.yaml         # 보안 기본값
│   └── templates/
│       ├── deployment.yaml  # PSS Restricted
│       ├── service.yaml
│       ├── networkpolicy.yaml
│       ├── serviceaccount.yaml
│       └── servicemonitor.yaml
└── cicd/
    └── gitea-workflow.yaml  # 빌드→테스트→스캔→배포
```
