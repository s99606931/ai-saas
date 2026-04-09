# 카나리 배포 전략 운영 가이드 (Flagger)

> **버전**: 1.0.0 | **작성일**: 2026-04-09
> **Design Ref**: MTU-N40 Design
> **CSAP 참조**: D-12(배포 안전성), D-06(이상 감지 알림)

---

## 1. 개요

Flagger는 Kubernetes에서 점진적 배포(Progressive Delivery)를 자동화하는 도구입니다.
Prometheus 메트릭을 기반으로 카나리 분석을 수행하고, 기준 미달 시 자동 롤백합니다.

### 1.1 배포 흐름

```
이미지 태그 변경
  ↓
Flagger 감지 → Canary Pod 생성
  ↓
10% 트래픽 전환 → 메트릭 분석 (30초)
  ↓ (성공)
30% → 분석 → 60% → 분석 → 100%
  ↓ (성공)
Primary 교체, Canary 제거
  ↓ (실패)
즉시 롤백 + Alert 발생
```

### 1.2 메트릭 기준

| 메트릭 | 임계값 | 실패 조건 |
|--------|--------|---------|
| 요청 성공률 | >= 99% | 성공률 99% 미만 |
| p99 지연시간 | <= 500ms | 500ms 초과 |

---

## 2. 설치

```bash
# Helm 저장소 추가
helm repo add flagger https://flagger.app
helm repo update

# Flagger 설치
helm install flagger flagger/flagger \
  --namespace flagger-system \
  --create-namespace \
  -f infra/flagger/values.yaml

# MetricTemplate 적용
kubectl apply -f infra/flagger/metric-templates.yaml

# Alert Provider 적용
kubectl apply -f infra/flagger/alert-provider.yaml

# Canary 리소스 적용
kubectl apply -f infra/flagger/canary-api-gateway.yaml
```

---

## 3. 카나리 배포 실행

### 3.1 배포 트리거

```bash
# 이미지 태그 업데이트 → Flagger가 자동 감지
kubectl set image deployment/api-gateway \
  api-gateway=localhost:8080/public-saas/api-gateway:v1.1.0 \
  -n saas-platform
```

### 3.2 배포 상태 확인

```bash
# Canary 상태 확인
kubectl get canary -n saas-platform

# 상세 상태
kubectl describe canary api-gateway -n saas-platform

# 이벤트 확인
kubectl get events -n saas-platform --field-selector reason=Synced
```

### 3.3 수동 롤백

```bash
# 긴급 수동 롤백
kubectl annotate canary api-gateway \
  "flagger.app/abort=true" \
  -n saas-platform
```

---

## 4. 다른 서비스 확장

다른 서비스에 카나리 배포를 적용하려면 `canary-api-gateway.yaml`을 복사하여 수정:

```yaml
# canary-auth-service.yaml
spec:
  targetRef:
    name: auth-service    # 대상 Deployment 이름
  service:
    port: 3001            # 서비스 포트
```

---

## 5. Prometheus 메트릭

Flagger가 사용하는 Traefik 메트릭:
- `traefik_service_requests_total`: 총 요청 수 (코드별)
- `traefik_service_request_duration_seconds_bucket`: 요청 지연시간 히스토그램

Grafana 대시보드에서 카나리 배포 진행 상황을 모니터링할 수 있습니다.

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-09 | 최초 작성 | PM Lead |
