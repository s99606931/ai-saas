---
sidebar_position: 1
title: k3s 완전 가이드
description: 초급부터 고급까지 — 설치, 관리, 모니터링 완전 정복
---

# k3s 완전 가이드

> **대상 독자**: 초급(처음 접하는 분) → 중급(운영 경험자) → 고급(프로덕션 구축자)
> **환경**: WSL2(Ubuntu 22.04+) / Linux / 공공기관 SaaS 프레임워크
> **검증 버전**: k3s v1.34.6+k3s1 (2026-04-06 기준)

---

## 목차

1. [k3s 개념과 아키텍처](#1-k3s-개념과-아키텍처)
2. [환경 준비](#2-환경-준비)
3. [설치](#3-설치)
4. [기본 사용법 — kubectl 핵심 명령어](#4-기본-사용법--kubectl-핵심-명령어)
5. [워크로드 관리](#5-워크로드-관리)
6. [네트워킹 & 서비스 노출](#6-네트워킹--서비스-노출)
7. [스토리지 관리](#7-스토리지-관리)
8. [보안 강화 (CSAP-D08/D11)](#8-보안-강화-csap-d08d11)
9. [모니터링](#9-모니터링)
10. [운영 관리 — 일상 작업](#10-운영-관리--일상-작업)
11. [문제 해결 가이드](#11-문제-해결-가이드)
12. [고급: 멀티 노드 클러스터](#12-고급-멀티-노드-클러스터)

---

## 1. k3s 개념과 아키텍처

### 1.1 k3s란 무엇인가?

k3s는 Rancher Labs(현 SUSE)가 만든 **경량 Kubernetes**입니다.
일반 Kubernetes(k8s)와 완전히 호환되면서 단일 바이너리(~70MB)로 배포됩니다.

```
┌─────────────────────────────────────────────────────────────┐
│                    k3s vs Kubernetes 비교                    │
├─────────────────┬───────────────────┬───────────────────────┤
│ 항목            │ Kubernetes (k8s)  │ k3s                   │
├─────────────────┼───────────────────┼───────────────────────┤
│ 바이너리 크기   │ 여러 개 (~수 GB)  │ 단일 바이너리 (~70MB) │
│ 최소 메모리     │ 2GB+              │ 512MB (권장 1GB+)     │
│ 설치 시간       │ 30분+             │ 2~5분                 │
│ 설치 방법       │ kubeadm 등 복잡   │ curl 한 줄            │
│ 내장 컴포넌트   │ 별도 설치 필요    │ Traefik, local-path   │
│ etcd           │ 외부 etcd 필요    │ SQLite (기본) / etcd  │
│ 프로덕션        │ O                 │ O (Rancher 지원)      │
│ Edge/IoT        │ 어려움            │ 최적화됨              │
└─────────────────┴───────────────────┴───────────────────────┘
```

### 1.2 k3s 아키텍처 도식

```
┌─────────────────────────────────────────────────────────────────┐
│                     k3s 클러스터 전체 구조                       │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    서버 노드 (Server Node)                │   │
│  │                  (마스터 / 컨트롤 플레인)                  │   │
│  │                                                          │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │   │
│  │  │  API Server  │  │  Scheduler   │  │  Controller   │  │   │
│  │  │  :6443       │  │              │  │  Manager      │  │   │
│  │  └──────────────┘  └──────────────┘  └───────────────┘  │   │
│  │                                                          │   │
│  │  ┌──────────────────────────────────────────────────┐   │   │
│  │  │              데이터스토어                          │   │   │
│  │  │   SQLite (단일 노드) / etcd (HA) / MySQL / PG    │   │   │
│  │  └──────────────────────────────────────────────────┘   │   │
│  │                                                          │   │
│  │  ┌──────────────┐  ┌──────────────┐                     │   │
│  │  │  kubelet     │  │  kube-proxy  │  ← 서버도 워크로드   │   │
│  │  │  (에이전트)   │  │              │     실행 가능        │   │
│  │  └──────────────┘  └──────────────┘                     │   │
│  └──────────────────────────────────────────────────────────┘   │
│                            │ API                                  │
│                     ┌──────┴──────┐                              │
│                     │             │                              │
│  ┌──────────────┐   │   ┌──────────────┐                        │
│  │ 에이전트 노드  │   │   │ 에이전트 노드  │                        │
│  │ (Worker 1)   │   │   │ (Worker 2)   │                        │
│  │              │   │   │              │                        │
│  │ ┌──────────┐ │   │   │ ┌──────────┐ │                        │
│  │ │ kubelet  │ │   │   │ │ kubelet  │ │                        │
│  │ │kube-proxy│ │   │   │ │kube-proxy│ │                        │
│  │ │ containerd│ │   │   │ │containerd│ │                        │
│  │ └──────────┘ │   │   │ └──────────┘ │                        │
│  │              │   │   │              │                        │
│  │ [Pod] [Pod]  │   │   │ [Pod] [Pod]  │                        │
│  └──────────────┘   │   └──────────────┘                        │
└─────────────────────────────────────────────────────────────────┘
```

### 1.3 k3s 핵심 컴포넌트

```
┌─────────────────────────────────────────────────────────────┐
│                    k3s 단일 바이너리 내부                    │
│                                                             │
│  ┌───────────┐  ┌───────────┐  ┌──────────────────────┐   │
│  │API Server │  │ Scheduler │  │  Controller Manager  │   │
│  └───────────┘  └───────────┘  └──────────────────────┘   │
│                                                             │
│  ┌───────────┐  ┌───────────┐  ┌──────────────────────┐   │
│  │  kubelet  │  │kube-proxy │  │     containerd       │   │
│  └───────────┘  └───────────┘  └──────────────────────┘   │
│                                                             │
│  내장 Add-on:                                               │
│  ┌───────────┐  ┌───────────┐  ┌──────────────────────┐   │
│  │  Traefik  │  │local-path │  │    CoreDNS           │   │
│  │(인그레스)  │  │(스토리지) │  │   (서비스 DNS)        │   │
│  └───────────┘  └───────────┘  └──────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 1.4 Kubernetes 핵심 개념 (초급자 필독)

```
┌─────────────────────────────────────────────────────────────┐
│                  Kubernetes 오브젝트 계층                    │
│                                                             │
│  Namespace (격리 단위)                                       │
│  └── Deployment (배포 단위, 롤링 업데이트 관리)               │
│      └── ReplicaSet (복제본 유지)                            │
│          └── Pod (실행 단위 — 컨테이너 1개 이상)             │
│              └── Container (실제 앱, Docker 이미지)          │
│                                                             │
│  Service (Pod 접근 방법)                                     │
│  ├── ClusterIP    : 클러스터 내부 전용                       │
│  ├── NodePort     : 외부 포트 노출                           │
│  └── LoadBalancer : 외부 로드밸런서 (클라우드)               │
│                                                             │
│  ConfigMap (설정 데이터) — Secret (민감 데이터)              │
│  PersistentVolume — PVC (영구 스토리지)                      │
│  Ingress (HTTP 라우팅, 도메인 기반)                          │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. 환경 준비

### 2.1 WSL2 설정 (Windows 사용자)

```powershell
# PowerShell (관리자 권한)
# WSL2 활성화
wsl --install
wsl --set-default-version 2

# Ubuntu 22.04 설치
wsl --install -d Ubuntu-22.04
```

**WSL2 메모리 설정** — `C:\Users\{사용자}\.wslconfig` 파일 생성:

```ini
[wsl2]
memory=8GB          # k3s + 워크로드용 (최소 4GB)
processors=4        # CPU 코어 수
swap=0              # k3s는 swap 비활성화 권장
localhostForwarding=true
```

설정 적용:
```powershell
wsl --shutdown      # WSL 재시작
wsl                 # 다시 진입
```

### 2.2 Linux 사전 요건 확인

```bash
# 시스템 정보 확인
echo "=== 시스템 정보 ==="
uname -r                                    # 커널 버전 (5.4+ 권장)
free -h                                     # 메모리 (4GB+ 권장)
df -h /                                     # 디스크 (20GB+ 여유)

# WSL2 확인
cat /proc/version | grep -i microsoft && echo "WSL2 확인됨"

# 필수 패키지 설치
sudo apt-get update
sudo apt-get install -y curl wget jq bash-completion

# cgroup v2 확인 (k3s 필요)
stat -fc %T /sys/fs/cgroup/
# 출력: cgroup2fs → 정상 / tmpfs → cgroup v1 (--cgroup-manager cgroupfs 필요)
```

### 2.3 Docker 설치 (선택, 이미지 빌드용)

```bash
# Docker 설치
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# 재로그인 후 확인
docker version
```

---

## 3. 설치

### 3.1 [초급] 가장 빠른 설치 (1분)

```bash
# k3s 설치 (최신 안정 버전)
curl -sfL https://get.k3s.io | sh -

# 설치 확인
sudo k3s kubectl get nodes
# NAME        STATUS   ROLES                  AGE   VERSION
# localhost   Ready    control-plane,master   30s   v1.34.x+k3s1
```

### 3.2 [중급] 보안 옵션 포함 설치

```bash
# 특정 버전 고정 설치 (운영 권장)
export K3S_VERSION="v1.34.6+k3s1"

curl -sfL https://get.k3s.io | \
  INSTALL_K3S_VERSION="${K3S_VERSION}" \
  sh -s - \
  --flannel-backend=none \        # CNI 직접 지정 (NetworkPolicy 지원)
  --disable=traefik \             # 별도 인그레스 사용
  --disable-network-policy \      # CNI가 담당
  --protect-kernel-defaults \     # 커널 보호 (CSAP-D11)
  --secrets-encryption \          # etcd 시크릿 암호화
  --write-kubeconfig-mode 600 \   # kubeconfig 권한 제한
  --cluster-cidr=10.42.0.0/16 \
  --service-cidr=10.43.0.0/16
```

### 3.3 [고급] 자동화 스크립트 사용 (공공 SaaS 프레임워크)

```bash
# 프로젝트 내 스크립트 사용
chmod +x docs/framework/07-infra/k3s-wsl2/scripts/install-k3s.sh
sudo ./docs/framework/07-infra/k3s-wsl2/scripts/install-k3s.sh

# 환경 변수로 커스터마이즈
K3S_VERSION=v1.34.6+k3s1 \
  CLUSTER_CIDR=10.42.0.0/16 \
  sudo -E ./install-k3s.sh
```

### 3.4 kubectl 설정

```bash
# kubeconfig 복사 (매번 sudo 없이 사용하기 위해)
mkdir -p ~/.kube
sudo cp /etc/rancher/k3s/k3s.yaml ~/.kube/config
sudo chown $(id -u):$(id -g) ~/.kube/config

# 환경 변수 영구 설정
echo 'export KUBECONFIG=~/.kube/config' >> ~/.bashrc
source ~/.bashrc

# kubectl 자동 완성 설정
echo 'source <(kubectl completion bash)' >> ~/.bashrc
echo 'alias k=kubectl' >> ~/.bashrc
echo 'complete -F __start_kubectl k' >> ~/.bashrc
source ~/.bashrc

# 동작 확인
kubectl version
kubectl get nodes
```

### 3.5 설치 상태 검증

```bash
# 클러스터 상태 전체 확인
echo "=== 노드 상태 ===" && kubectl get nodes -o wide
echo "=== 시스템 Pod ===" && kubectl get pods -n kube-system
echo "=== 서비스 목록 ===" && kubectl get svc -A
echo "=== 스토리지 클래스 ===" && kubectl get storageclass

# k3s 서비스 상태
sudo systemctl status k3s

# 버전 정보
kubectl version --short
k3s --version
```

### 3.6 제거

```bash
# k3s 완전 제거 (서버)
sudo /usr/local/bin/k3s-uninstall.sh

# 에이전트 노드 제거
sudo /usr/local/bin/k3s-agent-uninstall.sh
```

---

## 4. 기본 사용법 — kubectl 핵심 명령어

### 4.1 명령어 구조 이해

```
kubectl [동사] [리소스 종류] [리소스 이름] [옵션]
   │       │         │              │         │
   │       │         │              │         └── -n namespace, -o format 등
   │       │         │              └──────────── my-pod, my-deployment 등
   │       │         └─────────────────────────── pod, svc, deploy, ns 등
   │       └───────────────────────────────────── get, apply, delete, describe 등
   └───────────────────────────────────────────── kubectl
```

### 4.2 필수 명령어 치트시트

```bash
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 조회 (get)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# 모든 리소스 조회
kubectl get all                          # 현재 네임스페이스
kubectl get all -A                       # 전체 네임스페이스
kubectl get all -n saas-platform         # 특정 네임스페이스

# 주요 리소스 단축키
kubectl get pod,svc,deploy               # 여러 리소스 동시 조회
kubectl get pods -o wide                 # 노드 배치 포함
kubectl get pods -o yaml                 # YAML 전체 출력
kubectl get pods --show-labels           # 레이블 표시
kubectl get pods -w                      # 실시간 감시 (watch)

# 상세 정보
kubectl describe pod my-pod              # 이벤트 포함 상세 정보
kubectl describe node localhost          # 노드 상세 (리소스 사용량)

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 적용 / 생성 (apply / create)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

kubectl apply -f manifest.yaml           # 파일 적용 (생성 + 업데이트)
kubectl apply -f ./k8s/                  # 디렉토리 내 전체 적용
kubectl create ns saas-platform          # 네임스페이스 생성
kubectl create secret generic db-secret \
  --from-literal=password=mypass         # 시크릿 생성

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 삭제 (delete)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

kubectl delete pod my-pod                # Pod 삭제
kubectl delete -f manifest.yaml          # 파일 기반 삭제
kubectl delete pod --all -n my-ns        # 네임스페이스 내 전체 Pod 삭제

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 로그 (logs)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

kubectl logs my-pod                      # 로그 출력
kubectl logs my-pod -f                   # 실시간 로그 (follow)
kubectl logs my-pod --previous           # 이전 컨테이너 로그 (재시작 후)
kubectl logs my-pod -c my-container      # 멀티 컨테이너 Pod
kubectl logs -l app=portal               # 레이블 기반 (여러 Pod)
kubectl logs my-pod --tail=100           # 최근 100줄
kubectl logs my-pod --since=1h           # 최근 1시간

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 실행 (exec)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

kubectl exec -it my-pod -- bash          # 컨테이너 쉘 접속
kubectl exec my-pod -- ls /app           # 단일 명령 실행
kubectl exec -it my-pod -c sidecar -- sh # 특정 컨테이너 접속

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 포트 포워드 (port-forward)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

kubectl port-forward pod/my-pod 8080:80          # Pod 포워드
kubectl port-forward svc/my-service 8080:80      # Service 포워드
kubectl port-forward deploy/my-deploy 8080:80    # Deployment 포워드
# WSL2에서는 NodePort 대신 port-forward 필수!

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 스케일링
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

kubectl scale deploy my-deploy --replicas=3      # 복제본 수 조정
kubectl rollout status deploy/my-deploy          # 롤아웃 진행 상태
kubectl rollout undo deploy/my-deploy            # 이전 버전으로 롤백
kubectl rollout history deploy/my-deploy         # 배포 이력
```

### 4.3 컨텍스트 & 네임스페이스 전환

```bash
# 현재 컨텍스트 확인
kubectl config current-context
kubectl config get-contexts

# 기본 네임스페이스 설정 (매번 -n 생략 가능)
kubectl config set-context --current --namespace=saas-platform

# kubectx / kubens 도구 (편리한 전환)
sudo apt-get install -y kubectx    # or brew install kubectx
kubens saas-platform               # 네임스페이스 전환
```

---

## 5. 워크로드 관리

### 5.1 Deployment 생성 및 관리

```yaml
# deployment.yaml — 기본 예시
apiVersion: apps/v1
kind: Deployment
metadata:
  name: portal
  namespace: saas-platform
  labels:
    app: portal
    version: "1.0"
spec:
  replicas: 2                       # 복제본 수
  selector:
    matchLabels:
      app: portal
  strategy:
    type: RollingUpdate             # 무중단 배포
    rollingUpdate:
      maxUnavailable: 1             # 최대 중단 Pod 수
      maxSurge: 1                   # 최대 초과 Pod 수
  template:
    metadata:
      labels:
        app: portal
    spec:
      containers:
        - name: portal
          image: saas/portal:v1.0
          ports:
            - containerPort: 4000
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: db-secret
                  key: url
          resources:
            requests:               # 스케줄러가 노드 선택에 사용
              memory: "256Mi"
              cpu: "100m"
            limits:                 # 이 이상 사용 시 OOMKilled
              memory: "512Mi"
              cpu: "500m"
          readinessProbe:           # 트래픽 수신 준비 확인
            httpGet:
              path: /api/health
              port: 4000
            initialDelaySeconds: 10
            periodSeconds: 5
          livenessProbe:            # 앱 생존 확인 (실패 시 재시작)
            httpGet:
              path: /api/health
              port: 4000
            initialDelaySeconds: 30
            periodSeconds: 10
```

```bash
# 배포
kubectl apply -f deployment.yaml

# 배포 상태 확인
kubectl rollout status deploy/portal -n saas-platform

# 이미지 업데이트 (롤링 업데이트 트리거)
kubectl set image deploy/portal portal=saas/portal:v1.1 -n saas-platform

# 롤백
kubectl rollout undo deploy/portal -n saas-platform

# 특정 버전으로 롤백
kubectl rollout history deploy/portal -n saas-platform  # 이력 확인
kubectl rollout undo deploy/portal --to-revision=2 -n saas-platform
```

### 5.2 Docker 이미지를 k3s에 임포트 (인터넷 없는 환경)

```bash
# 로컬 이미지 빌드
docker build -t saas/portal:v1.0 ./platform/apps/portal

# k3s 내장 컨테이너 런타임에 직접 임포트
docker save saas/portal:v1.0 | sudo k3s ctr images import -

# 임포트된 이미지 확인
sudo k3s ctr images ls | grep saas

# ⚠️  imagePullPolicy: Never 설정 필수 (로컬 이미지 사용 시)
# deployment.yaml에서:
# spec.containers[].imagePullPolicy: Never
```

### 5.3 CronJob — 정기 작업

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: audit-cleanup
  namespace: saas-platform
spec:
  schedule: "0 2 * * *"          # 매일 새벽 2시
  jobTemplate:
    spec:
      template:
        spec:
          containers:
            - name: cleanup
              image: saas/tools:latest
              command: ["node", "scripts/audit-cleanup.js"]
          restartPolicy: OnFailure
```

---

## 6. 네트워킹 & 서비스 노출

### 6.1 서비스 유형별 사용 가이드

```
┌─────────────────────────────────────────────────────────────┐
│                   서비스 유형 결정 흐름도                    │
│                                                             │
│  외부에서 접근해야 하나?                                      │
│       │                                                     │
│    예 ─┤                                                     │
│       │                                                     │
│       ├── HTTP/HTTPS 도메인 기반? ── 예 ──→ Ingress          │
│       │                                                     │
│       └── TCP/UDP 포트 직접? ── 예 ──→ NodePort              │
│                                                             │
│  클러스터 내부 통신만? ── 예 ──→ ClusterIP (기본)            │
│                                                             │
│  WSL2 주의: NodePort는 localhost에서만 접근 가능             │
│  → 권장: kubectl port-forward 사용                          │
└─────────────────────────────────────────────────────────────┘
```

```yaml
# ClusterIP — 내부 통신 (기본값)
apiVersion: v1
kind: Service
metadata:
  name: portal-svc
  namespace: saas-platform
spec:
  type: ClusterIP
  selector:
    app: portal
  ports:
    - port: 80
      targetPort: 4000
---
# NodePort — 외부 노출 (개발/테스트용)
apiVersion: v1
kind: Service
metadata:
  name: portal-nodeport
spec:
  type: NodePort
  selector:
    app: portal
  ports:
    - port: 80
      targetPort: 4000
      nodePort: 30080      # 30000-32767 범위
```

### 6.2 Ingress — HTTP 라우팅

k3s는 Traefik을 기본 인그레스 컨트롤러로 내장합니다.

```yaml
# ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: portal-ingress
  namespace: saas-platform
  annotations:
    traefik.ingress.kubernetes.io/router.middlewares: "saas-platform-auth@kubernetescrd"
spec:
  rules:
    - host: portal.saas.local      # /etc/hosts에 등록 필요
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: portal-svc
                port:
                  number: 80
          - path: /api
            pathType: Prefix
            backend:
              service:
                name: api-gateway-svc
                port:
                  number: 8080
```

```bash
# WSL2에서 로컬 도메인 접근 설정
# Windows hosts 파일: C:\Windows\System32\drivers\etc\hosts
# 또는 WSL2 /etc/hosts
echo "127.0.0.1 portal.saas.local" | sudo tee -a /etc/hosts

# Traefik 대시보드 접근
kubectl port-forward svc/traefik 9000:9000 -n kube-system
# http://localhost:9000/dashboard/
```

### 6.3 NetworkPolicy — 네트워크 격리 (보안)

```yaml
# 기본 정책: 모든 트래픽 차단 후 필요한 것만 허용
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: deny-all
  namespace: saas-platform
spec:
  podSelector: {}          # 모든 Pod에 적용
  policyTypes:
    - Ingress
    - Egress
---
# portal → api-gateway 허용
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-portal-to-api
  namespace: saas-platform
spec:
  podSelector:
    matchLabels:
      app: api-gateway
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: portal
      ports:
        - port: 8080
```

---

## 7. 스토리지 관리

### 7.1 스토리지 계층 이해

```
┌─────────────────────────────────────────────────────────────┐
│                  Kubernetes 스토리지 계층                    │
│                                                             │
│  애플리케이션 (Pod)                                          │
│       │ 마운트                                               │
│       ▼                                                     │
│  PVC (PersistentVolumeClaim) — "얼마나 필요한지 요청"         │
│       │ 바인딩                                               │
│       ▼                                                     │
│  PV (PersistentVolume) — "실제 스토리지"                     │
│       │ 프로비저닝                                           │
│       ▼                                                     │
│  StorageClass — "어떤 방식으로 만들지 (자동 프로비저닝)"       │
│       │                                                     │
│       └── local-path (k3s 기본) / NFS / Longhorn           │
└─────────────────────────────────────────────────────────────┘
```

### 7.2 PVC 생성 및 사용

```yaml
# pvc.yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-pvc
  namespace: saas-platform
spec:
  accessModes:
    - ReadWriteOnce                # 단일 노드 읽기/쓰기
  resources:
    requests:
      storage: 10Gi
  storageClassName: local-path     # k3s 기본 스토리지 클래스
---
# pod에서 PVC 사용
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
  namespace: saas-platform
spec:
  selector:
    matchLabels:
      app: postgres
  template:
    spec:
      containers:
        - name: postgres
          image: postgres:15
          volumeMounts:
            - name: data
              mountPath: /var/lib/postgresql/data
      volumes:
        - name: data
          persistentVolumeClaim:
            claimName: postgres-pvc
```

```bash
# 스토리지 상태 확인
kubectl get pv,pvc -n saas-platform
kubectl describe pvc postgres-pvc -n saas-platform
```

---

## 8. 보안 강화 (CSAP-D08/D11)

### 8.1 RBAC — 역할 기반 접근 제어

```
┌─────────────────────────────────────────────────────────────┐
│                    RBAC 개념도                              │
│                                                             │
│  사용자/서비스어카운트                                        │
│         │                                                   │
│         │ RoleBinding / ClusterRoleBinding                  │
│         ▼                                                   │
│      Role / ClusterRole                                     │
│         │                                                   │
│         │ rules                                             │
│         ▼                                                   │
│  리소스 (Pod, Secret 등) + 동사 (get, list, create 등)       │
└─────────────────────────────────────────────────────────────┘
```

```yaml
# 읽기 전용 역할 생성
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: viewer
  namespace: saas-platform
rules:
  - apiGroups: [""]
    resources: ["pods", "services", "configmaps"]
    verbs: ["get", "list", "watch"]
---
# 역할 바인딩
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: viewer-binding
  namespace: saas-platform
subjects:
  - kind: User
    name: dev-user
    apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: Role
  name: viewer
  apiGroup: rbac.authorization.k8s.io
```

```bash
# 권한 확인 (CSAP 감리용)
kubectl auth can-i get pods -n saas-platform --as=dev-user
kubectl auth can-i delete secrets -n saas-platform --as=dev-user

# 모든 권한 목록
kubectl get clusterroles,roles -A
kubectl get clusterrolebindings,rolebindings -A
```

### 8.2 Secret 관리

```bash
# 시크릿 생성
kubectl create secret generic db-credentials \
  --from-literal=username=saas_user \
  --from-literal=password=SecureP@ssw0rd \
  --from-literal=host=postgres-svc \
  -n saas-platform

# 파일로부터 시크릿 생성
kubectl create secret generic tls-cert \
  --from-file=tls.crt=./certs/server.crt \
  --from-file=tls.key=./certs/server.key \
  -n saas-platform

# 시크릿 목록 (값은 표시 안 됨)
kubectl get secrets -n saas-platform

# 시크릿 값 디코딩 (관리자만)
kubectl get secret db-credentials -o jsonpath='{.data.password}' \
  -n saas-platform | base64 -d

# etcd 암호화 확인 (설치 시 --secrets-encryption 설정)
cat /var/lib/rancher/k3s/server/cred/encryption-config.json
```

### 8.3 Pod Security Standards

```bash
# 네임스페이스에 PSS restricted 적용
kubectl label namespace saas-platform \
  pod-security.kubernetes.io/enforce=restricted \
  pod-security.kubernetes.io/audit=restricted \
  pod-security.kubernetes.io/warn=restricted

# 적용 확인
kubectl get namespace saas-platform --show-labels

# PSS restricted Pod 예시 (root 실행 금지 등)
```

```yaml
apiVersion: v1
kind: Pod
spec:
  securityContext:
    runAsNonRoot: true              # root 실행 금지 (CSAP-D11)
    runAsUser: 1001
    fsGroup: 1001
    seccompProfile:
      type: RuntimeDefault
  containers:
    - name: app
      securityContext:
        allowPrivilegeEscalation: false   # 권한 상승 금지
        readOnlyRootFilesystem: true      # 파일시스템 읽기 전용
        capabilities:
          drop: ["ALL"]                   # 모든 Linux capability 제거
```

---

## 9. 모니터링

### 9.1 [초급] 기본 모니터링 명령어

```bash
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 클러스터 상태 한눈에 보기
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# 전체 현황
kubectl get all -n saas-platform

# 실시간 Pod 상태 감시
kubectl get pods -n saas-platform -w

# Pod 상태 이상 감지 (Running이 아닌 것)
kubectl get pods -A --field-selector=status.phase!=Running

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 리소스 사용량 (metrics-server 필요)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# metrics-server 설치
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml

# WSL2에서 TLS 우회 필요 시
kubectl patch deployment metrics-server -n kube-system \
  --type=json \
  -p='[{"op":"add","path":"/spec/template/spec/containers/0/args/-","value":"--kubelet-insecure-tls"}]'

# CPU/메모리 사용량
kubectl top nodes                           # 노드별 사용량
kubectl top pods -n saas-platform           # Pod별 사용량
kubectl top pods -n saas-platform --sort-by=memory  # 메모리 순 정렬

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 이벤트 모니터링 (문제 감지 핵심)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# 클러스터 이벤트 (최근 문제 빠르게 확인)
kubectl get events -n saas-platform --sort-by=.lastTimestamp
kubectl get events -A --field-selector=type=Warning   # Warning만 필터

# 실시간 이벤트 감시
kubectl get events -n saas-platform -w
```

### 9.2 [중급] 로그 중앙화 (Loki + Promtail)

```
┌─────────────────────────────────────────────────────────────┐
│                  로그 수집 파이프라인                        │
│                                                             │
│  [Pod 로그] → [Promtail] → [Loki] → [Grafana]              │
│                                                             │
│  Promtail: 각 노드의 로그를 수집하여 Loki로 전송             │
│  Loki: 로그 저장 및 쿼리 (Prometheus 스타일 LogQL)           │
│  Grafana: 로그 + 메트릭 통합 대시보드                        │
└─────────────────────────────────────────────────────────────┘
```

```bash
# Helm 설치 (패키지 매니저)
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

# Grafana Loki Stack 설치
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update

helm install loki-stack grafana/loki-stack \
  --namespace monitoring \
  --create-namespace \
  --set grafana.enabled=true \
  --set prometheus.enabled=true \
  --set prometheus.alertmanager.persistentVolume.enabled=false \
  --set prometheus.server.persistentVolume.enabled=false \
  --set loki.persistence.enabled=false

# Grafana 접근 (admin 초기 비밀번호 확인)
kubectl get secret loki-stack-grafana -n monitoring \
  -o jsonpath='{.data.admin-password}' | base64 -d

kubectl port-forward svc/loki-stack-grafana 3000:80 -n monitoring
# http://localhost:3000 접근 (admin / 위 비밀번호)
```

### 9.3 [고급] Prometheus + Grafana 완전 설정

```
┌─────────────────────────────────────────────────────────────┐
│               Prometheus 모니터링 아키텍처                   │
│                                                             │
│  [앱 /metrics] ──┐                                          │
│  [노드 exporter] ─┼──→ [Prometheus] ──→ [Grafana 대시보드]  │
│  [k3s /metrics] ─┘         │                               │
│                             │ 알림                           │
│                             ▼                               │
│                      [AlertManager]                         │
│                             │                               │
│                    [Slack / 이메일 / PagerDuty]              │
└─────────────────────────────────────────────────────────────┘
```

```bash
# kube-prometheus-stack 설치 (완전한 모니터링 스택)
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

# values.yaml 커스터마이즈
cat > monitoring-values.yaml << 'EOF'
grafana:
  adminPassword: "SecureGrafanaPass!"
  service:
    type: ClusterIP

prometheus:
  prometheusSpec:
    retention: 30d                    # 30일 보존
    storageSpec:
      volumeClaimTemplate:
        spec:
          storageClassName: local-path
          accessModes: ["ReadWriteOnce"]
          resources:
            requests:
              storage: 50Gi

alertmanager:
  config:
    route:
      group_by: ['alertname', 'namespace']
      receiver: 'slack'
    receivers:
      - name: 'slack'
        slack_configs:
          - channel: '#k8s-alerts'
            api_url: 'https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK'
EOF

helm install monitoring prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --create-namespace \
  -f monitoring-values.yaml

# Grafana 접근
kubectl port-forward svc/monitoring-grafana 3000:80 -n monitoring

# Prometheus 접근
kubectl port-forward svc/monitoring-kube-prometheus-prometheus 9090:9090 -n monitoring
```

### 9.4 주요 모니터링 지표 및 쿼리 (PromQL)

```bash
# Grafana에서 Explore → Prometheus 선택 후 아래 쿼리 입력

# Pod 재시작 횟수 (이상 징후)
kube_pod_container_status_restarts_total{namespace="saas-platform"} > 5

# 메모리 사용률 80% 초과
container_memory_usage_bytes / container_spec_memory_limit_bytes > 0.8

# CPU 사용률
rate(container_cpu_usage_seconds_total[5m]) * 100

# API 응답 시간 p95
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# 클러스터 노드 사용 가능 메모리
node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes * 100
```

### 9.5 알림 규칙 설정

```yaml
# prometheus-alerts.yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: saas-platform-alerts
  namespace: monitoring
spec:
  groups:
    - name: pod-alerts
      rules:
        - alert: PodCrashLooping
          expr: kube_pod_container_status_restarts_total > 5
          for: 5m
          labels:
            severity: critical
          annotations:
            summary: "Pod {{ $labels.pod }} 크래시 루프 감지"
            description: "{{ $labels.namespace }}/{{ $labels.pod }} 재시작 {{ $value }}회"

        - alert: HighMemoryUsage
          expr: container_memory_usage_bytes / container_spec_memory_limit_bytes > 0.9
          for: 10m
          labels:
            severity: warning
          annotations:
            summary: "메모리 90% 초과"
```

```bash
kubectl apply -f prometheus-alerts.yaml
```

---

## 10. 운영 관리 — 일상 작업

### 10.1 클러스터 헬스 체크 스크립트

```bash
#!/bin/bash
# health-check.sh — 매일 실행 권장

echo "==============================="
echo "k3s 클러스터 헬스 체크"
echo "$(date '+%Y-%m-%d %H:%M:%S')"
echo "==============================="

# 1. 노드 상태
echo ""
echo "[ 노드 상태 ]"
kubectl get nodes

# 2. NotReady/Pending Pod 감지
echo ""
echo "[ 비정상 Pod ]"
kubectl get pods -A | grep -vE 'Running|Completed' | grep -v NAME

# 3. Warning 이벤트
echo ""
echo "[ 최근 Warning 이벤트 (1시간) ]"
kubectl get events -A --field-selector=type=Warning \
  --sort-by=.lastTimestamp | tail -20

# 4. 리소스 사용량
echo ""
echo "[ 리소스 사용량 ]"
kubectl top nodes 2>/dev/null || echo "metrics-server 미설치"

# 5. 디스크 사용량
echo ""
echo "[ 디스크 사용량 ]"
df -h / | awk 'NR>1 {print "사용:", $3, "/ 전체:", $2, "/ 사용률:", $5}'
```

### 10.2 k3s 서비스 관리

```bash
# k3s 서비스 조작
sudo systemctl status k3s       # 상태 확인
sudo systemctl restart k3s      # 재시작
sudo systemctl stop k3s         # 중지
sudo systemctl start k3s        # 시작
sudo systemctl enable k3s       # 부팅 시 자동 시작

# 로그 확인
sudo journalctl -u k3s -f              # 실시간 로그
sudo journalctl -u k3s --since "1h ago"  # 최근 1시간

# k3s 상태 진단
sudo k3s check-config

# containerd 이미지 관리
sudo k3s ctr images ls                  # 이미지 목록
sudo k3s ctr images rm <image>          # 이미지 삭제
docker save my-image:tag | sudo k3s ctr images import -  # 이미지 임포트
```

### 10.3 백업 & 복구

```bash
# etcd 스냅샷 (SQLite 사용 시)
sudo k3s etcd-snapshot save \
  --snapshot-dir /backup/k3s-snapshots \
  --name snapshot-$(date +%Y%m%d)

# 스냅샷 목록
sudo k3s etcd-snapshot ls

# 복구 (주의: 클러스터 중단 후 실행)
sudo systemctl stop k3s
sudo k3s server --cluster-reset \
  --cluster-reset-restore-path=/backup/k3s-snapshots/snapshot-20260406

# 리소스 백업 (YAML 내보내기)
# 모든 리소스를 YAML로 백업
for ns in $(kubectl get ns -o jsonpath='{.items[*].metadata.name}'); do
  for resource in deploy svc configmap pvc; do
    kubectl get $resource -n $ns -o yaml > "backup/${ns}-${resource}.yaml" 2>/dev/null
  done
done

# Velero (볼륨 포함 완전 백업 도구)
helm install velero vmware-tanzu/velero \
  --namespace velero \
  --create-namespace \
  --set-json provider=null
```

### 10.4 업그레이드 절차

```bash
# 현재 버전 확인
k3s --version
kubectl version --short

# 업그레이드 (자동)
curl -sfL https://get.k3s.io | \
  INSTALL_K3S_VERSION="v1.34.7+k3s1" sh -

# 업그레이드 후 확인
kubectl get nodes
kubectl get pods -A
sudo systemctl status k3s
```

### 10.5 네임스페이스별 리소스 관리

```bash
# 네임스페이스 생성 및 레이블
kubectl create ns saas-platform
kubectl create ns monitoring
kubectl create ns logging

# ResourceQuota — 네임스페이스 리소스 제한
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: ResourceQuota
metadata:
  name: saas-quota
  namespace: saas-platform
spec:
  hard:
    requests.cpu: "4"
    requests.memory: "8Gi"
    limits.cpu: "8"
    limits.memory: "16Gi"
    pods: "50"
    persistentvolumeclaims: "10"
EOF

# LimitRange — Pod 기본 리소스 설정
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: LimitRange
metadata:
  name: default-limits
  namespace: saas-platform
spec:
  limits:
    - type: Container
      default:
        cpu: "500m"
        memory: "512Mi"
      defaultRequest:
        cpu: "100m"
        memory: "128Mi"
EOF

# 리소스 사용 현황
kubectl describe resourcequota -n saas-platform
```

---

## 11. 문제 해결 가이드

### 11.1 Pod 상태별 원인 및 해결

```
┌─────────────────────────────────────────────────────────────┐
│                  Pod 문제 진단 흐름도                        │
│                                                             │
│  kubectl get pods → 비정상 상태 발견                         │
│         │                                                   │
│         ├── Pending ──→ 스케줄링 실패                        │
│         │              kubectl describe pod → Events 확인   │
│         │              원인: 리소스 부족, 노드 선택 불일치   │
│         │                                                   │
│         ├── CrashLoopBackOff ──→ 앱 크래시                  │
│         │              kubectl logs --previous 로 확인       │
│         │              원인: 앱 오류, 설정 오류, OOM         │
│         │                                                   │
│         ├── OOMKilled ──→ 메모리 초과                        │
│         │              resources.limits.memory 증가         │
│         │                                                   │
│         ├── ImagePullBackOff ──→ 이미지 가져오기 실패        │
│         │              이미지명/태그 확인, 레지스트리 확인   │
│         │              로컬 이미지: k3s ctr images import   │
│         │                                                   │
│         └── Error ──→ kubectl describe + logs 확인          │
└─────────────────────────────────────────────────────────────┘
```

```bash
# Pod 상태 디버깅 전체 절차
POD_NAME="my-pod"
NS="saas-platform"

# 1단계: 상태 확인
kubectl get pod $POD_NAME -n $NS -o wide

# 2단계: 상세 이벤트 확인 (가장 중요!)
kubectl describe pod $POD_NAME -n $NS

# 3단계: 로그 확인
kubectl logs $POD_NAME -n $NS
kubectl logs $POD_NAME -n $NS --previous    # 이전 실행 로그

# 4단계: 컨테이너 직접 접속
kubectl exec -it $POD_NAME -n $NS -- sh

# 5단계: 임시 디버깅 Pod
kubectl run debug --image=busybox:latest --rm -it --restart=Never \
  -n $NS -- sh
```

### 11.2 자주 발생하는 문제 모음

```bash
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 문제 1: WSL2에서 k3s 서비스 시작 실패
# 증상: Failed to find memory cgroup
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# /etc/wsl.conf 수정
sudo tee /etc/wsl.conf <<EOF
[boot]
systemd=true

[automount]
enabled = true
EOF

# WSL2 재시작 후 다시 시도
# PowerShell: wsl --shutdown && wsl

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 문제 2: NodePort 외부 접근 불가 (WSL2)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 해결: port-forward 사용
kubectl port-forward svc/my-svc 8080:80 -n saas-platform &
# http://localhost:8080 접근

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 문제 3: ImagePullBackOff — 로컬 이미지
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 로컬 이미지를 k3s에 임포트 후 사용
docker build -t my-app:latest .
docker save my-app:latest | sudo k3s ctr images import -

# deployment.yaml에 imagePullPolicy: Never 추가
kubectl patch deploy my-deploy \
  -p '{"spec":{"template":{"spec":{"containers":[{"name":"app","imagePullPolicy":"Never"}]}}}}' \
  -n saas-platform

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 문제 4: DNS 해석 실패 (Pod 내부)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# CoreDNS 상태 확인
kubectl get pods -n kube-system -l k8s-app=kube-dns
kubectl logs -n kube-system -l k8s-app=kube-dns

# 서비스 DNS 형식
# <service-name>.<namespace>.svc.cluster.local
# 예: postgres-svc.saas-platform.svc.cluster.local

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 문제 5: Pending 상태 — 리소스 부족
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
kubectl describe pod my-pod -n saas-platform
# Events: Insufficient memory or cpu

# 노드 리소스 확인
kubectl describe node localhost | grep -A 10 "Allocated resources"

# Pod 요청 리소스 줄이기
kubectl patch deploy my-deploy \
  -p '{"spec":{"template":{"spec":{"containers":[{"name":"app","resources":{"requests":{"memory":"128Mi","cpu":"50m"}}}]}}}}' \
  -n saas-platform

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 문제 6: CrashLoopBackOff — 로그 없음
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 1. 이전 컨테이너 로그
kubectl logs my-pod --previous -n saas-platform

# 2. 컨테이너를 sleep으로 교체해 내부 확인
kubectl patch deploy my-deploy \
  -p '{"spec":{"template":{"spec":{"containers":[{"name":"app","command":["sleep","3600"]}]}}}}' \
  -n saas-platform
kubectl exec -it my-pod -n saas-platform -- sh
```

### 11.3 네트워크 디버깅

```bash
# 서비스 연결 테스트
kubectl run nettest --image=busybox --rm -it --restart=Never \
  -n saas-platform -- \
  wget -qO- http://portal-svc/api/health

# DNS 확인
kubectl run dnstest --image=busybox --rm -it --restart=Never \
  -n saas-platform -- \
  nslookup postgres-svc.saas-platform.svc.cluster.local

# NetworkPolicy 검증
kubectl get networkpolicy -n saas-platform
kubectl describe networkpolicy deny-all -n saas-platform
```

---

## 12. 고급: 멀티 노드 클러스터

### 12.1 HA 클러스터 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│              k3s HA 클러스터 구성                            │
│                                                             │
│  ┌──────────────────────────────────────────┐              │
│  │          로드 밸런서 (VIP / HAProxy)       │              │
│  └───────────────┬──────────────────────────┘              │
│                  │ :6443                                    │
│    ┌─────────────┴──────────────────────┐                   │
│    │             │                      │                   │
│  ┌─┴──────┐  ┌──┴─────┐  ┌─────────┐  │                   │
│  │Server 1│  │Server 2│  │Server 3 │  │ ← etcd 클러스터   │
│  │(active)│  │(standby│  │(standby)│  │                   │
│  └────────┘  └────────┘  └─────────┘  │                   │
│                                        │                   │
│  ┌──────────────────────────────────┐  │                   │
│  │  Agent 1  │  Agent 2  │  Agent 3 │  │ ← 워크로드 노드   │
│  └──────────────────────────────────┘  │                   │
└─────────────────────────────────────────────────────────────┘
```

### 12.2 서버 노드 추가

```bash
# 첫 번째 서버 노드 설치 (클러스터 초기화)
curl -sfL https://get.k3s.io | sh -s - server \
  --cluster-init \
  --token="MySuperSecretToken"

# 서버 토큰 확인
sudo cat /var/lib/rancher/k3s/server/node-token

# 두 번째/세 번째 서버 노드 추가
# (다른 머신에서 실행)
K3S_TOKEN="MySuperSecretToken" \
K3S_URL="https://server1-ip:6443" \
curl -sfL https://get.k3s.io | sh -s - server

# 에이전트(워커) 노드 추가
K3S_TOKEN="MySuperSecretToken" \
K3S_URL="https://server1-ip:6443" \
curl -sfL https://get.k3s.io | sh -s - agent

# 노드 추가 확인
kubectl get nodes -o wide
```

### 12.3 노드 관리

```bash
# 노드에 레이블 추가 (Pod 배치 제어)
kubectl label node worker-1 role=worker
kubectl label node worker-2 role=worker gpu=true

# 노드에 Pod 배치 강제 (nodeSelector)
# deployment.yaml에 추가:
# spec.template.spec.nodeSelector:
#   role: worker

# 노드 드레인 (유지보수 모드)
kubectl drain worker-1 --ignore-daemonsets --delete-emptydir-data
# 유지보수 완료 후 복귀
kubectl uncordon worker-1

# 노드 삭제 (클러스터에서 제거)
kubectl delete node worker-1
# 해당 머신에서: sudo /usr/local/bin/k3s-agent-uninstall.sh
```

---

## 부록 A: kubectl 별칭 모음

```bash
# ~/.bashrc 또는 ~/.zshrc에 추가

# 기본 단축키
alias k='kubectl'
alias kg='kubectl get'
alias kd='kubectl describe'
alias kdel='kubectl delete'
alias kl='kubectl logs'
alias kex='kubectl exec -it'
alias kaf='kubectl apply -f'
alias ksn='kubectl config set-context --current --namespace'

# 자주 쓰는 조합
alias kgp='kubectl get pods'
alias kgpa='kubectl get pods -A'
alias kgpw='kubectl get pods -w'
alias kgs='kubectl get svc'
alias kgd='kubectl get deploy'
alias kgn='kubectl get nodes'
alias kge='kubectl get events --sort-by=.lastTimestamp'

# 네임스페이스 빠른 전환
alias kns='kubens'
alias kctx='kubectx'
```

## 부록 B: 공공기관 SaaS 플랫폼 배포 체크리스트

```
□ 설치 확인
  □ k3s 서비스 Running
  □ 모든 시스템 Pod Running
  □ kubectl 접근 가능

□ 보안 설정
  □ PSS restricted 적용 (saas-platform 네임스페이스)
  □ deny-all NetworkPolicy 적용
  □ Secret 암호화 활성화 (--secrets-encryption)
  □ RBAC 권한 최소화
  □ kubeconfig 권한 600

□ 워크로드
  □ 모든 Pod Running
  □ readinessProbe / livenessProbe 설정
  □ resources.requests/limits 설정
  □ 비root 사용자로 실행

□ 모니터링
  □ metrics-server 설치
  □ Grafana 대시보드 접근 가능
  □ 알림 규칙 설정 (PodCrashLooping, HighMemory)

□ 백업
  □ etcd 스냅샷 자동화 (cron)
  □ PVC 데이터 백업 정책 수립

□ CSAP 감리 준비
  □ CSAP-D08 접근 통제 RBAC 문서화
  □ CSAP-D09 암호화 설정 확인서
  □ CSAP-D11 컨테이너 보안 체크리스트
```

---

*최종 수정: 2026-04-06 | 버전: 1.0.0 | 검증: k3s v1.34.6+k3s1 + WSL2 Ubuntu 22.04*
