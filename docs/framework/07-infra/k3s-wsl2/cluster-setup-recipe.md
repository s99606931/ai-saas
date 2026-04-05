# k3s WSL2 클러스터 설치 레시피

| 항목 | 내용 |
|------|------|
| 문서 ID | INFRA-K3S-RECIPE |
| 버전 | 1.0.0 |
| 최종 수정일 | 2026-04-05 |
| 대상 | DevOps 엔지니어, 인프라 운영팀 |
| 설치 소요 시간 | 10분 이내 |
| FR 매핑 | FR-5.1 (10분 이내 k3s 구성), INFR-2 (CSAP-D11 보안) |
| 참조 규정 | REF-01 (CSAP 표준등급), REF-03 (N2SF) |

<!-- Design Ref: MTU-I1-k3s-wsl2.design.md 2.1절 -- 레시피 설계 -->
<!-- Plan SC: WSL2에서 10분 이내 k3s 설치 재현 -->

---

## 1. 사전 요건

### 1.1 시스템 요건

| 요건 | 최소 | 권장 | 확인 명령 |
|------|------|------|---------|
| OS | Windows 10 21H2+ | Windows 11 | `winver` |
| WSL2 | Ubuntu 22.04 LTS | Ubuntu 24.04 LTS | `lsb_release -a` |
| 메모리 | 4GB (WSL2 할당) | 8GB | `free -h` |
| 디스크 | 10GB 여유 | 20GB | `df -h /` |
| CPU | 2코어 | 4코어 | `nproc` |

### 1.2 WSL2 설정 (`.wslconfig`)

Windows 사용자 디렉토리(`%USERPROFILE%`)에 `.wslconfig` 파일을 생성합니다:

```ini
# %USERPROFILE%/.wslconfig
[wsl2]
memory=4GB
processors=2
swap=0
localhostForwarding=true
kernelCommandLine=cgroup_enable=cpuset cgroup_memory=1 cgroup_enable=memory
```

**중요**: swap은 반드시 비활성화해야 합니다 (Kubernetes 요건).

설정 변경 후 PowerShell에서 WSL 재시작:

```powershell
wsl --shutdown
wsl -d Ubuntu
```

### 1.3 사전 확인 명령

```bash
# WSL2 커널 버전 확인 (5.15+)
uname -r

# systemd 활성화 확인
systemctl --version

# cgroup v2 확인
cat /sys/fs/cgroup/cgroup.controllers

# swap 비활성화 확인
free -h | grep Swap   # Swap: 0B 이어야 함
```

---

## 2. k3s 설치

### 2.1 CNI 선택 가이드

| CNI 옵션 | NetworkPolicy | WSL2 적합성 | 리소스 사용 | CSAP-D10 준수 | 권장도 |
|---------|-------------|-----------|----------|-------------|-------|
| **kube-router** (권장) | 지원 | 최적 | 낮음 (~50MB) | 준수 | 권장 |
| Calico | 지원 | 보통 | 높음 (~200MB) | 준수 | 가능 |
| Flannel 단독 | **미지원** | 최적 | 최소 | **위반** | 금지 |
| Cilium | 지원 | 보통 | 높음 (~300MB) | 준수 | 가능 |

**선택 근거**: WSL2 메모리 제한(4GB) 환경에서 NetworkPolicy를 지원하면서 리소스 사용이 최소인 kube-router를 권장합니다.

### 2.2 자동 설치 (권장)

```bash
# 자동화 스크립트 실행 (10분 이내)
chmod +x scripts/install-k3s.sh
sudo ./scripts/install-k3s.sh
```

### 2.3 수동 설치

수동으로 설치하는 경우 아래 단계를 순서대로 실행합니다.

**Step 1: k3s 설치 (버전 고정)**

```bash
# k3s v1.29 LTS 설치
# --flannel-backend=none: 기본 Flannel 비활성화 (kube-router 사용)
# --disable=traefik: 별도 인그레스 컨트롤러 사용
# --disable-network-policy: k3s 내장 정책 비활성화 (kube-router가 대체)
# --protect-kernel-defaults: 커널 매개변수 보호
# --secrets-encryption: etcd 시크릿 암호화

export INSTALL_K3S_VERSION="v1.29.12+k3s1"

curl -sfL https://get.k3s.io | sh -s - \
  --flannel-backend=none \
  --disable=traefik \
  --disable-network-policy \
  --protect-kernel-defaults \
  --secrets-encryption \
  --write-kubeconfig-mode 644 \
  --cluster-cidr=10.42.0.0/16 \
  --service-cidr=10.43.0.0/16
```

**Step 2: kube-router CNI 설치**

```bash
# kube-router 설치 (NetworkPolicy 지원)
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml

kubectl apply -f https://raw.githubusercontent.com/cloudnativelabs/kube-router/master/daemonset/kubeadm-kuberouter.yaml
```

**Step 3: kubectl 설정**

```bash
# kubeconfig 설정
mkdir -p ~/.kube
sudo cp /etc/rancher/k3s/k3s.yaml ~/.kube/config
sudo chown $(id -u):$(id -g) ~/.kube/config
export KUBECONFIG=~/.kube/config

# .bashrc에 영구 설정
echo 'export KUBECONFIG=~/.kube/config' >> ~/.bashrc
```

**Step 4: 설치 확인**

```bash
# 노드 상태 확인
kubectl get nodes
# 예상 출력: NAME   STATUS   ROLES                  AGE   VERSION
#            wsl2   Ready    control-plane,master   30s   v1.29.12+k3s1

# 시스템 Pod 확인
kubectl get pods -n kube-system

# kube-router 동작 확인
kubectl get pods -n kube-system -l k8s-app=kube-router
```

---

## 3. CSAP-D11 보안 강화

설치 후 반드시 보안 설정을 적용합니다. 상세 체크리스트는 `container-security-baseline.md`를 참조하십시오.

### 3.1 Pod Security Standards (PSS) 적용

```bash
# 네임스페이스별 PSS 레이블 적용 (restricted 모드)
kubectl label namespace default \
  pod-security.kubernetes.io/enforce=restricted \
  pod-security.kubernetes.io/audit=restricted \
  pod-security.kubernetes.io/warn=restricted

# 서비스 네임스페이스 생성 + PSS 적용
kubectl create namespace saas-app
kubectl label namespace saas-app \
  pod-security.kubernetes.io/enforce=restricted \
  pod-security.kubernetes.io/audit=restricted \
  pod-security.kubernetes.io/warn=restricted
```

### 3.2 NetworkPolicy 기본 차단

```yaml
# deny-all.yaml -- 기본 거부 정책 (CSAP-D10-01 방화벽 운영)
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: deny-all
  namespace: saas-app
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress
```

```bash
kubectl apply -f deny-all.yaml
```

### 3.3 etcd 시크릿 암호화 확인

```bash
# 시크릿 암호화 설정 확인
sudo cat /var/lib/rancher/k3s/server/cred/encryption-config.json

# 테스트: 시크릿 생성 후 etcd에서 암호화 확인
kubectl create secret generic test-secret --from-literal=password=test123 -n saas-app
sudo k3s etcd-snapshot ls  # 스냅샷에서 평문 미노출 확인
kubectl delete secret test-secret -n saas-app
```

### 3.4 RBAC 기본 설정

```yaml
# read-only-role.yaml -- 읽기 전용 역할 (CSAP-D08-04 RBAC)
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: saas-readonly
rules:
- apiGroups: [""]
  resources: ["pods", "services", "configmaps"]
  verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: saas-readonly-binding
subjects:
- kind: ServiceAccount
  name: saas-viewer
  namespace: saas-app
roleRef:
  kind: ClusterRole
  name: saas-readonly
  apiGroup: rbac.authorization.k8s.io
```

---

## 4. 검증

### 4.1 기능 검증

```bash
# 1. 노드 Ready 상태
kubectl get nodes
# 기대: STATUS = Ready

# 2. 시스템 Pod 정상
kubectl get pods -n kube-system --no-headers | awk '{print $3}' | sort | uniq -c
# 기대: 모두 Running

# 3. NetworkPolicy 동작 테스트
kubectl run test-pod --image=busybox --restart=Never -n saas-app -- sleep 3600
kubectl exec -n saas-app test-pod -- wget -qO- --timeout=3 http://kubernetes.default.svc 2>&1 || echo "BLOCKED (expected)"
kubectl delete pod test-pod -n saas-app

# 4. DNS 동작 확인
kubectl run dns-test --image=busybox --restart=Never -- nslookup kubernetes.default.svc.cluster.local
kubectl logs dns-test
kubectl delete pod dns-test
```

### 4.2 성능 검증

```bash
# 설치 시간 측정 (스크립트 실행 시)
time sudo ./scripts/install-k3s.sh
# 기대: real < 10m0.000s

# 리소스 사용량 확인
kubectl top nodes  # (metrics-server 설치 후)
free -h
```

---

## 5. 문제 해결 (FAQ)

### FAQ-01: k3s 서비스 시작 실패

```bash
# 증상: k3s.service failed
sudo journalctl -xeu k3s.service

# 해결: cgroup 설정 확인
cat /proc/cgroups | grep -E 'cpu|memory'
# cgroup v2가 아닌 경우 .wslconfig의 kernelCommandLine 확인
```

### FAQ-02: kube-router Pod CrashLoopBackOff

```bash
# 증상: kube-router가 시작 후 재시작 반복
kubectl logs -n kube-system -l k8s-app=kube-router --tail=50

# 해결: flannel이 아직 실행 중인 경우
kubectl delete daemonset svclb-traefik -n kube-system 2>/dev/null
# k3s 재시작
sudo systemctl restart k3s
```

### FAQ-03: kubectl 권한 오류

```bash
# 증상: The connection to the server localhost:6443 was refused
# 해결: kubeconfig 경로 확인
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
kubectl get nodes
```

### FAQ-04: WSL2 메모리 부족

```bash
# 증상: OOMKilled Pod 발생
# 해결: .wslconfig 메모리 증가
# memory=4GB -> memory=6GB 이상 권장
# WSL 재시작 후 확인
free -h
```

### FAQ-05: PSS 제한으로 Pod 생성 실패

```bash
# 증상: Pod 생성 시 "violates PodSecurity" 오류
# 해결: Pod spec에 securityContext 추가
# securityContext:
#   runAsNonRoot: true
#   runAsUser: 1000
#   seccompProfile:
#     type: RuntimeDefault
#   allowPrivilegeEscalation: false
#   capabilities:
#     drop: ["ALL"]
```

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | 최초 작성 -- 5섹션 레시피, kube-router CNI, CSAP-D11 보안 | Claude Code (PM Lead) |
