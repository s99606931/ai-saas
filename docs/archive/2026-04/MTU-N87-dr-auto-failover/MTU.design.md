# MTU-N87: 재해복구 자동 페일오버 — Design

> **MTU ID**: MTU-N87
> **Plan 참조**: docs/01-plan/mtus/MTU-N87-dr-auto-failover.plan.md
> **작성일**: 2026-04-10

---

## Design Anchor

| 항목 | 결정 |
|------|------|
| DR 모드 | Active-Passive (비용 최적화) |
| RTO 목표 | < 15분 |
| RPO 목표 | < 5분 |
| 백업 도구 | Velero + MinIO (S3 호환) |
| DB 동기화 | CloudNativePG Streaming Replication |

## 아키텍처

```
┌─ Active Cluster (Primary) ─────────┐
│  k3s + 전체 서비스 스택              │
│  ├── Velero: 5분 주기 백업           │
│  ├── CloudNativePG: Primary DB      │
│  └── 헬스체크: /health 30초 주기     │
└──────────┬──────────────────────────┘
           │ Velero Backup → MinIO
           │ PG Streaming Replication
           ▼
┌─ Passive Cluster (Standby) ────────┐
│  k3s + 최소 서비스 (대기 모드)       │
│  ├── Velero: 백업 복원 대기          │
│  ├── CloudNativePG: Standby DB      │
│  └── 페일오버 컨트롤러: 감시 중      │
└─────────────────────────────────────┘

페일오버 트리거:
  Active 헬스체크 3회 연속 실패 (90초)
  → Passive 클러스터 활성화
  → DNS/로드밸런서 전환
  → 서비스 복구 확인
  → 알림 전송
```

## 페일오버 절차 (자동)

| 단계 | 시간 | 작업 |
|------|------|------|
| 1 | 0-90초 | Active 헬스체크 실패 감지 (3회 연속) |
| 2 | 90-120초 | 페일오버 결정 + 확인 |
| 3 | 120-300초 | Velero 최신 백업 복원 |
| 4 | 300-600초 | DB 프로모션 (Standby → Primary) |
| 5 | 600-900초 | 서비스 시작 + 헬스체크 통과 |
| 6 | 900초 | DNS 전환 + 트래픽 유입 |
