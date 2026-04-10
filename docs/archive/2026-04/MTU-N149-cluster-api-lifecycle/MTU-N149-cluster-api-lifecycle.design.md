# MTU-N149 Cluster API 클러스터 수명주기 자동화 — Design

> **문서 버전**: 1.0.0 | **작성일**: 2026-04-10 | **작성자**: CTO Lead
> **Plan 참조**: MTU-N149-cluster-api-lifecycle.plan.md

---

## 1. 아키텍처 옵션 분석

### Option A: 최소 구성 (clusterctl only)
- clusterctl CLI 기반 수동 관리
- 장점: 단순, 빠른 시작
- 단점: 자동화 부족, GitOps 미연동

### Option B: Pragmatic Balance (CAPI + Flux GitOps) ← 선택
- CAPI 컨트롤러 + Docker Provider + Flux 연동
- 장점: 선언적 관리, Git 감사 추적, 자동 드리프트 감지
- 단점: 초기 설정 복잡도

### Option C: Full Enterprise (CAPI + Rancher Fleet + Crossplane)
- 멀티클라우드 Fleet 관리
- 장점: 대규모 멀티클러스터
- 단점: 과도한 복잡도, 온프레미스 환경 부적합

**선택 근거**: 공공기관 온프레미스/하이브리드 환경에서 GitOps 기반 감사 추적이 필수이며, k3s 환경에서 Docker Provider가 최적.

## 2. 상세 설계

### 2.1 CAPI 컨트롤러 설치 (FR-N149.1)

```yaml
# infra/cluster-api/capi-install.yaml
# Design Ref: §2.1 | Plan SC: FR-N149.1
apiVersion: v1
kind: Namespace
metadata:
  name: capi-system
  labels:
    app.kubernetes.io/part-of: cluster-api
    csap.compliance/domain: D-11
---
# clusterctl 설치 스크립트
# clusterctl init --infrastructure docker
# 컨트롤러 구성요소:
#   - capi-controller-manager (core)
#   - capd-controller-manager (Docker provider)
#   - capi-kubeadm-bootstrap (bootstrap)
#   - capi-kubeadm-control-plane (control plane)
```

### 2.2 워크로드 클러스터 템플릿 (FR-N149.2)

```yaml
# infra/cluster-api/workload-cluster-template.yaml
# Design Ref: §2.2 | Plan SC: FR-N149.2
apiVersion: cluster.x-k8s.io/v1beta1
kind: Cluster
metadata:
  name: workload-cluster-01
  namespace: capi-system
  labels:
    environment: production
    csap.compliance/grade: standard
    n2sf.security/level: "O"
spec:
  clusterNetwork:
    pods:
      cidrBlocks: ["10.244.0.0/16"]
    services:
      cidrBlocks: ["10.96.0.0/12"]
    serviceDomain: cluster.local
  controlPlaneRef:
    apiVersion: controlplane.cluster.x-k8s.io/v1beta1
    kind: KubeadmControlPlane
    name: workload-cluster-01-control-plane
  infrastructureRef:
    apiVersion: infrastructure.cluster.x-k8s.io/v1beta1
    kind: DockerCluster
    name: workload-cluster-01
---
apiVersion: infrastructure.cluster.x-k8s.io/v1beta1
kind: DockerCluster
metadata:
  name: workload-cluster-01
  namespace: capi-system
spec:
  loadBalancer:
    imageRepository: kindest/haproxy
    imageTag: v20230510-486ae40c
---
apiVersion: controlplane.cluster.x-k8s.io/v1beta1
kind: KubeadmControlPlane
metadata:
  name: workload-cluster-01-control-plane
  namespace: capi-system
spec:
  replicas: 1
  version: v1.30.0
  machineTemplate:
    infrastructureRef:
      apiVersion: infrastructure.cluster.x-k8s.io/v1beta1
      kind: DockerMachineTemplate
      name: workload-cluster-01-cp
  kubeadmConfigSpec:
    clusterConfiguration:
      apiServer:
        extraArgs:
          audit-log-path: /var/log/kubernetes/audit.log
          audit-policy-file: /etc/kubernetes/audit-policy.yaml
          # CSAP D-06 감사 로깅 설정
          audit-log-maxage: "365"
          audit-log-maxbackup: "10"
          audit-log-maxsize: "100"
    initConfiguration:
      nodeRegistration:
        kubeletExtraArgs:
          # CSAP D-11 보안 설정
          protect-kernel-defaults: "true"
          read-only-port: "0"
```

### 2.3 스케일링 정책 (FR-N149.3)

```yaml
# infra/cluster-api/machine-deployment.yaml
# Design Ref: §2.3 | Plan SC: FR-N149.3
apiVersion: cluster.x-k8s.io/v1beta1
kind: MachineDeployment
metadata:
  name: workload-cluster-01-workers
  namespace: capi-system
spec:
  clusterName: workload-cluster-01
  replicas: 3
  selector:
    matchLabels:
      cluster.x-k8s.io/cluster-name: workload-cluster-01
  template:
    spec:
      clusterName: workload-cluster-01
      version: v1.30.0
      bootstrap:
        configRef:
          apiVersion: bootstrap.cluster.x-k8s.io/v1beta1
          kind: KubeadmConfigTemplate
          name: workload-cluster-01-workers
      infrastructureRef:
        apiVersion: infrastructure.cluster.x-k8s.io/v1beta1
        kind: DockerMachineTemplate
        name: workload-cluster-01-workers
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
---
# Cluster Autoscaler 연동
apiVersion: cluster.x-k8s.io/v1beta1
kind: MachineDeployment
metadata:
  annotations:
    cluster.x-k8s.io/cluster-api-autoscaler-node-group-min-size: "2"
    cluster.x-k8s.io/cluster-api-autoscaler-node-group-max-size: "10"
```

### 2.4 롤링 업그레이드 전략 (FR-N149.4)

```yaml
# infra/cluster-api/upgrade-strategy.yaml
# Design Ref: §2.4 | Plan SC: FR-N149.4
#
# 업그레이드 절차:
# 1. KubeadmControlPlane.spec.version 변경 → 컨트롤 플레인 롤링 업그레이드
# 2. MachineDeployment.spec.template.spec.version 변경 → 워커 노드 롤링 업그레이드
# 3. maxSurge=1, maxUnavailable=0 → 무중단 보장
#
# Pre-upgrade 체크:
# - PodDisruptionBudget 확인
# - 노드 드레인 전 워크로드 마이그레이션
# - etcd 백업 자동 실행
#
# Rollback 전략:
# - Git revert → Flux 자동 롤백
# - MachineHealthCheck 실패 시 자동 노드 교체

apiVersion: cluster.x-k8s.io/v1beta1
kind: MachineHealthCheck
metadata:
  name: workload-cluster-01-mhc
  namespace: capi-system
spec:
  clusterName: workload-cluster-01
  maxUnhealthy: 40%
  nodeStartupTimeout: 10m
  selector:
    matchLabels:
      cluster.x-k8s.io/cluster-name: workload-cluster-01
  unhealthyConditions:
    - type: Ready
      status: Unknown
      timeout: 300s
    - type: Ready
      status: "False"
      timeout: 300s
```

### 2.5 클러스터 해체 자동화 (FR-N149.5)

```yaml
# infra/cluster-api/decommission-policy.yaml
# Design Ref: §2.5 | Plan SC: FR-N149.5
#
# 해체 절차 (자동화):
# 1. Workload 마이그레이션 확인
# 2. PV 데이터 백업 검증
# 3. DNS 레코드 정리
# 4. Cluster CR 삭제 → CAPI가 모든 인프라 리소스 정리
# 5. 감사 로그 기록
#
# Finalizer 기반 안전 삭제:
# - cluster.x-k8s.io/cluster finalizer가 모든 종속 리소스 정리 보장
# - PV reclaim policy: Retain (데이터 보존)

apiVersion: batch/v1
kind: CronJob
metadata:
  name: cluster-decommission-checker
  namespace: capi-system
spec:
  schedule: "0 6 * * 1"  # 매주 월요일 06:00
  jobTemplate:
    spec:
      template:
        spec:
          containers:
            - name: checker
              image: bitnami/kubectl:1.30
              command:
                - /bin/sh
                - -c
                - |
                  # Design Ref: §2.5 | Plan SC: FR-N149.5
                  # 만료된 클러스터 자동 감지
                  kubectl get clusters -n capi-system -o json | \
                    jq -r '.items[] | select(.metadata.annotations["lifecycle/expires"] != null) |
                    select(.metadata.annotations["lifecycle/expires"] < now | todate) |
                    .metadata.name' | while read cluster; do
                      echo "[DECOMMISSION] 만료 클러스터 감지: $cluster"
                      # 감사 로그 기록
                      echo "{\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"action\":\"CLUSTER_DECOMMISSION\",\"target\":\"$cluster\",\"actor\":\"capi-automation\"}" >> /audit/audit.jsonl
                  done
          restartPolicy: OnFailure
```

### 2.6 Flux GitOps 연동 (FR-N149.6)

```yaml
# infra/cluster-api/flux-capi-kustomization.yaml
# Design Ref: §2.6 | Plan SC: FR-N149.6
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: cluster-api-lifecycle
  namespace: flux-system
spec:
  interval: 5m
  path: ./infra/cluster-api
  prune: true
  sourceRef:
    kind: GitRepository
    name: flux-system
  healthChecks:
    - apiVersion: cluster.x-k8s.io/v1beta1
      kind: Cluster
      name: workload-cluster-01
      namespace: capi-system
  timeout: 15m
  postBuild:
    substituteFrom:
      - kind: ConfigMap
        name: cluster-config
```

### 2.7 감사 로그 설정 (FR-N149.7)

```yaml
# infra/cluster-api/audit-config.yaml
# Design Ref: §2.7 | Plan SC: FR-N149.7
apiVersion: v1
kind: ConfigMap
metadata:
  name: capi-audit-config
  namespace: capi-system
data:
  audit-policy.yaml: |
    apiVersion: audit.k8s.io/v1
    kind: Policy
    rules:
      # Cluster 수명주기 이벤트 전수 기록
      - level: RequestResponse
        resources:
          - group: "cluster.x-k8s.io"
            resources: ["clusters", "machinedeployments", "machines"]
        verbs: ["create", "update", "patch", "delete"]
      # 보안 관련 이벤트
      - level: Metadata
        resources:
          - group: ""
            resources: ["secrets", "configmaps"]
        namespaces: ["capi-system"]
```

## 3. 보안 설계 (CSAP/N2SF)

| 통제 항목 | 구현 방법 |
|-----------|---------|
| CSAP D-06 | 클러스터 수명주기 이벤트 전수 감사 로깅 (365일 보존) |
| CSAP D-08 | CAPI 네임스페이스 RBAC (cluster-admin 전용) |
| CSAP D-11 | PSS restricted + CIS Benchmark 자동 적용 |
| N2SF N-01 | 클러스터 간 네트워크 격리 (별도 CIDR) |
| N2SF N-03 | 데이터 등급별 클러스터 분리 (C/S/O) |
| N2SF N-06 | GitOps 기반 변경 추적 + 감사 로그 |

## 4. Session Guide

```
Phase 1: CAPI 컨트롤러 설치 매니페스트 작성
Phase 2: 워크로드 클러스터 템플릿 작성
Phase 3: 스케일링/업그레이드/해체 정책 작성
Phase 4: Flux 연동 + 감사 로그 설정
Phase 5: E2E 테스트 스크립트 작성
Phase 6: 검증 및 리포트 생성
```
