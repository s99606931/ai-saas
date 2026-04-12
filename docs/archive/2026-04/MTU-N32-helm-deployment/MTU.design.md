# Design: MTU-N32 Helm 실전 배포 테스트

| 항목 | 내용 |
|------|------|
| MTU ID | MTU-N32 |
| 작성일 | 2026-04-08 |
| 복잡도 | HIGH |
| 버전 | 1.0 |

## Design Anchor

- **Plan 참조**: docs/01-plan/mtus/MTU-N32-helm-deployment.plan.md
- **PRD 참조**: docs/00-pm/MTU-N32-helm-deployment.prd.md
- **기존 배포**: saas-platform NS의 api-gateway 서비스 참조

## 아키텍처 옵션 분석

### Option A: 전체 서비스 통합 Chart

- 단일 Helm Chart에 14개 서비스 포함
- 장점: 원-커맨드 배포
- 단점: 복잡도 과대, 테스트 범위 초과

### Option B: 개별 서비스 Chart (선택)

- api-gateway 단일 서비스 Chart 작성
- 별도 helm-test NS에서 독립 배포
- 장점: 충돌 없음, 검증 용이, 확장 가능한 패턴
- 단점: 단일 서비스만 검증

### Option C: Umbrella Chart

- 부모 Chart + 자식 Chart 구조
- 장점: 의존성 관리
- 단점: 과도한 복잡도

## 선택: Option B (개별 서비스 Chart)

기존 kustomize 배포와 충돌 없이 독립 NS에서 Helm 배포 전 주기를 검증.

## 상세 설계

### Chart 구조

```
infra/helm/api-gateway/
  Chart.yaml
  values.yaml
  templates/
    _helpers.tpl
    deployment.yaml
    service.yaml
    configmap.yaml
    serviceaccount.yaml
    NOTES.txt
```

### Chart.yaml

```yaml
apiVersion: v2
name: api-gateway
description: 공공기관 SaaS API Gateway Helm Chart
type: application
version: 0.1.0
appVersion: "1.0.0"
```

### values.yaml 설계

```yaml
replicaCount: 1
image:
  repository: api-gateway
  pullPolicy: IfNotPresent
  tag: "latest"
service:
  type: NodePort
  port: 3000
  nodePort: 32277  # 기존 32276과 다른 포트
resources:
  requests:
    cpu: 50m
    memory: 64Mi
  limits:
    cpu: 200m
    memory: 128Mi
healthCheck:
  path: /health
  port: 3000
env:
  NODE_ENV: production
  PORT: "3000"
```

### Deployment Template 핵심

- readinessProbe + livenessProbe (/health)
- configMapRef 환경 변수
- securityContext (readOnlyRootFilesystem, runAsNonRoot)

### 배포 네임스페이스

`helm-test` NS에 배포하여 기존 saas-platform과 완전 분리.

## Session Guide

1. infra/helm/api-gateway/ 디렉토리 + Chart 파일 생성
2. templates/ 작성 (deployment, service, configmap, serviceaccount)
3. helm lint 검증
4. kubectl create ns helm-test
5. helm install api-gw-test ./infra/helm/api-gateway -n helm-test
6. Pod Running + curl health 확인
7. values 변경 + helm upgrade + helm rollback
8. 가이드 문서 작성
