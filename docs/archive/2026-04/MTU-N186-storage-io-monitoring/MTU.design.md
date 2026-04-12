# MTU-N186: 스토리지 I/O 모니터링 — Design

> 버전: 1.0.0 | 작성일: 2026-04-10 | 작성자: PM Lead
> Plan 참조: docs/01-plan/mtus/MTU-N186-storage-io-monitoring.plan.md

## Design Anchor

| 항목 | 결정 |
|------|------|
| 아키텍처 옵션 | Pragmatic Balance — node_exporter + cadvisor 메트릭 활용 |
| 데이터 소스 | node_exporter (노드 디스크), cadvisor (컨테이너 I/O), kubelet (PVC) |
| 알림 채널 | Alertmanager 기존 채널 |
| 대시보드 | Grafana JSON Provisioning |

## DS-N186.1: 노드 디스크 IOPS Recording Rules

```promql
# 읽기 IOPS
rate(node_disk_reads_completed_total{device!~"dm-.*|loop.*"}[5m])
# 쓰기 IOPS
rate(node_disk_writes_completed_total{device!~"dm-.*|loop.*"}[5m])
```

## DS-N186.2: 노드 디스크 레이턴시 Recording Rules

```promql
# 읽기 레이턴시 (ms)
rate(node_disk_read_time_seconds_total[5m])
  / rate(node_disk_reads_completed_total[5m]) * 1000
# 쓰기 레이턴시 (ms)
rate(node_disk_write_time_seconds_total[5m])
  / rate(node_disk_writes_completed_total[5m]) * 1000
```

## DS-N186.3: 노드 디스크 처리량 Recording Rules

```promql
# 읽기 처리량 (bytes/s)
rate(node_disk_read_bytes_total{device!~"dm-.*|loop.*"}[5m])
# 쓰기 처리량 (bytes/s)
rate(node_disk_written_bytes_total{device!~"dm-.*|loop.*"}[5m])
```

## DS-N186.4: 디스크 I/O 포화도

```promql
# I/O 대기 시간 비율 (%)
rate(node_disk_io_time_weighted_seconds_total[5m])
```

## DS-N186.5: 컨테이너/PVC I/O

```promql
# 컨테이너 읽기/쓰기 바이트
rate(container_fs_reads_bytes_total[5m])
rate(container_fs_writes_bytes_total[5m])
```

## DS-N186.6: 알림 규칙

| 알림 | 조건 | 심각도 | 대기 |
|------|------|--------|------|
| DiskIOLatencyHigh | 읽기/쓰기 레이턴시 > 100ms | warning | 10m |
| DiskIOLatencyCritical | 읽기/쓰기 레이턴시 > 500ms | critical | 5m |
| DiskIOSaturationHigh | I/O 포화도 > 80% | warning | 10m |
| DiskIOPSHigh | IOPS > 5000 (노드 기준) | warning | 15m |
| DiskThroughputAnomaly | 처리량 급감 (1h 평균 대비 50% 미만) | warning | 10m |

## DS-N186.7: 대시보드 패널 구성

| 행 | 패널 | 타입 | 메트릭 |
|----|------|------|--------|
| 0 | I/O 상태 개요 (정상/경고/위험) | stat | 종합 |
| 1 | 노드 디스크 IOPS (읽기/쓰기) | timeseries | disk:iops:* |
| 2 | 노드 디스크 레이턴시 (읽기/쓰기) | timeseries | disk:latency:* |
| 3 | 노드 디스크 처리량 (읽기/쓰기) | timeseries | disk:throughput:* |
| 4 | I/O 포화도 | timeseries | disk:io_saturation |
| 5 | 컨테이너 I/O (Top 10) | timeseries | container_fs_* |
| 6 | PVC I/O 비교 | bargauge | pvc I/O |

## DS-N186.8: E2E 테스트

| TC ID | 테스트 내용 |
|-------|-----------|
| TC-N186.1 | YAML 문법 유효성 |
| TC-N186.2 | Recording rule 최소 8개 존재 |
| TC-N186.3 | Alert rule 최소 4개 존재 |
| TC-N186.4 | Dashboard JSON 유효성 + 패널 최소 7개 |
| TC-N186.5 | CSAP 라벨 매핑 |
| TC-N186.6 | Design Ref 주석 |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 초안 작성 | PM Lead |
