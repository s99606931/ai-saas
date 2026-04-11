# PostgreSQL — CloudNativePG HA 클러스터 운영

> **버전**: 1.0.0 | **작성일**: 2026-04-11
> **대상**: 신규 개발자, DevOps 엔지니어, DBA
> **CSAP**: D-09 (암호화 — DB 저장 암호화), D-06 (침해사고 관리 — DB 감사 로그)
> **관련 문서**: `04-infrastructure.md` §5.3, `docs/07-infra/sql-monitoring-guide.md`

---

## 목차

1. [CloudNativePG란](#1-cloudnativepg란)
2. [HA 3인스턴스 구조](#2-ha-3인스턴스-구조)
3. [WAL 기반 복제](#3-wal-기반-복제)
4. [서비스에서 DB 연결 방법](#4-서비스에서-db-연결-방법)
5. [Prisma 마이그레이션 실행](#5-prisma-마이그레이션-실행)
6. [백업과 복구](#6-백업과-복구)
7. [모니터링 대시보드](#7-모니터링-대시보드)
8. [자주 하는 실수](#8-자주-하는-실수)

---

## 1. CloudNativePG란

### 1.1 역할

CloudNativePG(CNPG)는 Kubernetes 네이티브 PostgreSQL 오퍼레이터입니다. 일반 PostgreSQL을 단순히 컨테이너에 올리는 것과 달리, Kubernetes의 상태 관리 패턴을 완전히 활용합니다.

```
일반 PostgreSQL 컨테이너 (사용 안 함):
  - 장애 시 수동 재시작
  - 복제 설정 수동 관리
  - 백업 스크립트 직접 작성
  - 스케일링 어려움

CloudNativePG (이 프레임워크):
  - Primary 장애 시 Replica가 자동 Primary 승격
  - WAL 복제 자동 설정
  - Backup 리소스로 선언적 백업 관리
  - Kubernetes Operator가 모든 운영을 자동화
```

### 1.2 CSAP D-09 준수

| CSAP 항목 | 구현 방법 |
|----------|---------|
| 암호화 전송 | PostgreSQL SSL 강제 (`sslmode=require`) |
| 암호화 인증 | `scram-sha-256` 인증 방식 |
| 저장 암호화 | 볼륨 레벨 암호화 (k3s local-path StorageClass) |
| 감사 로그 | `log_connections`, `log_statement`, `log_disconnections` 활성화 |

### 1.3 CNPG 상태 확인

```bash
# CNPG 오퍼레이터 Pod 상태
kubectl get pods -n cnpg-system
# NAME                                 READY   STATUS
# cnpg-controller-manager-xxxxx        1/1     Running

# 클러스터 목록
kubectl get cluster -n saas
# NAME           INSTANCES   READY   STATUS
# saas-main-db   3           3       Cluster in healthy state
```

---

## 2. HA 3인스턴스 구조

### 2.1 Primary + 2 Replica 아키텍처

```mermaid
graph TB
    subgraph CNPG["saas 네임스페이스 — CloudNativePG 클러스터"]
        subgraph PRIMARY["Primary Pod (saas-main-db-1)"]
            PG1["PostgreSQL 17\n읽기/쓰기 전용\nWAL 생성"]
            PGDATA1[(데이터\nVolume 20Gi)]
            PG1 --- PGDATA1
        end

        subgraph REPLICA1["Replica Pod (saas-main-db-2)"]
            PG2["PostgreSQL 17\n읽기 전용\nWAL 수신·적용"]
            PGDATA2[(데이터\nVolume 20Gi)]
            PG2 --- PGDATA2
        end

        subgraph REPLICA2["Replica Pod (saas-main-db-3)"]
            PG3["PostgreSQL 17\n읽기 전용\nWAL 수신·적용"]
            PGDATA3[(데이터\nVolume 20Gi)]
            PG3 --- PGDATA3
        end

        PG1 -->|WAL 스트리밍 복제| PG2
        PG1 -->|WAL 스트리밍 복제| PG3
    end

    subgraph SVC["Service 엔드포인트"]
        RW["saas-main-db-rw\n읽기/쓰기\n(Primary만)"]
        RO["saas-main-db-ro\n읽기 전용\n(Replica 로드밸런싱)"]
        ANY["saas-main-db-any\n랜덤 (Primary or Replica)"]
    end

    RW -->|항상 Primary| PG1
    RO -->|로드밸런싱| PG2
    RO -->|로드밸런싱| PG3
    ANY -->|랜덤| PG1
    ANY -->|랜덤| PG2
    ANY -->|랜덤| PG3

    subgraph APPS["saas-platform 애플리케이션"]
        AUTH["auth-service\n쓰기: RW\n읽기: RO"]
        REPORT["report-service\n읽기 전용 → RO"]
    end

    AUTH --> RW
    AUTH --> RO
    REPORT --> RO
```

### 2.2 자동 장애 조치 (Automatic Failover)

Primary Pod가 실패하면 CNPG 오퍼레이터가 자동으로 Replica를 Primary로 승격합니다.

```
정상 상태:
  saas-main-db-1 (Primary) → saas-main-db-2, 3 (Replica)

Primary(db-1) 장애:
  CNPG 감지 (30초 이내)
    ↓
  가장 최신 WAL을 가진 Replica(db-2) 선택
    ↓
  db-2를 새 Primary로 승격
    ↓
  Service(saas-main-db-rw)가 새 Primary(db-2)로 자동 업데이트
    ↓
  애플리케이션은 동일 DNS(saas-main-db-rw)로 계속 접근 가능
```

### 2.3 클러스터 정의 YAML

```yaml
# infra/cloudnative-pg/clusters/saas-main-db.yaml
apiVersion: postgresql.cnpg.io/v1
kind: Cluster
metadata:
  name: saas-main-db
  namespace: saas
spec:
  instances: 3    # Primary 1 + Replica 2

  postgresql:
    parameters:
      # CSAP D-06 감사 로그
      log_connections: "on"
      log_disconnections: "on"
      log_statement: "ddl"      # DDL 명령어만 로그 (성능 영향 최소화)
      log_duration: "off"
      # 암호화 설정
      ssl: "on"
      password_encryption: "scram-sha-256"

  bootstrap:
    initdb:
      database: saas_platform
      owner: saas_app
      secret:
        name: saas-db-credentials   # Vault/ESO에서 자동 주입

  storage:
    size: 20Gi
    storageClass: local-path

  resources:
    requests:
      cpu: 100m
      memory: 256Mi
    limits:
      cpu: 500m
      memory: 512Mi

  # WAL 아카이빙 (Point-in-Time Recovery 지원)
  backup:
    retentionPolicy: "30d"
    barmanObjectStore:
      destinationPath: s3://saas-backup/postgresql/
      s3Credentials:
        accessKeyId:
          name: backup-credentials
          key: access-key-id
        secretAccessKey:
          name: backup-credentials
          key: secret-access-key
```

---

## 3. WAL 기반 복제

### 3.1 WAL이란

WAL(Write-Ahead Log)은 PostgreSQL이 모든 변경 사항을 실제 데이터 파일에 쓰기 전에 먼저 기록하는 로그입니다.

```
WAL의 역할:
  1. 내구성: 서버 크래시 전 WAL에 기록 → 재시작 시 WAL로 복구
  2. 복제: Primary의 WAL을 Replica에 스트리밍 → Replica가 동일 상태 유지
  3. PITR: WAL 로그로 특정 시점의 데이터 상태로 복구 가능
```

### 3.2 복제 확인

```bash
# Primary에서 복제 상태 확인
kubectl exec -n saas saas-main-db-1 -- \
  psql -U postgres -c "SELECT application_name, state, sync_state FROM pg_stat_replication;"
# application_name  | state     | sync_state
# saas-main-db-2    | streaming | async
# saas-main-db-3    | streaming | async

# Replica에서 복제 지연 확인 (0에 가까울수록 좋음)
kubectl exec -n saas saas-main-db-2 -- \
  psql -U postgres -c "SELECT now() - pg_last_xact_replay_timestamp() AS replication_delay;"
# replication_delay
# 00:00:00.023      ← 23ms 지연 (정상)
```

---

## 4. 서비스에서 DB 연결 방법

### 4.1 Service 엔드포인트

CNPG는 클러스터를 위해 3개의 Service를 자동 생성합니다.

```bash
# Service 목록 확인
kubectl get services -n saas
# NAME                  TYPE        CLUSTER-IP      PORT(S)
# saas-main-db-rw       ClusterIP   10.43.xxx.xxx   5432/TCP   ← 쓰기 전용
# saas-main-db-ro       ClusterIP   10.43.xxx.xxx   5432/TCP   ← 읽기 전용
# saas-main-db-any      ClusterIP   10.43.xxx.xxx   5432/TCP   ← 랜덤
# saas-main-db-r        ClusterIP   None            5432/TCP   ← Headless (직접 Pod 접근)
```

### 4.2 애플리케이션 연결 설정

```typescript
// auth-service 예시 (TypeScript + Prisma)
// Design Ref: §4.2 — DB 연결 전략

// 쓰기 작업용 URL (Primary만)
const writeUrl = process.env.DATABASE_URL
// postgresql://saas_app:PASSWORD@saas-main-db-rw.saas.svc.cluster.local:5432/saas_platform?sslmode=require

// 읽기 작업용 URL (Replica 로드밸런싱)
const readUrl = process.env.DATABASE_URL_RO
// postgresql://saas_app:PASSWORD@saas-main-db-ro.saas.svc.cluster.local:5432/saas_platform?sslmode=require
```

```yaml
# ConfigMap에서 DB 호스트 설정 (비밀번호 제외)
apiVersion: v1
kind: ConfigMap
metadata:
  name: auth-service-config
  namespace: saas-platform
data:
  DATABASE_HOST_RW: "saas-main-db-rw.saas.svc.cluster.local"
  DATABASE_HOST_RO: "saas-main-db-ro.saas.svc.cluster.local"
  DATABASE_PORT: "5432"
  DATABASE_NAME: "saas_platform"
  DATABASE_SSL_MODE: "require"
```

### 4.3 연결 URL 패턴

```
형식: postgresql://{USER}:{PASSWORD}@{HOST}:{PORT}/{DATABASE}?sslmode=require

쓰기: postgresql://saas_app:***@saas-main-db-rw.saas.svc.cluster.local:5432/saas_platform?sslmode=require
읽기: postgresql://saas_app:***@saas-main-db-ro.saas.svc.cluster.local:5432/saas_platform?sslmode=require
```

**중요**: `sslmode=require`는 CSAP D-09 전송 암호화 요건을 충족하기 위해 필수입니다.

### 4.4 개발용 직접 접속 (psql)

```bash
# Primary에 직접 접속 (개발/디버깅용)
kubectl exec -it saas-main-db-1 -n saas -- \
  psql -U saas_app saas_platform

# 임시 Pod에서 접속 (외부 psql 클라이언트 사용)
kubectl run psql-client --image=postgres:17 --rm -it \
  -n saas --restart=Never -- \
  psql "postgresql://saas_app:PASSWORD@saas-main-db-rw.saas.svc.cluster.local/saas_platform?sslmode=require"

# 로컬에서 접속 (port-forward)
kubectl port-forward -n saas svc/saas-main-db-rw 15432:5432
# 로컬에서: psql -h localhost -p 15432 -U saas_app saas_platform
```

---

## 5. Prisma 마이그레이션 실행

이 프레임워크는 Prisma ORM을 사용하여 DB 스키마를 관리합니다. **절대 직접 SQL로 스키마를 변경하지 마십시오.**

### 5.1 마이그레이션 파일 생성

```bash
# 로컬 개발 환경에서 스키마 변경 후 마이그레이션 파일 생성
cd platform/services/auth-service

# schema.prisma 수정 후
npx prisma migrate dev --name add_notification_table

# 생성된 마이그레이션 파일 확인
ls prisma/migrations/
# 20260411_000001_add_notification_table/
# └── migration.sql
```

### 5.2 마이그레이션 적용 (CI/CD 자동 실행)

```yaml
# infra/db-migration/migration-job.yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: auth-service-migration
  namespace: saas-platform
spec:
  template:
    spec:
      restartPolicy: OnFailure
      containers:
        - name: prisma-migrate
          image: localhost:8080/public-saas/auth-service:v1.2.3
          command:
            - npx
            - prisma
            - migrate
            - deploy    # 개발 환경과 달리 프롬프트 없이 적용
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: auth-db-credentials
                  key: database-url
```

```bash
# Job 실행 상태 확인
kubectl get jobs -n saas-platform
kubectl logs -l job-name=auth-service-migration -n saas-platform

# 마이그레이션 적용 이력 확인
kubectl exec -n saas saas-main-db-1 -- \
  psql -U saas_app saas_platform -c \
  "SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 10;"
```

### 5.3 마이그레이션 롤백

Prisma는 자동 롤백을 지원하지 않습니다. 롤백이 필요하면:

```bash
# 방법 1: 롤백 마이그레이션 파일 작성
# prisma/migrations/20260411_000002_rollback_notification/migration.sql
# DROP TABLE IF EXISTS notifications;

# 방법 2: PITR (Point-in-Time Recovery) — 데이터 손실이 심각한 경우
# 아래 6절 복구 섹션 참조
```

---

## 6. 백업과 복구

### 6.1 자동 백업 설정

CNPG는 Velero 기반 전체 클러스터 백업 외에, PostgreSQL 수준의 연속 아카이빙을 지원합니다.

```bash
# Backup 리소스 목록 확인
kubectl get backup -n saas
# NAME                       CLUSTER         STATUS      AGE
# saas-main-db-backup-0401   saas-main-db    completed   10d
# saas-main-db-backup-0411   saas-main-db    completed   1d

# 백업 상세
kubectl describe backup saas-main-db-backup-0411 -n saas

# Velero 백업 상태 확인
kubectl get backups -n velero
```

### 6.2 수동 온디맨드 백업

```bash
# 즉시 백업 실행 (중요 변경 전 권장)
cat <<EOF | kubectl apply -f -
apiVersion: postgresql.cnpg.io/v1
kind: Backup
metadata:
  name: pre-migration-backup
  namespace: saas
spec:
  method: barmanObjectStore
  cluster:
    name: saas-main-db
EOF

# 백업 완료 확인
kubectl get backup pre-migration-backup -n saas -w
# STATUS가 completed로 바뀔 때까지 대기
```

### 6.3 Point-in-Time Recovery (PITR)

특정 시점으로 DB를 복구하는 절차 (데이터 손실 사고 시):

```yaml
# 새 클러스터 리소스로 특정 시점 복구
apiVersion: postgresql.cnpg.io/v1
kind: Cluster
metadata:
  name: saas-main-db-recovered
  namespace: saas
spec:
  instances: 1   # 복구용 단일 인스턴스
  bootstrap:
    recovery:
      source: saas-main-db
      recoveryTarget:
        # 특정 시간으로 복구 (KST 기준 ISO 8601 형식)
        targetTime: "2026-04-11T09:00:00+09:00"
  externalClusters:
    - name: saas-main-db
      barmanObjectStore:
        destinationPath: s3://saas-backup/postgresql/
```

```bash
# 복구된 클러스터 상태 확인
kubectl get cluster saas-main-db-recovered -n saas

# 복구된 DB 데이터 검증 후 서비스 연결 전환
kubectl patch cluster saas-main-db -n saas \
  --type=merge -p '{"spec":{"instances": 3}}'
```

---

## 7. 모니터링 대시보드

### 7.1 Grafana 대시보드

CNPG는 Prometheus 메트릭을 자동 노출합니다. Grafana에서 "CloudNativePG" 대시보드를 가져옵니다.

```bash
# Grafana 접근 (포트 포워딩)
kubectl port-forward -n monitoring svc/grafana 3000:3000
# 브라우저: http://localhost:3000
# 대시보드: CloudNativePG (사전 설치됨)
```

### 7.2 핵심 모니터링 지표

| 지표 | 의미 | 임계값 |
|------|------|--------|
| `cnpg_collector_pg_postmaster_start_time` | Primary 마지막 시작 시간 | 최근 재시작 감지 |
| `cnpg_collector_replica_status_replication_lag` | 복제 지연 | > 30초 = 경고 |
| `pg_stat_user_tables_n_dead_tup` | Dead tuple 수 | > 10000 = VACUUM 필요 |
| `pg_database_size_bytes` | DB 크기 | > 15GB = 스토리지 확장 검토 |
| `cnpg_collector_backends_waiting_total` | 대기 중인 연결 수 | > 50 = 커넥션 풀 검토 |

```bash
# Prometheus에서 직접 쿼리 (포트 포워딩 후)
kubectl port-forward -n monitoring svc/prometheus-server 9090:9090
# 브라우저: http://localhost:9090
# 쿼리 예시: cnpg_collector_replica_status_replication_lag
```

### 7.3 DB 성능 진단

```bash
# 느린 쿼리 상위 10개
kubectl exec -n saas saas-main-db-1 -- \
  psql -U saas_app saas_platform -c \
  "SELECT query, calls, mean_exec_time, total_exec_time
   FROM pg_stat_statements
   ORDER BY mean_exec_time DESC LIMIT 10;"

# 현재 활성 연결 확인
kubectl exec -n saas saas-main-db-1 -- \
  psql -U saas_app saas_platform -c \
  "SELECT count(*), state FROM pg_stat_activity GROUP BY state;"

# 테이블 크기 상위 10개
kubectl exec -n saas saas-main-db-1 -- \
  psql -U saas_app saas_platform -c \
  "SELECT schemaname, tablename,
   pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
   FROM pg_tables ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC LIMIT 10;"
```

---

## 8. 자주 하는 실수

### 실수 1: 읽기 쿼리에 RW 엔드포인트 사용

```typescript
// 잘못된 예 — 모든 쿼리가 Primary로만 가서 부하 집중
const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } }  // RW 엔드포인트만
})

// 올바른 예 — 읽기는 RO로 분산
const prismaWrite = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL_RW } } })
const prismaRead = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL_RO } } })
```

### 실수 2: 직접 SQL로 스키마 변경

```bash
# 절대 금지 — Prisma 마이그레이션 이력과 충돌 발생
kubectl exec -n saas saas-main-db-1 -- psql -U saas_app -c "ALTER TABLE users ADD COLUMN phone VARCHAR(20);"

# 올바른 방법: Prisma schema.prisma 수정 → migrate dev → PR → 자동 배포
```

### 실수 3: 연결 URL에 SSL 미설정

```bash
# 잘못된 예 — CSAP D-09 위반
DATABASE_URL=postgresql://user:pass@host:5432/db

# 올바른 예 — TLS 강제
DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=require
```

### 실수 4: Replica를 쓰기에 사용 시도

```bash
# Replica는 읽기 전용 → 쓰기 시도 시 오류
# ERROR: cannot execute INSERT in a read-only transaction

# saas-main-db-ro 엔드포인트는 읽기(SELECT)만 사용
```

---

다음 단계: `04-vault.md`에서 HashiCorp Vault와 External Secrets Operator를 통한 시크릿 관리를 학습합니다.
