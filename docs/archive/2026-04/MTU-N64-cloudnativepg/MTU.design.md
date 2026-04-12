# MTU-N64: CloudNativePG PostgreSQL Operator 설계

> **버전**: 1.0.0 | **작성일**: 2026-04-10 | **작성자**: bkend-expert

---

## 1. 아키텍처

```
CloudNativePG Operator (cnpg-system 네임스페이스)
  └── Cluster: saas-main-db (saas 네임스페이스)
       ├── Primary (1) — 읽기/쓰기
       ├── Replica (2) — 읽기 전용
       ├── WAL Archive → MinIO (velero-system)
       └── Scheduled Backup → daily 03:00 KST
```

## 2. Cluster 스펙

- PostgreSQL 16
- instances: 3 (1 primary + 2 replicas)
- 스토리지: 10Gi PVC (WSL2 hostpath)
- 리소스: requests 100m/256Mi, limits 500m/512Mi
- affinity: podAntiAffinity preferredDuringScheduling
- TLS: cert-manager Certificate 자동 발급

## 3. 백업 전략

- WAL 아카이빙: MinIO S3 호환 (Velero와 동일 MinIO)
- 스케줄 백업: daily 03:00 KST, retention 14일
- 복구: PITR (Point-in-Time Recovery) 지원
- RTO: 15분 (자동 장애 복구), RPO: WAL 단위 (거의 0)

## 4. 모니터링

- PodMonitor: cnpg 메트릭 수집
- 알림: PG 복제 지연, 연결 수 초과, WAL 백업 실패

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 최초 작성 | bkend-expert |
