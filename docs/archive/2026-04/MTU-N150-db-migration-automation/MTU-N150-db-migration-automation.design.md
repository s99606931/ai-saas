# MTU-N150 DB 마이그레이션 자동화 — Design

> **문서 버전**: 1.0.0 | **작성일**: 2026-04-10 | **작성자**: CTO Lead
> **Plan 참조**: MTU-N150-db-migration-automation.plan.md

---

## 1. 아키텍처 옵션

### Option A: Flyway Only (SQL 기반)
- 순수 SQL 마이그레이션
- 장점: 단순, DBA 친화적
- 단점: 스키마 드리프트 감지 부재

### Option B: Atlas + Flyway Hybrid ← 선택
- Atlas: 선언적 스키마 관리 + lint + dry-run
- Flyway: 실행 시점 마이그레이션 (K8s Job)
- 장점: 선언적 + 명령적 이중 관리, CI lint 통합
- 단점: 도구 2개 학습

### Option C: Liquibase Enterprise
- XML/YAML 기반 추상화
- 장점: 크로스 DB
- 단점: 복잡도 높음, 공공 환경 과도

**선택 근거**: Atlas의 CI lint + dry-run이 감리 증적에 최적. Flyway의 K8s Job 기반 실행이 GitOps에 적합.

## 2. 상세 설계

### 2.1 Atlas 스키마 관리 (FR-N150.1)

```hcl
# infra/db-migration/atlas.hcl
# Design Ref: §2.1 | Plan SC: FR-N150.1
variable "db_url" {
  type    = string
  default = "postgres://app:${var.db_password}@postgres:5432/saas?sslmode=require"
}

env "dev" {
  src = "file://schema.sql"
  url = "postgres://app:dev@localhost:5432/saas_dev?sslmode=disable"
  dev = "docker://postgres/16/dev"
  migration {
    dir = "file://migrations"
  }
}

env "stg" {
  src = "file://schema.sql"
  url = var.db_url
  migration {
    dir    = "file://migrations"
    format = atlas
  }
}

env "prod" {
  src = "file://schema.sql"
  url = var.db_url
  migration {
    dir             = "file://migrations"
    format          = atlas
    revisions_schema = "atlas_schema_revisions"
  }
}

lint {
  destructive {
    error = true
  }
  data_depend {
    error = true
  }
}
```

### 2.2 마이그레이션 디렉토리 구조 (FR-N150.2)

```
infra/db-migration/
  atlas.hcl                  # Atlas 설정
  schema.sql                 # 선언적 스키마 (desired state)
  migrations/                # 버전별 마이그레이션 파일
    20260410000001_init.sql
    20260410000002_add_audit_table.sql
  rollback/                  # 롤백 스크립트
    20260410000001_init.down.sql
    20260410000002_add_audit_table.down.sql
  verification/              # 무결성 검증
    pre-check.sql
    post-check.sql
  ci/                        # CI 파이프라인
    migration-lint.yaml
    migration-apply.yaml
```

### 2.3 CI 파이프라인 (FR-N150.3)

```yaml
# .gitea/workflows/db-migration-ci.yaml
# Design Ref: §2.3 | Plan SC: FR-N150.3
name: DB Migration CI
on:
  pull_request:
    paths:
      - 'infra/db-migration/**'
  push:
    branches: [main, stg]
    paths:
      - 'infra/db-migration/**'

jobs:
  lint:
    name: Schema Lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ariga/setup-atlas@v0
      - name: Atlas Lint
        run: |
          atlas migrate lint \
            --env dev \
            --dir "file://infra/db-migration/migrations" \
            --dev-url "docker://postgres/16/dev" \
            --latest 1
        env:
          ATLAS_TOKEN: ${{ secrets.ATLAS_TOKEN }}

  dry-run:
    name: Migration Dry Run
    needs: lint
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_DB: saas_test
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
        ports: ['5432:5432']
    steps:
      - uses: actions/checkout@v4
      - uses: ariga/setup-atlas@v0
      - name: Dry Run
        run: |
          atlas migrate apply \
            --env dev \
            --url "postgres://test:test@localhost:5432/saas_test?sslmode=disable" \
            --dry-run

  apply:
    name: Migration Apply
    needs: dry-run
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ariga/setup-atlas@v0
      - name: Pre-check
        run: |
          psql "$DB_URL" -f infra/db-migration/verification/pre-check.sql
      - name: Apply
        run: |
          atlas migrate apply \
            --env prod \
            --url "$DB_URL"
      - name: Post-check
        run: |
          psql "$DB_URL" -f infra/db-migration/verification/post-check.sql
      - name: Audit Log
        run: |
          echo '{"timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","action":"DB_MIGRATION_APPLY","actor":"ci-pipeline","details":{"env":"prod","status":"success"}}' >> .claude/audit.jsonl
```

### 2.4 K8s 마이그레이션 Job (FR-N150.4)

```yaml
# infra/db-migration/k8s-migration-job.yaml
# Design Ref: §2.4 | Plan SC: FR-N150.4
apiVersion: batch/v1
kind: Job
metadata:
  name: db-migration
  namespace: saas-system
  labels:
    csap.compliance/domain: D-12
spec:
  backoffLimit: 0
  template:
    metadata:
      labels:
        app: db-migration
    spec:
      serviceAccountName: db-migration-sa
      securityContext:
        runAsNonRoot: true
        runAsUser: 65534
        seccompProfile:
          type: RuntimeDefault
      initContainers:
        - name: backup
          image: postgres:16
          securityContext:
            allowPrivilegeEscalation: false
            capabilities:
              drop: ["ALL"]
          command:
            - /bin/sh
            - -c
            - |
              pg_dump "$DATABASE_URL" > /backup/pre-migration-$(date +%Y%m%d%H%M%S).sql
              echo "[INFO] 마이그레이션 전 백업 완료"
          envFrom:
            - secretRef:
                name: db-credentials
          volumeMounts:
            - name: backup
              mountPath: /backup
      containers:
        - name: migrate
          image: arigaio/atlas:latest
          securityContext:
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            capabilities:
              drop: ["ALL"]
          command:
            - atlas
            - migrate
            - apply
            - --env
            - prod
          envFrom:
            - secretRef:
                name: db-credentials
          volumeMounts:
            - name: migrations
              mountPath: /migrations
              readOnly: true
      volumes:
        - name: backup
          persistentVolumeClaim:
            claimName: db-backup-pvc
        - name: migrations
          configMap:
            name: db-migrations
      restartPolicy: Never
```

### 2.5 보안 설계

| 통제 항목 | 구현 방법 |
|-----------|---------|
| CSAP D-06 | 마이그레이션 실행 전수 감사 로그 |
| CSAP D-07 | 마이그레이션 전 자동 백업 (initContainer) |
| CSAP D-09 | DB 연결 SSL/TLS 필수 (sslmode=require) |
| CSAP D-12 | Atlas lint로 파괴적 변경 차단 |
| N2SF N-05 | 마이그레이션 파일에 PII 포함 금지 검사 |
| N2SF N-06 | 변경 이력 Git + audit.jsonl 이중 추적 |
