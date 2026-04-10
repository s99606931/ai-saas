# MTU-N97: 스토리지 계층화 -- Design

> **MTU ID**: MTU-N97
> **Plan 참조**: docs/01-plan/mtus/MTU-N97-storage-tiering.plan.md
> **작성일**: 2026-04-10

---

## Design Anchor

| 항목 | 내용 |
|------|------|
| 목표 | Hot/Warm/Cold 3단계 스토리지 + MinIO ILM 자동 이전 |
| 제약 | k3s local-path 기반, 외부 클라우드 스토리지 사용 금지 |
| 검증 | ILM 규칙 동작 확인, 데이터 무결성 검증 |

## 아키텍처

```
[Hot Tier]          [Warm Tier]         [Cold Tier]
NVMe/SSD            HDD/Standard        Archive/Compressed
< 7일               7~30일              > 30일
  |                   |                   |
  +---MinIO ILM 자동 전환---+---MinIO ILM 자동 전환---+
```

### StorageClass 구성

| 티어 | StorageClass | 용도 | 보존 기간 |
|------|-------------|------|----------|
| Hot | sc-hot-nvme | 실시간 메트릭, 활성 로그 | 0~7일 |
| Warm | sc-warm-standard | 분석용 로그, 지난 메트릭 | 7~30일 |
| Cold | sc-cold-archive | 감사 로그 장기보관, 백업 | 30일+ |

### MinIO ILM 규칙

| 규칙 | 조건 | 동작 |
|------|------|------|
| audit-log-warm | age > 7d | hot -> warm 이전 |
| audit-log-cold | age > 30d | warm -> cold 이전 |
| metrics-warm | age > 3d | hot -> warm 이전 |
| metrics-cold | age > 14d | warm -> cold 이전 |
| backup-cold | age > 7d | hot -> cold 직접 이전 |

## 산출물

| # | 파일 | 설명 |
|---|------|------|
| 1 | infra/storage/storageclass-hot.yaml | Hot 티어 StorageClass |
| 2 | infra/storage/storageclass-warm.yaml | Warm 티어 StorageClass |
| 3 | infra/storage/storageclass-cold.yaml | Cold 티어 StorageClass |
| 4 | infra/storage/minio-ilm-rules.yaml | MinIO ILM 수명주기 규칙 |
| 5 | infra/storage/data-lifecycle-cronjob.yaml | 데이터 이전 크론잡 |
| 6 | infra/monitoring/dashboards/storage-tiering.json | Grafana 대시보드 |
| 7 | tests/e2e/test-storage-tiering.sh | E2E 테스트 |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 초기 설계 | PM Agent |
