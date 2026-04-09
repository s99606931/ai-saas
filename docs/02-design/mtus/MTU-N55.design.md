# MTU-N55: Velero DR 자동화 설계 문서

> **버전**: 1.0.0 | **작성일**: 2026-04-10 | **작성자**: infra-architect

---

## Executive Summary

| 관점 | 설계 결정 |
|------|----------|
| 비즈니스 | Velero v1.18 + MinIO S3 호환 스토리지로 온프레미스 완전 DR 체계 구축 |
| 기술 | 3단계 백업(네임스페이스/전체/PV), 자동 스케줄, Restic 파일 레벨 백업 |
| 보안 | 백업 데이터 MinIO 서버사이드 암호화, RBAC 접근 통제 |
| 운영 | RTO 30분/RPO 1시간, DR 훈련 자동화, 월간 복구 검증 |

---

## 3.1 아키텍처 개요

```
┌─────────────────────────────────────────┐
│             k3s Cluster (WSL2)           │
│                                         │
│  ┌─────────────┐    ┌─────────────────┐ │
│  │ Velero       │    │ 워크로드         │ │
│  │ Server       │───>│ (saas NS)       │ │
│  │ + Restic     │    │ Deployment, PV  │ │
│  └──────┬──────┘    └─────────────────┘ │
│         │                               │
└─────────┼───────────────────────────────┘
          │ S3 API
          ▼
┌─────────────────┐
│ MinIO            │
│ (S3 호환 스토리지)│
│ velero-backups/  │
│  ├── daily/      │
│  ├── weekly/     │
│  └── pv-data/    │
└─────────────────┘
```

---

## 3.2 백업 스케줄 설계

| 스케줄 | 대상 | 주기 | 보존 | TTL |
|--------|------|------|------|-----|
| daily-saas | saas 네임스페이스 | 매일 02:00 | 30일 | 720h |
| weekly-cluster | 전체 클러스터 | 매주 일요일 03:00 | 90일 | 2160h |
| daily-pv | PersistentVolume 데이터 | 매일 04:00 | 14일 | 336h |

---

## 3.3 RTO/RPO 목표

| 시나리오 | RTO | RPO | 근거 |
|---------|-----|-----|------|
| 네임스페이스 복구 | 15분 | 24시간 | daily 백업 기준 |
| 전체 클러스터 복구 | 30분 | 7일 | weekly 백업 기준 |
| PV 데이터 복구 | 20분 | 24시간 | daily PV 백업 기준 |

---

## 3.4 Helm Values

```yaml
configuration:
  backupStorageLocation:
    - name: default
      provider: aws
      bucket: velero-backups
      config:
        region: us-east-1
        s3ForcePathStyle: true
        s3Url: http://minio.minio:9000
  volumeSnapshotLocation: []
  uploaderType: restic
credentials:
  secretContents:
    cloud: |
      [default]
      aws_access_key_id=velero
      aws_secret_access_key=<sealed-secret>
```

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 최초 작성 | infra-architect |
