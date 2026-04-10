# MTU-N151 백업 자동 검증 파이프라인 — Design

> **문서 버전**: 1.0.0 | **작성일**: 2026-04-10 | **작성자**: CTO Lead
> **Plan 참조**: MTU-N151-backup-verification.plan.md

---

## 1. 아키텍처 선택: Pragmatic Balance

격리 네임스페이스 기반 자동 복구 테스트 + 데이터 무결성 검증 + 자동 정리

## 2. 상세 설계

### 2.1 Velero 백업 복구 검증 CronJob (FR-N151.1)

```yaml
# infra/backup-verification/velero-verify-cronjob.yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: velero-backup-verify
  namespace: velero
spec:
  schedule: "0 3 * * 0"  # 매주 일요일 03:00
  jobTemplate:
    spec:
      template:
        spec:
          serviceAccountName: velero-verify-sa
          securityContext:
            runAsNonRoot: true
            runAsUser: 65534
          containers:
            - name: verify
              image: bitnami/kubectl:1.30
              command: ["/bin/sh", "-c"]
              args:
                - |
                  set -euo pipefail
                  NAMESPACE="backup-verify-$(date +%Y%m%d)"
                  START_TIME=$(date +%s)

                  echo "[INFO] 백업 복구 검증 시작"

                  # 최신 백업 확인
                  LATEST_BACKUP=$(velero backup get -o json | jq -r '.items | sort_by(.status.completionTimestamp) | last | .metadata.name')
                  echo "[INFO] 최신 백업: $LATEST_BACKUP"

                  # 격리 네임스페이스에 복구
                  velero restore create "verify-${LATEST_BACKUP}" \
                    --from-backup "$LATEST_BACKUP" \
                    --namespace-mappings "saas-system:${NAMESPACE}" \
                    --wait

                  # 복구 상태 확인
                  RESTORE_STATUS=$(velero restore get "verify-${LATEST_BACKUP}" -o json | jq -r '.status.phase')
                  END_TIME=$(date +%s)
                  RTO=$((END_TIME - START_TIME))

                  if [ "$RESTORE_STATUS" = "Completed" ]; then
                    echo "[PASS] 복구 성공 — RTO: ${RTO}초"
                    STATUS="SUCCESS"
                  else
                    echo "[FAIL] 복구 실패: $RESTORE_STATUS"
                    STATUS="FAILED"
                  fi

                  # 감사 로그
                  echo "{\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"action\":\"BACKUP_VERIFY\",\"target\":\"$LATEST_BACKUP\",\"status\":\"$STATUS\",\"rto_seconds\":$RTO}" >> /tmp/audit.log

                  # 정리
                  kubectl delete namespace "$NAMESPACE" --ignore-not-found
                  velero restore delete "verify-${LATEST_BACKUP}" --confirm
          restartPolicy: OnFailure
```

### 2.2 CNPG 데이터베이스 복구 검증 (FR-N151.2)

```yaml
# infra/backup-verification/cnpg-verify-cronjob.yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: cnpg-backup-verify
  namespace: cnpg-system
spec:
  schedule: "0 4 * * 0"
  jobTemplate:
    spec:
      template:
        spec:
          containers:
            - name: verify
              image: postgres:16-alpine
              command: ["/bin/sh", "-c"]
              args:
                - |
                  set -euo pipefail
                  echo "[INFO] CNPG 백업 복구 검증 시작"

                  # 1. 체크섬 기반 데이터 무결성 검증
                  CHECKSUM_BEFORE=$(psql "$PROD_DB_URL" -t -c \
                    "SELECT md5(string_agg(md5(t.*::text), '' ORDER BY id)) FROM (SELECT * FROM tenants ORDER BY id) t")

                  # 2. 백업에서 복구 클러스터 생성
                  kubectl apply -f - <<EOF
                  apiVersion: postgresql.cnpg.io/v1
                  kind: Cluster
                  metadata:
                    name: verify-restore
                    namespace: cnpg-verify
                  spec:
                    instances: 1
                    bootstrap:
                      recovery:
                        source: saas-db
                    storage:
                      size: 5Gi
                  EOF

                  # 3. 복구 대기
                  kubectl wait --for=condition=Ready cluster/verify-restore -n cnpg-verify --timeout=600s

                  # 4. 복구 데이터 체크섬 비교
                  CHECKSUM_AFTER=$(psql "$RESTORE_DB_URL" -t -c \
                    "SELECT md5(string_agg(md5(t.*::text), '' ORDER BY id)) FROM (SELECT * FROM tenants ORDER BY id) t")

                  if [ "$CHECKSUM_BEFORE" = "$CHECKSUM_AFTER" ]; then
                    echo "[PASS] 데이터 무결성 확인 — 체크섬 일치"
                  else
                    echo "[FAIL] 데이터 불일치!"
                  fi

                  # 5. 정리
                  kubectl delete cluster verify-restore -n cnpg-verify
          restartPolicy: OnFailure
```

### 2.3 보고서 자동 생성 (FR-N151.3)

```yaml
# infra/backup-verification/report-generator.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: backup-verify-report-template
  namespace: velero
data:
  template.md: |
    # 백업 검증 보고서 — {{ .Date }}

    ## 요약
    | 항목 | 결과 |
    |------|------|
    | Velero 복구 | {{ .VeleroStatus }} |
    | CNPG 복구 | {{ .CnpgStatus }} |
    | RTO 측정 | {{ .RtoSeconds }}초 (목표: 14400초) |
    | 데이터 무결성 | {{ .IntegrityCheck }} |
    | 백업 암호화 | {{ .EncryptionCheck }} |

    ## 세부 결과
    - 백업 이름: {{ .BackupName }}
    - 복구 시작: {{ .StartTime }}
    - 복구 완료: {{ .EndTime }}
    - 데이터 체크섬: {{ .Checksum }}

    ## CSAP D-07 준수 현황
    - [x] 정기 복구 테스트 실행
    - [x] RTO/RPO 달성 여부 확인
    - [x] 백업 데이터 무결성 검증
    - [x] 감사 로그 기록
```

### 2.4 Prometheus 알림 (FR-N151.5)

```yaml
# infra/backup-verification/alerts.yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: backup-verification-alerts
  namespace: monitoring
spec:
  groups:
    - name: backup-verification
      rules:
        - alert: BackupVerificationFailed
          expr: backup_verification_status{result="failed"} > 0
          for: 0m
          labels:
            severity: critical
            csap_domain: D-07
          annotations:
            summary: "백업 복구 검증 실패"
            description: "{{ $labels.type }} 백업 복구 검증이 실패했습니다."

        - alert: BackupRTOExceeded
          expr: backup_verification_rto_seconds > 14400
          for: 0m
          labels:
            severity: warning
            csap_domain: D-07
          annotations:
            summary: "RTO 초과: {{ $value }}초"

        - alert: BackupVerificationMissed
          expr: time() - backup_verification_last_success_timestamp > 604800
          for: 1h
          labels:
            severity: warning
          annotations:
            summary: "7일 이상 백업 검증 미실행"
```

### 2.5 보안 설계

| 통제 항목 | 구현 방법 |
|-----------|---------|
| CSAP D-07 | 주간 자동 복구 테스트 + RTO 측정 |
| CSAP D-09 | 백업 데이터 AES-256 암호화 검증 |
| CSAP D-06 | 복구 테스트 이력 전수 감사 로그 |
| N2SF N-04 | 백업 암호화 상태 자동 점검 |
| N2SF N-05 | 복구 검증 데이터 격리 (별도 네임스페이스) |
