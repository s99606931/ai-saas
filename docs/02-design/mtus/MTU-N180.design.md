# MTU-N180: 컨테이너 런타임 모니터링 Design

> **문서 ID**: DESIGN-N180 | **버전**: 1.0 | **작성일**: 2026-04-10
> **작성자**: PM Lead | **상태**: 승인

---

## Executive Summary

| 관점 | 설계 결정 |
|------|----------|
| 아키텍처 | cadvisor + kube-state-metrics 기반 컨테이너 런타임 메트릭 수집 |
| 데이터 흐름 | cadvisor/kubelet → Prometheus → recording rules → Grafana + Alertmanager |
| 보안 | OOM Kill/CrashLoop 감사 로깅, CSAP D-12 런타임 보안 모니터링 |
| 운영 | 이미지 풀 지연, 컨테이너 재시작, 런타임 상태 종합 대시보드 |

## Design Anchor

```
Plan 참조: PLAN-N180
FR 범위: FR-N180.1 ~ FR-N180.6
CSAP 매핑: D-12 (시스템 개발 보안), D-06 (침해사고 관리)
```

## 아키텍처 옵션 분석

| 옵션 | 장점 | 단점 | 선택 |
|------|------|------|------|
| A: containerd 직접 메트릭 API | 세밀한 런타임 데이터 | 추가 exporter 필요 | - |
| B: cadvisor + kube-state-metrics | 기존 스택 활용, 안정적 | containerd 내부 상세 제한 | **선택** |
| C: CRI 커스텀 exporter | 최대 유연성 | 개발/유지보수 부담 | - |

**선택 근거**: 옵션 B - k3s 내장 cadvisor + kube-state-metrics로 충분한 런타임 가시성 확보

## 상세 설계

### DS-N180.1: containerd 런타임 상태

```yaml
# 컨테이너 상태별 수량
- record: cluster:container:state_count
  expr: count by (container_state) (kube_pod_container_status_waiting_reason)

# 런타임 작업 큐 크기
- record: node:containerd:operations_total
  expr: rate(container_runtime_operations_total[5m])
```

### DS-N180.2: 이미지 풀 지연 모니터링

```yaml
- record: cluster:image:pull_duration_p99
  expr: histogram_quantile(0.99, rate(kubelet_image_pull_duration_seconds_bucket[15m]))

- alert: ImagePullSlowP99
  expr: cluster:image:pull_duration_p99 > 30
  for: 5m
```

### DS-N180.3: OOM Kill 모니터링

```yaml
- record: cluster:container:oom_kills_total
  expr: increase(kube_pod_container_status_last_terminated_reason{reason="OOMKilled"}[1h])

- alert: ContainerOOMKilled
  expr: increase(kube_pod_container_status_last_terminated_reason{reason="OOMKilled"}[5m]) > 0
```

### DS-N180.4: CrashLoopBackOff 탐지

```yaml
- alert: ContainerCrashLoopBackOff
  expr: |
    increase(kube_pod_container_status_restarts_total[1h]) > 5
    and kube_pod_container_status_waiting_reason{reason="CrashLoopBackOff"} > 0
```

### DS-N180.5: 대시보드 레이아웃

```
Row 1: 종합 현황 (stat panels)
  - 실행 중 컨테이너 | OOM Kill 수 | CrashLoop 수 | 이미지 풀 P99
Row 2: 시계열 차트
  - 컨테이너 재시작 추이 | 이미지 풀 지연 추이
Row 3: 상세 분석
  - OOM Kill 이력 | CrashLoop 파드 목록 | 런타임 작업 큐
Row 4: 이미지 레지스트리
  - 이미지 풀 크기 | 레지스트리별 지연
```

### DS-N180.6: 이미지 레지스트리 접근성

```yaml
- record: cluster:image:pull_errors_total
  expr: increase(kubelet_image_pull_errors_total[5m])

- alert: ImagePullErrors
  expr: increase(kubelet_image_pull_errors_total[15m]) > 3
```

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-10 | 초안 작성 | PM Lead |
