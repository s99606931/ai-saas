# 컨테이너 보안 기준선 (Container Security Baseline)

| 항목 | 내용 |
|------|------|
| 문서 ID | INFRA-CONTAINER-SEC |
| 버전 | 1.0.0 |
| 최종 수정일 | 2026-04-05 |
| 대상 | 보안 담당자, DevOps 엔지니어, CSAP 인증 심사 대응 팀 |
| 참조 규정 | REF-01 (CSAP 표준등급), CIS Kubernetes Benchmark v1.8 |
| FR 매핑 | INFR-2 (CSAP-D11 보안), FR-5.1 (k3s 클러스터 보안) |
| 관련 MTU | MTU-I1 (k3s WSL2), MTU-C3 (D08~D13 구현 가이드) |

<!-- Design Ref: MTU-I1-k3s-wsl2.design.md 2.3절 -- 보안 기준선 설계 -->
<!-- Plan SC: CSAP-D11-01~07 보안 설정 체크리스트 7개 항목 통과 -->

---

## 목적

k3s WSL2 클러스터에 적용할 컨테이너 보안 기준선을 정의합니다. CSAP 표준등급 D11(가상화 보안) 7개 통제항목을 CIS Kubernetes Benchmark와 매핑하고, 각 항목별 k3s 구현 방법과 검증 명령을 제공합니다.

**적용 시점**: `install-k3s.sh` 실행 후, 워크로드 배포 전에 이 체크리스트를 점검합니다.

---

## 1. CSAP-D11 x CIS Benchmark 매핑 체크리스트

### CSAP-D11-01: 가상 머신 격리 (중요도: 상)

| 항목 | 내용 |
|------|------|
| **CSAP 요건** | 테넌트 간 가상 머신(컨테이너) 격리 보장. 리소스 격리(CPU, 메모리, 디스크) 설정 확인 |
| **CIS 매핑** | CIS 4.1 워커 노드 격리, CIS 5.7 Pod 리소스 제한 |
| **k3s 구현** | Pod Security Standards (restricted) + ResourceQuota + LimitRange |

**구현 방법**:

```yaml
# 1. Pod Security Standards (restricted) -- install-k3s.sh에서 자동 적용
# 네임스페이스 레이블로 적용됨 (Step 4)

# 2. ResourceQuota -- 네임스페이스별 리소스 상한 설정
apiVersion: v1
kind: ResourceQuota
metadata:
  name: saas-quota
  namespace: saas-app
spec:
  hard:
    requests.cpu: "4"
    requests.memory: 4Gi
    limits.cpu: "8"
    limits.memory: 8Gi
    pods: "50"
    persistentvolumeclaims: "10"

---
# 3. LimitRange -- 개별 Pod 리소스 기본값·제한
apiVersion: v1
kind: LimitRange
metadata:
  name: saas-limits
  namespace: saas-app
spec:
  limits:
  - type: Container
    default:
      cpu: "200m"
      memory: 256Mi
    defaultRequest:
      cpu: "100m"
      memory: 128Mi
    max:
      cpu: "2"
      memory: 2Gi
    min:
      cpu: "50m"
      memory: 64Mi
```

**검증 명령**:

```bash
# PSS 레이블 확인
kubectl get namespace saas-app --show-labels | grep pod-security

# ResourceQuota 적용 확인
kubectl describe resourcequota saas-quota -n saas-app

# LimitRange 적용 확인
kubectl describe limitrange saas-limits -n saas-app

# 격리 테스트: 권한 상승 시도 차단 확인
kubectl run test-priv --image=busybox --restart=Never -n saas-app \
  --overrides='{"spec":{"containers":[{"name":"test","image":"busybox","securityContext":{"privileged":true}}]}}' 2>&1 || echo "BLOCKED (expected)"
```

| 확인 | 기준 | 결과 |
|------|------|------|
| ☐ | PSS restricted 레이블 적용 | |
| ☐ | ResourceQuota 적용 | |
| ☐ | LimitRange 적용 | |
| ☐ | 권한 상승 Pod 차단 확인 | |

---

### CSAP-D11-02: 하이퍼바이저 보안 (중요도: 상)

| 항목 | 내용 |
|------|------|
| **CSAP 요건** | 하이퍼바이저(k3s) 보안 패치 적용 현황. 취약점 점검 이력. 접근 통제 설정 |
| **CIS 매핑** | CIS 1.1 API 서버 보안, CIS 1.2 API 서버 접근 통제 |
| **k3s 구현** | k3s 버전 고정 + API 서버 보안 설정 + kubeconfig 접근 제한 |

**구현 방법**:

```bash
# 1. k3s 버전 고정 (install-k3s.sh에서 적용)
# INSTALL_K3S_VERSION="v1.29.12+k3s1"

# 2. API 서버 보안 매개변수 (install-k3s.sh에서 적용)
# --protect-kernel-defaults: 커널 매개변수 보호
# --secrets-encryption: etcd 시크릿 암호화

# 3. kubeconfig 파일 권한 제한
sudo chmod 600 /etc/rancher/k3s/k3s.yaml
ls -la /etc/rancher/k3s/k3s.yaml
# 기대: -rw------- root root

# 4. API 서버 감사 로그 활성화 (선택)
# /etc/rancher/k3s/config.yaml에 추가:
# kube-apiserver-arg:
#   - "audit-log-path=/var/log/k3s-audit.log"
#   - "audit-log-maxage=30"
#   - "audit-log-maxbackup=10"
#   - "audit-log-maxsize=100"
```

**검증 명령**:

```bash
# k3s 버전 확인
k3s --version
# 기대: v1.29.12+k3s1

# API 서버 보안 매개변수 확인
ps aux | grep k3s | grep -o '\-\-protect-kernel-defaults'
ps aux | grep k3s | grep -o '\-\-secrets-encryption'

# kubeconfig 권한 확인
stat -c '%a %U' /etc/rancher/k3s/k3s.yaml
# 기대: 644 root (--write-kubeconfig-mode 644는 사용자용)

# CVE 확인 (수동)
# https://github.com/k3s-io/k3s/security/advisories 참조
```

| 확인 | 기준 | 결과 |
|------|------|------|
| ☐ | k3s 버전 고정 (v1.29 LTS) | |
| ☐ | --protect-kernel-defaults 적용 | |
| ☐ | --secrets-encryption 적용 | |
| ☐ | kubeconfig 접근 제한 | |

---

### CSAP-D11-03: 가상 네트워크 보안 (중요도: 상)

| 항목 | 내용 |
|------|------|
| **CSAP 요건** | 가상 네트워크 세그멘테이션. 가상 방화벽/보안 그룹 설정. 테넌트 간 네트워크 격리 |
| **CIS 매핑** | CIS 5.3 네트워크 정책, CIS 5.1 RBAC |
| **k3s 구현** | kube-router CNI + NetworkPolicy (deny-all 기본) + 네임스페이스 격리 |

**구현 방법**:

```yaml
# 1. 기본 거부 정책 (install-k3s.sh Step 4에서 적용)
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

---
# 2. 허용 정책 -- 필요한 트래픽만 명시적으로 허용
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-dns
  namespace: saas-app
spec:
  podSelector: {}
  policyTypes:
  - Egress
  egress:
  - to:
    - namespaceSelector:
        matchLabels:
          kubernetes.io/metadata.name: kube-system
    ports:
    - protocol: UDP
      port: 53
    - protocol: TCP
      port: 53

---
# 3. 서비스 간 허용 정책 (예시)
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-app-to-db
  namespace: saas-app
spec:
  podSelector:
    matchLabels:
      app: database
  policyTypes:
  - Ingress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: backend
    ports:
    - protocol: TCP
      port: 5432
```

**검증 명령**:

```bash
# kube-router 동작 확인
kubectl get pods -n kube-system -l k8s-app=kube-router
# 기대: Running

# NetworkPolicy 목록 확인
kubectl get networkpolicy -n saas-app
# 기대: deny-all 존재

# 네트워크 격리 테스트 (deny-all 상태에서)
kubectl run test-net --image=busybox --restart=Never -n saas-app \
  --overrides='{"spec":{"securityContext":{"runAsNonRoot":true,"runAsUser":1000,"seccompProfile":{"type":"RuntimeDefault"}},"containers":[{"name":"test","image":"busybox","command":["sleep","30"],"securityContext":{"allowPrivilegeEscalation":false,"capabilities":{"drop":["ALL"]}}}]}}' 2>/dev/null
kubectl exec -n saas-app test-net -- wget -qO- --timeout=3 http://kubernetes.default.svc 2>&1 || echo "BLOCKED (expected)"
kubectl delete pod test-net -n saas-app --force 2>/dev/null
```

| 확인 | 기준 | 결과 |
|------|------|------|
| ☐ | kube-router CNI 정상 동작 | |
| ☐ | deny-all NetworkPolicy 적용 | |
| ☐ | 네트워크 격리 테스트 통과 | |
| ☐ | DNS 허용 정책 준비 | |

---

### CSAP-D11-04: 컨테이너 보안 (중요도: 상)

| 항목 | 내용 |
|------|------|
| **CSAP 요건** | 컨테이너 이미지 취약점 스캔. Pod Security Standards 적용. 런타임 보안 모니터링 |
| **CIS 매핑** | CIS 4.2 이미지 스캔, CIS 5.2 Pod Security |
| **k3s 구현** | Trivy 이미지 스캔 + PSS restricted + seccomp/AppArmor 프로파일 |

**구현 방법**:

```bash
# 1. Trivy 설치 (이미지 취약점 스캔)
curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sudo sh -s -- -b /usr/local/bin

# 2. 이미지 스캔 예시
trivy image --severity HIGH,CRITICAL nginx:1.25-alpine
# 기대: HIGH/CRITICAL 취약점 0건

# 3. k3s 노드 보안 스캔
trivy k8s --report summary cluster
```

```yaml
# 4. Pod 보안 컨텍스트 표준 (모든 워크로드에 필수 적용)
apiVersion: v1
kind: Pod
metadata:
  name: secure-pod-example
  namespace: saas-app
spec:
  securityContext:
    runAsNonRoot: true
    runAsUser: 1000
    runAsGroup: 1000
    fsGroup: 1000
    seccompProfile:
      type: RuntimeDefault
  containers:
  - name: app
    image: app:latest
    securityContext:
      allowPrivilegeEscalation: false
      readOnlyRootFilesystem: true
      capabilities:
        drop:
        - ALL
    resources:
      requests:
        cpu: 100m
        memory: 128Mi
      limits:
        cpu: 500m
        memory: 512Mi
```

**검증 명령**:

```bash
# PSS 위반 테스트 (root 실행 시도)
kubectl run test-root --image=busybox --restart=Never -n saas-app \
  --overrides='{"spec":{"containers":[{"name":"test","image":"busybox","securityContext":{"runAsUser":0}}]}}' 2>&1 || echo "BLOCKED by PSS (expected)"

# 현재 Pod 보안 상태 점검
kubectl get pods -n saas-app -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.securityContext}{"\n"}{end}'
```

| 확인 | 기준 | 결과 |
|------|------|------|
| ☐ | Trivy 설치 및 스캔 가능 | |
| ☐ | PSS restricted 적용으로 root Pod 차단 | |
| ☐ | securityContext 표준 템플릿 준비 | |
| ☐ | readOnlyRootFilesystem 권장 | |

---

### CSAP-D11-05: 가상 스토리지 보안 (중요도: 중)

| 항목 | 내용 |
|------|------|
| **CSAP 요건** | 테넌트 간 스토리지 격리. 볼륨 암호화. 스토리지 접근 통제 |
| **CIS 매핑** | CIS 3.1 스토리지 암호화 |
| **k3s 구현** | etcd 시크릿 암호화 + PV 접근 제어 + local-path-provisioner 네임스페이스 격리 |

**구현 방법**:

```bash
# 1. etcd 시크릿 암호화 확인 (install-k3s.sh --secrets-encryption)
sudo cat /var/lib/rancher/k3s/server/cred/encryption-config.json
# 기대: aescbc 또는 secretbox 암호화 설정 존재

# 2. 시크릿 암호화 테스트
kubectl create secret generic test-enc --from-literal=key=value -n saas-app
# etcd에서 암호화된 데이터 확인 (평문 미노출)
sudo k3s etcd-snapshot ls
kubectl delete secret test-enc -n saas-app
```

```yaml
# 3. PersistentVolume 접근 제어
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: app-data
  namespace: saas-app
spec:
  accessModes:
  - ReadWriteOnce    # 단일 노드 접근만 허용
  storageClassName: local-path
  resources:
    requests:
      storage: 1Gi

---
# 4. StorageClass 설정 (reclaimPolicy: Delete)
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: local-path-secure
provisioner: rancher.io/local-path
reclaimPolicy: Delete    # PVC 삭제 시 데이터 즉시 삭제
volumeBindingMode: WaitForFirstConsumer
```

**검증 명령**:

```bash
# etcd 암호화 설정 확인
sudo cat /var/lib/rancher/k3s/server/cred/encryption-config.json | grep -o '"aescbc\|"secretbox'

# PVC 네임스페이스 격리 확인
kubectl get pvc --all-namespaces
# 각 PVC가 올바른 네임스페이스에만 존재해야 함
```

| 확인 | 기준 | 결과 |
|------|------|------|
| ☐ | etcd 시크릿 암호화 활성화 | |
| ☐ | 암호화 테스트 통과 | |
| ☐ | PVC 네임스페이스 격리 | |

---

### CSAP-D11-06: 이미지/스냅샷 관리 (중요도: 중)

| 항목 | 내용 |
|------|------|
| **CSAP 요건** | VM/컨테이너 이미지 무결성 검증. 스냅샷 접근 통제. 불필요 이미지 정리 |
| **CIS 매핑** | CIS 4.3 이미지 무결성 |
| **k3s 구현** | Cosign 서명 검증 + 이미지 풀 정책 + 정리 자동화 |

**구현 방법**:

```bash
# 1. Cosign 설치 (이미지 서명 검증)
curl -sSfL https://github.com/sigstore/cosign/releases/latest/download/cosign-linux-amd64 -o /usr/local/bin/cosign
chmod +x /usr/local/bin/cosign

# 2. 이미지 서명 검증 예시
cosign verify --key cosign.pub nginx:1.25-alpine

# 3. 이미지 정리 (수동)
sudo k3s crictl rmi --prune
```

```yaml
# 4. imagePullPolicy: Always (무결성 보장)
apiVersion: v1
kind: Pod
metadata:
  name: verified-app
  namespace: saas-app
spec:
  containers:
  - name: app
    image: registry.example.com/app:v1.0.0@sha256:abc123...
    imagePullPolicy: Always    # 항상 최신 이미지 풀
```

**검증 명령**:

```bash
# 이미지 목록 확인
sudo k3s crictl images

# 불필요 이미지 확인 (사용되지 않는 이미지)
sudo k3s crictl images | grep -v "IMAGE ID" | awk '{print $1":"$2}'

# imagePullPolicy 확인
kubectl get pods -n saas-app -o jsonpath='{range .items[*].spec.containers[*]}{.image}{"\t"}{.imagePullPolicy}{"\n"}{end}'
```

| 확인 | 기준 | 결과 |
|------|------|------|
| ☐ | Cosign 설치 또는 설치 계획 | |
| ☐ | imagePullPolicy: Always 적용 | |
| ☐ | 이미지 정리 절차 문서화 | |

---

### CSAP-D11-07: 가상 환경 모니터링 (중요도: 중)

| 항목 | 내용 |
|------|------|
| **CSAP 요건** | 가상 리소스 사용량 모니터링. 비정상 행위 탐지. 성능 임계값 경고 |
| **CIS 매핑** | CIS 4.4 모니터링, CIS 5.5 감사 로그 |
| **k3s 구현** | metrics-server + Prometheus 스택 (선택) + 리소스 임계값 경고 |

**구현 방법**:

```bash
# 1. metrics-server 설치 (k3s 기본 내장 가능)
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml

# WSL2 환경에서 TLS 우회 필요 (개발 환경만)
kubectl patch deployment metrics-server -n kube-system --type='json' \
  -p='[{"op":"add","path":"/spec/template/spec/containers/0/args/-","value":"--kubelet-insecure-tls"}]'
```

```yaml
# 2. 리소스 모니터링 경고 (ResourceQuota 임계값)
# metrics-server 설치 후 사용 가능:
# kubectl top nodes
# kubectl top pods -n saas-app

# 3. Prometheus 스택 (선택 -- MTU-I4에서 상세 구성)
# helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
# helm install monitoring prometheus-community/kube-prometheus-stack -n monitoring --create-namespace

# 4. 기본 모니터링 스크립트 (Prometheus 미설치 시)
# 아래 명령을 cron으로 실행
```

```bash
#!/usr/bin/env bash
# monitor-resources.sh -- 리소스 사용량 기본 모니터링
THRESHOLD_CPU=80    # CPU 사용률 임계값 (%)
THRESHOLD_MEM=80    # 메모리 사용률 임계값 (%)

# 노드 리소스 확인
kubectl top nodes --no-headers | while read node cpu cpu_pct mem mem_pct; do
    cpu_val=${cpu_pct%\%}
    mem_val=${mem_pct%\%}
    if [ "$cpu_val" -gt "$THRESHOLD_CPU" ]; then
        echo "[WARN] 노드 ${node} CPU 사용률 ${cpu_pct} (임계값: ${THRESHOLD_CPU}%)"
    fi
    if [ "$mem_val" -gt "$THRESHOLD_MEM" ]; then
        echo "[WARN] 노드 ${node} 메모리 사용률 ${mem_pct} (임계값: ${THRESHOLD_MEM}%)"
    fi
done
```

**검증 명령**:

```bash
# metrics-server 동작 확인
kubectl top nodes
# 기대: CPU/메모리 사용량 표시

# Pod 리소스 확인
kubectl top pods -n saas-app
# 기대: 각 Pod의 CPU/메모리 사용량 표시

# 감사 로그 확인 (API 서버 감사 활성화 시)
sudo ls -la /var/log/k3s-audit.log 2>/dev/null || echo "감사 로그 미설정 (선택사항)"
```

| 확인 | 기준 | 결과 |
|------|------|------|
| ☐ | metrics-server 설치 및 동작 | |
| ☐ | kubectl top 명령 정상 출력 | |
| ☐ | 리소스 임계값 경고 방법 문서화 | |

---

## 2. 자가진단 결과 요약

| CSAP ID | 항목명 | 중요도 | 적합 | 비고 |
|---------|-------|-------|------|------|
| CSAP-D11-01 | 가상 머신 격리 | 상 | ☐ | PSS + ResourceQuota + LimitRange |
| CSAP-D11-02 | 하이퍼바이저 보안 | 상 | ☐ | k3s 버전 고정 + API 서버 보안 |
| CSAP-D11-03 | 가상 네트워크 보안 | 상 | ☐ | kube-router + deny-all 정책 |
| CSAP-D11-04 | 컨테이너 보안 | 상 | ☐ | Trivy + PSS restricted + seccomp |
| CSAP-D11-05 | 가상 스토리지 보안 | 중 | ☐ | etcd 암호화 + PV 접근 제어 |
| CSAP-D11-06 | 이미지/스냅샷 관리 | 중 | ☐ | Cosign + imagePullPolicy |
| CSAP-D11-07 | 가상 환경 모니터링 | 중 | ☐ | metrics-server + 임계값 경고 |

**적합 항목**: _/7 | **부분 적합**: _/7 | **미적합**: _/7

---

## 3. 추적성 매트릭스

| CSAP ID | CIS Benchmark | k3s 설정/도구 | 설치 스크립트 단계 | 레시피 섹션 |
|---------|--------------|--------------|----------------|-----------|
| CSAP-D11-01 | 4.1, 5.7 | PSS, ResourceQuota | Step 4 | 3.1 |
| CSAP-D11-02 | 1.1, 1.2 | --protect-kernel-defaults, --secrets-encryption | Step 2 | 2.3 |
| CSAP-D11-03 | 5.3, 5.1 | kube-router, NetworkPolicy | Step 3, 4 | 3.2 |
| CSAP-D11-04 | 4.2, 5.2 | Trivy, PSS, seccomp | Step 4 | 3.1 |
| CSAP-D11-05 | 3.1 | --secrets-encryption, PV | Step 2 | 3.3 |
| CSAP-D11-06 | 4.3 | Cosign, imagePullPolicy | 수동 | - |
| CSAP-D11-07 | 4.4, 5.5 | metrics-server, Prometheus | 수동 | - |

---

## 4. 후속 조치

| 조치 | 관련 MTU | 우선순위 |
|------|---------|---------|
| Kyverno 정책 적용 (이미지 서명 강제) | MTU-C7 | P1 |
| Prometheus + Grafana 모니터링 스택 | MTU-I4 | P1 |
| Harbor 레지스트리 + Trivy 자동 스캔 | MTU-I3 | P1 |
| Falco 런타임 보안 모니터링 | MTU-I4 | P2 |
| CIS Benchmark 자동화 (kube-bench) | MTU-C7 | P2 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | 최초 작성 -- CSAP-D11 7항목 x CIS Benchmark 매핑, 검증 명령, 추적성 매트릭스 | Claude Code |
