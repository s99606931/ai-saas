# D11 가상화 보안 구현 가이드

| 항목 | 내용 |
|------|------|
| 문서 ID | CSAP-IMPL-D11 |
| 버전 | 1.0.0 |
| 최종 수정일 | 2026-04-05 |
| CSAP 분야 | D11 가상화 보안 |
| 항목 수 | 7개 (CSAP-D11-01 ~ D11-07) |
| 통제 유형 | 기술적 통제 |
| 심사 방법 | 설정 확인 + 가상화 플랫폼 검증 |
| 마스터 체크리스트 | [checklist-master.md#csap-d11-01](../checklist-master.md#csap-d11-01) |
| FR 매핑 | FR-2.3-D11 |

<!-- Design Ref: MTU-C3 Plan -- D11 가상화 보안 -->
<!-- Plan SC: 컨테이너 격리/런타임 보안/이미지 무결성 패턴 포함 -->

---

## 분야 개요

가상화 보안은 **가상 머신, 컨테이너, 하이퍼바이저** 환경의 보안을 보장하는 기술 통제입니다. k3s + WSL2 환경에서는 컨테이너 보안이 핵심이며, Pod Security Standards (PSS), 이미지 무결성 검증, 리소스 격리가 주요 구현 대상입니다.

**핵심 키워드**: 컨테이너 격리, PSS restricted, Trivy 이미지 스캔, seccompProfile, 런타임 보안

**연계 MTU**:
- MTU-I1 k3s 클러스터: PSS restricted + deny-all NetworkPolicy + CIS Benchmark
- MTU-C8 공급망 보안: 이미지 서명(Cosign) + SBOM 검증

---

## CSAP-D11-01: 가상 머신 격리

> **중요도**: 상 | **구분**: 필수

### 구현 목표

테넌트 간 가상 머신/컨테이너를 격리하고 리소스를 분리한다.

### 구현 방법

**k3s 네임스페이스 기반 테넌트 격리**

```yaml
# 테넌트별 네임스페이스 + 리소스 쿼터
apiVersion: v1
kind: ResourceQuota
metadata:
  name: tenant-a-quota
  namespace: tenant-a
spec:
  hard:
    requests.cpu: "4"
    requests.memory: 8Gi
    limits.cpu: "8"
    limits.memory: 16Gi
    pods: "20"

---
# 네임스페이스 간 네트워크 격리
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: tenant-isolation
  namespace: tenant-a
spec:
  podSelector: {}
  policyTypes:
    - Ingress
    - Egress
  ingress:
    - from:
        - podSelector: {}  # 같은 테넌트 내부만
  egress:
    - to:
        - podSelector: {}  # 같은 테넌트 내부만
    - to:  # DNS 허용
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: kube-system
      ports:
        - port: 53
          protocol: UDP
```

### 필요 증거 자료

| 증거 | 형태 | 보관 위치 |
|------|------|---------|
| 가상화/네임스페이스 설정 | YAML | Git 저장소 |
| 리소스 할당 정책 | ResourceQuota YAML | Git 저장소 |
| 격리 검증 결과 | 테스트 보고서 | 문서관리시스템 |

---

## CSAP-D11-02: 하이퍼바이저 보안

> **중요도**: 상 | **구분**: 필수

### 구현 목표

하이퍼바이저(WSL2) 보안 패치를 적용하고 접근을 제한한다.

### 구현 방법

| 항목 | 설정 |
|------|------|
| 보안 패치 | Windows Update + WSL2 커널 업데이트 정기 적용 |
| 접근 제한 | WSL2 접근은 로컬 관리자만, 원격 직접 접근 금지 |
| 설정 관리 | `.wslconfig` 리소스 제한 설정 |
| 취약점 점검 | 분기 1회 CVE 점검 |

```ini
# %UserProfile%/.wslconfig (WSL2 리소스 제한)
[wsl2]
memory=16GB
processors=4
swap=4GB
localhostForwarding=true
```

### 필요 증거 자료

| 증거 | 형태 | 보관 위치 |
|------|------|---------|
| 하이퍼바이저(WSL2) 버전 | 스크린샷 | 문서관리시스템 |
| 보안 패치 이력 | Windows Update 기록 | 시스템 관리 |
| 접근 통제 설정 | 설정 파일 | 인프라 관리 |

---

## CSAP-D11-03: 가상 네트워크 보안

> **중요도**: 상 | **구분**: 필수

### 구현 목표

가상 네트워크 세그멘테이션과 보안 그룹을 설정한다.

### 구현 방법

k3s 환경의 가상 네트워크 보안은 D10 네트워크 보안과 연계됩니다:

| 구성요소 | 역할 |
|---------|------|
| kube-router | CNI + NetworkPolicy 적용 |
| NetworkPolicy | Pod 간 통신 제어 (D10-01 참조) |
| 네임스페이스 | 테넌트 간 네트워크 격리 (D11-01 참조) |
| Traefik | Ingress 트래픽 제어 + TLS 종료 |

### 필요 증거 자료

| 증거 | 형태 | 보관 위치 |
|------|------|---------|
| 가상 네트워크 구성도 | 다이어그램 | 문서관리시스템 |
| 보안 그룹(NetworkPolicy) 설정 | YAML | Git 저장소 |
| 격리 검증 결과 | 테스트 보고서 | 문서관리시스템 |

---

## CSAP-D11-04: 컨테이너 보안

> **중요도**: 상 | **구분**: 필수

### 구현 목표

컨테이너 이미지 취약점 스캔, Pod Security Standards, 런타임 보안을 적용한다.

### 구현 방법

**이미지 취약점 스캔 (Trivy)**

```bash
# CI/CD 파이프라인에서 이미지 빌드 후 스캔
trivy image --severity HIGH,CRITICAL --exit-code 1 myapp:latest
# HIGH/CRITICAL 취약점 발견 시 배포 차단 (exit code 1)
```

**Pod Security Standards (PSS) restricted**

```yaml
# 네임스페이스에 PSS restricted 강제 적용 (MTU-I1)
apiVersion: v1
kind: Namespace
metadata:
  name: production
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/enforce-version: latest
    pod-security.kubernetes.io/warn: restricted
    pod-security.kubernetes.io/audit: restricted
```

**비특권 컨테이너 + seccompProfile**

```yaml
# Pod 보안 컨텍스트 (CSAP-D11-04)
apiVersion: v1
kind: Pod
metadata:
  name: secure-app
spec:
  securityContext:
    runAsNonRoot: true
    runAsUser: 1000
    fsGroup: 1000
    seccompProfile:
      type: RuntimeDefault
  containers:
    - name: app
      image: myapp:latest
      securityContext:
        allowPrivilegeEscalation: false
        readOnlyRootFilesystem: true
        capabilities:
          drop:
            - ALL
      resources:
        limits:
          cpu: "500m"
          memory: 512Mi
        requests:
          cpu: "100m"
          memory: 128Mi
```

### 필요 증거 자료

| 증거 | 형태 | 보관 위치 |
|------|------|---------|
| 이미지 스캔 결과 (Trivy) | 보고서 | CI/CD 아티팩트 |
| PSS 설정 | YAML | Git 저장소 |
| 런타임 보안 설정 (seccomp) | YAML | Git 저장소 |

---

## CSAP-D11-05: 가상 스토리지 보안

> **중요도**: 중 | **구분**: 필수

### 구현 목표

테넌트 간 스토리지를 격리하고 볼륨을 암호화한다.

### 구현 방법

| 항목 | 설정 |
|------|------|
| PV 격리 | 네임스페이스별 PVC, 교차 접근 금지 |
| 볼륨 암호화 | 호스트 디스크 암호화 (LUKS) 또는 StorageClass 암호화 |
| 접근 통제 | PV accessModes: ReadWriteOnce (단일 Pod) |
| 삭제 정책 | reclaimPolicy: Delete (사용 후 자동 삭제) |

```yaml
# 암호화된 StorageClass (예시)
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: encrypted-storage
provisioner: rancher.io/local-path
reclaimPolicy: Delete
volumeBindingMode: WaitForFirstConsumer
parameters:
  encryption: "true"
```

### 필요 증거 자료

| 증거 | 형태 | 보관 위치 |
|------|------|---------|
| 스토리지 설정 | StorageClass YAML | Git 저장소 |
| 암호화 설정 | 설정/증빙 | 인프라 관리 |
| 접근 통제 목록 | PV/PVC 목록 | k3s 클러스터 |

---

## CSAP-D11-06: 이미지/스냅샷 관리

> **중요도**: 중 | **구분**: 필수

### 구현 목표

컨테이너 이미지 무결성을 검증하고 불필요 이미지를 정리한다.

### 구현 방법

| 항목 | 도구/방법 |
|------|---------|
| 이미지 서명 | Cosign (Sigstore) -- MTU-C8 연계 |
| 무결성 검증 | 배포 시 서명 검증 필수 |
| 이미지 정리 | 미사용 이미지 주간 자동 정리 |
| 레지스트리 | Harbor (프라이빗 레지스트리) -- MTU-I3 연계 |

```bash
# Cosign 이미지 서명 검증 (MTU-C8)
cosign verify --key cosign.pub myregistry/myapp:latest

# 미사용 이미지 정리 (k3s)
crictl rmi --prune
```

> 상세 이미지 서명/검증 절차: MTU-C8 [`07-infra/supply-chain/sigstore-signing.md`](../../../07-infra/supply-chain/sigstore-signing.md)

### 필요 증거 자료

| 증거 | 형태 | 보관 위치 |
|------|------|---------|
| 이미지 목록 | 표 | Harbor/레지스트리 |
| 무결성 검증 설정 (Cosign) | 설정 | Git 저장소 |
| 이미지 정리 정책 | cron 설정 | 인프라 관리 |

---

## CSAP-D11-07: 가상 환경 모니터링

> **중요도**: 중 | **구분**: 필수

### 구현 목표

가상 리소스 사용량을 모니터링하고 비정상 행위를 탐지한다.

### 구현 방법

| 모니터링 항목 | 도구 | 임계값/규칙 |
|------------|------|-----------|
| CPU/메모리 사용량 | Prometheus + node-exporter | 80% 초과 경고, 95% 위험 |
| Pod 상태 | kube-state-metrics | CrashLoopBackOff, OOMKilled 탐지 |
| 컨테이너 런타임 | Falco | 비정상 시스콜, 파일 접근 탐지 |
| 성능 임계값 | Prometheus Alertmanager | 커스텀 경고 규칙 |

```yaml
# Prometheus 경고 규칙 예시
groups:
  - name: virtualization-alerts
    rules:
      - alert: HighCpuUsage
        expr: sum(rate(container_cpu_usage_seconds_total[5m])) by (namespace) > 0.8
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "네임스페이스 {{ $labels.namespace }} CPU 사용량 80% 초과"

      - alert: PodCrashLooping
        expr: rate(kube_pod_container_status_restarts_total[15m]) > 0
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Pod 반복 재시작 탐지"
```

### 필요 증거 자료

| 증거 | 형태 | 보관 위치 |
|------|------|---------|
| 모니터링 설정 | Prometheus 규칙 YAML | Git 저장소 |
| 대시보드 화면 | 스크린샷 | 문서관리시스템 |
| 경고 규칙 목록 | 설정 | 모니터링 시스템 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | 최초 작성 -- CSAP-D11 7항목 전수 구현 가이드. k3s PSS restricted + Trivy + Falco + Cosign 패턴 | Claude Code |
