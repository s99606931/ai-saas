# Design: MTU-N172 GitOps 환경 승격 게이트

> 버전: 1.0 | 작성일: 2026-04-10

## 1. Design Anchor

- Plan: docs/01-plan/mtus/MTU-N172-gitops-promotion-gates.plan.md
- 핵심 결정: Flux + Kustomize 오버레이 + Gitea Actions 승격 자동화

## 2. 아키텍처

```
Git Push (main) ──→ Flux (dev) ──→ 스모크테스트
                                       │
                                  Pass? ──→ 자동 PR (stg)
                                              │
                                         Flux (stg) ──→ 부하테스트
                                                           │
                                                      Pass? ──→ 수동 PR (prod)
                                                                    │
                                                               승인 → Flux (prod)
```

## 3. 상세 설계

### 3.1 환경별 디렉토리 구조
```
infra/gitops/
  base/               # 공통 매니페스트
  overlays/
    dev/               # 개발 환경 (자동 동기화)
    stg/               # 스테이징 (테스트 통과 후 승격)
    prod/              # 프로덕션 (수동 승인 후 승격)
```

### 3.2~3.8 Flux Kustomization, 승격 스크립트, 감사 로그 등
