# MTU-N194: Persistent Volume Claim 라이프사이클 모니터링 -- Design

> 버전: 1.0.0 | 작성일: 2026-04-10 | 작성자: PM Lead
> Plan 참조: docs/01-plan/mtus/MTU-N194-pvc-lifecycle.plan.md

## Design Anchor

| 항목 | 결정 |
|------|------|
| 아키텍처 | Pragmatic Balance -- kube-state-metrics + PrometheusRule 조합 |
| 메트릭 소스 | kube_persistentvolumeclaim_status_phase (kube-state-metrics 제공) |
| 알림 채널 | Alertmanager 표준 경로 (Slack/Email) |
| 대시보드 | Grafana JSON 프로비저닝 |

## 상세 설계

### 1. Recording Rules (FR-N194.1, FR-N194.4, FR-N194.5)

```yaml
# PVC 상태별 수량 집계
pvc_lifecycle:phase_count -- phase별(Pending/Bound/Lost) PVC 수
pvc_lifecycle:pending_duration_seconds -- Pending 지속 시간 추적
pvc_lifecycle:unattached_bound_count -- Bound이나 Pod 미연결 PVC 수
pvc_lifecycle:provisioning_latency_seconds -- 프로비저닝 소요 시간
```

### 2. Alerting Rules (FR-N194.2, FR-N194.3)

| 알림명 | 조건 | 심각도 | for |
|--------|------|--------|-----|
| PVCPendingTooLong | Pending 상태 5분 초과 | warning | 5m |
| PVCPendingCritical | Pending 상태 15분 초과 | critical | 15m |
| PVCLostDetected | Lost 상태 감지 | critical | 1m |
| PVCUnattachedWarning | Bound이나 Pod 미연결 24시간 초과 | warning | 24h |

### 3. 대시보드 패널 (FR-N194.6)

- PVC 상태별 수량 stat 패널 (Pending / Bound / Lost)
- Pending PVC 목록 table 패널
- 미사용 PVC 목록 table 패널
- PVC 상태 전이 타임라인
- 프로비저닝 소요 시간 히스토그램

### 4. CSAP 매핑

| CSAP | 항목 | 구현 |
|------|------|------|
| D-09 | 데이터 보호 | Lost PVC 즉시 감지 -> 데이터 유실 방지 |
| D-10 | 서비스 가용성 | Pending 장기체류 감지 -> Pod 스케줄링 보호 |
| D-12 | 개발 보안 | E2E 테스트 검증 |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 초안 작성 | PM Lead |
