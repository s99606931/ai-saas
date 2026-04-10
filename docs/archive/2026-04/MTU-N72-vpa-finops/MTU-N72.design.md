# MTU-N72: VPA Right-Sizing + OpenCost FinOps — Design

> **버전**: 1.0.0 | **작성일**: 2026-04-10 | **작성자**: PM Lead (Opus)

---

## 1. VPA 아키텍처

### 1.1 VPA 컴포넌트

| 컴포넌트 | 역할 | 배포 모드 |
|---------|------|----------|
| VPA Recommender | 리소스 사용 분석 → 권고 생성 | Off (권고만) |
| VPA Updater | Pod 재시작으로 리소스 자동 조정 | 비활성화 (안전) |
| VPA Admission Controller | 새 Pod에 권고 리소스 주입 | 비활성화 (안전) |

### 1.2 VPA 오브젝트 설계

```yaml
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: {service-name}-vpa
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: {service-name}
  updatePolicy:
    updateMode: "Off"  # 권고만 생성, 자동 적용 안함
  resourcePolicy:
    containerPolicies:
      - containerName: "*"
        minAllowed:
          cpu: 10m
          memory: 32Mi
        maxAllowed:
          cpu: "2"
          memory: 4Gi
```

---

## 2. OpenCost 설계

### 2.1 OpenCost 배포

- Helm Chart 기반 배포
- Prometheus 메트릭 수집 연동
- 네임스페이스/라벨 기반 비용 할당
- 자체 UI 포트 (9090) + Grafana 대시보드

### 2.2 비용 할당 기준

| 할당 대상 | 라벨 | 비용 항목 |
|----------|------|----------|
| 테넌트 | `tenant-id` | CPU, Memory, Storage |
| 서비스 | `app.kubernetes.io/name` | CPU, Memory |
| 네임스페이스 | namespace | 전체 리소스 합계 |

---

## 3. Right-Sizing 알림 규칙

```yaml
# VPA 권고 대비 30% 이상 과다 할당 시 알림
- alert: VPAOverProvisionedResource
  expr: |
    (kube_pod_container_resource_requests{resource="cpu"}
    - on(namespace,pod,container) vpa_recommender_recommendation_target{resource="cpu"})
    / kube_pod_container_resource_requests{resource="cpu"} > 0.3
  for: 1h
  labels:
    severity: warning
    csap_control: D-12-07
  annotations:
    summary: "{{ $labels.pod }} CPU 30% 이상 과다 할당"
```

---

## 4. Grafana 대시보드 설계

### 4.1 VPA Right-Sizing 대시보드 패널

| 패널 | 쿼리 | 목적 |
|------|------|------|
| VPA 권고 vs 실제 사용량 | vpa_recommender_recommendation | 과다/과소 할당 시각화 |
| 네임스페이스별 비용 | opencost_total_cost | 비용 분배 현황 |
| Right-Sizing 절감 예상 | 현재 request - VPA 권고 | 절감 가능 금액 |
| 서비스별 효율성 점수 | 사용량/request 비율 | 효율성 랭킹 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 최초 작성 | PM Lead |
