# Design: MTU-N174 15라운드 통합 테스트

> 버전: 1.0 | 작성일: 2026-04-10

## 통합 아키텍처

```
                    Keycloak SSO (N170)
                         │
                    OIDC Token
                         │
Developer ──→ API Gateway ──→ Services
    │                              │
    │                         DORA Exporter (N169)
    │                              │
    └── Git Push ──→ GitOps (N172) ──→ dev ──→ stg ──→ prod
                         │
                    k6 Tests (N171)    MLflow (N173)
                    (승격 게이트)       (모델 CD)
```

## 배포 순서 (의존성 순서)

1. Keycloak SSO → OIDC Provider 필요
2. DORA Exporter → Prometheus 메트릭 수집
3. MLflow → 모델 레지스트리
4. GitOps Overlays → 환경 분리
5. k6 Tests → 성능 게이트
