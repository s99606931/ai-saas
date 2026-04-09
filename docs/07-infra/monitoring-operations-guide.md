# 모니터링 운영 가이드 — Public SaaS

> **버전**: 1.0.0 | **작성일**: 2026-04-08 | **작성자**: PM Lead
> **MTU**: MTU-N25 | **CSAP**: D-06 (침해사고 관리)

---

## 1. 접근 정보

| 서비스 | URL | 계정 |
|--------|-----|------|
| Grafana | http://localhost:30302 | admin / admin |
| Prometheus | http://localhost:30090 | (인증 없음) |
| Alertmanager | http://localhost:30090 → Alerts | (인증 없음) |

---

## 2. 대시보드 목록

### 2.1 커스텀 대시보드 (Public SaaS 전용)

| 대시보드 | Grafana UID | 용도 |
|---------|------------|------|
| 클러스터 개요 | saas-cluster-overview | 노드 상태, CPU/메모리 사용량, Pod 수 |
| 서비스 상태 | saas-service-status | 네임스페이스별 Pod, 재시작 횟수, OOMKilled |
| GitOps 현황 | saas-gitops-status | Flux 컨트롤러, GitRepository, Kustomization |

### 2.2 기본 대시보드 (kube-prometheus-stack)

kube-prometheus-stack 설치 시 28개 기본 대시보드가 포함됩니다:
- Kubernetes / Compute Resources / Cluster
- Kubernetes / Compute Resources / Namespace (Pods)
- Kubernetes / Compute Resources / Node
- Node Exporter / Use Method / Node
- CoreDNS, Kubelet, API Server 등

---

## 3. 알림 규칙

### 3.1 커스텀 알림 (saas-custom-alerts)

| 알림 | 조건 | 심각도 | 대응 |
|------|------|--------|------|
| HighCPUUsage | CPU > 80% (5분) | warning | Pod 리소스 제한 확인, 불필요 워크로드 정리 |
| HighMemoryUsage | Memory > 85% (5분) | warning | OOMKilled 확인, 메모리 누수 점검 |
| PodCrashLooping | 재시작 > 5회/15분 | critical | Pod 로그 확인: `kubectl logs -n <ns> <pod> --previous` |
| PodNotReady | NotReady > 5분 | warning | Describe 확인: `kubectl describe pod -n <ns> <pod>` |
| FluxReconcileFailure | Ready=False > 5분 | critical | Flux 로그: `kubectl logs -n flux-system deploy/<ctrl>` |

### 3.2 알림 확인 명령

```bash
# Prometheus 알림 상태 확인
curl -s http://localhost:30090/api/v1/alerts | python3 -m json.tool

# 활성 알림 목록
curl -s http://localhost:30090/api/v1/alerts | python3 -c "
import sys, json
alerts = json.load(sys.stdin)['data']['alerts']
for a in alerts:
    if a['state'] == 'firing':
        print(f\"[FIRING] {a['labels']['alertname']}: {a['annotations'].get('summary', '')}\")"
```

---

## 4. 대시보드 추가 방법

Grafana sidecar(k8s-sidecar)가 `grafana_dashboard: "1"` 레이블의 ConfigMap을 자동 감지합니다.

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: my-custom-dashboard
  namespace: monitoring
  labels:
    grafana_dashboard: "1"
data:
  my-dashboard.json: |
    { ... Grafana Dashboard JSON ... }
```

```bash
kubectl apply -f my-dashboard-configmap.yaml
# 약 5초 후 Grafana에서 자동 표시
```

---

## 5. 일상 운영 절차

### 5.1 매일 점검

1. Grafana 클러스터 개요 대시보드 확인 (CPU/메모리 추이)
2. 서비스 상태 대시보드에서 재시작 횟수 확인
3. Prometheus Alerts 페이지에서 활성 알림 확인

### 5.2 장애 대응

```bash
# 1. Pod 상태 확인
kubectl get pods -A | grep -v Running

# 2. 이벤트 확인
kubectl get events -A --sort-by='.lastTimestamp' | tail -20

# 3. Pod 로그 확인
kubectl logs -n <namespace> <pod> --tail=100

# 4. 리소스 사용량 확인
kubectl top nodes
kubectl top pods -A --sort-by=memory | head -20
```

### 5.3 Flux GitOps 문제 대응

```bash
# GitRepository 상태 확인
kubectl get gitrepositories -n flux-system
kubectl describe gitrepository fleet-infra -n flux-system

# Kustomization 상태 확인
kubectl get kustomizations -n flux-system
kubectl describe kustomization sample-apps -n flux-system

# 수동 reconcile 트리거
kubectl annotate gitrepository fleet-infra -n flux-system \
  reconcile.fluxcd.io/requestedAt="$(date +%s)" --overwrite
```

---

## 6. CSAP/감리 매핑

| CSAP 항목 | 구현 내용 |
|-----------|---------|
| D-06-01 | 모니터링 체계 구축 (Prometheus + Grafana) |
| D-06-03 | 인프라 이상 탐지 알림 (CPU, Memory, Pod) |
| D-06-04 | 장애 대응 절차 문서화 |
| D-12-08 | GitOps 배포 상태 모니터링 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-08 | 최초 작성 | PM Lead |
