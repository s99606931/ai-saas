# Kyverno Policy Reporter 설치 가이드

| 항목 | 내용 |
|------|------|
| 문서 ID | INFRA-PR-001 |
| 버전 | 1.0.0 |
| 작성일 | 2026-04-09 |
| MTU 매핑 | MTU-N34 |
| CSAP 매핑 | D-05-03, D-06-01, D-12-08 |

<!-- Design Ref: MTU-N34 Design -->
<!-- Plan SC: FR-N34.7 -->

---

## 개요

Policy Reporter는 Kyverno의 PolicyReport CRD 결과를 시각화하는 도구입니다.
다음 구성요소를 포함합니다:

| 구성요소 | 역할 | Pod |
|---------|------|-----|
| Policy Reporter Core | PolicyReport 수집, Prometheus 메트릭 노출 | policy-reporter |
| Kyverno Plugin | Kyverno 정책 정보 수집 | policy-reporter-kyverno-plugin |
| Policy Reporter UI | 웹 대시보드 | policy-reporter-ui |

---

## 사전 요구사항

- k3s 클러스터 (v1.31+)
- Helm v3.x
- Kyverno v1.17+ (kyverno NS에 설치됨)
- Kyverno reportsController 활성화
- kube-prometheus-stack (monitoring NS, 선택)

---

## 설치 절차

### 1. Helm 저장소 추가

```bash
helm repo add policy-reporter https://kyverno.github.io/policy-reporter
helm repo update
```

### 2. values.yaml 구성

파일: `infra/kyverno/policy-reporter-values.yaml`

핵심 설정:
- Core: 64Mi 메모리 요청 (WSL2 최소)
- Kyverno Plugin: 활성화
- UI: NodePort 30380
- Monitoring: ServiceMonitor + Grafana 대시보드 자동 프로비저닝

### 3. Helm 설치

```bash
KUBECONFIG=/etc/rancher/k3s/k3s.yaml \
helm upgrade --install policy-reporter policy-reporter/policy-reporter \
  -n policy-reporter --create-namespace \
  -f infra/kyverno/policy-reporter-values.yaml \
  --version 3.7.3
```

### 4. Kyverno reportsController 활성화

PolicyReport가 생성되려면 Kyverno의 reportsController가 필요합니다:

```bash
KUBECONFIG=/etc/rancher/k3s/k3s.yaml \
helm upgrade kyverno kyverno/kyverno -n kyverno \
  --set reportsController.enabled=true \
  --set reportsController.resources.requests.cpu=50m \
  --set reportsController.resources.requests.memory=64Mi \
  --set reportsController.resources.limits.cpu=200m \
  --set reportsController.resources.limits.memory=128Mi \
  --reuse-values
```

### 5. UI NodePort 설정 (필요 시)

v3.x에서 NodePort가 자동 할당되는 경우 수동 패치:

```bash
kubectl patch svc policy-reporter-ui -n policy-reporter \
  --type='json' \
  -p='[{"op": "replace", "path": "/spec/ports/0/nodePort", "value": 30380}]'
```

---

## 검증

### Pod 상태

```bash
kubectl get pods -n policy-reporter
# 예상: 3개 Pod 모두 Running
```

### UI 접근

```
http://localhost:30380
```

### PolicyReport 확인

```bash
kubectl get policyreport -A
kubectl get clusterpolicyreport -A
```

### Prometheus ServiceMonitor

```bash
kubectl get servicemonitor -n policy-reporter
# 예상: policy-reporter-monitoring
```

### Grafana 대시보드

```bash
kubectl get configmap -n monitoring | grep policy-reporter
# 예상: 3개 ConfigMap (overview, policy-details, clusterpolicy-details)
```

---

## 리소스 현황

| Pod | CPU 요청 | 메모리 요청 | CPU 상한 | 메모리 상한 |
|-----|---------|-----------|---------|-----------|
| Core | 50m | 64Mi | 200m | 128Mi |
| Kyverno Plugin | 50m | 64Mi | 200m | 128Mi |
| UI | 50m | 64Mi | 200m | 128Mi |
| **합계** | **150m** | **192Mi** | **600m** | **384Mi** |

---

## Audit 정책 (PolicyReport 생성용)

verify-image-signature 정책은 verifyImages 규칙이므로 background scan에서
PolicyReport를 생성하지 않습니다. PolicyReport를 생성하려면 validate 규칙 정책이
필요합니다.

예시: `infra/kyverno/require-labels.yaml` (app 라벨 필수 검증, Audit 모드)

```bash
kubectl apply -f infra/kyverno/require-labels.yaml
```

---

## 접근 포트 요약

| 서비스 | 포트 | 용도 |
|--------|------|------|
| Policy Reporter UI | 30380 | 정책 결과 대시보드 |
| Grafana | 30302 | 모니터링 대시보드 |
| Prometheus | 30090 | 메트릭 조회 |

---

## 트러블슈팅

### PolicyReport가 생성되지 않음
- Kyverno reportsController 활성화 여부 확인
- validate 규칙 정책이 있는지 확인 (verifyImages는 리포트 미생성)

### Prometheus가 Policy Reporter를 스크래핑하지 않음
- ServiceMonitor 라벨에 `release: kube-prometheus-stack` 있는지 확인
- monitoring NS의 NetworkPolicy에 port 8080 egress 허용되어 있는지 확인
- Prometheus Pod 재시작 후 타겟 확인

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-09 | 초안 작성 | PM Lead |
