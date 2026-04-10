# 리포트: MTU-N172 GitOps 환경 승격 게이트

> 작성일: 2026-04-10 | matchRate: 95%

## Executive Summary

| 관점 | 계획 | 달성 |
|------|------|------|
| 비즈니스 | 환경별 안전 배포 | 3단계 승격 (dev→stg→prod) |
| 기술 | Flux + Kustomize | 오버레이 3환경 + Flux Kustomization |
| 보안 | 프로덕션 CSAP 게이트 | 스모크/부하 테스트 + CSAP 검증 |
| 운영 | dev 자동, prod 수동 | 승격 스크립트 + 감사 로그 |

## 산출물

| 파일 | 용도 |
|------|------|
| infra/gitops/base/kustomization.yaml | 공통 매니페스트 |
| infra/gitops/overlays/dev/ | 개발 환경 오버레이 |
| infra/gitops/overlays/stg/ | 스테이징 오버레이 |
| infra/gitops/overlays/prod/ | 프로덕션 오버레이 |
| infra/gitops/flux-promotion-kustomizations.yaml | Flux 환경별 동기화 |
| scripts/promotion/promote-to-stg.sh | dev→stg 승격 |
| scripts/promotion/promote-to-prod.sh | stg→prod 승격 |
| tests/e2e/gitops-promotion.test.ts | E2E 테스트 11건 |

## matchRate: 95%
