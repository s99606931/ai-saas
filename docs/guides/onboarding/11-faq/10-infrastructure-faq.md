# 인프라 운영 심화 FAQ — K8s 고급 문제 해결 30가지

> **문서 ID**: OPS-INFRA-FAQ-10
> **버전**: 1.0.0 | **작성일**: 2026-04-13 | **작성자**: Implementer (Sonnet)
> **목적**: k3s 클러스터·스토리지·네트워크에서 발생하는 실제 운영 장애 30가지를 신속하게 진단하고 해결한다
> **선행 학습**: [02-infra-faq.md](./02-infra-faq.md), [04-infrastructure/](../04-infrastructure/)

---

## FAQ 목차

### 빠른 답변 TOP 5 (가장 자주 묻는 질문)

| 순위 | 질문 | 바로가기 |
|------|------|---------|
| 1 | 노드가 NotReady 상태입니다. 어떻게 확인하나요? | [Q1](#q1-노드가-notready-상태입니다-어떻게-확인하나요) |
| 2 | PVC가 Pending 상태에서 멈췄습니다. 원인은? | [Q11](#q11-pvc가-pending-상태에서-멈췄습니다-원인은) |
| 3 | 서비스 간 통신이 갑자기 안 됩니다. 확인 방법은? | [Q21](#q21-서비스-간-통신이-갑자기-안-됩니다-확인-방법은) |
| 4 | 네임스페이스 삭제가 Terminating에 걸렸을 때? | [Q6](#q6-네임스페이스-삭제가-terminating에-걸렸을-때) |
| 5 | Flux GitOps가 특정 HelmRelease를 계속 실패하면? | [Q10](#q10-flux-gitops가-특정-helmrelease를-계속-실패하면) |

### 전체 질문 목차

**k3s 클러스터 FAQ (Q1~Q10)**
- Q1: 노드 NotReady 상태 확인
- Q2: etcd 데이터 손상 복구
- Q3: 클러스터 안전 업그레이드
- Q4: 특정 노드 Pod 강제 배치
- Q5: Taint/Toleration 설정
- Q6: 네임스페이스 Terminating 해제
- Q7: ResourceQuota 초과 Pod 생성 실패
- Q8: PodDisruptionBudget 설정
- Q9: 노드 드레인 없이 롤링 업데이트
- Q10: Flux HelmRelease 지속 실패

**스토리지 FAQ (Q11~Q20)**
- Q11: PVC Pending 상태 원인
- Q12: 볼륨 용량 온라인 확장
- Q13: ReadWriteMany PVC 실패
- Q14: 스냅샷 복구 불가 원인
- Q15: PostgreSQL 데이터 디렉토리 용량 경보
- Q16: 로그 볼륨 가득 찼을 때 긴급 처리
- Q17: Velero 백업 실패
- Q18: 임시 파일 PVC 포화
- Q19: StorageClass 없어서 PVC 생성 실패
- Q20: 다른 네임스페이스 PVC 접근

**네트워크 FAQ (Q21~Q30)**
- Q21: 서비스 간 통신 갑작스러운 중단
- Q22: NetworkPolicy Pod 차단 확인
- Q23: Ingress 추가 후 HTTPS 미동작
- Q24: LoadBalancer 외부 IP Pending
- Q25: DNS 조회 실패 또는 지연
- Q26: 외부 AI API 호출 timeout
- Q27: 멀티 네임스페이스 간 서비스 호출
- Q28: Linkerd 주입 미적용
- Q29: TCP keepalive 설정 상황
- Q30: 클러스터 내부 외부 SMTP 차단

---

## k3s 클러스터 FAQ

### Q1: 노드가 NotReady 상태입니다. 어떻게 확인하나요?

**증상**: `kubectl get nodes`에서 특정 노드가 `NotReady`로 표시됩니다.

**1단계: 노드 상태 상세 확인**

```bash
# 노드 상태 및 Condition 확인
kubectl get nodes -o wide
kubectl describe node <node-name>

# 주요 확인 포인트:
# Conditions 섹션: Ready=False 이유 확인
# Events 섹션: 최근 이벤트 확인
# Taints 섹션: node.kubernetes.io/not-ready taint 확인
```

**2단계: k3s 에이전트 서비스 확인**

```bash
# NotReady 노드에 SSH 접속 후
ssh user@<node-ip>

# k3s 에이전트 서비스 상태 확인
sudo systemctl status k3s-agent

# 에이전트 로그 확인
sudo journalctl -u k3s-agent -f --no-pager -n 100

# 주요 에러 패턴:
# "failed to connect to server" → 마스터 노드 연결 불가
# "certificate has expired" → TLS 인증서 만료
# "node is not registered" → 노드 재등록 필요
```

**3단계: 리소스 부족 확인**

```bash
# 노드 리소스 사용량 (metrics-server 필요)
kubectl top node <node-name>

# 노드의 디스크 사용량 (SSH 접속 후)
df -h
du -sh /var/lib/rancher/k3s/  # k3s 데이터 디렉토리

# 메모리 압박 확인
free -h
cat /proc/meminfo | grep MemAvailable
```

**4단계: 네트워크 연결성 확인**

```bash
# 마스터 → 워커 노드 연결 확인
ping <node-ip>
nc -zv <node-ip> 6443  # API 서버 포트

# k3s 플래넬 CNI 상태 확인 (k3s 기본 CNI)
sudo kubectl --kubeconfig /etc/rancher/k3s/k3s.yaml get pods -n kube-system | grep flannel
```

**해결책별 조치**:

| 원인 | 해결 방법 |
|------|---------|
| k3s-agent 서비스 중단 | `sudo systemctl restart k3s-agent` |
| TLS 인증서 만료 | `sudo k3s certificate rotate && sudo systemctl restart k3s-agent` |
| 디스크 공간 부족 | 불필요한 이미지 정리: `sudo k3s crictl rmi --prune` |
| 메모리 OOM | 리소스 제한 상향 또는 노드 스케일 아웃 |
| 네트워크 단절 | 방화벽 규칙 및 라우팅 테이블 확인 |

---

### Q2: etcd 데이터가 손상된 경우 복구 방법은?

**주의**: k3s의 기본 데이터베이스는 SQLite (단일 노드) 또는 etcd (HA 구성)입니다.

**k3s SQLite 복구 (단일 노드)**:

```bash
# k3s 중지
sudo systemctl stop k3s

# SQLite DB 파일 위치
ls -la /var/lib/rancher/k3s/server/db/state.db

# DB 무결성 검사
sqlite3 /var/lib/rancher/k3s/server/db/state.db "PRAGMA integrity_check;"

# 백업에서 복구 (Velero 또는 수동 백업)
sudo cp /backup/state.db.bak /var/lib/rancher/k3s/server/db/state.db
sudo systemctl start k3s
```

**etcd HA 구성 복구**:

```bash
# etcd 상태 확인
etcdctl --endpoints=https://127.0.0.1:2379 \
  --cacert=/var/lib/rancher/k3s/server/tls/etcd/server-ca.crt \
  --cert=/var/lib/rancher/k3s/server/tls/etcd/client.crt \
  --key=/var/lib/rancher/k3s/server/tls/etcd/client.key \
  endpoint status --write-out=table

# 특정 멤버 제거 후 재추가
etcdctl member list
etcdctl member remove <member-id>

# 스냅샷에서 복구
etcdctl snapshot restore /backup/etcd-snapshot.db \
  --name=<node-name> \
  --initial-cluster=<cluster-init-str> \
  --initial-advertise-peer-urls=https://<node-ip>:2380 \
  --data-dir=/var/lib/rancher/k3s/server/db/etcd

sudo systemctl restart k3s
```

**예방 조치**: Velero를 이용한 etcd 정기 백업 (매일 1회):

```bash
velero backup create etcd-backup-$(date +%Y%m%d) \
  --include-namespaces kube-system \
  --ttl 168h
```

---

### Q3: 클러스터 업그레이드를 안전하게 하는 방법은?

공공기관 SaaS 환경에서는 **블루-그린 업그레이드** 또는 **롤링 업그레이드** 중 하나를 선택합니다.

**롤링 업그레이드 절차 (다운타임 없음)**:

```bash
# Step 1: 업그레이드 전 전체 백업
velero backup create pre-upgrade-backup-$(date +%Y%m%d) --wait

# Step 2: 마스터 노드 업그레이드 (k3s 자동 업그레이드 CRD 활용)
cat <<EOF | kubectl apply -f -
apiVersion: upgrade.cattle.io/v1
kind: Plan
metadata:
  name: k3s-server
  namespace: system-upgrade
spec:
  concurrency: 1
  cordon: true
  nodeSelector:
    matchExpressions:
    - {key: node-role.kubernetes.io/master, operator: In, values: ["true"]}
  serviceAccountName: system-upgrade
  upgrade:
    image: rancher/k3s-upgrade
  channel: https://update.k3s.io/v1-release/channels/stable
EOF

# Step 3: 워커 노드 순차 업그레이드
cat <<EOF | kubectl apply -f -
apiVersion: upgrade.cattle.io/v1
kind: Plan
metadata:
  name: k3s-agent
  namespace: system-upgrade
spec:
  concurrency: 2   # 동시 업그레이드 노드 수 (PDB 준수)
  cordon: true
  nodeSelector:
    matchExpressions:
    - {key: node-role.kubernetes.io/master, operator: DoesNotExist}
  prepare:
    image: rancher/k3s-upgrade
    args: ["prepare", "k3s-server"]
  serviceAccountName: system-upgrade
  upgrade:
    image: rancher/k3s-upgrade
  channel: https://update.k3s.io/v1-release/channels/stable
EOF

# Step 4: 업그레이드 진행 모니터링
kubectl get nodes -w
kubectl get pods -n system-upgrade -w
```

**업그레이드 롤백**:

```bash
# 업그레이드 실패 시 특정 버전으로 다운그레이드
curl -sfL https://get.k3s.io | INSTALL_K3S_VERSION=v1.28.0+k3s1 sh -
sudo systemctl restart k3s
```

---

### Q4: 특정 노드에 Pod를 강제 배치하려면?

**방법 1: nodeSelector (단순)**

```yaml
# Deployment spec.template.spec에 추가
spec:
  nodeSelector:
    kubernetes.io/hostname: worker-node-01
    # 또는 커스텀 레이블
    node-type: gpu
    zone: kr-central-1a
```

```bash
# 노드에 레이블 추가
kubectl label node worker-node-01 node-type=gpu
```

**방법 2: nodeAffinity (조건부, 권장)**

```yaml
spec:
  affinity:
    nodeAffinity:
      # 필수 조건 (requiredDuringScheduling)
      requiredDuringSchedulingIgnoredDuringExecution:
        nodeSelectorTerms:
        - matchExpressions:
          - key: node-type
            operator: In
            values: [gpu, high-memory]
      # 선호 조건 (preferredDuringScheduling)
      preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 80
        preference:
          matchExpressions:
          - key: zone
            operator: In
            values: [kr-central-1a]
```

**방법 3: Taint/Toleration (노드 전용 예약)**

```bash
# AI 서비스 전용 노드 설정
kubectl taint node ai-node-01 dedicated=ai-service:NoSchedule

# AI 서비스 Deployment에 Toleration 추가
spec:
  tolerations:
  - key: dedicated
    operator: Equal
    value: ai-service
    effect: NoSchedule
```

---

### Q5: Taint/Toleration 설정 방법은?

**Taint 종류와 효과**:

| Effect | 의미 | 사용 케이스 |
|--------|------|-----------|
| `NoSchedule` | Toleration 없으면 스케줄 거부 | 특수 목적 노드 예약 |
| `PreferNoSchedule` | Toleration 없으면 스케줄 기피 | 소프트 격리 |
| `NoExecute` | 기존 Pod 퇴거 + 신규 스케줄 거부 | 노드 유지보수 |

```bash
# Taint 추가
kubectl taint node maintenance-node-01 \
  maintenance=true:NoSchedule

# Taint 제거 (끝에 - 추가)
kubectl taint node maintenance-node-01 \
  maintenance=true:NoSchedule-

# 노드의 현재 Taint 확인
kubectl describe node maintenance-node-01 | grep -A5 Taints
```

**공공기관 SaaS 권장 Taint 구성**:

```bash
# AI 서비스 전용 노드 (GPU 또는 고메모리)
kubectl taint node ai-node-01 workload=ai:NoSchedule

# 데이터베이스 전용 노드 (SSD 스토리지)
kubectl taint node db-node-01 workload=database:NoSchedule

# 감사/보안 서비스 전용 노드 (격리 강화)
kubectl taint node secure-node-01 csap=sensitive:NoSchedule
```

---

### Q6: 네임스페이스 삭제가 Terminating에 걸렸을 때?

**가장 흔한 원인**: Finalizer가 있는 리소스가 남아있어 삭제를 막는 상황입니다.

**Step 1: Terminating 원인 파악**

```bash
# 네임스페이스 상세 확인
kubectl describe namespace <terminating-ns>

# Finalizer 목록 확인
kubectl get namespace <terminating-ns> -o json | \
  jq '.spec.finalizers, .status.conditions'
```

**Step 2: Finalizer가 있는 리소스 탐색**

```bash
# 해당 네임스페이스의 모든 리소스 확인
kubectl api-resources --verbs=list --namespaced -o name | \
  xargs -n1 kubectl get --ignore-not-found \
  -n <terminating-ns> 2>/dev/null | grep -v "^NAME"

# CustomResource Finalizer 확인
kubectl get helmreleases,kustomizations \
  -n <terminating-ns> -o json | \
  jq '.items[] | select(.metadata.finalizers != null) | .metadata.name'
```

**Step 3: Finalizer 강제 제거 (최후 수단)**

```bash
# Flux HelmRelease finalizer 제거 예시
kubectl patch helmrelease <name> \
  -n <terminating-ns> \
  -p '{"metadata":{"finalizers":[]}}' \
  --type=merge

# 네임스페이스 finalizer 직접 제거
kubectl get namespace <terminating-ns> -o json | \
  jq '.spec.finalizers = []' | \
  kubectl replace --raw /api/v1/namespaces/<terminating-ns>/finalize -f -
```

**주의**: Finalizer 강제 제거는 감사 로그에 기록되며, CSAP 심사 시 설명이 필요할 수 있습니다.

---

### Q7: ResourceQuota 초과로 Pod 생성이 실패하면?

**증상**: `kubectl describe pod <pod-name>`에서 `exceeded quota` 오류가 나타납니다.

```bash
# 네임스페이스 쿼터 현황 확인
kubectl describe resourcequota -n <namespace>

# 출력 예시:
# Name:            tenant-quota
# Namespace:       public-saas
# Resource         Used    Hard
# --------         ----    ----
# cpu              1900m   2000m   ← 거의 초과
# memory           3.8Gi   4Gi     ← 거의 초과
# pods             19      20      ← 거의 초과
```

**단기 해결책 — 쿼터 임시 상향**:

```bash
# 쿼터 상향 (슈퍼 어드민 권한 필요)
kubectl edit resourcequota tenant-quota -n <namespace>

# 또는 patch로 CPU만 상향
kubectl patch resourcequota tenant-quota \
  -n <namespace> \
  -p '{"spec":{"hard":{"cpu":"4000m","memory":"8Gi"}}}' \
  --type=merge
```

**근본 해결책 — 리소스 최적화**:

```bash
# 네임스페이스 내 Pod별 리소스 사용량 확인
kubectl top pods -n <namespace> --sort-by=cpu

# 불필요한 Pod 제거
kubectl delete pod <idle-pod-name> -n <namespace>

# requests/limits 최적화 (과다 요청 파악)
kubectl get pods -n <namespace> -o json | \
  jq '.items[] | {name: .metadata.name, requests: .spec.containers[].resources.requests}'
```

---

### Q8: PodDisruptionBudget 설정 방법은?

PDB는 롤링 업데이트나 노드 드레인 시 최소 가용 Pod 수를 보장합니다.

```yaml
# 공공기관 SaaS 서비스별 PDB 권장 설정
---
# auth-service PDB (CSAP 고가용성 요건)
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: auth-service-pdb
  namespace: public-saas
spec:
  minAvailable: 2      # 최소 2개 Pod 유지 (중단 시 최대 1개 제거 가능)
  selector:
    matchLabels:
      app: auth-service
---
# tenant-service PDB
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: tenant-service-pdb
  namespace: public-saas
spec:
  maxUnavailable: 1    # 동시에 최대 1개만 중단 가능
  selector:
    matchLabels:
      app: tenant-service
```

```bash
# PDB 현황 확인
kubectl get pdb -n public-saas

# 노드 드레인 전 PDB 충족 여부 확인
kubectl drain <node-name> --dry-run=client --ignore-daemonsets
```

PDB 없이 드레인하면 모든 Pod가 동시에 중단될 수 있습니다. 특히 replicas=2인 서비스는 PDB 필수입니다.

---

### Q9: 노드 드레인 없이 롤링 업데이트 하면 어떻게 되나요?

`kubectl drain` 없이 노드를 재시작하거나 Cordoning하면:

1. 노드의 기존 Pod는 즉시 종료되지 않음 (그래도 실행 중)
2. 새 Pod는 해당 노드에 스케줄되지 않음 (`cordon` 효과)
3. 기존 Pod는 `Terminating` 상태로 전환됨 (graceful shutdown 시작)
4. Graceful shutdown 시간 초과 시 강제 종료 (`terminationGracePeriodSeconds`)

**권장 절차**:

```bash
# 1. 노드 Cordon (새 Pod 스케줄 차단)
kubectl cordon <node-name>

# 2. 기존 Pod 안전 이동 (PDB 준수)
kubectl drain <node-name> \
  --ignore-daemonsets \
  --delete-emptydir-data \
  --grace-period=60  # 60초 graceful shutdown 대기

# 3. 노드 작업 수행 (업그레이드, 유지보수 등)

# 4. Uncordon (다시 스케줄 허용)
kubectl uncordon <node-name>
```

**k3s graceful shutdown 설정** (`platform/packages/mesh-ready/src/graceful-shutdown.ts` 기반):

```typescript
// CSAP D-07: 서비스 간 통신 graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...')
  await server.close()
  await prisma.$disconnect()
  process.exit(0)
})
```

---

### Q10: Flux GitOps가 특정 HelmRelease를 계속 실패하면?

**Step 1: HelmRelease 상태 확인**

```bash
# HelmRelease 상태 및 에러 메시지 확인
kubectl get helmreleases -n flux-system
kubectl describe helmrelease <release-name> -n <namespace>

# flux CLI로 확인
flux get helmreleases --all-namespaces

# 에러 메시지 위치:
# Status.Conditions[type=Ready, status=False].Message
```

**Step 2: Helm Chart 검증**

```bash
# 차트 직접 렌더링 (values 포함)
helm template <release-name> <chart-repo>/<chart> \
  -f values.yaml \
  -n <namespace> | kubectl apply --dry-run=client -f -

# Helm 히스토리 확인
helm history <release-name> -n <namespace>

# Flux를 통한 차트 소스 새로고침
flux reconcile source helm <source-name>
flux reconcile helmrelease <release-name> -n <namespace>
```

**Step 3: 일반적인 실패 원인별 해결**

```bash
# 원인 1: values.yaml 스키마 검증 실패
# → HelmChart의 valuesFrom이나 spec.values 확인
kubectl get secret -n flux-system | grep helm-values

# 원인 2: CRD 미설치 (Chart에 CRD 포함된 경우)
# → crds/ 폴더가 있는 차트는 먼저 CRD 설치 필요
kubectl apply -f https://.../crds.yaml
flux reconcile helmrelease <release-name>

# 원인 3: 이전 릴리스 충돌
# Flux가 관리하는 릴리스를 직접 수정한 경우
helm uninstall <release-name> -n <namespace>
flux reconcile helmrelease <release-name>

# 원인 4: OOMKilled 중 업그레이드
# → Pod 리소스 limits 상향 후 재시도
```

---

## 스토리지 FAQ

### Q11: PVC가 Pending 상태에서 멈췄습니다. 원인은?

**Step 1: PVC 상태 상세 확인**

```bash
# PVC 이벤트 및 원인 확인 (가장 빠른 진단)
kubectl describe pvc <pvc-name> -n <namespace>

# 주요 에러 메시지:
# "no volume plugin matched" → StorageClass 없음
# "waiting for first consumer to be created" → WaitForFirstConsumer 바인딩 모드
# "node has no volume plugin for" → CSI 드라이버 미설치
# "insufficient available capacity" → 스토리지 용량 부족
```

**Step 2: StorageClass 확인**

```bash
# StorageClass 목록 및 기본값 확인
kubectl get storageclass

# NAME             PROVISIONER          RECLAIMPOLICY  BINDINGMODE
# local-path(default) rancher.io/local-path Delete     WaitForFirstConsumer
# nfs-client          k8s-sigs.io/nfs-sc   Delete     Immediate

# PVC의 storageClassName과 실제 StorageClass 일치 여부 확인
kubectl get pvc <pvc-name> -o jsonpath='{.spec.storageClassName}'
```

**Step 3: CSI 드라이버 상태 확인**

```bash
# CSI 노드 드라이버 상태
kubectl get csidrivers
kubectl get csinodes

# longhorn CSI 사용 시
kubectl get pods -n longhorn-system | grep -v Running
```

**원인별 해결**:

```bash
# 해결 1: WaitForFirstConsumer → Pod가 생성되면 자동 바인딩됨
# (일부러 기다리는 상태, 정상임)
kubectl get pods -n <namespace>  # Pod가 실행 중인지 확인

# 해결 2: StorageClass 지정 없이 기본값 없는 경우
kubectl patch pvc <pvc-name> \
  -p '{"spec":{"storageClassName":"local-path"}}' \
  --type=merge

# 해결 3: 용량 부족 → 기존 PV 정리 또는 스토리지 확장
kubectl get pv --sort-by='.spec.capacity.storage'
kubectl delete pv <released-pv>  # Released 상태 PV 정리
```

---

### Q12: 볼륨 용량 부족 시 온라인 확장 방법은?

**사전 조건**: StorageClass의 `allowVolumeExpansion: true` 설정 필요

```bash
# StorageClass 확장 가능 여부 확인
kubectl get storageclass local-path -o jsonpath='{.allowVolumeExpansion}'
# true → 온라인 확장 가능

# PVC 현재 용량 확인
kubectl get pvc <pvc-name> -n <namespace> -o jsonpath='{.status.capacity.storage}'
```

**온라인 볼륨 확장 절차**:

```bash
# Step 1: PVC 용량 증가 (10Gi → 50Gi)
kubectl patch pvc <pvc-name> \
  -n <namespace> \
  -p '{"spec":{"resources":{"requests":{"storage":"50Gi"}}}}' \
  --type=merge

# Step 2: 확장 상태 모니터링
kubectl describe pvc <pvc-name> -n <namespace>
# "waiting for user to (re-)start a pod" → Pod 재시작 필요 (파일시스템 확장)

# Step 3: Pod 재시작 (파일시스템 확장 적용)
kubectl rollout restart deployment/<deployment-name> -n <namespace>

# Step 4: 파일시스템 확장 완료 확인
kubectl exec -it <pod-name> -n <namespace> -- df -h /data
```

**PostgreSQL 볼륨 확장 시 주의사항**:

```bash
# PostgreSQL은 HA(Primary/Replica) 고려 필요
# Primary 먼저 확장 → 순서 준수

# CNPG(CloudNativePG) 사용 시
kubectl get cluster <cluster-name> -n <namespace>
# storage.size 필드 수정
kubectl patch cluster <cluster-name> \
  -n <namespace> \
  -p '{"spec":{"storage":{"size":"100Gi"}}}' \
  --type=merge
```

---

### Q13: ReadWriteMany PVC가 필요한데 왜 실패하나요?

**원인**: k3s 기본 `local-path` StorageClass는 `ReadWriteOnce`만 지원합니다.

```bash
# AccessMode 지원 현황
kubectl get storageclass -o json | \
  jq '.items[] | {name: .metadata.name, provisioner: .provisioner}'

# StorageClass별 AccessMode 지원:
# local-path: RWO만 지원 (단일 노드 마운트)
# nfs-client: RWO, ROX, RWX 모두 지원
# longhorn: RWO, RWX (NFS 모드) 지원
```

**ReadWriteMany 지원 스토리지 설치**:

```bash
# NFS 기반 스토리지 (권장 — 공공기관 온프레미스 환경)
helm repo add nfs-subdir-external-provisioner \
  https://kubernetes-sigs.github.io/nfs-subdir-external-provisioner/

helm install nfs-provisioner \
  nfs-subdir-external-provisioner/nfs-subdir-external-provisioner \
  --set nfs.server=<nfs-server-ip> \
  --set nfs.path=/exports/k8s-data \
  --set storageClass.name=nfs-rwx \
  --set storageClass.accessModes=ReadWriteMany

# NFS RWX PVC 생성
kubectl apply -f - <<EOF
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: shared-files-pvc
  namespace: public-saas
spec:
  storageClassName: nfs-rwx
  accessModes: [ReadWriteMany]
  resources:
    requests:
      storage: 100Gi
EOF
```

---

### Q14: 스냅샷이 생성됐는데 복구가 안 됩니다. 원인은?

```bash
# VolumeSnapshot 상태 확인
kubectl get volumesnapshots -n <namespace>
kubectl describe volumesnapshot <snapshot-name> -n <namespace>

# VolumeSnapshotContent 확인 (실제 스냅샷 데이터)
kubectl get volumesnapshotcontent

# 주요 에러:
# "VolumeSnapshotContent not found" → 스냅샷 데이터 유실
# "CSI snapshot driver not ready" → CSI 드라이버 문제
```

**복구 절차**:

```bash
# 스냅샷에서 새 PVC 생성
kubectl apply -f - <<EOF
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: restored-data-pvc
  namespace: <namespace>
spec:
  storageClassName: <storage-class>
  dataSource:
    name: <snapshot-name>
    kind: VolumeSnapshot
    apiGroup: snapshot.storage.k8s.io
  accessModes: [ReadWriteOnce]
  resources:
    requests:
      storage: 50Gi  # 스냅샷 크기 이상으로 설정
EOF

# 복구 진행 상태 확인
kubectl describe pvc restored-data-pvc -n <namespace>
```

---

### Q15: PostgreSQL 데이터 디렉토리 용량 경보가 울렸습니다.

**긴급 대응 (용량 >90%)**:

```bash
# Step 1: PostgreSQL Pod에서 용량 확인
kubectl exec -it <postgres-pod> -n public-saas -- \
  psql -U postgres -c "
    SELECT
      schemaname,
      tablename,
      pg_size_pretty(pg_total_relation_size(quote_ident(schemaname) || '.' || quote_ident(tablename))) AS size
    FROM pg_tables
    ORDER BY pg_total_relation_size(quote_ident(schemaname) || '.' || quote_ident(tablename)) DESC
    LIMIT 20;
  "

# Step 2: 불필요한 데이터 정리
# WAL 파일 정리 (주의: 활성 복제 확인 후)
kubectl exec -it <postgres-pod> -n public-saas -- \
  psql -U postgres -c "SELECT pg_switch_wal();"

# Step 3: VACUUM FULL (대용량 테이블 공간 회수 — 장시간 잠금 주의)
kubectl exec -it <postgres-pod> -n public-saas -- \
  psql -U postgres -c "VACUUM FULL ANALYZE audit_logs;"

# Step 4: 감사 로그 아카이브 (CSAP D-06: 1년 이상 보존)
# 90일 이상 오래된 감사 로그를 콜드 스토리지로 이전
kubectl exec -it <postgres-pod> -n public-saas -- \
  psql -U postgres -c "
    INSERT INTO audit_logs_archive
    SELECT * FROM audit_logs
    WHERE created_at < NOW() - INTERVAL '90 days';
  "
```

---

### Q16: 로그 볼륨이 가득 찼을 때 긴급 처리 방법은?

```bash
# Step 1: 로그 볼륨 사용량 상위 Pod 확인
kubectl top pods --all-namespaces --sort-by=cpu

# Step 2: 가장 큰 로그 파일 찾기
kubectl exec -it <loki-pod> -n monitoring -- \
  du -sh /data/loki/* | sort -rh | head -20

# Step 3: Loki 컴팩션 즉시 실행 (중복 청크 제거)
kubectl exec -it <loki-pod> -n monitoring -- \
  curl -X POST http://localhost:3100/loki/api/v1/admin/compaction/run

# Step 4: 보존 기간이 지난 로그 강제 삭제 (CSAP D-06 준수 범위 내)
# Loki 보존 설정 확인 (1년 이상인지 확인 후)
kubectl exec -it <loki-pod> -n monitoring -- \
  cat /etc/loki/loki.yaml | grep -A5 retention

# Step 5: 긴급 디스크 여유 공간 확보
kubectl exec -it <loki-pod> -n monitoring -- \
  find /data/loki -name "*.gz" -mtime +365 -delete  # 1년 초과 압축 파일
```

---

### Q17: Velero 백업이 실패하면 어떻게 하나요?

```bash
# Step 1: 백업 실패 상태 확인
velero backup describe <backup-name> --details
velero backup logs <backup-name>

# 주요 에러 패턴:
# "backup storage location not found" → 스토리지 설정 오류
# "volume backup failed" → CSI 스냅샷 문제
# "timeout waiting for backup" → 대용량 데이터, 타임아웃 증가 필요
```

**원인별 해결**:

```bash
# 해결 1: 백업 스토리지 연결 확인
velero backup-location get
velero backup-location check

# 스토리지 자격증명 재확인 (환경변수 기반 — CSAP D-09)
kubectl get secret velero-credentials -n velero -o yaml | \
  grep -v "^  data:" | grep -v "^data:"

# 해결 2: CSI 스냅샷 플러그인 활성화 확인
kubectl get pods -n velero | grep csi-snapshotter

# 해결 3: 타임아웃 증가
velero backup create <backup-name> \
  --snapshot-volumes \
  --wait-minutes 120  # 2시간으로 증가

# 해결 4: 특정 네임스페이스만 백업 (용량 문제)
velero backup create partial-backup \
  --include-namespaces public-saas \
  --exclude-resources pods,events
```

---

### Q18: 임시 파일이 PVC를 가득 채웠을 때?

```bash
# Step 1: 어떤 프로세스가 임시 파일을 생성하는지 확인
kubectl exec -it <pod-name> -n <namespace> -- \
  lsof | grep deleted  # 삭제됐지만 열려있는 파일

kubectl exec -it <pod-name> -n <namespace> -- \
  find /tmp -size +100M -mtime -1  # 최근 1일 내 100MB 이상 파일

# Step 2: 임시 파일 즉시 정리
kubectl exec -it <pod-name> -n <namespace> -- \
  find /tmp -name "*.tmp" -mtime +1 -delete
  
# Step 3: AI 서비스의 RAG 임시 파일 정리 예시
kubectl exec -it <ai-service-pod> -n public-saas -- \
  find /tmp/uploads -name "*.pdf" -mtime +1 -delete

# Step 4: emptyDir 볼륨으로 임시 파일 격리 (근본 해결)
# Pod spec에 임시 볼륨 추가
spec:
  volumes:
  - name: tmp-files
    emptyDir:
      sizeLimit: 5Gi  # 임시 파일 최대 5GB로 제한
  containers:
  - volumeMounts:
    - name: tmp-files
      mountPath: /tmp
```

---

### Q19: StorageClass가 없어서 PVC 생성이 실패하면?

```bash
# PVC 생성 실패 메시지 확인
kubectl describe pvc <pvc-name>
# Error: "no persistent volumes available for this claim and no storage class is set"

# 현재 StorageClass 목록 확인
kubectl get storageclass
# 아무것도 없거나 (default) 표시 없음

# k3s 기본 StorageClass 설치 (local-path-provisioner)
kubectl apply -f https://raw.githubusercontent.com/rancher/local-path-provisioner/master/deploy/local-path-storage.yaml

# 기본 StorageClass로 설정
kubectl patch storageclass local-path \
  -p '{"metadata":{"annotations":{"storageclass.kubernetes.io/is-default-class":"true"}}}'

# PVC 재생성 또는 기존 PVC에 StorageClass 지정
kubectl patch pvc <pvc-name> \
  -p '{"spec":{"storageClassName":"local-path"}}' \
  --type=merge
```

---

### Q20: 다른 네임스페이스의 PVC에 접근할 수 있나요?

**짧은 답변**: 기본적으로 불가능합니다. PVC는 네임스페이스 범위 리소스입니다.

**올바른 해결 방법**:

```bash
# 방법 1: 공유 데이터는 공통 네임스페이스에 PVC 생성
kubectl create namespace shared-storage
kubectl apply -f - <<EOF
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: shared-assets
  namespace: shared-storage
spec:
  storageClassName: nfs-rwx
  accessModes: [ReadWriteMany]
  resources:
    requests:
      storage: 100Gi
EOF

# 방법 2: PV → 여러 네임스페이스에서 PVC 바인딩 (ClaimRef 설정)
# (읽기 전용 공유 데이터에 적합)
kubectl apply -f - <<EOF
apiVersion: v1
kind: PersistentVolume
metadata:
  name: shared-pv
spec:
  capacity:
    storage: 50Gi
  accessModes: [ReadOnlyMany]
  nfs:
    server: <nfs-server>
    path: /exports/shared
  claimRef:           # 특정 PVC에 미리 바인딩하지 않음
    namespace: ~
EOF
```

**N2SF N-03 주의**: 테넌트 간 스토리지 공유는 데이터 격리 위반입니다. 공유 스토리지는 비테넌트 공용 파일(정적 에셋 등)에만 사용하세요.

---

## 네트워크 FAQ

### Q21: 서비스 간 통신이 갑자기 안 됩니다. 확인 방법은?

**체계적 진단 절차**:

```bash
# Step 1: 대상 서비스 정상 동작 확인
kubectl get pods -n public-saas -l app=<target-service>
kubectl describe service <target-service> -n public-saas

# Step 2: 서비스 EndpointSlice 확인 (백엔드 Pod 연결)
kubectl get endpointslice -n public-saas | grep <target-service>
kubectl describe endpointslice -n public-saas <endpointslice-name>
# "endpoints: (none)" → Pod가 없거나 readinessProbe 실패

# Step 3: DNS 해석 확인
kubectl run dns-test --image=busybox:1.36 --rm -it --restart=Never -- \
  nslookup <target-service>.public-saas.svc.cluster.local

# Step 4: 직접 연결 테스트
kubectl run conn-test --image=curlimages/curl --rm -it --restart=Never -- \
  curl -v http://<target-service>.public-saas.svc.cluster.local:<port>/health
```

**일반적인 원인과 해결**:

| 원인 | 증상 | 해결 |
|------|------|------|
| Pod readinessProbe 실패 | Endpoints 비어있음 | readinessProbe 로그 확인 |
| NetworkPolicy 차단 | 연결 거부(Connection refused) | Q22 참조 |
| 서비스 포트 불일치 | Connection refused | selector/port 재확인 |
| DNS 캐시 문제 | 특정 노드에서만 실패 | CoreDNS Pod 재시작 |

---

### Q22: NetworkPolicy가 내 Pod를 차단하는지 확인하려면?

```bash
# Step 1: 대상 네임스페이스의 NetworkPolicy 목록
kubectl get networkpolicies -n public-saas

# Step 2: 특정 Pod에 적용되는 NetworkPolicy 확인
kubectl describe networkpolicy -n public-saas | \
  grep -A20 "Pod Selector"

# Step 3: Cilium 사용 시 실시간 정책 추적
cilium monitor --type drop 2>/dev/null | head -50
# "Policy denied" 메시지 탐지

# Step 4: Hubble UI로 시각화 확인
hubble observe --namespace public-saas --to-pod <pod-name> --verdict DROPPED

# Step 5: 임시 진단 — NetworkPolicy를 테스트 네임스페이스로 격리
kubectl label namespace public-saas network-policy-test=true
```

**NetworkPolicy 디버깅 예시**:

```yaml
# 현재 적용된 NetworkPolicy 확인 후
# ingress 규칙에 소스 Pod가 허용되어 있는지 확인
kubectl describe networkpolicy tenant-service-netpol -n public-saas

# 예시 출력:
# Spec:
#   PodSelector: app=tenant-service
#   Ingress:
#     From:
#       NamespaceSelector: kubernetes.io/metadata.name=public-saas
#       PodSelector: app=api-gateway  ← api-gateway에서만 허용
#
# → api-gateway가 아닌 다른 Pod에서 직접 호출 시 차단됨
```

---

### Q23: Ingress를 추가했는데 HTTPS가 동작 안 합니다.

```bash
# Step 1: Ingress 상태 확인
kubectl describe ingress <ingress-name> -n public-saas

# Step 2: cert-manager 인증서 상태 확인
kubectl get certificate -n public-saas
kubectl describe certificate <cert-name> -n public-saas

# Certificate 상태:
# Ready=False, Reason=Failed → ACME 챌린지 실패
# Ready=False, Reason=Issuing → 발급 중 (정상, 대기)

# Step 3: ACME 챌린지 확인
kubectl get certificaterequest -n public-saas
kubectl describe challenge <challenge-name> -n public-saas

# Step 4: Traefik IngressRoute 사용 시
kubectl get ingressroute -n public-saas
kubectl describe ingressroute <route-name> -n public-saas
```

**HTTPS 인증서 수동 발급**:

```bash
# cert-manager가 자동 발급 실패 시 수동 트리거
kubectl delete certificate <cert-name> -n public-saas
kubectl apply -f - <<EOF
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: <cert-name>
  namespace: public-saas
spec:
  secretName: <cert-secret>
  issuerRef:
    name: letsencrypt-prod  # 또는 내부 CA
    kind: ClusterIssuer
  dnsNames:
  - api.example.go.kr
  - portal.example.go.kr
EOF
```

**공공기관 주의사항**: 공인 CA 인증서를 사용할 수 없는 망분리 환경에서는 내부 CA(InternalCA)를 ClusterIssuer로 등록하세요.

---

### Q24: LoadBalancer 서비스 외부 IP가 Pending입니다.

```bash
# 확인
kubectl get service <svc-name> -n public-saas
# EXTERNAL-IP: <pending> 상태

# Step 1: k3s 환경에서는 metallb 또는 klipper-lb 필요
kubectl get pods -n kube-system | grep -E "svclb|metallb"

# Step 2: MetalLB 설치 (온프레미스)
helm install metallb metallb/metallb -n metallb-system

# IP 주소 풀 설정
kubectl apply -f - <<EOF
apiVersion: metallb.io/v1beta1
kind: IPAddressPool
metadata:
  name: public-saas-pool
  namespace: metallb-system
spec:
  addresses:
  - 192.168.100.200-192.168.100.250  # 온프레미스 IP 범위
---
apiVersion: metallb.io/v1beta1
kind: L2Advertisement
metadata:
  name: public-saas-l2advert
  namespace: metallb-system
EOF

# Step 3: 외부 IP 할당 확인
kubectl get service <svc-name> -n public-saas -w
```

---

### Q25: DNS 조회가 실패하거나 느릴 때?

```bash
# Step 1: CoreDNS Pod 상태 확인
kubectl get pods -n kube-system -l k8s-app=kube-dns
kubectl logs -n kube-system -l k8s-app=kube-dns --tail=50

# Step 2: DNS 조회 지연 측정
kubectl run dnstest --image=busybox:1.36 --rm -it --restart=Never -- \
  sh -c "for i in \$(seq 1 10); do time nslookup tenant-service.public-saas.svc.cluster.local; done"

# Step 3: ndots 설정 확인 (잘못된 설정으로 외부 DNS 우회 발생)
kubectl run dnstest --image=busybox:1.36 --rm -it --restart=Never -- \
  cat /etc/resolv.conf
# ndots:5 → 짧은 이름에 .svc.cluster.local 등 5번 시도 후 상위 DNS 전달

# Step 4: CoreDNS 설정 튜닝
kubectl edit configmap coredns -n kube-system
# cache 플러그인: 캐시 TTL 증가
# forward 플러그인: 업스트림 DNS 서버 확인
```

**CoreDNS 성능 최적화**:

```yaml
# CoreDNS Corefile 최적화 설정
.:53 {
    errors
    health {
       lameduck 5s
    }
    ready
    kubernetes cluster.local in-addr.arpa ip6.arpa {
       pods insecure
       fallthrough in-addr.arpa ip6.arpa
       ttl 30
    }
    prometheus :9153
    forward . /etc/resolv.conf {
       max_concurrent 1000
    }
    cache 30          # 30초 캐시 (기본 30)
    loop
    reload
    loadbalance
}
```

---

### Q26: 외부 AI API 호출이 timeout됩니다. 이그레스 규칙은?

**공공기관 SaaS 외부 AI API 허용 규칙**:

```yaml
# NetworkPolicy: AI 서비스만 외부 API 호출 허용 (N2SF N-05)
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: ai-service-egress
  namespace: public-saas
spec:
  podSelector:
    matchLabels:
      app: ai-service  # AI 서비스 Pod만 해당
  policyTypes:
  - Egress
  egress:
  # 클러스터 내부 통신 허용
  - to:
    - namespaceSelector: {}
  # 외부 AI API만 허용 (포트 443)
  - to:
    - ipBlock:
        cidr: 0.0.0.0/0
        except:
        - 10.0.0.0/8    # 사설망 제외
        - 172.16.0.0/12
        - 192.168.0.0/16
    ports:
    - port: 443
      protocol: TCP
```

**timeout 디버깅**:

```bash
# AI Gateway Pod에서 직접 연결 테스트
kubectl exec -it <ai-service-pod> -n public-saas -- \
  curl -v --max-time 30 https://api.anthropic.com/v1/messages \
  -H "x-api-key: test" 2>&1 | head -30

# 프록시 설정 확인 (망분리 환경)
kubectl exec -it <ai-service-pod> -n public-saas -- \
  env | grep -i proxy

# Timeout 값 증가 (ai-service 환경변수)
kubectl set env deployment/ai-service \
  -n public-saas \
  AI_API_TIMEOUT_MS=60000  # 60초로 증가
```

**N2SF 준수**: 외부 AI API 호출 시 반드시 O등급 데이터만 전송하고, PII 마스킹을 적용해야 합니다.

---

### Q27: 멀티 네임스페이스 간 서비스 호출 방법은?

```bash
# 서비스 DNS 전체 경로 사용
# 형식: <service-name>.<namespace>.svc.cluster.local

# 예시: public-saas 네임스페이스에서 monitoring 네임스페이스의 Prometheus 호출
curl http://prometheus-server.monitoring.svc.cluster.local:9090/api/v1/query

# 예시: tenant-service가 auth-service 호출 (같은 namespace)
http://auth-service:3001/auth/verify

# 예시: 다른 네임스페이스의 서비스 호출
http://compliance-service.audit-ns.svc.cluster.local:3010/compliance/check
```

**NetworkPolicy 설정 (네임스페이스 간 허용)**:

```yaml
# auth-service가 public-saas 네임스페이스에서만 호출받도록 설정
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: auth-service-ingress
  namespace: auth-ns
spec:
  podSelector:
    matchLabels:
      app: auth-service
  ingress:
  - from:
    # public-saas 네임스페이스의 모든 Pod 허용
    - namespaceSelector:
        matchLabels:
          kubernetes.io/metadata.name: public-saas
    # 또는 특정 서비스만 허용
    - namespaceSelector:
        matchLabels:
          kubernetes.io/metadata.name: public-saas
      podSelector:
        matchLabels:
          app: tenant-service
```

---

### Q28: Linkerd 주입이 특정 Pod에 안 됩니다. 왜?

```bash
# Step 1: Linkerd 주입 상태 확인
kubectl get pods -n public-saas -o json | \
  jq '.items[] | {name: .metadata.name, sidecar: .spec.containers[].name}' | \
  grep -B1 linkerd

# Step 2: 주입 제외 어노테이션 확인
kubectl describe pod <pod-name> -n public-saas | grep -A5 Annotations
# linkerd.io/inject: disabled → 명시적으로 제외됨

# Step 3: Namespace 레벨 주입 설정 확인
kubectl get namespace public-saas -o json | \
  jq '.metadata.annotations'
# "linkerd.io/inject": "enabled" → 네임스페이스 전체 주입 활성화
```

**주입 실패 원인별 해결**:

```bash
# 원인 1: init container 권한 부족
# → Linkerd init container는 NET_ADMIN 권한 필요
kubectl get pod <pod-name> -o json | jq '.spec.initContainers'

# 원인 2: 호스트 네트워크 사용
# → hostNetwork: true Pod는 Linkerd 주입 불가
kubectl describe pod <pod-name> | grep "Host Network"

# 원인 3: Linkerd trust anchor 만료
linkerd check --proxy
linkerd identity --certs | grep -E "NotAfter|NotBefore"

# 강제 재주입
kubectl rollout restart deployment/<deployment-name> -n public-saas
```

---

### Q29: TCP keepalive 설정이 필요한 상황은?

**TCP keepalive가 필요한 상황**:

1. **AI API 장시간 스트리밍 응답**: LLM 스트리밍 응답은 수십 초 이상 걸릴 수 있음
2. **PostgreSQL 유휴 연결**: 연결 풀 유휴 연결이 NAT 장비나 방화벽에 의해 끊길 수 있음
3. **외부 SMTP 연결**: 장시간 연결 유지 시 방화벽 타임아웃

```typescript
// Node.js에서 TCP keepalive 설정 예시
// platform/services/ai-service/src/lib/ai-gateway.ts

import https from 'node:https'

const httpsAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 60000,    // 60초마다 keepalive 패킷 전송
  maxSockets: 10,            // 최대 10개 연결 유지
  timeout: 120000,           // 120초 소켓 타임아웃
})

// AI API 호출 시 에이전트 사용
const response = await fetch('https://api.anthropic.com/v1/messages', {
  agent: httpsAgent,
  signal: AbortSignal.timeout(60000), // CSAP D-07: 타임아웃 필수
})
```

**PostgreSQL keepalive 설정**:

```typescript
// Prisma 연결 문자열에 keepalive 파라미터 추가
// DATABASE_URL="postgresql://user:pass@host:5432/db?keepalives=1&keepalives_idle=60"

// 또는 Prisma datasource에서 설정
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  // keepalives는 connection string에서 설정
}
```

---

### Q30: 클러스터 내부에서 외부 SMTP 연결이 차단됩니다.

```bash
# Step 1: SMTP 포트 연결 테스트
kubectl run smtp-test --image=busybox:1.36 --rm -it --restart=Never -- \
  nc -zv <smtp-server> 587

# 연결 거부 시 → 이그레스 NetworkPolicy 또는 방화벽 문제

# Step 2: notification-service의 NetworkPolicy 확인
kubectl get networkpolicy -n public-saas -o yaml | \
  grep -A20 "notification"

# Step 3: SMTP 이그레스 허용 NetworkPolicy 추가
kubectl apply -f - <<EOF
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: notification-service-smtp-egress
  namespace: public-saas
spec:
  podSelector:
    matchLabels:
      app: notification-service
  policyTypes:
  - Egress
  egress:
  # 클러스터 내부
  - to:
    - namespaceSelector: {}
  # SMTP 서버 (STARTTLS 587, SMTPS 465)
  - to:
    - ipBlock:
        cidr: <smtp-server-ip>/32
    ports:
    - port: 587
      protocol: TCP
    - port: 465
      protocol: TCP
  # DNS 해석 허용
  - to:
    - namespaceSelector:
        matchLabels:
          kubernetes.io/metadata.name: kube-system
      podSelector:
        matchLabels:
          k8s-app: kube-dns
    ports:
    - port: 53
      protocol: UDP
EOF
```

**망분리 환경 SMTP 대안**:

```
공공기관 망분리 환경에서는 외부 SMTP 직접 연결이 불가능한 경우가 많습니다.
대안:
  1. 내부 SMTP 릴레이 서버를 통한 이메일 발송
  2. 망간 데이터 연계 시스템을 통한 이메일 전달
  3. 전자정부 표준 알림 API (행안부 제공)
```

---

## Mermaid 다이어그램

### K8s 장애 진단 결정 트리

```mermaid
flowchart TD
    START([장애 발생]) --> A{증상 분류}

    A -->|Pod 시작 안됨| B{Pod 상태 확인}
    A -->|서비스 접근 불가| C{서비스 레이어 확인}
    A -->|성능 저하| D{리소스 모니터링}
    A -->|데이터 손실| E{스토리지 확인}

    B -->|Pending| B1{스케줄 실패 원인}
    B -->|CrashLoopBackOff| B2[kubectl logs --previous\n이전 컨테이너 로그]
    B -->|ImagePullBackOff| B3[이미지 레지스트리 접근\n자격증명 확인]
    B -->|OOMKilled| B4[메모리 limits 상향\n또는 메모리 누수 조사]

    B1 -->|Insufficient resources| B11[kubectl top nodes\n리소스 부족 확인]
    B1 -->|NodeAffinity 불만족| B12[노드 레이블 확인\nkubectl get nodes --show-labels]
    B1 -->|PVC Pending| B13[→ Q11 참조\nStorageClass 확인]

    C -->|DNS 실패| C1[CoreDNS Pod 상태\nnslookup 테스트]
    C -->|Connection refused| C2{Endpoints 확인}
    C -->|403 Forbidden| C3[NetworkPolicy 확인\n→ Q22 참조]
    C -->|HTTPS 실패| C4[cert-manager 인증서\n→ Q23 참조]

    C2 -->|비어있음| C21[readinessProbe 실패\nkubectl describe pod]
    C2 -->|정상| C22[서비스 포트/selector\n재확인]

    D -->|CPU 높음| D1[kubectl top pods\nHPA 동작 확인]
    D -->|메모리 높음| D2[메모리 누수 의심\nheap dump 수집]
    D -->|디스크 I/O 높음| D3[PVC 성능 확인\niostat on node]
    D -->|네트워크 지연| D4[Linkerd 메시 확인\nlinkerd check]

    E -->|PVC Pending| B13
    E -->|데이터 없음| E1[PV 상태 확인\nReclaim Policy 확인]
    E -->|마운트 실패| E2[CSI 드라이버 상태\nkubectl get csinodes]

    B11 --> RESOLVE[해결 방안 적용]
    B12 --> RESOLVE
    B13 --> RESOLVE
    C1 --> RESOLVE
    C21 --> RESOLVE
    C22 --> RESOLVE
    D1 --> RESOLVE
    E1 --> RESOLVE

    RESOLVE --> TEST{검증}
    TEST -->|통과| END([정상화 완료\n감사 로그 기록])
    TEST -->|실패| START

    style START fill:#f88,stroke:#f33
    style END fill:#8f8,stroke:#0a0
    style RESOLVE fill:#88f,color:#fff
```

### 네트워크 문제 디버깅 플로우

```mermaid
flowchart LR
    subgraph 진단 도구
        A[kubectl describe pod]
        B[kubectl logs]
        C[nslookup / dig]
        D[curl / nc]
        E[kubectl get networkpolicy]
        F[hubble observe]
    end

    subgraph 네트워크 레이어
        L1[Pod 내부\n컨테이너]
        L2[클러스터 DNS\nCoreDNS]
        L3[서비스\nClusterIP/NodePort]
        L4[Ingress\nTraefik/Nginx]
        L5[외부 네트워크\n방화벽/NAT]
    end

    subgraph 장애 지점별 진단
        D1[컨테이너 시작 실패\n→ kubectl logs]
        D2[DNS 해석 실패\n→ nslookup 테스트]
        D3[서비스 연결 거부\n→ Endpoints 확인]
        D4[Ingress 502/503\n→ 백엔드 Pod 상태]
        D5[외부 통신 차단\n→ NetworkPolicy + 방화벽]
    end

    L1 --> D1
    L2 --> D2
    L3 --> D3
    L4 --> D4
    L5 --> D5

    D1 --> A
    D1 --> B
    D2 --> C
    D3 --> D
    D3 --> E
    D4 --> B
    D5 --> E
    D5 --> F

    A --> FIX[수정 적용]
    B --> FIX
    C --> FIX
    D --> FIX
    E --> FIX
    F --> FIX

    style FIX fill:#4a9eff,color:#fff
```

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-13 | 최초 작성 — 인프라 운영 심화 FAQ 30가지 | Implementer (Sonnet) |
