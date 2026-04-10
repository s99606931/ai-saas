# MTU-N208: 노드 디스크 I/O 포화도 모니터링 -- Design

> 버전: 1.0.0 | 작성일: 2026-04-10 | 작성자: PM Lead

## Design Anchor

| 항목 | 결정 |
|------|------|
| 아키텍처 | Pragmatic Balance -- node-exporter 메트릭 활용 |
| 메트릭 소스 | node_disk_io_time_weighted_seconds_total, node_disk_read/write_bytes_total, node_disk_reads/writes_completed_total |

## 상세 설계

### Recording Rules
```yaml
disk_io:utilization_percent         # 디스크 사용률 (%)
disk_io:io_weighted_time            # I/O 가중 시간
disk_io:read_throughput_bytes       # 읽기 처리량 (B/s)
disk_io:write_throughput_bytes      # 쓰기 처리량 (B/s)
disk_io:read_iops                   # 읽기 IOPS
disk_io:write_iops                  # 쓰기 IOPS
disk_io:avg_read_latency            # 평균 읽기 레이턴시
disk_io:avg_write_latency           # 평균 쓰기 레이턴시
```

### Alerting Rules
| 알림명 | 조건 | 심각도 |
|--------|------|--------|
| DiskIOSaturationHigh | 포화도 > 80% (5분) | warning |
| DiskIOSaturationCritical | 포화도 > 95% (5분) | critical |
| DiskWriteLatencyHigh | 쓰기 레이턴시 > 100ms | warning |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 초안 작성 | PM Lead |
