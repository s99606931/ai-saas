# DevOps/인프라 운영 심화 FAQ

> **문서 ID**: ONBOARD-11-DEVOPS
> **버전**: 1.0.0 | **작성일**: 2026-04-12 | **작성자**: Implementer (Sonnet)
> **대상**: DevOps 엔지니어, 인프라 담당자, SRE
> **전제 조건**: `11-faq/02-infra-faq.md` 완료
> **질문 수**: 25개
> **CSAP**: D-08 (접근 통제), D-09 (암호화), D-11 (가상화 보안)
> **Design Ref**: MTU-N244 (CI/CD), MTU-N246 (DevSecOps), MTU-N251 (DORA)

---

## 목차

- [카테고리 1: Kubernetes 고급 운영](#카테고리-1-kubernetes-고급-운영) (Q1~Q6)
- [카테고리 2: CI/CD 고급 운영](#카테고리-2-cicd-고급-운영) (Q7~Q11)
- [카테고리 3: 모니터링 고급 운영](#카테고리-3-모니터링-고급-운영) (Q12~Q16)
- [카테고리 4: 보안 운영](#카테고리-4-보안-운영) (Q17~Q20)
- [카테고리 5: 비용/성능 운영](#카테고리-5-비용성능-운영) (Q21~Q25)
- [변경 이력](#변경-이력)

---

## 카테고리 1: Kubernetes 고급 운영

---

**Q1. etcd 백업은 얼마나 자주 해야 하나요?**

etcd는 k3s 클러스터의 모든 상태(Pod, Service, ConfigMap, Secret 등)를 저장하는 핵심 데이터베이스입니다. etcd가 손상되면 클러스터 전체를 처음부터 재구성해야 합니다.

**권장 백업 주기**:

| 환경 | 주기 | 보존 기간 | 이유 |
|------|------|---------|------|
| 운영(main) | 매 6시간 | 30일 | 운영 중단 최소화 |
| 스테이징(stg) | 매일 | 7일 | 복구 검증 목적 |

**k3s etcd 백업 명령어**:

```bash
# k3s 내장 etcd 스냅샷 생성
sudo k3s etcd-snapshot save \
  --name="etcd-backup-$(date +%Y%m%d-%H%M%S)"

# 스냅샷 목록 확인
sudo k3s etcd-snapshot ls

# 스냅샷 파일 위치 확인
ls -la /var/lib/rancher/k3s/server/db/snapshots/

# 원격 스토리지에 자동 업로드 (S3 호환 MinIO)
sudo k3s etcd-snapshot save \
  --s3 \
  --s3-endpoint="http://minio.infra.svc.cluster.local:9000" \
  --s3-bucket="etcd-backups" \
  --s3-access-key="${MINIO_ACCESS_KEY}" \
  --s3-secret-key="${MINIO_SECRET_KEY}" \
  --name="etcd-$(date +%Y%m%d-%H%M%S)"
```

**자동화 크론잡 설정**:

```bash
# /etc/cron.d/etcd-backup
0 */6 * * * root /usr/local/bin/k3s etcd-snapshot save \
  --name="etcd-auto-$(date +%Y%m%d-%H%M%S)" >> /var/log/etcd-backup.log 2>&1
```

**복구 절차** (긴급 상황):

```bash
# 1. k3s 중지
sudo systemctl stop k3s

# 2. 스냅샷으로 복구 (주의: 현재 상태 모두 덮어쓰기!)
sudo k3s etcd-snapshot restore \
  --cluster-reset \
  --cluster-reset-restore-path="/var/lib/rancher/k3s/server/db/snapshots/etcd-backup-20260412-060000"

# 3. k3s 재시작
sudo systemctl start k3s

# 4. 복구 확인
kubectl get nodes
kubectl get pods -A | grep -v Running
```

**예방법**: etcd 스냅샷을 별도 스토리지(NFS, MinIO)에 보관하고, 분기별로 복구 테스트를 수행하십시오.

**관련 문서**: `04-infrastructure/` 인프라 설정

---

**Q2. k3s 노드 추가/제거 방법은?**

**노드 추가 절차**:

```bash
# Step 1: 마스터 노드에서 조인 토큰 확인
sudo cat /var/lib/rancher/k3s/server/node-token

# Step 2: 새 노드에서 k3s 에이전트 설치
curl -sfL https://get.k3s.io | K3S_URL=https://{MASTER_IP}:6443 \
  K3S_TOKEN="{TOKEN}" sh -s - agent \
  --node-label "role=worker" \
  --node-label "environment=production"

# Step 3: 마스터에서 노드 추가 확인
kubectl get nodes
# NAME        STATUS   ROLES                  AGE   VERSION
# master-1    Ready    control-plane,master   10d   v1.29.x
# worker-1    Ready    <none>                 5m    v1.29.x  ← 새 노드

# Step 4: 노드 레이블 추가 (필요시)
kubectl label node worker-1 disk=ssd
kubectl label node worker-1 zone=az-1
```

**노드 제거 절차**:

```bash
# Step 1: 노드 드레인 (Pod을 다른 노드로 이동)
kubectl drain worker-1 \
  --ignore-daemonsets \
  --delete-emptydir-data \
  --grace-period=120

# Step 2: 드레인 완료 확인
kubectl get pods -A --field-selector spec.nodeName=worker-1
# → 결과 없으면 완료

# Step 3: 노드 삭제
kubectl delete node worker-1

# Step 4: 노드 자체에서 k3s 제거
# (해당 노드에서 실행)
sudo /usr/local/bin/k3s-agent-uninstall.sh
```

**예방법**: 노드 제거 전 해당 노드에 실행 중인 PVC(Persistent Volume Claim)가 있는지 반드시 확인하십시오. `local-path` PV는 노드 삭제 시 데이터가 함께 사라집니다.

---

**Q3. kubectl drain vs cordon 차이와 사용 시점은?**

**개념 차이**:

```
kubectl cordon {노드}:
  - 새로운 Pod 스케줄링 차단
  - 기존에 실행 중인 Pod에는 영향 없음
  - 노드 상태: Ready,SchedulingDisabled

kubectl drain {노드}:
  - cordon 효과 포함
  - 기존 Pod을 다른 노드로 강제 이동
  - 노드 상태: Ready,SchedulingDisabled (이동 완료 후)
```

**사용 시점**:

| 상황 | 명령어 | 이유 |
|------|--------|------|
| 노드 하드웨어 점검 (몇 분 이내) | cordon | 기존 Pod 유지, 새 Pod만 막음 |
| 노드 OS 패치 (재부팅 필요) | drain | 재부팅 전 모든 Pod 이동 필요 |
| 노드 영구 제거 | drain → delete | 안전하게 제거 |
| 특정 노드에 새 Pod 배치 금지 | cordon | 디버깅 목적 |

```bash
# 시나리오: worker-1 노드 OS 패치

# 1. 새 Pod 스케줄링 차단
kubectl cordon worker-1

# 2. 기존 Pod 이동 (drain)
kubectl drain worker-1 \
  --ignore-daemonsets \    # DaemonSet은 이동 불가, 무시
  --delete-emptydir-data \ # emptyDir 데이터 삭제 허용
  --grace-period=300       # Pod 종료 대기 시간 (초)

# 3. OS 패치 수행 (노드 접속)
sudo apt update && sudo apt upgrade -y && sudo reboot

# 4. 재부팅 후 노드 복귀
kubectl uncordon worker-1

# 5. 확인
kubectl get nodes worker-1
# STATUS: Ready (정상)
```

**예방법**: DaemonSet Pod(Prometheus Node Exporter, Falco 등)은 drain으로 이동할 수 없습니다. `--ignore-daemonsets` 옵션을 사용하면 이들을 제외하고 drain합니다.

---

**Q4. Pod Disruption Budget 설정이 필요한 경우는?**

PDB(Pod Disruption Budget)는 유지보수 중에도 최소한의 Pod 가용성을 보장합니다.

**언제 필요한가**:

```
PDB가 없으면:
  drain 명령 실행 시 해당 노드의 모든 Pod이 동시에 종료될 수 있음
  → 서비스 순간 다운타임 발생!

PDB가 있으면:
  "최소 2개 이상의 Pod이 항상 실행 중이어야 함"
  → drain 시 안전하게 하나씩 이동 (무중단)
```

**PDB 설정**:

```yaml
# deploy/base/pdb-auth-service.yaml
# Design Ref: MTU-N244 고가용성 설계

apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: auth-service-pdb
  namespace: saas-platform
spec:
  # 방법 1: 최소 가용 Pod 수 지정
  minAvailable: 2
  # → 최소 2개는 항상 실행 (drain 시 나머지만 이동)

  # 방법 2: 최대 중단 가능 비율 지정 (minAvailable과 택일)
  # maxUnavailable: 25%
  # → 전체의 25%까지만 동시 중단 허용

  selector:
    matchLabels:
      app: auth-service
```

**어떤 서비스에 PDB를 설정해야 하는가**:

```
필수:
  - auth-service (인증 다운 시 전체 서비스 중단)
  - api-gateway (단일 장애 지점)
  - tenant-service (핵심 비즈니스 로직)

권장:
  - 3개 이상 레플리카를 가진 모든 서비스

불필요:
  - 1개 레플리카인 서비스 (PDB가 drain 자체를 막을 수 있음)
  - 상태없는(stateless) 배치 Job
```

**PDB 설정 확인**:

```bash
kubectl get pdb -n saas-platform

# NAME               MIN AVAILABLE   MAX UNAVAILABLE   ALLOWED DISRUPTIONS   AGE
# auth-service-pdb   2               N/A               1                     5d
```

---

**Q5. ResourceQuota와 LimitRange 차이와 설정 방법은?**

**개념 차이**:

```
ResourceQuota:
  → 네임스페이스 전체 리소스 총량 제한
  → "이 팀(네임스페이스)은 CPU 40코어, 메모리 80Gi까지만 사용 가능"

LimitRange:
  → 개별 Pod/컨테이너의 리소스 범위 제한
  → "각 Pod은 최소 100m CPU, 최대 2 CPU 사용 가능"
```

**ResourceQuota 설정**:

```yaml
# deploy/base/resource-quota.yaml

apiVersion: v1
kind: ResourceQuota
metadata:
  name: saas-platform-quota
  namespace: saas-platform
spec:
  hard:
    # CPU 총량 제한
    requests.cpu: "20"     # 요청 합계 최대 20 CPU
    limits.cpu: "40"       # 제한 합계 최대 40 CPU

    # 메모리 총량 제한
    requests.memory: 40Gi
    limits.memory: 80Gi

    # Pod 수 제한
    pods: "200"

    # PVC 수 제한
    persistentvolumeclaims: "50"
    requests.storage: 500Gi
```

**LimitRange 설정**:

```yaml
# deploy/base/limit-range.yaml

apiVersion: v1
kind: LimitRange
metadata:
  name: saas-platform-limits
  namespace: saas-platform
spec:
  limits:
    # 컨테이너 리소스 범위 설정
    - type: Container
      default:          # requests/limits 미설정 시 기본값
        cpu: "500m"
        memory: "512Mi"
      defaultRequest:
        cpu: "100m"
        memory: "128Mi"
      min:              # 최솟값 (이 이하 설정 불가)
        cpu: "50m"
        memory: "64Mi"
      max:              # 최댓값 (이 이상 설정 불가)
        cpu: "4"
        memory: "4Gi"
```

**현재 사용량 확인**:

```bash
# ResourceQuota 사용 현황
kubectl describe resourcequota saas-platform-quota -n saas-platform

# Name:                    saas-platform-quota
# Namespace:               saas-platform
# Resource                 Used    Hard
# --------                 ----    ----
# limits.cpu               18      40
# limits.memory            32Gi    80Gi
# pods                     87      200
# requests.cpu             9       20
# requests.memory          16Gi    40Gi
```

---

**Q6. Persistent Volume 마이그레이션 방법은?**

PV 마이그레이션이 필요한 상황: 노드 교체, 스토리지 업그레이드, 클러스터 이전 등.

**마이그레이션 절차** (PostgreSQL PV 예시):

```bash
# 시나리오: audit-service DB를 worker-1에서 worker-2로 이전

# Step 1: 원본 PVC 정보 확인
kubectl get pvc audit-service-data -n saas-platform -o yaml
# storageClassName: local-path
# volumeName: pvc-abc123

# Step 2: 데이터 백업 (Velero 사용)
velero backup create audit-service-migration \
  --include-namespaces saas-platform \
  --selector app=audit-service \
  --wait

# Step 3: audit-service 스케일다운
kubectl scale deployment audit-service --replicas=0 -n saas-platform

# Step 4: 데이터 복사 (rsync 사용)
# 원본 노드에서 실행:
rsync -avz /var/lib/rancher/k3s/storage/pvc-abc123/ \
  worker-2:/var/lib/rancher/k3s/storage/pvc-abc123/

# Step 5: PV nodeAffinity 수정 (대상 노드로 변경)
kubectl patch pv pvc-abc123 --type=json -p='[
  {
    "op": "replace",
    "path": "/spec/nodeAffinity/required/nodeSelectorTerms/0/matchExpressions/0/values/0",
    "value": "worker-2"
  }
]'

# Step 6: audit-service 스케일업
kubectl scale deployment audit-service --replicas=1 -n saas-platform

# Step 7: 데이터 무결성 확인
kubectl exec -it audit-service-xxx -n saas-platform -- \
  psql $DATABASE_URL -c "SELECT COUNT(*) FROM audit_logs;"
```

**예방법**: `local-path` 타입 PV는 특정 노드에 종속됩니다. 가능하면 NFS 또는 분산 스토리지(Longhorn)를 사용하여 PV를 노드 독립적으로 관리하십시오.

---

## 카테고리 2: CI/CD 고급 운영

---

**Q7. Gitea Actions runner를 추가하는 방법은?**

Runner가 부족하면 파이프라인이 큐에서 대기합니다. Runner를 추가하여 병렬 실행 용량을 늘립니다.

**Runner 추가 절차**:

```bash
# Step 1: Gitea UI에서 Runner 토큰 생성
# 저장소 → Settings → Actions → Runners → New Runner
# 또는: 관리자 패널 → Actions → Runners (전체 공유 Runner)

# Step 2: Runner 서버에서 act_runner 설치
# (self-hosted runner 서버에서 실행)
curl -sfL https://gitea.com/gitea/act_runner/releases/download/v0.2.10/act_runner-v0.2.10-linux-amd64 \
  -o /usr/local/bin/act_runner
chmod +x /usr/local/bin/act_runner

# Step 3: Runner 등록
act_runner register \
  --instance https://git.saas.local \
  --token {RUNNER_TOKEN} \
  --name "worker-runner-02" \
  --labels "self-hosted,linux,x64,high-memory"

# Step 4: Runner 서비스 시작
cat > /etc/systemd/system/act-runner.service << 'EOF'
[Unit]
Description=Gitea Actions Runner
After=network.target

[Service]
ExecStart=/usr/local/bin/act_runner daemon
WorkingDirectory=/opt/act-runner
Restart=always

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now act-runner

# Step 5: Runner 등록 확인
# Gitea UI → Settings → Actions → Runners에서 확인
```

**Runner 레이블로 특정 워크플로우에 할당**:

```yaml
# 특정 레이블을 가진 Runner에서만 실행
jobs:
  high-memory-task:
    runs-on: [self-hosted, high-memory]  # high-memory 레이블 Runner만 사용

  standard-task:
    runs-on: self-hosted  # 모든 self-hosted Runner 사용 가능
```

**예방법**: Runner를 여러 대 구성하고, 각각 레이블을 부여하여 워크플로우 유형에 맞게 할당하십시오. SBOM 스캔처럼 리소스를 많이 사용하는 작업은 전용 Runner에서 실행합니다.

---

**Q8. 특정 워크플로우만 수동으로 트리거하는 방법은?**

자동 트리거(push, PR) 없이 특정 워크플로우를 수동으로 실행해야 할 때 사용합니다.

**방법 1: Gitea UI에서 수동 실행**:

```
Gitea UI:
  저장소 → Actions 탭
  → 실행할 워크플로우 선택 (왼쪽 사이드바)
  → "Run workflow" 버튼 클릭
  → 브랜치 선택 + 입력 파라미터 지정
  → "Run workflow" 클릭
```

**방법 2: Gitea API로 수동 실행**:

```bash
# Gitea API로 워크플로우 디스패치
curl -X POST \
  "https://git.saas.local/api/v1/repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches" \
  -H "Authorization: token ${GITEA_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "ref": "stg",
    "inputs": {
      "image_tag": "stg-abc1234",
      "service_filter": "auth-service"
    }
  }'
```

**워크플로우에 수동 트리거 추가** (`workflow_dispatch`):

```yaml
# .gitea/workflows/sbom-scan.yml 발췌 (실제 설정)

on:
  # 자동 트리거
  workflow_run:
    workflows: ["CI/CD Pipeline"]
    types: [completed]

  # 수동 트리거 (이 설정이 있어야 UI에서 "Run workflow" 버튼 표시됨)
  workflow_dispatch:
    inputs:
      image_tag:
        description: "스캔할 이미지 태그 (예: stg-abc1234)"
        required: false
        type: string
      service_filter:
        description: "특정 서비스만 스캔 (비워두면 전체)"
        required: false
        type: string
```

**예방법**: 운영에 영향을 주는 워크플로우(배포, DB 마이그레이션)에는 `workflow_dispatch` 입력에 환경(`environment: production`)을 명시하여 실수 방지.

---

**Q9. pnpm 캐시가 CI에서 동작하지 않습니다. 어떻게 하나요?**

pnpm 캐시가 적중하지 않으면 매 빌드마다 수백 개의 패키지를 재다운로드하여 빌드 시간이 3~5분 증가합니다.

**진단 방법**:

```bash
# Gitea Actions 로그에서 캐시 관련 로그 확인
# "Cache restored from key: ..." → 캐시 적중
# "Cache not found for key: ..." → 캐시 미스

# 캐시 키 확인
echo "캐시 키: ${{ runner.os }}-pnpm-store-${{ hashFiles('**/pnpm-lock.yaml') }}"
```

**자주 발생하는 원인과 해결**:

```yaml
# ❌ 잘못된 설정: pnpm store 경로 하드코딩
- name: Restore pnpm cache
  uses: actions/cache@v4
  with:
    path: ~/.pnpm-store  # 이 경로가 틀릴 수 있음!
    key: pnpm-${{ hashFiles('pnpm-lock.yaml') }}

# ✅ 올바른 설정: 동적으로 store 경로 확인
- name: Get pnpm store directory
  shell: bash
  run: echo "STORE_PATH=$(pnpm store path --silent)" >> $GITHUB_ENV

- name: Restore pnpm cache
  uses: actions/cache@v4
  with:
    path: ${{ env.STORE_PATH }}  # 실제 경로 사용
    key: ${{ runner.os }}-pnpm-store-${{ hashFiles('**/pnpm-lock.yaml') }}
    restore-keys: |
      ${{ runner.os }}-pnpm-store-  # lock 파일 변경 시 부분 적중
```

**캐시 키 충돌 방지**:

```yaml
# 서비스별로 다른 캐시 (필요한 경우)
key: ${{ runner.os }}-pnpm-store-auth-${{ hashFiles('platform/services/auth-service/pnpm-lock.yaml') }}

# 전체 모노레포 공용 캐시 (권장)
key: ${{ runner.os }}-pnpm-store-${{ hashFiles('**/pnpm-lock.yaml') }}
```

**캐시 강제 무효화**:

```bash
# 캐시 키에 날짜 추가 (주간 자동 리셋)
key: ${{ runner.os }}-pnpm-store-${{ env.WEEK }}-${{ hashFiles('**/pnpm-lock.yaml') }}

# 또는 Gitea UI에서 캐시 삭제
# 저장소 → Settings → Actions → Caches → 삭제
```

---

**Q10. Turbo 원격 캐시를 설정하는 방법은?**

Turbo 원격 캐시는 서로 다른 CI Runner 간에 빌드 캐시를 공유합니다. 이미 빌드된 패키지를 재빌드하지 않아 CI 시간을 30~60% 절약할 수 있습니다.

**Self-hosted Turbo Cache 서버 설정** (Turborepo Remote Cache Server 사용):

```bash
# 1. 원격 캐시 서버 설치
npx @turborepo/remote-cache-server@latest

# 또는 Vercel Remote Cache (공공기관에서는 사용 금지)
# self-hosted 대안: ducktape (https://github.com/Tapico/turborepo-remote-cache)
```

**turbo.json 설정**:

```json
{
  "$schema": "https://turbo.build/schema.json",
  "remoteCache": {
    "enabled": true,
    "apiUrl": "http://turbo-cache.infra.svc.cluster.local:3000"
  },
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"],
      "cache": true
    },
    "test": {
      "dependsOn": ["build"],
      "outputs": ["coverage/**"],
      "cache": true
    },
    "lint": {
      "cache": true
    }
  }
}
```

**CI에서 원격 캐시 활성화**:

```yaml
- name: Build with Turbo (remote cache)
  run: pnpm turbo run build
  env:
    TURBO_TOKEN: ${{ secrets.TURBO_CACHE_TOKEN }}
    TURBO_TEAM: saas-platform
    TURBO_API: http://turbo-cache.infra.svc.cluster.local:3000
```

**캐시 히트율 확인**:

```bash
# Turbo 빌드 로그에서 캐시 히트 확인
# HIT:full  → 완전 캐시 적중 (빌드 건너뜀)
# HIT:miss  → 캐시 미스 (재빌드)

pnpm turbo run build --dry=json | jq '.tasks[] | {task: .taskId, cache: .cache}'
```

---

**Q11. 여러 서비스를 동시에 배포할 때 순서를 제어하는 방법은?**

의존성이 있는 서비스들은 순서를 지켜서 배포해야 합니다. 예: DB 마이그레이션 → 백엔드 → 프론트엔드.

**방법 1: Gitea Actions `needs` 사용**:

```yaml
# .gitea/workflows/deploy.yml

jobs:
  # Step 1: DB 마이그레이션 (가장 먼저)
  migrate-db:
    name: "DB Migration"
    runs-on: self-hosted
    steps:
      - name: Run migrations
        run: |
          for service in platform/services/*/; do
            if [ -f "$service/prisma/schema.prisma" ]; then
              echo "Migrating: $service"
              pnpm --filter "$(basename $service)" prisma migrate deploy
            fi
          done

  # Step 2: 핵심 서비스 배포 (마이그레이션 완료 후)
  deploy-core:
    name: "Deploy Core Services"
    needs: [migrate-db]      # ← 마이그레이션 완료 후 시작
    runs-on: self-hosted
    strategy:
      matrix:
        service: [auth-service, tenant-service, user-service]
    steps:
      - name: Deploy ${{ matrix.service }}
        run: |
          kubectl set image deployment/${{ matrix.service }} \
            ${{ matrix.service }}=${IMAGE}:${TAG} \
            -n saas-platform
          kubectl rollout status deployment/${{ matrix.service }} \
            -n saas-platform --timeout=180s

  # Step 3: 비즈니스 서비스 배포 (핵심 서비스 완료 후)
  deploy-business:
    name: "Deploy Business Services"
    needs: [deploy-core]     # ← 핵심 서비스 완료 후 시작
    runs-on: self-hosted
    strategy:
      matrix:
        service: [billing-service, crm-service, catalog-service]
    steps:
      - name: Deploy ${{ matrix.service }}
        run: |
          kubectl set image deployment/${{ matrix.service }} \
            ${{ matrix.service }}=${IMAGE}:${TAG} \
            -n saas-platform

  # Step 4: 프론트엔드 배포 (모든 백엔드 완료 후)
  deploy-portal:
    name: "Deploy Portal"
    needs: [deploy-core, deploy-business]
    runs-on: self-hosted
    steps:
      - name: Deploy portal
        run: |
          kubectl set image deployment/portal portal=${IMAGE}:${TAG} -n saas-platform
          kubectl rollout status deployment/portal -n saas-platform --timeout=300s
```

**방법 2: kubectl rollout 상태 대기**:

```bash
#!/bin/bash
# scripts/deploy-ordered.sh

NAMESPACE="saas-platform"
IMAGE_TAG="${1:-latest}"

# 1. DB 마이그레이션
echo "=== DB 마이그레이션 ==="
pnpm prisma migrate deploy
echo "[OK] DB 마이그레이션 완료"

# 2. auth-service 배포 및 대기
echo "=== auth-service 배포 ==="
kubectl set image deployment/auth-service auth-service=harbor/public-saas/auth-service:${IMAGE_TAG} -n ${NAMESPACE}
kubectl rollout status deployment/auth-service -n ${NAMESPACE} --timeout=180s
echo "[OK] auth-service Ready"

# 3. 나머지 서비스 순차 배포
for service in api-gateway tenant-service user-service billing-service; do
  echo "=== ${service} 배포 ==="
  kubectl set image deployment/${service} ${service}=harbor/public-saas/${service}:${IMAGE_TAG} -n ${NAMESPACE}
  kubectl rollout status deployment/${service} -n ${NAMESPACE} --timeout=180s
  echo "[OK] ${service} Ready"
done

echo "=== 모든 서비스 배포 완료 ==="
```

---

## 카테고리 3: 모니터링 고급 운영

---

**Q12. Grafana 대시보드를 코드로 관리하는 방법은?**

대시보드를 UI에서만 편집하면 버전 관리가 안 되고, 실수로 삭제되면 복구가 어렵습니다.

**방법: Grafana Dashboard Provisioning**:

```yaml
# infra/grafana/provisioning/dashboards/dashboard-config.yaml

apiVersion: 1
providers:
  - name: "saas-dashboards"
    orgId: 1
    folder: "Public SaaS"
    type: file
    disableDeletion: true       # UI에서 삭제 방지
    updateIntervalSeconds: 30   # 30초마다 파일 감시
    allowUiUpdates: false       # UI 편집 → 파일 변경은 반영 안 됨
    options:
      path: /etc/grafana/dashboards  # 대시보드 JSON 파일 위치
```

**대시보드 JSON 내보내기 및 저장**:

```bash
# 1. Grafana UI에서 대시보드 내보내기
# Dashboard → 공유 아이콘 → Export → Save to file

# 2. git에 저장
cp ~/Downloads/dashboard-*.json infra/grafana/dashboards/

# 3. ConfigMap으로 Kubernetes에 배포
kubectl create configmap grafana-dashboards \
  --from-file=infra/grafana/dashboards/ \
  -n monitoring \
  --dry-run=client -o yaml | kubectl apply -f -

# 4. Grafana Pod 재시작 (새 대시보드 적용)
kubectl rollout restart deployment/grafana -n monitoring
```

**Grafonnet (Jsonnet으로 대시보드 생성)**:

```jsonnet
// infra/grafana/dashboards/slo-dashboard.jsonnet
// Jsonnet으로 대시보드를 프로그래밍 방식으로 생성

local grafana = import 'grafonnet/grafana.libsonnet';

grafana.dashboard.new(
  'SLO 현황 — 공공기관 SaaS',
  tags=['slo', 'csap'],
  time_from='now-1h',
)
.addPanel(
  grafana.panels.stat.new('가용성 SLO', description='99.9% 목표') +
  grafana.panels.stat.withTargets([
    grafana.targets.prometheus.new(
      'avg(up{job=~"auth-service|api-gateway"}) * 100',
      legendFormat='가용성 (%)'
    )
  ])
)
```

---

**Q13. AlertManager에서 알림 그룹화를 설정하는 방법은?**

동일한 장애로 수백 개의 알림이 쏟아지는 "알림 폭풍"을 방지합니다.

**문제 시나리오**:

```
auth-service 장애 발생 시:
  - Pod 재시작 알림 × 5
  - 헬스 체크 실패 알림 × 30
  - 응답 시간 증가 알림 × 10
  - 에러율 증가 알림 × 8
  = 총 53개 알림이 Slack에 도착!
  → 정작 중요한 정보가 무엇인지 파악 어려움
```

**그룹화 설정** (`infra/monitoring/alertmanager/config.yaml`):

```yaml
global:
  resolve_timeout: 5m
  slack_api_url: "https://hooks.slack.com/services/..."

route:
  # 기본 그룹화 기준
  group_by: ['alertname', 'job', 'namespace']
  group_wait: 30s        # 그룹 첫 알림 후 30초 대기 (추가 알림 수집)
  group_interval: 5m     # 동일 그룹 재알림 간격
  repeat_interval: 4h    # 동일 알림 반복 간격

  routes:
    # Critical 알림: 즉시 발송 (그룹화 최소)
    - match:
        severity: critical
      group_wait: 0s       # 즉시 발송
      group_interval: 1m
      receiver: pagerduty-critical

    # 서비스별 그룹화 (서비스 장애는 묶어서 처리)
    - match_re:
        alertname: ".*ServiceDown.*|.*PodRestart.*"
      group_by: ['namespace', 'service']  # 서비스 단위로 묶음
      group_wait: 60s      # 1분 대기 후 발송 (관련 알림 수집)
      receiver: slack-ops

receivers:
  - name: slack-ops
    slack_configs:
      - channel: "#ops-alerts"
        title: '[{{ .Status | toUpper }}] {{ .GroupLabels.service }} 이상'
        text: |
          {{ range .Alerts }}
          *알림*: {{ .Annotations.summary }}
          *심각도*: {{ .Labels.severity }}
          {{ end }}

  - name: pagerduty-critical
    pagerduty_configs:
      - service_key: "${PAGERDUTY_SERVICE_KEY}"
```

---

**Q14. Prometheus 데이터 보존 기간을 늘리는 방법은?**

기본 보존 기간은 15일입니다. CSAP 감리를 위해 90일~1년으로 늘려야 할 수 있습니다.

**방법 1: Prometheus 스토리지 설정 변경**:

```yaml
# deploy/monitoring/prometheus-config.yaml

apiVersion: apps/v1
kind: Deployment
metadata:
  name: prometheus
  namespace: monitoring
spec:
  template:
    spec:
      containers:
        - name: prometheus
          args:
            # 보존 기간 (시간 단위)
            - "--storage.tsdb.retention.time=90d"

            # 또는 스토리지 크기로 제한
            # - "--storage.tsdb.retention.size=50GB"

            # 데이터 디렉토리
            - "--storage.tsdb.path=/prometheus"

          volumeMounts:
            - name: prometheus-storage
              mountPath: /prometheus

      volumes:
        - name: prometheus-storage
          persistentVolumeClaim:
            claimName: prometheus-pvc
```

**방법 2: Thanos를 사용한 장기 보존** (권장):

```
Thanos 구성:
  Prometheus → Thanos Sidecar → MinIO (S3 호환)
                                  ↑ 장기 저장 (1년+)

장점:
  - Prometheus 로컬 스토리지 부하 없음
  - MinIO에 무제한 보존 가능
  - 여러 Prometheus 인스턴스의 데이터 통합 조회
```

```yaml
# Thanos Sidecar 설정
containers:
  - name: thanos-sidecar
    image: thanosio/thanos:v0.34.0
    args:
      - sidecar
      - --tsdb.path=/prometheus
      - --objstore.config-file=/etc/thanos/object-store.yaml
    volumeMounts:
      - name: object-store-config
        mountPath: /etc/thanos
```

**현재 스토리지 사용량 확인**:

```bash
kubectl exec -it prometheus-xxx -n monitoring -- \
  du -sh /prometheus/
# 15.2G  /prometheus/  (90일 데이터 기준)
```

---

**Q15. Loki 로그 스토리지가 가득 찼습니다. 어떻게 하나요?**

Loki 스토리지가 가득 차면 새 로그가 수집되지 않습니다. 즉각 대응이 필요합니다.

**긴급 진단**:

```bash
# Loki 스토리지 사용량 확인
kubectl exec -it loki-xxx -n monitoring -- df -h /loki
# /loki     95G  93G  2G  98%  ← 위험!

# 가장 많은 공간을 차지하는 테넌트 확인
kubectl exec -it loki-xxx -n monitoring -- \
  du -sh /loki/chunks/* | sort -rh | head -10
```

**즉각 대응 (단기)**:

```bash
# 1. 오래된 청크 삭제 (주의: 되돌릴 수 없음!)
# Loki 삭제 API 사용 (retention 설정보다 이른 삭제)
curl -X POST \
  "http://loki.monitoring.svc.cluster.local:3100/loki/api/v1/delete" \
  -H "X-Scope-OrgID: saas-platform" \
  -d 'query={app="api-gateway"}&start=2025-01-01T00:00:00Z&end=2025-12-31T00:00:00Z'

# 2. PVC 크기 증가 (k3s + local-path는 동적 증가 불가)
# → 스토리지 노드의 디스크를 확장하거나 새 PVC 생성
```

**영구 해결 (장기)**:

```yaml
# Loki 보존 정책 설정 (loki-config.yaml)
# 주의: CSAP D-06 최소 1년 보존 요건 준수 필요

schema_config:
  configs:
    - from: 2026-01-01
      store: boltdb-shipper
      object_store: s3  # MinIO로 오프로드

# 자동 삭제 정책
limits_config:
  retention_period: 365d  # 1년 (CSAP D-06 최소 요건)

# MinIO로 오프로드 (로컬 디스크 절약)
storage_config:
  aws:
    endpoint: http://minio.infra.svc.cluster.local:9000
    bucketnames: loki-logs
    access_key_id: "${MINIO_ACCESS_KEY}"
    secret_access_key: "${MINIO_SECRET_KEY}"
    s3forcepathstyle: true
```

**예방법**: Loki PVC 사용량을 Prometheus로 모니터링하고 80% 초과 시 알림을 설정하십시오.

---

**Q16. Tempo에서 트레이스 샘플링 비율을 조정하는 방법은?**

100% 샘플링은 스토리지와 성능 비용이 너무 크고, 너무 낮은 비율은 문제 추적이 어렵습니다.

**샘플링 전략 선택**:

| 전략 | 설명 | 적합한 경우 |
|------|------|---------|
| 확률적 (Probabilistic) | N%의 요청만 추적 | 고트래픽, 비용 절감 |
| 속도 제한 (Rate Limiting) | 초당 N개 추적 | 일정한 샘플링 보장 |
| 테일 기반 (Tail-based) | 느린/에러 요청만 추적 | 문제 추적 최적화 |

**OpenTelemetry Collector 샘플링 설정**:

```yaml
# infra/otel/collector-config.yaml

processors:
  # 확률적 샘플링 (현재 권장)
  probabilistic_sampler:
    sampling_percentage: 10  # 10% 샘플링

  # 또는 테일 기반 샘플링 (더 스마트)
  tail_sampling:
    decision_wait: 10s  # 결정 대기 시간
    num_traces: 100     # 메모리에 유지할 트레이스 수
    policies:
      # 에러 요청은 100% 추적
      - name: error-policy
        type: status_code
        status_code:
          status_codes: [ERROR]

      # 느린 요청은 100% 추적 (500ms 이상)
      - name: slow-traces
        type: latency
        latency:
          threshold_ms: 500

      # 나머지는 5% 추적
      - name: base-rate
        type: probabilistic
        probabilistic:
          sampling_percentage: 5
```

**환경별 샘플링 비율 권장**:

| 환경 | 권장 비율 | 이유 |
|------|---------|------|
| 개발 | 100% | 모든 트레이스 확인 필요 |
| 스테이징 | 50% | 비교적 낮은 트래픽 |
| 운영 | 10~20% | 비용 절감, 문제 추적 가능 |

---

## 카테고리 4: 보안 운영

---

**Q17. Vault 마스터 키 교체 절차는?**

Vault 마스터 키(Unseal Key) 교체는 보안 감사 또는 키 노출 의심 시 수행합니다.

**주의**: 이 작업은 Vault 서비스를 일시 중단합니다. 사전에 팀과 공유하십시오.

```bash
# Step 1: 현재 상태 확인
vault status

# Step 2: 재키잉(Rekey) 초기화 (키 교체)
vault operator rekey \
  -init \
  -key-shares=5 \        # 새 키 조각 수
  -key-threshold=3        # 해제에 필요한 최소 조각 수

# 응답:
# Nonce: abc123...
# Key 1 of 5 of 5 shares needed
# (기존 unseal 키 보유자들에게 Nonce 전달)

# Step 3: 각 키 보유자가 기존 키 제출 (순차적으로)
# (첫 번째 보유자)
vault operator rekey -nonce=abc123 "${OLD_UNSEAL_KEY_1}"
# (두 번째 보유자)
vault operator rekey -nonce=abc123 "${OLD_UNSEAL_KEY_2}"
# (세 번째 보유자 - threshold 충족)
vault operator rekey -nonce=abc123 "${OLD_UNSEAL_KEY_3}"

# Step 4: 새 키 확인 및 안전하게 배포
# 응답에 새 Unseal Key 5개와 새 Root Token 포함
# → 각 키 보유자에게 개별 전달 (같은 채널 금지!)

# Step 5: 확인
vault status  # Sealed: false (정상)
```

**예방법 (CSAP D-09)**:
- Unseal Key는 최소 5개 조각으로 분리, 3개 이상 없으면 해제 불가
- 각 키 조각은 다른 담당자가 보관
- Key는 HSM(Hardware Security Module) 또는 암호화된 USB에 보관

---

**Q18. 인증서가 자동 갱신되지 않을 때 수동 갱신 방법은?**

cert-manager가 인증서를 자동으로 갱신하지 못하는 경우가 있습니다.

**진단**:

```bash
# 인증서 만료일 확인
kubectl get certificates -n saas-platform

# NAME              READY   SECRET                 AGE
# saas-tls-cert     False   saas-tls-secret        30d  ← False면 문제!

# 상세 이유 확인
kubectl describe certificate saas-tls-cert -n saas-platform
# Events:
#   Warning  ErrObtainCertificate  Failed to obtain certificate: ...

# CertificateRequest 상태 확인
kubectl get certificaterequest -n saas-platform

# Orders (ACME) 상태 확인
kubectl get orders -n saas-platform
kubectl describe order saas-tls-cert-xxx -n saas-platform
```

**수동 갱신 방법**:

```bash
# 방법 1: Certificate 재발급 트리거
# (cert-manager 어노테이션 추가로 강제 재발급)
kubectl annotate certificate saas-tls-cert \
  cert-manager.io/issue-temporary-certificate="true" \
  -n saas-platform

# 방법 2: Secret 삭제 후 재발급
# (Secret 삭제 시 cert-manager가 자동으로 재발급)
kubectl delete secret saas-tls-secret -n saas-platform
# → cert-manager가 새 인증서 발급 시작

# 방법 3: 수동 인증서 갱신 (cert-manager CLI)
cmctl renew saas-tls-cert -n saas-platform

# 갱신 상태 모니터링
kubectl get certificates saas-tls-cert -n saas-platform --watch
# NAME            READY
# saas-tls-cert   True  ← True가 되면 완료
```

**인증서 만료 알림 설정**:

```yaml
# PrometheusRule: 인증서 만료 7일 전 알림
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: cert-expiry-alert
  namespace: monitoring
spec:
  groups:
    - name: certificate.rules
      rules:
        - alert: CertificateExpiringSoon
          expr: |
            certmanager_certificate_expiration_timestamp_seconds
            - time() < 7 * 24 * 3600
          for: 1h
          labels:
            severity: warning
          annotations:
            summary: "인증서 {{ $labels.name }} 7일 내 만료 예정"
```

---

**Q19. Falco 알림이 너무 많이 옵니다. 노이즈를 줄이는 방법은?**

Falco는 k8s 런타임 보안 모니터링 도구입니다. 기본 규칙이 너무 민감하게 설정되어 있으면 알림 폭풍이 발생합니다.

**노이즈 많은 규칙 식별**:

```bash
# 가장 많은 이벤트를 발생시키는 규칙 확인
kubectl logs -n falco -l app=falco --tail=10000 | \
  jq -r '.rule' | \
  sort | uniq -c | sort -rn | head -20

# 상위 결과 예시:
# 8542  Write below binary dir
# 3821  Read sensitive file trusted after startup
# 1205  Terminal shell in container
```

**규칙 억제 (falco_rules.local.yaml)**:

```yaml
# /etc/falco/falco_rules.local.yaml (기존 규칙 오버라이드)

# 특정 컨테이너에서의 규칙 억제 (예외 추가)
- rule: Terminal shell in container
  append: true   # 기존 규칙에 예외 추가
  exceptions:
    # 디버깅용 임시 컨테이너는 예외
    - name: debug-containers
      fields: [container.image.repository]
      comps: [in]
      values:
        - ["debug-tools", "busybox", "curlimages/curl"]

    # CI/CD 빌드 컨테이너는 예외
    - name: ci-containers
      fields: [k8s.ns.name]
      comps: [in]
      values:
        - ["gitea-runner"]

# 특정 규칙 완전 비활성화 (노이즈가 심한 경우)
- rule: Read sensitive file trusted after startup
  enabled: false  # 이 규칙은 우리 환경에 맞지 않음
```

**알림 우선순위 설정**:

```yaml
# falco.yaml
# 최소 우선순위: WARNING 이상만 알림 발송
rules_file:
  - /etc/falco/falco_rules.yaml
  - /etc/falco/falco_rules.local.yaml

json_output: true
log_level: info
priority: WARNING  # DEBUG/INFO 무시, WARNING/ERROR/CRITICAL만

# Slack 연동 (Critical만 즉시, Warning은 집계 후)
program_output:
  enabled: true
  keep_alive: false
  program: "jq '{text: (.rule + \": \" + .output)}' | curl -X POST -d @- ${SLACK_WEBHOOK}"
```

---

**Q20. Kyverno 정책이 기존 Pod를 차단하고 있습니다. 임시 해제 방법은?**

새 Kyverno 정책이 배포 후 기존 Pod 재시작을 막는 상황입니다. 긴급 대응이 필요합니다.

**문제 진단**:

```bash
# 차단된 이벤트 확인
kubectl get policyreport -A

# 특정 네임스페이스의 정책 위반 확인
kubectl get policyreport -n saas-platform -o yaml

# Kyverno 로그 확인
kubectl logs -n kyverno -l app=kyverno | grep "DENY"
```

**임시 해제 방법**:

```bash
# 방법 1: 정책을 Audit 모드로 전환 (차단 → 경고만)
kubectl patch clusterpolicy require-pod-security \
  --type=json \
  -p='[{"op": "replace", "path": "/spec/validationFailureAction", "value": "audit"}]'
# enforce → audit 으로 변경: 이제 차단 안 하고 경고만

# 방법 2: 특정 네임스페이스 제외
kubectl patch clusterpolicy require-pod-security \
  --type=json \
  -p='[{"op": "add", "path": "/spec/rules/0/match/any/0/resources/namespaces/-", "value": "saas-platform-temp"}]'

# 방법 3: 특정 Pod에 예외 레이블 추가
kubectl annotate pod auth-service-xxx \
  policies.kyverno.io/exclude="true" \
  -n saas-platform
```

**영구 예외 설정**:

```yaml
# infra/kyverno/policy-exception.yaml
# Design Ref: MTU-N246 S3.4

apiVersion: kyverno.io/v2beta1
kind: PolicyException
metadata:
  name: legacy-pod-exception
  namespace: saas-platform
spec:
  exceptions:
    - policyName: require-pod-security
      ruleNames:
        - require-non-root-user
  match:
    any:
      - resources:
          kinds:
            - Pod
          namespaces:
            - saas-platform
          selector:
            matchLabels:
              legacy-mode: "true"  # 이 레이블이 있는 Pod만 예외
```

**예방법**: 새 Kyverno 정책은 항상 `audit` 모드로 먼저 배포하여 영향을 파악한 후, `enforce` 모드로 전환하십시오. `devsecops.yml`의 `kyverno-check` 단계에서 사전 검증을 수행합니다.

---

## 카테고리 5: 비용/성능 운영

---

**Q21. 주말/야간에 불필요한 Pod를 자동으로 줄이는 방법은?**

개발/스테이징 환경은 주말과 야간에 사용량이 거의 없습니다. 스케일다운으로 인프라 비용을 절감합니다.

**Kubernetes CronJob으로 스케일 조절**:

```yaml
# deploy/scheduling/scale-down-cronjob.yaml

apiVersion: batch/v1
kind: CronJob
metadata:
  name: weekend-scale-down
  namespace: saas-platform
spec:
  schedule: "0 20 * * 5"  # 금요일 20:00 KST (Cron: UTC 11:00 금)
  jobTemplate:
    spec:
      template:
        spec:
          serviceAccountName: scale-manager
          containers:
            - name: kubectl
              image: bitnami/kubectl:latest
              command:
                - /bin/sh
                - -c
                - |
                  # 스테이징 환경만 스케일다운 (운영 제외!)
                  NAMESPACE="saas-platform-stg"

                  # 비핵심 서비스 스케일다운
                  for svc in crm-service notification-service catalog-service; do
                    kubectl scale deployment $svc --replicas=0 -n $NAMESPACE
                    echo "[DOWN] $svc 스케일다운 완료"
                  done

                  # 핵심 서비스는 최소 유지 (1개)
                  for svc in auth-service api-gateway; do
                    kubectl scale deployment $svc --replicas=1 -n $NAMESPACE
                    echo "[MIN] $svc 최소 레플리카 유지"
                  done
          restartPolicy: OnFailure

---
apiVersion: batch/v1
kind: CronJob
metadata:
  name: monday-scale-up
  namespace: saas-platform
spec:
  schedule: "0 8 * * 1"  # 월요일 08:00 KST (UTC 23:00 일)
  jobTemplate:
    spec:
      template:
        spec:
          serviceAccountName: scale-manager
          containers:
            - name: kubectl
              image: bitnami/kubectl:latest
              command:
                - /bin/sh
                - -c
                - |
                  NAMESPACE="saas-platform-stg"
                  for svc in crm-service notification-service catalog-service; do
                    kubectl scale deployment $svc --replicas=2 -n $NAMESPACE
                    echo "[UP] $svc 스케일업 완료"
                  done
          restartPolicy: OnFailure
```

---

**Q22. 특정 서비스만 리소스 사용량이 급증합니다. 분석 방법은?**

**단계별 진단**:

```bash
# Step 1: 현재 리소스 사용량 확인
kubectl top pods -n saas-platform --sort-by=cpu | head -20
kubectl top pods -n saas-platform --sort-by=memory | head -20

# Step 2: 특정 서비스 세부 분석
POD="auth-service-xxx-yyy"
kubectl top pod $POD -n saas-platform --containers

# Step 3: 프로세스 수준 분석 (컨테이너 접속)
kubectl exec -it $POD -n saas-platform -- /bin/sh

# 컨테이너 내부에서:
top -b -n 1                    # 프로세스 CPU/메모리
cat /proc/meminfo              # 메모리 상세
ls -la /proc/*/fd | wc -l      # 열린 파일 디스크립터 수

# Step 4: 로그에서 원인 파악
kubectl logs $POD -n saas-platform --tail=500 | grep -E "ERROR|WARN|OOM"

# Step 5: Grafana에서 시계열 분석
# → Explore → Prometheus → container_cpu_usage_seconds_total{pod="$POD"}
```

**Prometheus 쿼리로 리소스 급증 패턴 분석**:

```promql
# CPU 급증 탐지 (5분 평균이 평소의 2배 이상)
(
  rate(container_cpu_usage_seconds_total{namespace="saas-platform"}[5m])
  /
  avg_over_time(
    rate(container_cpu_usage_seconds_total{namespace="saas-platform"}[5m])[1h:5m]
  )
) > 2

# 메모리 누수 감지 (지속적으로 증가)
predict_linear(
  container_memory_usage_bytes{namespace="saas-platform"}[1h],
  3600  # 1시간 후 예측값
)
```

---

**Q23. HPA 스케일업이 너무 늦게 반응합니다. 개선 방법은?**

HPA(Horizontal Pod Autoscaler)의 기본 설정은 응답이 느릴 수 있습니다.

**현재 HPA 상태 확인**:

```bash
kubectl get hpa auth-service -n saas-platform
# NAME           REFERENCE              TARGETS   MINPODS   MAXPODS   REPLICAS   AGE
# auth-service   Deployment/auth-service 80%/70%   2         10        2          5d
# → CPU 80%인데 아직 스케일업 안 됨 (반응 늦음)

kubectl describe hpa auth-service -n saas-platform
# Events:
#   Normal  SuccessfulRescale  ...  new size: 4, reason: cpu resource above target
# → 스케일업까지 5분 걸림
```

**HPA 반응 속도 개선**:

```yaml
# deploy/hpa/auth-service-hpa.yaml

apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: auth-service-hpa
  namespace: saas-platform
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: auth-service

  minReplicas: 2
  maxReplicas: 10

  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 60  # 70% → 60%로 낮춤 (더 일찍 반응)

  # 스케일링 동작 정밀 제어
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60     # 기본 300초 → 60초로 단축
      policies:
        - type: Pods
          value: 4                       # 한 번에 최대 4개 추가
          periodSeconds: 60

    scaleDown:
      stabilizationWindowSeconds: 300    # 스케일다운은 5분 대기 (과도한 축소 방지)
      policies:
        - type: Percent
          value: 25                      # 한 번에 25%만 제거
          periodSeconds: 120
```

**KEDA로 커스텀 메트릭 기반 스케일링** (고급):

```yaml
# Redis 큐 길이 기반 스케일링 (KEDA)
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: notification-service-scaler
  namespace: saas-platform
spec:
  scaleTargetRef:
    name: notification-service
  minReplicaCount: 1
  maxReplicaCount: 20
  triggers:
    - type: redis
      metadata:
        address: redis.infra.svc.cluster.local:6379
        listName: notification-queue
        listLength: "10"  # 큐에 10개 이상이면 스케일업
```

---

**Q24. 노드 리소스 활용률이 낮습니다. 최적화 방법은?**

노드 CPU/메모리가 20~30%만 사용되고 있다면 리소스 요청(requests) 설정이 너무 높게 설정된 것입니다.

**진단**:

```bash
# 노드 실제 vs 할당 리소스 비교
kubectl describe node worker-1 | grep -A 10 "Allocated resources"

# Allocated resources:
#   Resource           Requests    Limits
#   cpu                18 (45%)    36 (90%)    ← requests 기준 45% 할당
#   memory             32Gi (50%)  64Gi        
# 실제 사용량:
kubectl top node worker-1
# CPU: 15%  Memory: 25%
# → 할당은 45%인데 실제 사용은 15% → requests가 너무 높음!
```

**최적화 방법**:

```bash
# 1. 실제 사용량 기반으로 requests 조정
# VPA(Vertical Pod Autoscaler)로 자동 추천받기

kubectl apply -f - <<'EOF'
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: auth-service-vpa
  namespace: saas-platform
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: auth-service
  updatePolicy:
    updateMode: "Off"  # 자동 적용 말고 추천만 받기
EOF

# VPA 추천값 확인 (1일 이상 데이터 수집 후)
kubectl describe vpa auth-service-vpa -n saas-platform
# Recommendation:
#   Container Recommendations:
#     Container Name: auth-service
#     Lower Bound:
#       Cpu: 50m     ← 현재 100m requests보다 낮음
#       Memory: 64Mi ← 현재 256Mi requests보다 낮음
#     Target:
#       Cpu: 200m
#       Memory: 128Mi

# 2. 추천값으로 requests 조정 (테스트 후 적용)
kubectl set resources deployment auth-service \
  -n saas-platform \
  --requests=cpu=100m,memory=128Mi \
  --limits=cpu=500m,memory=512Mi
```

**Descheduler로 불균형 분산 해소**:

```yaml
# 노드 간 부하 불균형 해소
apiVersion: "descheduler/v1alpha1"
kind: "DeschedulerPolicy"
strategies:
  LowNodeUtilization:
    enabled: true
    params:
      nodeResourceUtilizationThresholds:
        thresholds:
          cpu: 20     # 20% 미만 사용 노드에서 Pod 이동
          memory: 20
        targetThresholds:
          cpu: 50     # 50% 미만 노드로만 이동
          memory: 50
```

---

**Q25. 스토리지 사용량을 모니터링하는 방법은?**

디스크가 가득 차면 Pod 실패, 로그 소실, DB 장애가 발생합니다. 사전 모니터링이 필수입니다.

**현재 스토리지 사용량 확인**:

```bash
# 노드별 디스크 사용량
kubectl get nodes -o custom-columns=\
"NAME:.metadata.name,\
OS-IMAGE:.status.nodeInfo.osImage" && \
kubectl top nodes

# 각 노드에서 실제 디스크 확인
for node in $(kubectl get nodes -o name | cut -d/ -f2); do
  echo "=== $node ==="
  kubectl debug node/$node -it --image=busybox -- df -h /
done

# PVC 사용량 확인 (Prometheus 쿼리)
# kubelet_volume_stats_used_bytes / kubelet_volume_stats_capacity_bytes
```

**Prometheus 알림 설정**:

```yaml
# infra/monitoring/alerts/storage-alerts.yaml

groups:
  - name: storage.rules
    rules:
      # PVC 사용량 80% 초과 경고
      - alert: PVCUsageHigh
        expr: |
          (
            kubelet_volume_stats_used_bytes
            /
            kubelet_volume_stats_capacity_bytes
          ) > 0.80
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "PVC {{ $labels.persistentvolumeclaim }} 사용량 80% 초과"
          description: "현재 사용량: {{ $value | humanizePercentage }}"

      # PVC 사용량 90% 초과 긴급
      - alert: PVCUsageCritical
        expr: |
          (
            kubelet_volume_stats_used_bytes
            /
            kubelet_volume_stats_capacity_bytes
          ) > 0.90
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "[긴급] PVC {{ $labels.persistentvolumeclaim }} 90% 초과"

      # 노드 디스크 사용량 85% 초과
      - alert: NodeDiskHigh
        expr: |
          (
            node_filesystem_size_bytes{mountpoint="/"}
            - node_filesystem_free_bytes{mountpoint="/"}
          )
          /
          node_filesystem_size_bytes{mountpoint="/"}
          > 0.85
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "노드 {{ $labels.instance }} 디스크 85% 초과"
```

**스토리지 정리 자동화**:

```bash
#!/bin/bash
# scripts/cleanup-storage.sh
# 오래된 로그, 불필요한 이미지 정리

# 1. Docker/containerd 이미지 정리 (각 노드에서 실행)
crictl rmi --prune  # 사용하지 않는 이미지 제거

# 2. 완료된 Job/CronJob Pod 정리
kubectl delete pods \
  --field-selector status.phase=Succeeded \
  -n saas-platform

kubectl delete pods \
  --field-selector status.phase=Failed \
  -n saas-platform

# 3. 오래된 Gitea Actions 아티팩트 정리
# (Gitea API로 30일 이상 된 아티팩트 삭제)
curl -X GET "https://git.saas.local/api/v1/repos/{owner}/{repo}/actions/artifacts" \
  -H "Authorization: token ${GITEA_API_TOKEN}" | \
  jq '.artifacts[] | select(.created_at < (now - 30*86400) | tostring) | .id' | \
  xargs -I{} curl -X DELETE "https://git.saas.local/api/v1/repos/{owner}/{repo}/actions/artifacts/{}"

echo "스토리지 정리 완료: $(date)"
```

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-12 | 초안 작성 — DevOps/인프라 운영 심화 FAQ 25개 | Implementer (Sonnet) |

---

**관련 문서**:
- `11-faq/02-infra-faq.md` — 인프라 기본 FAQ (선행 문서)
- `09-troubleshooting/07-cicd-debugging.md` — CI/CD 파이프라인 디버깅
- `06-cicd/06-supply-chain-security.md` — 공급망 보안
- `07-security/coding/03-dependency-security.md` — 의존성 보안
- `.gitea/workflows/devsecops.yml` — DevSecOps 파이프라인 (실제 구현)
