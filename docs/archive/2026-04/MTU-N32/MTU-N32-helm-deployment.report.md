# Report: MTU-N32 Helm 실전 배포 테스트

| 항목 | 내용 |
|------|------|
| MTU ID | MTU-N32 |
| 완료일 | 2026-04-08 |
| matchRate | 100% (5/5 FR) |
| 복잡도 | HIGH |

## Executive Summary

| 관점 | 목표 | 달성 |
|------|------|------|
| 비즈니스 | Helm 기반 배포 역량 확보 | 전 주기 검증 완료 |
| 기술 | Chart 작성 + 배포 | helm lint PASS, install/upgrade/rollback 성공 |
| 보안 | CSAP D-12 준수 | 표준화된 배포 프로세스 구현 |
| 운영 | 기존 배포 무충돌 | helm-test NS 독립 배포 |

## FR별 달성 현황

| FR ID | 요구사항 | 상태 | 증적 |
|-------|---------|------|------|
| FR-N32.1 | Chart 구조 완성 | PASS | helm lint 0 failures |
| FR-N32.2 | helm install 성공 | PASS | REVISION 1 deployed |
| FR-N32.3 | Pod Running + Health | PASS | 1/1 Running + /health 200 OK |
| FR-N32.4 | upgrade/rollback 검증 | PASS | REVISION 1->2->3(rollback)->4 |
| FR-N32.5 | 배포 가이드 문서 | PASS | docs/07-infra/helm-deployment-guide.md |

## 주요 결정 사항

1. **개별 서비스 Chart 방식**: api-gateway 단일 Chart (충돌 방지)
2. **helm-test NS 독립 배포**: 기존 kustomize 배포와 분리
3. **image.pullPolicy=Never**: k3s 로컬 이미지 사용
4. **NodePort 32277**: 기존 32276과 다른 포트 사용

## Helm Release History

| REVISION | 상태 | 설명 |
|----------|------|------|
| 1 | superseded | Install (기본 이미지 -> ErrImagePull) |
| 2 | superseded | Upgrade (로컬 이미지 -> Running) |
| 3 | superseded | Rollback to 1 |
| 4 | deployed | Upgrade (최종 정상) |

## 산출물

- infra/helm/api-gateway/Chart.yaml
- infra/helm/api-gateway/values.yaml
- infra/helm/api-gateway/templates/ (5개 파일)
- docs/07-infra/helm-deployment-guide.md
