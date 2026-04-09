# Design: MTU-N25 모니터링 대시보드 실전 구성

> **버전**: 1.0.0 | **작성일**: 2026-04-08 | **작성자**: PM Lead

---

## 아키텍처: Grafana Sidecar ConfigMap 패턴

kube-prometheus-stack의 Grafana sidecar가 `grafana_dashboard: "1"` 레이블이 있는
ConfigMap을 자동 감지하여 대시보드를 로딩합니다.

```
ConfigMap (label: grafana_dashboard=1)
  └── data: {dashboard-name}.json
        ↓ (sidecar 감지)
  └── Grafana /var/lib/grafana/dashboards/
```

---

## 대시보드 3종 설계

### 1. 클러스터 개요 (cluster-overview)
- 노드 상태 (CPU, Memory, Disk)
- Pod 수/상태 (Running, Pending, Failed)
- 네임스페이스별 리소스 사용량
- 패널: stat, gauge, timeseries

### 2. 서비스 상태 (service-status)
- 네임스페이스별 Pod 목록
- 컨테이너 재시작 횟수
- OOMKilled 이벤트
- 패널: table, stat, timeseries

### 3. Flux GitOps (gitops-status)
- Flux 컨트롤러 상태
- GitRepository reconcile 상태
- Kustomization 적용 상태
- 패널: stat, table

---

## 알림 규칙 5종

1. HighCPUUsage: 노드 CPU > 80% (5분 지속)
2. HighMemoryUsage: 노드 Memory > 85% (5분 지속)
3. PodCrashLooping: Pod 재시작 > 5회 (15분 내)
4. PodNotReady: Pod NotReady 상태 > 5분
5. FluxReconcileFailure: Flux reconcile 실패

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-08 | 최초 작성 | PM Lead |
