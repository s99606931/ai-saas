# 운영 FAQ — 실전 운영 상황 대응 가이드

> **문서 ID**: ONBOARD-11-OPS-FAQ
> **버전**: 1.0.0 | **작성일**: 2026-04-12 | **작성자**: Implementer (Sonnet)
> **대상**: 플랫폼 운영 담당자, DevOps 엔지니어, 온콜 담당자
> **선행 학습**: `02-infra-faq.md` (인프라 기초), `09-troubleshooting/04-incident-management.md`
> **질문 수**: 25개
> **주의**: 이 문서는 인프라 FAQ(`02-infra-faq.md`)와 중복되지 않는 운영 상황만 다룹니다.

---

## 목차

1. [배포 운영 (6문항)](#1-배포-운영)
2. [데이터베이스 운영 (5문항)](#2-데이터베이스-운영)
3. [보안 사고 대응 (5문항)](#3-보안-사고-대응)
4. [성능 긴급 대응 (5문항)](#4-성능-긴급-대응)
5. [일반 운영 (4문항)](#5-일반-운영)
6. [학습 체크리스트](#6-학습-체크리스트)
7. [다음 단계](#7-다음-단계)

---

## 1. 배포 운영

---

**Q1. 새벽 2시에 배포해야 합니다. 절차가 어떻게 되나요?**

A: 새벽 배포도 절차는 동일하지만 추가 확인 단계가 필요합니다.

**배포 전 체크리스트 (새벽 배포)**

```bash
# 1. 현재 클러스터 상태 확인 (이상 없는지)
kubectl get pods -n saas-platform
kubectl top nodes

# 2. 현재 활성 사용자 확인 (새벽에도 배치 작업이 있을 수 있음)
kubectl logs -n saas-platform -l app=api-gateway --since=10m | grep "POST\|PUT\|DELETE" | wc -l

# 3. DB 백업 상태 확인
kubectl get cronjob -n saas-platform | grep backup
```

**배포 절차**

```bash
# 4. stg에서 최신 코드 확인
git log --oneline -5

# 5. Gitea Actions 배포 트리거 (git push로만 배포)
git checkout stg
git merge feature/your-feature
git push origin stg
# → Gitea Actions가 자동으로 CI/CD 파이프라인 실행

# 6. Flux 동기화 확인
flux get kustomization saas-platform --watch

# 7. 배포 완료 후 헬스 체크
curl http://localhost:4000/health/ping
curl http://localhost:3001/health/ping  # auth-service
curl http://localhost:3004/health/ping  # subscription-service
curl http://localhost:3005/health/ping  # billing-service
```

**새벽 배포 주의사항:**

- ⚠️ 배포 전 반드시 롤백 계획 확인 (아래 Q2 참고)
- ⚠️ 배포 중 DB 마이그레이션이 있으면 반드시 사전에 팀장 승인 필요
- ⚠️ 배포 완료 후 최소 15분은 모니터링 유지 (Grafana 대시보드 확인)
- ✅ 배포 결과를 운영 채널에 기록 (시간, 버전, 담당자)

```bash
# 배포 완료 기록 예시 (운영 채널 슬랙/채팅)
# "[배포 완료] 2026-04-12 02:47 / auth-service v1.2.3 / 담당: 홍길동"
# "헬스체크: 전 서비스 정상 / 영향: 없음"
```

---

**Q2. 배포 중 에러가 발생했습니다. 즉시 롤백하는 방법은?**

A: 이 프로젝트는 Flux GitOps를 사용하므로, git에서 이전 커밋으로 되돌리는 것이 가장 안전한 롤백 방법입니다.

**즉시 롤백 절차**

```bash
# 방법 1: git revert (권장 — 히스토리 보존)
git log --oneline -10  # 롤백할 커밋 해시 확인
git revert <문제-커밋-해시> --no-edit
git push origin stg
# → Flux가 자동으로 이전 상태로 복원

# 방법 2: Helm 직접 롤백 (긴급 시)
# 현재 릴리스 히스토리 확인
helm history auth-service -n saas-platform

# REVISION 숫자로 이전 버전으로 롤백
helm rollback auth-service 2 -n saas-platform  # 2번 리비전으로 롤백
# → Flux와 충돌할 수 있음, 즉시 git도 revert 필요
```

**롤백 후 확인**

```bash
# 서비스 상태 확인
kubectl rollout status deployment/auth-service -n saas-platform

# 로그에서 에러 사라졌는지 확인
kubectl logs -f -l app=auth-service -n saas-platform | grep ERROR

# 헬스체크
curl http://localhost:3001/health/ping
```

💡 Helm 직접 롤백 후에는 반드시 git의 `stg` 브랜치도 revert해야 합니다. 그렇지 않으면 다음 Flux 동기화 시 다시 문제 버전이 배포됩니다.

---

**Q3. 카나리 배포가 멈춰 있습니다. 수동으로 프로모션/롤백하는 방법은?**

A: 카나리 배포 상태를 확인하고 수동으로 처리합니다.

```bash
# 카나리 배포 상태 확인 (Flagger 사용 시)
kubectl get canary -n saas-platform
# NAME           STATUS      WEIGHT   LASTTRANSITIONTIME
# auth-service   Progressing 20       2026-04-12T01:30:00Z

# 카나리 상세 상태
kubectl describe canary auth-service -n saas-platform

# 수동 프로모션 (카나리를 프로덕션으로 전환)
kubectl annotate canary auth-service -n saas-platform \
  flagger.app/confirm-rollout=true

# 수동 롤백 (카나리 중단, 이전 버전 유지)
kubectl annotate canary auth-service -n saas-platform \
  flagger.app/confirm-rollback=true
```

**카나리 단계별 트래픽 분배 확인:**

```bash
# 현재 트래픽 비율 확인
kubectl get virtualservice auth-service-vs -n saas-platform -o yaml | grep weight

# 카나리 메트릭 확인 (에러율, 레이턴시)
kubectl get canaryanalysis -n saas-platform
```

💡 카나리가 Progressing 상태에서 오래 멈춰 있는 이유:
- 메트릭 임계값 미충족 (에러율 > 5%, P99 레이턴시 > 2000ms)
- Prometheus가 응답하지 않아 메트릭 수집 실패
- 분석 간격(interval)보다 짧은 시간에 판단하려고 기다리는 중

---

**Q4. 핫픽스를 스테이징 없이 프로덕션에 바로 올릴 수 있나요?**

A: 원칙적으로 스테이징을 거쳐야 합니다. 하지만 P1 장애 상황에서는 예외 절차를 따릅니다.

**P1 장애 시 핫픽스 예외 절차**

```bash
# 1. 팀장 및 PM 승인 확보 (슬랙/전화 기록 남김)
# "P1 장애로 인해 핫픽스 직배포 승인 요청 — 홍길동 팀장, 김철수 PM"

# 2. hotfix 브랜치 생성
git checkout main
git checkout -b hotfix/fix-login-crash

# 3. 최소한의 수정만 적용
# ... 코드 수정 ...

# 4. 로컬에서 테스트
pnpm test --filter=auth-service

# 5. main에 직접 머지 (스테이징 건너뜀)
git checkout main
git merge hotfix/fix-login-crash
git tag v1.2.4-hotfix
git push origin main
git push origin v1.2.4-hotfix

# 6. Gitea Actions 파이프라인 완료 확인
# → .gitea/workflows/hotfix.yml 이 자동으로 프로덕션 배포

# 7. 사후 스테이징 검증 (반드시!)
# 핫픽스 후 정규 스프린트에서 stg에도 동일 수정 적용 확인
```

⚠️ 핫픽스 직배포 후 CSAP D-06 감사 로그에 예외 배포 기록을 남겨야 합니다.

```bash
# 감사 로그 수동 기록
cat >> /data/ai-saas/.claude/audit.jsonl << 'EOF'
{"timestamp":"2026-04-12T02:15:00Z","action":"HOTFIX_DEPLOY_WITHOUT_STAGING","actor":"hong-gildong","reason":"P1 장애 — 로그인 전체 불가","approver":"team-lead-kim","commit":"abc123","approved":true}
EOF
```

---

**Q5. 배포 승인이 필요한 경우 승인자가 없을 때 어떻게 하나요?**

A: 승인자 부재 시 에스컬레이션 체계를 따릅니다.

**에스컬레이션 순서**

```
1. 직속 팀장 (전화, 슬랙)
    ↓ 응답 없음 (10분)
2. 차상위 팀장 또는 PM
    ↓ 응답 없음 (10분)
3. 비상 연락망의 다음 담당자
    ↓ 응답 없음 (10분)
4. P1 장애인 경우: 온콜 담당자 단독 승인으로 진행 + 사후 보고 의무
5. P2 이하: 배포 보류, 다음 업무 시간까지 대기
```

**긴급 배포 자기 승인 기록 (P1 전용)**

```bash
# 단독 승인 사유 기록 (반드시 남겨야 함)
cat >> /data/ai-saas/.claude/audit.jsonl << 'EOF'
{"timestamp":"2026-04-12T03:00:00Z","action":"SELF_APPROVED_DEPLOY","actor":"on-call-engineer","reason":"P1 장애, 승인자 미응답 30분, 에스컬레이션 체계 소진","severity":"P1","post_incident_review":"required"}
EOF
```

---

**Q6. 동시에 두 팀이 배포하면 충돌이 나나요?**

A: GitOps(Flux) 방식에서는 충돌이 발생할 수 있습니다. 이를 예방하는 방법을 설명합니다.

**충돌 시나리오와 예방책**

```bash
# 문제 시나리오:
# 팀A: auth-service 이미지 태그를 v1.2 → v1.3 으로 변경 후 push
# 팀B: auth-service 환경 변수를 추가 후 push (동시에)
# → git merge 충돌 발생

# 예방책 1: 배포 전 배포 중임을 운영 채널에 공지
# "[배포 시작] auth-service v1.3 — 팀A / 완료까지 약 10분"

# 예방책 2: 서로 다른 서비스 배포라면 충돌 없음
# 팀A: auth-service 배포
# 팀B: billing-service 배포  ← 다른 Deployment이므로 충돌 없음

# 예방책 3: Flux의 서비스별 HelmRelease 분리
flux get helmreleases -n saas-platform
# 각 서비스가 독립적인 HelmRelease를 가지면 서로 영향 없음
```

**충돌 발생 시 해결**

```bash
# git 충돌 해결 후 재push
git pull origin stg
# 충돌 파일 수동 수정
git add .
git commit -m "fix: merge conflict between team-a and team-b deployments"
git push origin stg

# Flux 상태 확인
flux reconcile kustomization saas-platform
```

---

## 2. 데이터베이스 운영

---

**Q7. DB 마이그레이션을 되돌려야 합니다. 어떻게 하나요?**

A: Prisma 마이그레이션 롤백은 지원하지 않습니다. 별도 절차가 필요합니다.

```bash
# 현재 마이그레이션 상태 확인
npx prisma migrate status

# 마이그레이션 이력 확인
ls platform/services/auth-service/prisma/migrations/

# 방법 1: 역방향 SQL 작성 (권장)
# 예: 컬럼 추가를 되돌리려면
cat << 'EOF' > /tmp/rollback.sql
-- 마이그레이션 롤백: 20260412_add_column_xxx
ALTER TABLE "users" DROP COLUMN IF EXISTS "new_column";
EOF

# PostgreSQL에 직접 실행
kubectl exec -n saas-platform postgres-0 -- \
  psql -U saas_user -d saas_platform -f /tmp/rollback.sql

# 방법 2: 새 마이그레이션으로 변경 되돌리기 (코드로 관리)
# prisma/migrations/20260412_rollback_xxx/migration.sql 작성
```

⚠️ 데이터가 있는 컬럼을 DROP하면 데이터가 삭제됩니다. 반드시 백업 후 진행하세요.

```bash
# 롤백 전 대상 데이터 백업
kubectl exec -n saas-platform postgres-0 -- \
  pg_dump -U saas_user -d saas_platform -t users --data-only \
  > /tmp/users_backup_$(date +%Y%m%d_%H%M%S).sql
```

---

**Q8. DB 용량이 80%입니다. 급하게 늘리는 방법은?**

A: 즉각적인 임시 조치와 근본적인 해결책을 함께 적용합니다.

**즉시 여유 공간 확보 (임시)**

```bash
# 1. 현재 DB 용량 확인
kubectl exec -n saas-platform postgres-0 -- \
  psql -U saas_user -d saas_platform -c "
  SELECT
    pg_size_pretty(pg_database_size('saas_platform')) AS db_size,
    pg_size_pretty(pg_total_relation_size('audit_logs')) AS audit_size,
    pg_size_pretty(pg_total_relation_size('events')) AS events_size;
  "

# 2. 오래된 감사 로그 아카이브 (1년 이전 데이터)
# 주의: CSAP D-06에 따라 1년 보존 필수 — 아카이브 후 삭제
kubectl exec -n saas-platform postgres-0 -- \
  psql -U saas_user -d saas_platform -c "
  -- 아카이브 테이블로 이동 (삭제 전 백업)
  INSERT INTO audit_logs_archive
  SELECT * FROM audit_logs
  WHERE created_at < NOW() - INTERVAL '1 year';

  DELETE FROM audit_logs
  WHERE created_at < NOW() - INTERVAL '1 year';
  "

# 3. VACUUM으로 실제 디스크 공간 회수
kubectl exec -n saas-platform postgres-0 -- \
  psql -U saas_user -d saas_platform -c "VACUUM FULL VERBOSE;"
```

**PVC 용량 증설 (영구 해결)**

```bash
# 현재 PVC 용량 확인
kubectl get pvc -n saas-platform | grep postgres

# PVC 용량 증설 (StorageClass가 allowVolumeExpansion: true 이어야 함)
kubectl patch pvc postgres-pvc -n saas-platform \
  --type='json' -p='[{"op":"replace","path":"/spec/resources/requests/storage","value":"100Gi"}]'

# 증설 상태 확인 (몇 분 소요)
kubectl get pvc postgres-pvc -n saas-platform -w
```

---

**Q9. 특정 쿼리가 DB를 잠그고 있습니다. 강제 종료하는 방법은?**

A: 잠금 중인 쿼리를 찾아 안전하게 종료합니다.

```bash
# 1. 현재 실행 중인 쿼리 목록 확인
kubectl exec -n saas-platform postgres-0 -- \
  psql -U saas_user -d saas_platform -c "
  SELECT
    pid,
    now() - pg_stat_activity.query_start AS duration,
    query,
    state
  FROM pg_stat_activity
  WHERE (now() - pg_stat_activity.query_start) > interval '5 minutes'
  ORDER BY duration DESC;
  "

# 2. 잠금 현황 확인 (blocking 쿼리 찾기)
kubectl exec -n saas-platform postgres-0 -- \
  psql -U saas_user -d saas_platform -c "
  SELECT
    blocked_locks.pid AS blocked_pid,
    blocking_locks.pid AS blocking_pid,
    blocked_activity.query AS blocked_statement,
    blocking_activity.query AS current_statement_in_blocking_process
  FROM pg_catalog.pg_locks blocked_locks
  JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
  JOIN pg_catalog.pg_locks blocking_locks
    ON blocking_locks.locktype = blocked_locks.locktype
    AND blocking_locks.DATABASE IS NOT DISTINCT FROM blocked_locks.DATABASE
    AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
    AND blocking_locks.pid != blocked_locks.pid
  JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
  WHERE NOT blocked_locks.GRANTED;
  "

# 3. 특정 PID 강제 종료 (pg_terminate_backend)
# 주의: 실행 중인 트랜잭션이 롤백됩니다
kubectl exec -n saas-platform postgres-0 -- \
  psql -U saas_user -d saas_platform -c "
  SELECT pg_terminate_backend(12345);  -- 12345는 위에서 확인한 blocking_pid
  "
```

⚠️ `pg_terminate_backend`는 해당 세션의 모든 트랜잭션을 롤백합니다. 중요한 작업이 진행 중이라면 신중하게 판단하십시오.

---

**Q10. PITR로 특정 시점으로 복구하는 절차는?**

A: Point-In-Time Recovery(PITR)는 데이터 손실 사고 시 사용하는 최후의 수단입니다.

```bash
# 1. 복구할 시점 결정 (데이터 손실 발생 직전 시각)
# 예: 2026-04-12T02:30:00Z (UTC)

# 2. WAL 아카이브 위치 확인 (백업이 있는지)
kubectl exec -n saas-platform postgres-0 -- \
  psql -U saas_user -c "SHOW archive_status;"

# 3. 복구 대상 DB를 임시 이름으로 새 인스턴스에 복원
# (운영 DB를 직접 건드리면 안 됨 — 검증 후 교체)
kubectl apply -f - << 'EOF'
apiVersion: v1
kind: Pod
metadata:
  name: postgres-recovery
  namespace: saas-platform
spec:
  containers:
  - name: postgres
    image: postgres:15
    env:
    - name: PGDATA
      value: /var/lib/postgresql/data
    command:
    - postgres
    - -c
    - restore_command=cp /wal-archive/%f %p
    - -c
    - recovery_target_time=2026-04-12 02:30:00 UTC
    - -c
    - recovery_target_action=promote
EOF

# 4. 복원된 DB에서 데이터 검증
kubectl exec -n saas-platform postgres-recovery -- \
  psql -U saas_user -d saas_platform -c "SELECT COUNT(*) FROM users;"

# 5. 검증 완료 후 운영 DB 교체 (팀장 승인 필수)
# → 이 단계는 반드시 DBA 또는 시니어 엔지니어와 함께 진행
```

💡 PITR은 사전에 `archive_mode = on`과 `archive_command` 설정이 되어 있어야 합니다. 사전 설정 여부를 지금 확인해두세요.

---

**Q11. 테넌트 데이터를 완전히 삭제하는 절차는? (GDPR/개인정보보호법)**

A: 테넌트 데이터 삭제는 법적 의무사항이며, 4단계 절차를 반드시 따라야 합니다.

```bash
export TENANT_ID="삭제할-테넌트-ID"

# 1. 법적 요건 확인 (팀장 + 법무팀 승인)
# - 개인정보보호법: 삭제 요청 후 5일 이내 처리 의무
# - CSAP: 삭제 이력 감사 로그 3년 보존 필수
# - 재무 데이터: 세금계산서는 5년 보존 의무 (세법) → 익명화만 가능

# 2. 삭제 전 아카이브 (재무 데이터)
kubectl exec -n saas-platform postgres-0 -- \
  psql -U saas_user -d saas_platform -c "
  -- 인보이스는 삭제 불가 (세법 5년 보존) → 테넌트 정보만 익명화
  UPDATE invoices
  SET tenant_display_name = '(삭제된 기관)'
  WHERE subscription_id IN (
    SELECT id FROM subscriptions WHERE tenant_id = '${TENANT_ID}'
  );
  "

# 3. 개인정보 데이터 삭제 (사용자 PII)
kubectl exec -n saas-platform postgres-0 -- \
  psql -U saas_user -d saas_platform -c "
  BEGIN;

  -- 사용자 개인정보 삭제 (이름, 이메일, 전화번호)
  DELETE FROM users WHERE tenant_id = '${TENANT_ID}';

  -- 감사 로그 익명화 (삭제 대신 익명화 — 감사 이력 유지)
  UPDATE audit_logs
  SET actor_id = '(삭제된-사용자)',
      metadata = '{}'
  WHERE tenant_id = '${TENANT_ID}';

  -- 구독 취소 (데이터 보존)
  UPDATE subscriptions
  SET status = 'CANCELED',
      canceled_at = NOW()
  WHERE tenant_id = '${TENANT_ID}';

  COMMIT;
  "

# 4. 삭제 감사 로그 기록 (CSAP D-06 필수)
cat >> /data/ai-saas/.claude/audit.jsonl << EOF
{"timestamp":"$(date -u +%Y-%m-%dT%H:%M:%SZ)","action":"TENANT_DATA_DELETED","actor":"$(whoami)","target":"${TENANT_ID}","reason":"개인정보 삭제 요청 (법적 의무)","approver":"팀장-이름","legal_basis":"개인정보보호법 제36조"}
EOF
```

---

## 3. 보안 사고 대응

---

**Q12. JWT 토큰이 탈취된 것 같습니다. 즉시 해야 할 일은?**

A: JWT 토큰 탈취는 P1 보안 사고입니다. 즉시 다음 순서로 대응합니다.

**즉시 대응 (0~10분)**

```bash
# 1. 탈취 범위 파악 — 어떤 토큰인지 확인
# 특정 사용자? 전체 사용자? 서비스 간 내부 토큰?

# 2. 즉시 JWT 시크릿 교체 (접근 토큰 전체 무효화)
# 주의: 모든 로그인 사용자가 강제 로그아웃됩니다
kubectl create secret generic jwt-secret \
  --from-literal=JWT_SECRET=$(openssl rand -base64 64) \
  -n saas-platform \
  --dry-run=client -o yaml | kubectl apply -f -

# 3. auth-service 재시작 (새 시크릿 적용)
kubectl rollout restart deployment/auth-service -n saas-platform

# 4. 재시작 완료 확인
kubectl rollout status deployment/auth-service -n saas-platform
```

**원인 조사 (10~30분)**

```bash
# 탈취 토큰으로 어떤 API가 호출됐는지 확인
kubectl logs -n saas-platform -l app=api-gateway --since=1h | \
  grep "탈취된-사용자-ID\|탈취된-IP" | head -50

# 이상 접근 IP 차단 (WAF 또는 NetworkPolicy)
kubectl apply -f - << 'EOF'
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: block-suspicious-ip
  namespace: saas-platform
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  ingress:
  - from:
    - ipBlock:
        cidr: 0.0.0.0/0
        except:
        - 악성.IP.주소/32  # 차단할 IP
EOF
```

**사고 보고 (30분 이내)**

```bash
# CSAP D-06 침해사고 보고서 작성 필수
cat >> /data/ai-saas/.claude/audit.jsonl << EOF
{"timestamp":"$(date -u +%Y-%m-%dT%H:%M:%SZ)","action":"SECURITY_INCIDENT_JWT_STOLEN","severity":"P1","affected_user":"user-id","action_taken":"JWT_SECRET_ROTATED","reporter":"$(whoami)"}
EOF
```

---

**Q13. Falco 알림이 왔습니다. 어떻게 판단하나요?**

A: Falco 알림은 심각도별로 다르게 대응합니다.

```bash
# Falco 알림 확인
kubectl logs -n security-monitor -l app=falco | grep CRITICAL | tail -20

# 알림 예시별 판단 기준:

# 알림 1: "Terminal shell in container"
# → 누군가 kubectl exec으로 컨테이너에 접속
# → 판단: 운영 목적인지 확인 (로그 타임스탬프와 담당자 접속 기록 대조)
# → 운영 목적 아니면 즉시 해당 세션 종료 + P1 선언

# 알림 2: "Suspicious outbound connection"
# → 컨테이너가 외부 IP에 연결 시도
# → 판단: 허용된 외부 서비스(AI 게이트웨이, SMTP)인지 확인
# → 허용 목록에 없으면 NetworkPolicy로 차단 + 조사

# 알림 3: "Write below binary dir"
# → /usr/bin 같은 시스템 디렉터리에 파일 쓰기
# → 판단: 거의 항상 이상 → P1 선언, 해당 Pod 즉시 격리
kubectl delete pod <의심-pod> -n saas-platform
```

**Falco 오탐 처리**

```bash
# 운영상 정상인 동작이 알림으로 오는 경우 예외 규칙 추가
# /etc/falco/falco_rules.local.yaml에 예외 추가
# → 단, 예외 추가는 반드시 코드 리뷰를 거쳐야 함
```

---

**Q14. 사용자가 다른 테넌트 데이터를 봤다고 신고했습니다. 어떻게 하나요?**

A: 테넌트 간 데이터 유출은 CSAP 위반 가능성이 있는 P1 사고입니다.

**즉시 대응**

```bash
# 1. 해당 사용자의 최근 API 호출 로그 확인
kubectl logs -n saas-platform -l app=api-gateway --since=2h | \
  grep "신고한-사용자-ID" | grep -v "본인-테넌트-ID"

# 2. 타 테넌트 데이터 접근 여부 확인
kubectl exec -n saas-platform postgres-0 -- \
  psql -U saas_user -d saas_platform -c "
  SELECT * FROM audit_logs
  WHERE actor_id = '신고한-사용자-ID'
    AND tenant_id != '본인-테넌트-ID'
    AND created_at > NOW() - INTERVAL '24 hours'
  ORDER BY created_at DESC;
  "

# 3. 해당 사용자 세션 즉시 무효화 (조사 중 추가 접근 차단)
# auth-service에서 특정 사용자 토큰 블랙리스트 처리
curl -X POST http://localhost:3001/auth/revoke-user \
  -H "x-internal-service-key: ${INTERNAL_SERVICE_KEY}" \
  -d '{"userId": "신고한-사용자-ID"}'
```

**원인 분석**

- 테넌트 격리 로직(x-user-tenant-id 헤더 검사) 버그인가?
- API 게이트웨이의 헤더 주입 오류인가?
- 특정 API Route Handler의 WHERE 조건 누락인가?

```bash
# API Gateway 헤더 주입 로그 확인
kubectl logs -n saas-platform -l app=api-gateway --since=2h | \
  grep "x-user-tenant-id" | grep "신고한-사용자-ID" | head -10
```

**CSAP 보고 의무 (D-06)**

데이터 유출이 확인되면 72시간 이내 개인정보보호위원회에 신고해야 할 수 있습니다.

---

**Q15. 취약한 패키지가 발견되었습니다. 얼마나 빨리 패치해야 하나요?**

A: 심각도(CVSS Score)에 따라 패치 기한이 달라집니다.

| CVSS Score | 심각도 | 패치 기한 | 대응 방법 |
|-----------|--------|---------|---------|
| 9.0 ~ 10.0 | Critical | 24시간 이내 | 즉시 패치 또는 서비스 중단 |
| 7.0 ~ 8.9 | High | 72시간 이내 | 긴급 패치 릴리스 |
| 4.0 ~ 6.9 | Medium | 7일 이내 | 정규 스프린트 포함 |
| 0 ~ 3.9 | Low | 30일 이내 | 다음 스프린트 |

```bash
# 취약점 스캔
pnpm audit

# 자동 패치 (major 버전 제외)
pnpm audit --fix

# 특정 패키지 강제 업데이트
pnpm add 취약한-패키지@latest

# 패치 후 테스트
pnpm test

# Trivy로 컨테이너 이미지 취약점 스캔
trivy image public-saas/auth-service:latest --severity HIGH,CRITICAL
```

💡 공급망 보안(Supply Chain Security): `pnpm-lock.yaml`은 반드시 git에 커밋하여 의존성 버전을 고정합니다.

---

**Q16. 감사 로그가 비어 있습니다. CSAP 위반인가요?**

A: 비어 있는 기간에 따라 다르게 판단합니다.

```bash
# 감사 로그 현황 확인
kubectl logs -n saas-platform -l app=compliance-service --since=1h | grep "audit"

# audit.jsonl 최근 기록 확인
tail -20 /data/ai-saas/.claude/audit.jsonl

# 감사 로그 DB 테이블 확인
kubectl exec -n saas-platform postgres-0 -- \
  psql -U saas_user -d saas_platform -c "
  SELECT
    date_trunc('hour', created_at) AS hour,
    COUNT(*) AS log_count
  FROM audit_logs
  WHERE created_at > NOW() - INTERVAL '6 hours'
  GROUP BY 1
  ORDER BY 1 DESC;
  "
```

**판단 기준:**

| 공백 기간 | 판단 | 조치 |
|---------|-----|------|
| 5분 미만 | 일시적 지연 (허용 가능) | 모니터링 유지 |
| 5~30분 | P2 — 감사 로그 공백 | 원인 조사 + 복구 |
| 30분 이상 | CSAP D-06 위반 위험 | 즉시 P1 선언 + CSAP 담당자 보고 |

```bash
# 감사 로그 서비스 재시작 (로그 공백 원인이 서비스 장애인 경우)
kubectl rollout restart deployment/compliance-service -n saas-platform

# 공백 기간의 감사 로그를 수동으로 보완 기록 (근거 문서 첨부 필수)
# → CSAP 감리 시 공백 사유서 제출 가능
```

---

## 4. 성능 긴급 대응

---

**Q17. CPU가 100%입니다. 지금 당장 Pod를 늘리는 방법은?**

A: 즉각적인 수평 확장과 원인 조사를 동시에 진행합니다.

```bash
# 1. 어떤 서비스가 CPU를 많이 쓰는지 확인
kubectl top pods -n saas-platform --sort-by=cpu | head -10

# 2. 즉시 수평 확장 (HPA 최대값 초과는 불가)
kubectl scale deployment auth-service -n saas-platform --replicas=5

# 또는 HPA 최대 한도를 일시 조정
kubectl patch hpa auth-service-hpa -n saas-platform \
  --type='json' -p='[{"op":"replace","path":"/spec/maxReplicas","value":10}]'

# 3. 확장 완료 확인
kubectl rollout status deployment/auth-service -n saas-platform
kubectl get pods -n saas-platform -l app=auth-service
```

**원인 조사 (확장 후 병행)**

```bash
# 높은 CPU 유발 쿼리 또는 엔드포인트 확인
kubectl logs -l app=auth-service -n saas-platform --since=5m | \
  grep -E "duration.*[5-9][0-9]{3}|duration.*[0-9]{5}" | head -20

# Prometheus 메트릭에서 원인 API 확인 (Grafana 대시보드 또는 curl)
curl http://localhost:9090/api/v1/query \
  --data-urlencode 'query=rate(http_requests_total{job="auth-service"}[5m])' | \
  jq '.data.result | sort_by(.value[1]) | reverse | .[:5]'
```

---

**Q18. 디스크가 꽉 찼습니다. 어떻게 정리하나요?**

A: 단계별로 즉각 정리합니다.

```bash
# 1. 어느 경로가 많이 차지하는지 확인
kubectl exec -n saas-platform postgres-0 -- df -h
kubectl exec -n saas-platform -l app=ai-service -- du -sh /tmp /var/log /app/uploads 2>/dev/null

# 2. Docker/컨테이너 이미지 캐시 정리 (k3s 노드에서)
sudo k3s crictl images | grep "<none>" | awk '{print $3}' | xargs sudo k3s crictl rmi

# 또는
sudo k3s crictl rmi --prune

# 3. Pod 로그 사이즈 확인 및 정리
kubectl logs -n saas-platform <무거운-pod> | wc -c
# → 로그가 너무 크면 로그 로테이션 설정 확인

# 4. 오래된 Job/완료된 Pod 정리
kubectl delete pods -n saas-platform \
  --field-selector=status.phase=Succeeded
kubectl delete pods -n saas-platform \
  --field-selector=status.phase=Failed

# 5. 임시 파일 정리 (ai-service 업로드 임시 파일)
kubectl exec -n saas-platform -l app=ai-service -- \
  find /tmp -mtime +1 -delete
```

---

**Q19. Prometheus가 응답하지 않습니다. 어떻게 하나요?**

A: Prometheus 장애는 모니터링 불능 상태를 의미하므로 빠르게 복구합니다.

```bash
# 1. Prometheus Pod 상태 확인
kubectl get pods -n monitoring -l app=prometheus

# 2. 로그 확인
kubectl logs -n monitoring -l app=prometheus --previous | tail -50

# 3. 흔한 원인: TSDB 디스크 꽉 참
kubectl exec -n monitoring prometheus-0 -- df -h /prometheus
# 해결: 오래된 데이터 삭제 설정 확인
kubectl get prometheus -n monitoring -o yaml | grep retention

# 4. Prometheus 재시작
kubectl rollout restart statefulset/prometheus -n monitoring

# 5. 재시작 후 상태 확인
kubectl rollout status statefulset/prometheus -n monitoring
curl http://localhost:9090/-/healthy

# 6. Prometheus 없는 상태에서 임시 모니터링
# kubectl top으로 기본 메트릭 확인 (Prometheus 없이도 동작)
kubectl top pods -n saas-platform
kubectl top nodes
```

⚠️ Prometheus가 다운된 상태에서 알림(Alertmanager)도 작동하지 않습니다. 장애 발생 시 수동 모니터링으로 전환하고 팀에 공지하세요.

---

**Q20. AI 서비스 응답이 30초 넘게 걸립니다. 원인은?**

A: AI 서비스 지연의 원인을 단계별로 추적합니다.

```bash
# 1. ai-service Pod 상태와 자원 사용량
kubectl top pods -n saas-platform -l app=ai-service
kubectl logs -l app=ai-service -n saas-platform --since=5m | grep -E "timeout|slow|error"

# 2. AI 게이트웨이 응답 시간 확인
time curl http://localhost:3010/ai/health

# 3. 외부 AI API 응답 시간 확인 (ai-service가 호출하는 API)
kubectl exec -n saas-platform -l app=ai-service -- \
  curl -o /dev/null -w "%{time_total}" https://ai-gateway.internal/health

# 4. 벡터 DB(vector-store) 조회 시간 확인 (RAG 지연 원인)
kubectl logs -l app=ai-service -n saas-platform --since=5m | \
  grep "vector_search" | grep -E "[0-9]{4,}ms"
```

**원인별 대응:**

| 원인 | 증상 | 해결책 |
|------|------|--------|
| 외부 AI API 지연 | ai-gateway 응답 > 25초 | 타임아웃 설정, Circuit Breaker 확인 |
| 벡터 검색 느림 | vector_search > 5초 | 인덱스 재구축, 청크 크기 조정 |
| 컨텍스트 너무 큼 | 토큰 수 > 100K | 청킹 설정 조정 |
| ai-service CPU 부족 | CPU 사용률 > 90% | Pod 수평 확장 |

```bash
# Circuit Breaker 상태 확인 (장애 전파 방지)
kubectl logs -l app=ai-service -n saas-platform --since=10m | grep "circuit"
```

---

**Q21. 특정 테넌트만 느립니다. 원인과 조치 방법은?**

A: 테넌트별 격리가 제대로 되어 있는지 확인하고, 해당 테넌트의 사용 패턴을 분석합니다.

```bash
export SLOW_TENANT_ID="느린-테넌트-ID"

# 1. 해당 테넌트의 최근 요청량 확인 (노이지 네이버 현상)
kubectl logs -n saas-platform -l app=api-gateway --since=30m | \
  grep "${SLOW_TENANT_ID}" | wc -l

# 2. 해당 테넌트가 느린 쿼리를 유발하는지 확인
kubectl exec -n saas-platform postgres-0 -- \
  psql -U saas_user -d saas_platform -c "
  SELECT
    query,
    calls,
    mean_exec_time,
    total_exec_time
  FROM pg_stat_statements
  WHERE query LIKE '%${SLOW_TENANT_ID}%'
  ORDER BY mean_exec_time DESC
  LIMIT 10;
  "

# 3. Rate Limit 적용 (해당 테넌트만)
# 현재 rate-limit 설정 확인
kubectl get configmap rate-limit-config -n saas-platform -o yaml

# 4. 해당 테넌트의 구독 한도 확인 (한도 초과 여부)
curl -s http://localhost:3004/subscription/tenants/${SLOW_TENANT_ID} \
  -H "x-user-role: SUPER_ADMIN" \
  -H "x-internal-service-key: ${INTERNAL_SERVICE_KEY}" | \
  jq '.data | {status, plan}'
```

---

## 5. 일반 운영

---

**Q22. 시크릿을 갱신해야 합니다. 다운타임 없이 교체하는 방법은?**

A: 시크릿 교체는 롤링 업데이트를 활용하여 무중단으로 진행합니다.

```bash
# 절대 금지: .env 파일이나 코드에 시크릿 하드코딩
# 절대 금지: git에 시크릿 커밋

# 1. 새 시크릿 값 생성
NEW_JWT_SECRET=$(openssl rand -base64 64)

# 2. Kubernetes Secret 업데이트
kubectl create secret generic jwt-secret \
  --from-literal=JWT_SECRET="${NEW_JWT_SECRET}" \
  -n saas-platform \
  --dry-run=client -o yaml | kubectl apply -f -

# 3. 시크릿 업데이트 확인
kubectl get secret jwt-secret -n saas-platform -o jsonpath='{.metadata.resourceVersion}'

# 4. 롤링 재시작 (모든 Pod가 새 시크릿 읽도록)
kubectl rollout restart deployment/auth-service -n saas-platform

# 5. 무중단 확인 (롤링 업데이트 진행 중 서비스 응답 확인)
while kubectl rollout status deployment/auth-service -n saas-platform | grep -v "successfully"; do
  curl -s http://localhost:3001/health/ping
  sleep 2
done
```

**내부 서비스 키 교체 시 주의사항:**

```bash
# INTERNAL_SERVICE_KEY는 모든 서비스가 동시에 교체해야 함
# 순서가 잘못되면 서비스 간 인증 실패 발생

# 올바른 교체 순서:
# 1. 새 키로 Secret 업데이트
# 2. api-gateway 재시작 (헤더 주입 담당)
# 3. 각 백엔드 서비스 재시작 (순서 무관)
```

---

**Q23. 서비스 점검 공지 없이 잠깐 내려야 합니다. 방법은?**

A: 가능한 한 무중단이 원칙이지만, 불가피한 경우 절차를 따릅니다.

```bash
# 방법 1: Maintenance 페이지로 트래픽 전환 (권장)
kubectl apply -f - << 'EOF'
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: saas-maintenance
  namespace: saas-platform
  annotations:
    nginx.ingress.kubernetes.io/custom-http-errors: "503"
    nginx.ingress.kubernetes.io/default-backend: maintenance-page
spec:
  # 기존 Ingress를 503으로 대체
EOF

# 방법 2: Replica를 0으로 설정 (서비스 완전 중단)
kubectl scale deployment auth-service -n saas-platform --replicas=0
# 작업 완료 후 복원
kubectl scale deployment auth-service -n saas-platform --replicas=2

# 방법 3: Ingress 규칙으로 특정 IP만 허용 (관리자만 접근 가능)
kubectl annotate ingress saas-ingress -n saas-platform \
  nginx.ingress.kubernetes.io/whitelist-source-range="관리자-IP/32"
```

⚠️ CSAP D-10(서비스 가용성) 요건에 따라 예정된 점검도 사전에 공지해야 합니다. 공지 없는 중단은 CSAP 감리 시 지적 사항이 됩니다.

---

**Q24. 새 개발자에게 k3s 클러스터 접근 권한을 주는 방법은?**

A: 최소 권한 원칙(Principle of Least Privilege)에 따라 역할별로 접근 권한을 부여합니다.

```bash
# 1. 새 개발자용 ServiceAccount 생성
kubectl create serviceaccount dev-hong -n saas-platform

# 2. 역할에 맞는 ClusterRole 바인딩
# (개발자는 읽기 + 로그 조회만, 운영자는 쓰기 포함)

# 개발자용 (읽기 전용)
kubectl create rolebinding dev-hong-readonly \
  -n saas-platform \
  --clusterrole=view \
  --serviceaccount=saas-platform:dev-hong

# 운영자용 (전체 권한)
kubectl create rolebinding ops-kim-fullaccess \
  -n saas-platform \
  --clusterrole=admin \
  --serviceaccount=saas-platform:ops-kim

# 3. kubeconfig 생성 및 배포
kubectl create token dev-hong -n saas-platform --duration=8760h > /tmp/dev-hong-token

# 4. kubeconfig 파일 생성
cat > /tmp/dev-hong-kubeconfig.yaml << EOF
apiVersion: v1
kind: Config
clusters:
- cluster:
    server: https://k3s-server-ip:6443
    certificate-authority-data: $(kubectl config view --raw --minify --flatten -o jsonpath='{.clusters[].cluster.certificate-authority-data}')
  name: saas-cluster
contexts:
- context:
    cluster: saas-cluster
    user: dev-hong
    namespace: saas-platform
  name: saas-dev-hong
current-context: saas-dev-hong
users:
- name: dev-hong
  user:
    token: $(cat /tmp/dev-hong-token)
EOF

# 5. 권한 부여 기록 (CSAP D-08 — 접근 제어 감사)
cat >> /data/ai-saas/.claude/audit.jsonl << EOF
{"timestamp":"$(date -u +%Y-%m-%dT%H:%M:%SZ)","action":"CLUSTER_ACCESS_GRANTED","actor":"admin","target":"dev-hong","role":"view","namespace":"saas-platform","approver":"팀장"}
EOF
```

---

**Q25. CSAP 감리관이 지금 당장 증거를 요청합니다. 어떻게 하나요?**

A: 감리관 요청에는 즉시 대응할 수 있도록 증거를 미리 준비된 위치에서 제공합니다.

**즉시 제공 가능한 증거 목록**

```bash
# 1. 감사 로그 (CSAP D-06)
# audit.jsonl — 모든 민감 작업 기록
cat /data/ai-saas/.claude/audit.jsonl | \
  jq -c 'select(.timestamp >= "2026-01-01")' | head -100

# 또는 DB의 audit_logs 테이블
kubectl exec -n saas-platform postgres-0 -- \
  psql -U saas_user -d saas_platform -c "
  SELECT actor_id, action, target, tenant_id, created_at
  FROM audit_logs
  WHERE created_at > NOW() - INTERVAL '90 days'
  ORDER BY created_at DESC
  LIMIT 1000;
  " --csv > /tmp/audit_logs_90days.csv

# 2. CSAP 79항목 준수 현황
curl -s http://localhost:3000/api/compliance/csap \
  -H "x-user-role: SUPER_ADMIN" | \
  jq '.data' > /tmp/csap_compliance_$(date +%Y%m%d).json

# 3. 접근 권한 현황 (D-08)
kubectl get rolebinding,clusterrolebinding -n saas-platform -o yaml > \
  /tmp/access_control_$(date +%Y%m%d).yaml

# 4. 암호화 설정 확인 (D-09)
# TLS 인증서 상태
kubectl get certificate -n saas-platform

# 5. 최근 배포 이력
git log --oneline --format="%H %ae %ad %s" --date=short -100 > \
  /tmp/deploy_history.txt

# 6. 취약점 스캔 결과
pnpm audit --json > /tmp/vulnerability_scan_$(date +%Y%m%d).json
```

**감리관 현장 대응 체크리스트**

```
[ ] CSAP D-06: 감사 로그 90일치 출력 가능
[ ] CSAP D-08: 역할별 접근 제어 현황 제시
[ ] CSAP D-09: TLS 인증서 만료일 및 암호화 알고리즘 확인
[ ] CSAP D-12: 입력 검증 코드(Zod) 및 테스트 결과 제시
[ ] CSAP D-10: SLO 가용성 메트릭 (Grafana 대시보드 공유)
[ ] 인시던트 이력: 발생한 장애의 사후 검토 문서
[ ] 변경 이력: git 커밋 이력 (기능 추가, 보안 패치)
```

**30분 안에 감리 보고서 생성**

```bash
# CSAP 증거 패키지 자동 수집 스크립트
mkdir -p /tmp/csap_evidence_$(date +%Y%m%d)
cd /tmp/csap_evidence_$(date +%Y%m%d)

# 모든 증거 한 번에 수집
cat /data/ai-saas/.claude/audit.jsonl > audit_logs.jsonl
git -C /data/ai-saas log --oneline -200 > git_history.txt
kubectl get all -n saas-platform > k8s_resources.txt
kubectl get certificate,secret -n saas-platform -o name > secrets_certs.txt
pnpm --prefix /data/ai-saas audit --json > vulnerability_scan.json 2>/dev/null || true

# 압축하여 제출
tar -czf /tmp/csap_evidence_$(date +%Y%m%d).tar.gz .
echo "증거 파일 준비 완료: /tmp/csap_evidence_$(date +%Y%m%d).tar.gz"
```

---

## 6. 학습 체크리스트

### 배포 운영

- [ ] 새벽 배포 시 추가로 확인해야 할 사항(활성 사용자, 배치 작업)을 안다
- [ ] `git revert`로 배포 롤백하는 방법을 알고, Helm 직접 롤백 시 git도 반드시 revert해야 하는 이유를 안다
- [ ] 카나리 배포 수동 프로모션/롤백 명령을 사용할 수 있다
- [ ] 핫픽스 직배포 예외 절차와 사후 감사 로그 기록 의무를 안다
- [ ] 동시 배포 충돌 예방을 위해 운영 채널 공지가 필요한 이유를 안다

### 데이터베이스 운영

- [ ] DB 마이그레이션 롤백이 Prisma에서 자동 지원되지 않아 역방향 SQL을 직접 작성해야 함을 안다
- [ ] `VACUUM FULL`이 실제 디스크 공간을 회수하는 명령임을 안다
- [ ] `pg_terminate_backend`로 잠금 세션을 종료하면 해당 트랜잭션이 롤백됨을 안다
- [ ] 테넌트 데이터 삭제 시 세금계산서는 세법상 5년 보존 의무로 삭제 불가임을 안다

### 보안 사고 대응

- [ ] JWT 시크릿 교체 시 모든 사용자가 강제 로그아웃됨을 안다
- [ ] Falco 알림 중 "Terminal shell in container"가 정상/비정상인지 판단하는 방법을 안다
- [ ] 테넌트 간 데이터 유출 신고 시 72시간 이내 개인정보보호위원회 신고 의무가 있음을 안다
- [ ] CVSS Score 9.0 이상 취약점은 24시간 이내 패치 기한임을 안다
- [ ] 감사 로그 30분 이상 공백은 CSAP D-06 위반 위험임을 안다

### 성능 긴급 대응

- [ ] `kubectl scale` 명령으로 즉시 Pod를 늘리는 방법을 안다
- [ ] 디스크 정리 시 완료된 Job/Pod를 삭제하는 명령을 안다
- [ ] AI 서비스 지연의 4가지 원인(외부 API 지연, 벡터 검색, 컨텍스트 크기, CPU 부족)을 안다

### 일반 운영

- [ ] 시크릿 교체 후 롤링 재시작을 해야 하는 이유를 안다
- [ ] 새 개발자 접근 권한 부여 후 감사 로그에 기록해야 하는 이유를 안다
- [ ] CSAP 감리관 요청 시 30분 안에 증거 패키지를 생성하는 스크립트를 실행할 수 있다

---

## 7. 다음 단계

이 FAQ를 읽었다면, 더 심층적인 운영 지식을 위해 다음 문서를 학습하세요.

- **인시던트 관리 전체 절차**: `09-troubleshooting/04-incident-management.md`
- **모니터링 알림 런북**: `05-monitoring/alerting/02-alert-runbooks.md`
- **CSAP 준수 상세**: `11-faq/03-csap-faq.md`
- **인프라 기초 FAQ**: `11-faq/02-infra-faq.md` (Pod 장애, Helm, 네트워크 등)
- **보안 개발 심화**: `03-development/04-advanced-patterns.md`

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-12 | 최초 작성 — 운영 실전 FAQ 25문항 | Implementer (Sonnet) |
