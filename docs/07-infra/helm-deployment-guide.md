# Helm 실전 배포 가이드

> Design Ref: MTU-N32 Design -- Helm 실전 배포 테스트
> Plan SC: FR-N32.5
> CSAP: D-12 (시스템 개발보안)

## 개요

Helm은 Kubernetes 패키지 매니저로, 서비스 배포/업그레이드/롤백을 표준화합니다. 이 가이드는 공공기관 SaaS 프레임워크의 Helm Chart 구조와 배포 절차를 설명합니다.

## Chart 구조

```
infra/helm/api-gateway/
  Chart.yaml          # 차트 메타데이터
  values.yaml         # 기본 설정값
  templates/
    _helpers.tpl      # 템플릿 헬퍼 함수
    deployment.yaml   # Deployment 매니페스트
    service.yaml      # Service 매니페스트
    serviceaccount.yaml # ServiceAccount
    NOTES.txt         # 설치 후 안내 메시지
```

## 배포 절차

### 1. Chart 검증

```bash
helm lint infra/helm/api-gateway
# 결과: 1 chart(s) linted, 0 chart(s) failed
```

### 2. 설치

```bash
# 네임스페이스 생성
kubectl create namespace helm-test

# 설치 (로컬 이미지 사용)
helm install api-gw-test ./infra/helm/api-gateway \
  -n helm-test \
  --kubeconfig /etc/rancher/k3s/k3s.yaml \
  --set image.repository=saas/api-gateway \
  --set image.tag=dev \
  --set image.pullPolicy=Never \
  --timeout 90s
```

### 3. 검증

```bash
# Pod 상태 확인
kubectl get pods -n helm-test

# Health Check
curl http://localhost:32277/health
# 예상: {"status":"ok","service":"api-gateway","registeredServices":14}
```

### 4. 업그레이드

```bash
# 설정 변경 후 업그레이드
helm upgrade api-gw-test ./infra/helm/api-gateway \
  -n helm-test \
  --kubeconfig /etc/rancher/k3s/k3s.yaml \
  --set image.repository=saas/api-gateway \
  --set image.tag=dev \
  --set image.pullPolicy=Never \
  --set replicaCount=2

# 히스토리 확인
helm history api-gw-test -n helm-test --kubeconfig /etc/rancher/k3s/k3s.yaml
```

### 5. 롤백

```bash
# 이전 버전으로 롤백
helm rollback api-gw-test 1 -n helm-test --kubeconfig /etc/rancher/k3s/k3s.yaml

# 롤백 확인
helm history api-gw-test -n helm-test --kubeconfig /etc/rancher/k3s/k3s.yaml
```

### 6. 삭제

```bash
helm uninstall api-gw-test -n helm-test --kubeconfig /etc/rancher/k3s/k3s.yaml
```

## values.yaml 주요 설정

| 설정 | 기본값 | 설명 |
|------|--------|------|
| replicaCount | 1 | Pod 복제 수 |
| image.repository | api-gateway | 이미지 저장소 |
| image.tag | latest | 이미지 태그 |
| service.type | NodePort | 서비스 유형 |
| service.nodePort | 32277 | NodePort 번호 |
| resources.requests.cpu | 50m | CPU 요청량 |
| resources.limits.memory | 128Mi | 메모리 제한 |

## 환경별 values 오버라이드

```bash
# 개발 환경
helm install app ./chart -f values-dev.yaml

# 스테이징 환경
helm install app ./chart -f values-stg.yaml

# 프로덕션 환경
helm install app ./chart -f values-prod.yaml
```

## 기존 kustomize 배포와의 관계

- Helm Chart는 별도 네임스페이스(helm-test)에서 독립 배포
- 기존 saas-platform 네임스페이스의 kustomize 배포와 충돌 없음
- 향후 전체 서비스 Helm 전환 시 점진적 마이그레이션 권장

## CSAP 매핑

| CSAP 항목 | 설명 | 준수 방법 |
|-----------|------|----------|
| D-12 | 시스템 개발보안 | Helm 기반 표준화 배포 |
| D-07 | 가용성 관리 | Rollback 기능으로 빠른 복구 |
