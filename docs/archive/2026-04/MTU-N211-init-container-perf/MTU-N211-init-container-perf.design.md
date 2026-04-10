# MTU-N211: Init 컨테이너 성능 모니터링 -- Design

> 버전: 1.0.0 | 작성일: 2026-04-10 | 작성자: PM Lead

## Design Anchor

| 항목 | 결정 |
|------|------|
| 아키텍처 | Pragmatic Balance -- kube-state-metrics 활용 |
| 메트릭 소스 | kube_pod_init_container_status_ready, kube_pod_init_container_status_restarts_total |

### Recording Rules
```yaml
init_ctr:waiting_count, init_ctr:restart_rate, init_ctr:not_ready_count
```

### Alerting Rules
| 알림명 | 조건 | 심각도 |
|--------|------|--------|
| InitContainerFailing | 재시작 > 3회/시간 | warning |
| InitContainerStuck | 대기 > 10분 | critical |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 초안 | PM Lead |
