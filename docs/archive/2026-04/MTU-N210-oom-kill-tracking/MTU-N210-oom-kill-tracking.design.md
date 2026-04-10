# MTU-N210: OOM Kill 이벤트 추적 -- Design

> 버전: 1.0.0 | 작성일: 2026-04-10 | 작성자: PM Lead

## Design Anchor

| 항목 | 결정 |
|------|------|
| 아키텍처 | Pragmatic Balance -- kube-state-metrics + cAdvisor 조합 |
| 메트릭 소스 | kube_pod_container_status_last_terminated_reason, container_memory_working_set_bytes, kube_pod_container_resource_limits |

## 상세 설계

### Recording Rules
```yaml
oom:kill_count_by_namespace     # 네임스페이스별 OOM Kill 횟수
oom:kill_count_by_workload      # 워크로드별 OOM Kill 횟수
oom:recurring_kills             # 반복 OOM Kill (1시간 내 2회+)
oom:memory_near_limit_ratio     # limit 대비 사용률 (사전 경고)
oom:containers_near_limit       # limit 90%+ 컨테이너 수
```

### Alerting Rules
| 알림명 | 조건 | 심각도 |
|--------|------|--------|
| OOMKillDetected | OOM Kill 발생 | warning |
| OOMKillRecurring | 같은 워크로드 1시간 내 2회+ | critical |
| MemoryNearLimit | limit 대비 사용률 > 95% | warning |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 초안 작성 | PM Lead |
