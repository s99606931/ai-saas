# Helm Umbrella Chart 사용 가이드

| 항목 | 내용 |
|------|------|
| 문서 ID | INFRA-HU-001 |
| 버전 | 1.0.0 |
| 작성일 | 2026-04-09 |
| MTU 매핑 | MTU-N35 |
| CSAP 매핑 | D-07, D-12 |

<!-- Design Ref: MTU-N35 Design -->
<!-- Plan SC: FR-N35.7 -->

---

## 개요

saas-platform의 전체 마이크로서비스 스택을 단일 Helm Umbrella Chart로 통합 관리합니다.

| 항목 | 수량 |
|------|------|
| 마이크로서비스 | 16개 |
| 인프라 서비스 | 3개 (PostgreSQL, Redis, MinIO) |
| 공통 라이브러리 | 1개 (common) |
| 환경별 values | 3개 (default, dev, stg) |

---

## 디렉토리 구조

```
infra/helm/saas-platform/
  Chart.yaml           -- Umbrella Chart (20개 하위 차트 의존)
  values.yaml          -- 프로덕션 기본값
  values-dev.yaml      -- 개발 환경 (최소 리소스, 일부 비활성)
  values-stg.yaml      -- 스테이징 환경
  charts/
    common/            -- 라이브러리 차트 (named templates)
    api-gateway/       -- API Gateway (NodePort 32277)
    auth-service/      -- 인증 서비스
    user-service/      -- 사용자 관리
    tenant-service/    -- 테넌트 관리
    menu-service/      -- 메뉴 관리
    saas-catalog-service/ -- SaaS 카탈로그
    subscription-service/ -- 구독 관리
    billing-service/   -- 빌링
    crm-service/       -- CRM
    ai-service/        -- AI 서비스
    notification-service/ -- 알림
    file-service/      -- 파일 관리
    audit-service/     -- 감사 로그
    compliance-service/ -- 준수 현황
    security-monitor-service/ -- 보안 모니터링
    portal/            -- 포털 UI
    postgres/          -- PostgreSQL 16
    redis/             -- Redis 7
    minio/             -- MinIO
```

---

## 설치 절차

### 1. 의존성 업데이트

```bash
cd infra/helm/saas-platform

# 하위 차트 의존성 업데이트
for chart in charts/*/; do
  (cd "$chart" && helm dependency update .)
done

# Umbrella Chart 의존성 업데이트
helm dependency update .
```

### 2. Lint 확인

```bash
helm lint .
```

### 3. 설치

```bash
# 프로덕션 (기본 values)
KUBECONFIG=/etc/rancher/k3s/k3s.yaml \
helm upgrade --install saas infra/helm/saas-platform \
  -n saas-helm --create-namespace

# 개발 환경
KUBECONFIG=/etc/rancher/k3s/k3s.yaml \
helm upgrade --install saas-dev infra/helm/saas-platform \
  -n saas-dev --create-namespace \
  -f infra/helm/saas-platform/values-dev.yaml

# 스테이징 환경
KUBECONFIG=/etc/rancher/k3s/k3s.yaml \
helm upgrade --install saas-stg infra/helm/saas-platform \
  -n saas-stg --create-namespace \
  -f infra/helm/saas-platform/values-stg.yaml
```

### 4. 업그레이드

```bash
helm upgrade saas infra/helm/saas-platform -n saas-helm
```

### 5. 롤백

```bash
helm rollback saas 1 -n saas-helm
```

---

## 환경별 설정 차이

| 항목 | dev | stg | prod |
|------|-----|-----|------|
| 서비스 수 | 16 | 19 | 19 |
| 메모리 요청 | 32Mi | 64Mi | 128Mi |
| replicas | 1 | 1 | 2+ |
| 비활성 서비스 | CRM, 빌링, 구독 | 없음 | 없음 |

---

## 개별 서비스 비활성화

특정 서비스만 비활성화하려면:

```bash
helm upgrade saas infra/helm/saas-platform \
  -n saas-helm \
  --set crm-service.enabled=false \
  --set billing-service.enabled=false
```

---

## 공통 라이브러리 차트

`charts/common/` 라이브러리 차트가 제공하는 named templates:

| Template | 용도 |
|----------|------|
| `common.name` | 차트 이름 |
| `common.fullname` | 릴리스 + 차트 전체 이름 |
| `common.labels` | 표준 라벨 (Helm + Kubernetes) |
| `common.selectorLabels` | 셀렉터 라벨 |
| `common.serviceAccountName` | SA 이름 |
| `common.image` | 이미지 참조 |

모든 하위 차트는 이 템플릿을 재사용하여 일관된 리소스 네이밍과 라벨링을 보장합니다.

---

## kustomize와의 병행 운영

현재 saas-platform 네임스페이스의 서비스들은 kustomize로 배포되어 있습니다.
Umbrella Chart는 별도 네임스페이스(saas-helm, saas-dev 등)에 배포하여
기존 환경과 충돌 없이 테스트할 수 있습니다.

향후 마이그레이션 시:
1. Umbrella Chart를 saas-platform NS로 이동
2. kustomize 매니페스트 제거
3. Flux GitOps HelmRelease로 전환

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-09 | 초안 작성 | PM Lead |
