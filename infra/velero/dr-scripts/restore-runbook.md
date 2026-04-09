# Velero 백업/복구 Runbook

> **Design Ref**: MTU-N55 Section 3.3
> **Plan SC**: FR-N55.6
> **CSAP**: D-06 침해사고 관리

---

## 1. 긴급 복구 절차 (RTO: 30분)

### 1.1 전체 네임스페이스 복구

```bash
# 1. 최신 백업 확인
velero backup get --selector schedule-type=daily

# 2. 백업 상세 확인
velero backup describe <backup-name> --details

# 3. 복구 실행
velero restore create restore-$(date +%Y%m%d%H%M%S) \
  --from-backup <backup-name> \
  --wait

# 4. 복구 상태 확인
velero restore get
velero restore describe <restore-name> --details

# 5. 서비스 정상 확인
kubectl get pods -n saas
kubectl get svc -n saas
```

### 1.2 특정 리소스만 복구

```bash
# Deployment만 복구
velero restore create --from-backup <backup-name> \
  --include-resources deployments \
  --wait

# 특정 라벨의 리소스만 복구
velero restore create --from-backup <backup-name> \
  --selector app=auth-service \
  --wait
```

### 1.3 PV 데이터 복구

```bash
# PV 백업에서 데이터 복구
velero restore create --from-backup <pv-backup-name> \
  --include-resources persistentvolumeclaims,persistentvolumes \
  --wait
```

---

## 2. 수동 백업

```bash
# 즉시 백업 (배포 전)
velero backup create pre-deploy-$(date +%Y%m%d%H%M%S) \
  --include-namespaces saas \
  --default-volumes-to-fs-backup \
  --wait

# 특정 라벨 백업
velero backup create hotfix-backup \
  --selector app=auth-service \
  --wait
```

---

## 3. 스케줄 관리

```bash
# 스케줄 목록
velero schedule get

# 스케줄 일시 중지
velero schedule pause daily-saas

# 스케줄 재개
velero schedule unpause daily-saas

# 스케줄 삭제
velero schedule delete <schedule-name>
```

---

## 4. 백업 보존 관리

| 스케줄 | 보존 기간 | TTL | 자동 정리 |
|--------|---------|-----|----------|
| daily-saas | 30일 | 720h | 자동 |
| weekly-cluster | 90일 | 2160h | 자동 |
| daily-pv | 14일 | 336h | 자동 |

만료된 백업은 Velero가 자동으로 정리합니다.

---

## 5. 문제 해결

### 백업 실패 시
```bash
# 백업 로그 확인
velero backup logs <backup-name>

# Velero 서버 로그
kubectl logs -n velero deploy/velero -f

# Restic 로그 (PV 백업 실패 시)
kubectl logs -n velero daemonset/node-agent -f
```

### 복구 실패 시
```bash
# 복구 로그 확인
velero restore logs <restore-name>

# 부분 복구 확인
velero restore describe <restore-name> --details
```

---

## 6. DR 훈련 일정

| 훈련 유형 | 주기 | 담당 |
|---------|------|------|
| 네임스페이스 복구 | 월간 | 인프라 팀 |
| 전체 클러스터 복구 | 분기 | 인프라 + 보안 팀 |
| RTO/RPO 검증 | 반기 | 전체 팀 |

훈련 자동화: `./dr-scripts/dr-drill.sh saas`
