# MTU-N201: etcd 성능 상세 모니터링 -- Design

> 버전: 1.0.0 | 작성일: 2026-04-10 | 작성자: PM Lead
> Plan 참조: docs/01-plan/mtus/MTU-N201-etcd-performance.plan.md

## Design Anchor

| 항목 | 결정 |
|------|------|
| 아키텍처 | Pragmatic Balance -- etcd 내장 메트릭 활용 |
| 메트릭 소스 | etcd_disk_*, etcd_mvcc_db_total_size_in_bytes, etcd_debugging_snap_save_total_duration_seconds |

## 상세 설계

### 1. Recording Rules

```yaml
etcd_perf:wal_fsync_p99 -- WAL fsync p99 레이턴시
etcd_perf:backend_commit_p99 -- Backend commit p99 레이턴시
etcd_perf:db_size_bytes -- DB 크기
etcd_perf:db_size_growth_rate_1h -- DB 크기 증가율
etcd_perf:compaction_duration_p99 -- Compaction p99 소요 시간
etcd_perf:snapshot_duration_p99 -- 스냅샷 p99 소요 시간
```

### 2. Alerting Rules

| 알림명 | 조건 | 심각도 | for |
|--------|------|--------|-----|
| EtcdWALFsyncSlow | WAL fsync p99 > 100ms | warning | 5m |
| EtcdBackendCommitSlow | Backend commit p99 > 250ms | critical | 5m |
| EtcdDBSizeLarge | DB 크기 > 6GB | warning | 15m |
| EtcdDBSizeGrowing | 1시간 증가율 > 100MB | warning | 30m |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 초안 작성 | PM Lead |
