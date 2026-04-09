# Kyverno Enforce 전환 가이드

> Design Ref: MTU-N31 Design -- Kyverno Enforce 전환
> Plan SC: FR-N31.5
> CSAP: D-05-03, D-12-08

## 개요

Kyverno는 Kubernetes 네이티브 정책 엔진으로, ClusterPolicy를 통해 이미지 서명 검증을 자동화합니다. 이 가이드는 Audit 모드에서 Enforce 모드로의 전환 절차를 설명합니다.

## 사전 요구사항

- k3s 클러스터 (v1.34+)
- Helm v3.20+
- Cosign v3.x 설치 + 키 쌍 생성 완료
- Harbor 레지스트리 (localhost:8080)

## 1. Kyverno 설치

```bash
# Helm 저장소 추가
helm repo add kyverno https://kyverno.github.io/kyverno/
helm repo update kyverno

# WSL2 최소 설치 (리소스 절약)
helm install kyverno kyverno/kyverno \
  --namespace kyverno \
  --create-namespace \
  --values infra/kyverno/values.yaml \
  --kubeconfig /etc/rancher/k3s/k3s.yaml \
  --wait --timeout 180s

# 설치 확인
kubectl get pods -n kyverno
```

### values.yaml 주요 설정

| 설정 | 값 | 이유 |
|------|-----|------|
| admissionController.replicas | 1 | WSL2 리소스 절약 |
| reportsController.enabled | false | WSL2 리소스 절약 |
| cleanupController.enabled | false | WSL2 리소스 절약 |

## 2. Audit 모드 정책 적용

```bash
# Audit 모드로 먼저 적용 (차단 없이 경고만)
kubectl apply -f infra/kyverno/verify-image-signature.yaml
# validationFailureAction: Audit 확인
kubectl get cpol verify-image-signature -o jsonpath='{.spec.validationFailureAction}'
```

## 3. Enforce 모드 전환

```yaml
# infra/kyverno/verify-image-signature.yaml
spec:
  validationFailureAction: Enforce  # Audit -> Enforce 변경
```

```bash
kubectl apply -f infra/kyverno/verify-image-signature.yaml
```

## 4. 검증

### 미서명 이미지 배포 차단 확인

```bash
# 미서명 Harbor 이미지 배포 시도 -> 거부되어야 함
kubectl run test-unsigned \
  --image=localhost:8080/public-saas/unsigned-test:latest \
  -n saas-platform \
  --restart=Never \
  --dry-run=server
# 예상 결과: admission webhook denied the request
```

### 기존 서비스 안정성 확인

```bash
# 기존 서비스 영향 없음 확인
kubectl get pods -A --field-selector=status.phase=Running | wc -l
# Kyverno 특성: 기존 위반 리소스의 업데이트는 허용
```

## 5. 트러블슈팅

### Kyverno webhook 장애 시

values.yaml에서 `failurePolicy: Ignore` 권장 (프로덕션):
- webhook 장애 시 Pod 생성이 차단되지 않음
- 보안과 가용성의 균형점

### 정책 비활성화 (긴급 시)

```bash
# Audit 모드로 즉시 전환
kubectl patch cpol verify-image-signature \
  --type='json' \
  -p='[{"op": "replace", "path": "/spec/validationFailureAction", "value": "Audit"}]'
```

## 6. 운영 권장사항

- **주기적 PolicyReport 확인**: 위반 사항 모니터링
- **새 서비스 배포 전**: Cosign 서명 필수 확인
- **Kyverno 업그레이드**: Helm upgrade로 관리
- **HA 구성**: 프로덕션에서는 replicas=3 권장

## CSAP 매핑

| CSAP 항목 | 설명 | 준수 방법 |
|-----------|------|----------|
| D-05-03 | 접근통제 정책 관리 | Kyverno Enforce 모드 |
| D-12-08 | 소프트웨어 개발 보안 | Cosign 서명 검증 자동화 |
| D-09-01 | 암호화 통제 | ECDSA 키 기반 서명 |
