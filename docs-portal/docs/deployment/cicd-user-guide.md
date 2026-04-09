---
sidebar_position: 3
title: CI/CD 완전 자동화 가이드
description: Gitea Actions + Harbor + Cosign + Flux GitOps — 코드 Push부터 k3s 배포까지 완전 자동화
---

# CI/CD 완전 자동화 가이드

> **대상 독자**: 초급(CI/CD 처음 접하는 분) ~ 중급(커스터마이징이 필요한 분)
> **환경**: WSL2 + k3s + Gitea + Harbor + Flux CD
> **CSAP 준수**: D-06(감사 로그), D-08(접근 통제), D-11(이미지 서명), D-12(시스템 개발 보안)

---

## 목차

1. [개요 및 전체 아키텍처](#1-개요-및-전체-아키텍처)
2. [사전 준비사항](#2-사전-준비사항)
3. [Gitea Actions Runner 설정](#3-gitea-actions-runner-설정)
4. [CI/CD 파이프라인 이해](#4-cicd-파이프라인-이해)
5. [Harbor 이미지 레지스트리 설정](#5-harbor-이미지-레지스트리-설정)
6. [Flux GitOps 설정](#6-flux-gitops-설정)
7. [환경별 배포 (dev/stg/prod)](#7-환경별-배포-devstgprod)
8. [원클릭 배포 스크립트 사용법](#8-원클릭-배포-스크립트-사용법)
9. [배포 확인 및 롤백](#9-배포-확인-및-롤백)
10. [Cosign 이미지 서명](#10-cosign-이미지-서명)
11. [문제 해결 가이드](#11-문제-해결-가이드)
12. [감사 로그 확인 (CSAP D-06)](#12-감사-로그-확인-csap-d-06)

---

## 1. 개요 및 전체 아키텍처

### 1.1 CI/CD란?

**CI (Continuous Integration, 지속적 통합)**는 개발자가 코드를 변경할 때마다 자동으로 빌드하고 테스트하는 프로세스입니다.
**CD (Continuous Deployment, 지속적 배포)**는 테스트를 통과한 코드를 자동으로 운영 환경에 배포하는 프로세스입니다.

### 1.2 전체 파이프라인 흐름

```
개발자 코드 작성
    ↓
git push (Gitea 저장소)
    ↓
┌─────────────────────────────────────────────────┐
│  Gitea Actions Runner (자동 실행)                │
│                                                  │
│  [1단계] CI: 빌드 + 테스트                       │
│    ├─ pnpm install (의존성 설치)                 │
│    ├─ typecheck (타입 검사)                       │
│    ├─ lint (코드 스타일 검사)                     │
│    ├─ build (빌드)                               │
│    └─ test (단위 + 통합 테스트)                  │
│                                                  │
│  [2단계] 보안 스캔                               │
│    ├─ 의존성 취약점 검사 (npm audit)             │
│    ├─ 하드코딩 시크릿 검사                       │
│    └─ Helm 차트 유효성 검증                      │
│                                                  │
│  [3단계] Docker 이미지 빌드 + Harbor 푸시        │
│    ├─ 16개 마이크로서비스 이미지 빌드            │
│    └─ Harbor 레지스트리에 푸시                    │
│                                                  │
│  [4단계] Cosign 이미지 서명                      │
│    ├─ 모든 이미지에 디지털 서명                  │
│    └─ 서명 검증                                  │
│                                                  │
│  [5단계] k3s 배포 (Helm)                         │
│    ├─ 환경 자동 감지 (dev/stg/prod)              │
│    ├─ Helm upgrade --install --atomic            │
│    └─ 실패 시 자동 롤백                          │
│                                                  │
│  [6단계] 배포 검증                               │
│    ├─ Pod Ready 대기                             │
│    ├─ Health Check                               │
│    └─ Smoke Test                                 │
│                                                  │
│  [7단계] 감사 로그 + 알림                        │
│    ├─ 배포 이벤트 audit.jsonl 기록               │
│    └─ 파이프라인 결과 요약 출력                  │
└─────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────┐
│  Flux GitOps (별도 자동 동기화)                  │
│    ├─ Git 레포 5분 주기 폴링                     │
│    ├─ 변경 감지 시 자동 배포                     │
│    └─ HelmRelease 상태 관리                      │
└─────────────────────────────────────────────────┘
```

### 1.3 핵심 구성 요소

| 구성 요소 | 역할 | 접속 정보 |
|-----------|------|----------|
| **Gitea** | Git 저장소 + CI/CD 트리거 | `http://localhost:3000` |
| **Gitea Actions Runner** | CI/CD 파이프라인 실행 | self-hosted (WSL2) |
| **Harbor** | Docker 이미지 레지스트리 | `http://localhost:8080` |
| **Cosign** | 이미지 무결성 서명 | CLI 도구 |
| **Helm** | k8s 패키지 매니저 | CLI 도구 |
| **Flux CD** | GitOps 자동 배포 | k3s 클러스터 내 |

---

## 2. 사전 준비사항

### 2.1 필수 소프트웨어 설치 확인

아래 명령어로 모든 필수 도구가 설치되어 있는지 확인합니다.

```bash
# k3s 클러스터 확인
kubectl cluster-info
# 출력 예: Kubernetes control plane is running at https://127.0.0.1:6443

# Helm 확인
helm version --short
# 출력 예: v3.16.0+g12345

# Docker 확인
docker --version
# 출력 예: Docker version 27.x

# Gitea 접속 확인
curl -s http://localhost:3000/api/v1/version
# 출력 예: {"version":"1.22.x"}

# Harbor 접속 확인
curl -sk https://localhost:8080/api/v2.0/health
# 출력 예: {"status":"healthy"}
```

### 2.2 도구별 설치 방법 (미설치 시)

```bash
# k3s 설치 (아직 없는 경우)
curl -sfL https://get.k3s.io | sh -

# Helm 설치
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

# Cosign 설치
curl -sSfL https://github.com/sigstore/cosign/releases/latest/download/cosign-linux-amd64 \
  -o /usr/local/bin/cosign && chmod +x /usr/local/bin/cosign

# Flux CLI 설치
curl -s https://fluxcd.io/install.sh | sudo bash
```

### 2.3 Gitea 시크릿 설정

CI/CD 파이프라인에서 사용하는 시크릿을 Gitea에 등록해야 합니다.

```
Gitea 웹 UI 접속 → 저장소 설정 → Actions → Secrets

필수 시크릿:
  HARBOR_URL          = localhost:8080
  HARBOR_USERNAME     = admin
  HARBOR_PASSWORD     = (Harbor 관리자 비밀번호)
  COSIGN_PASSWORD     = (Cosign 서명 키 비밀번호)
  KUBECONFIG          = (k3s kubeconfig 내용 - base64 아님, 원문)
```

**단계별 설정 방법:**

1. 브라우저에서 `http://localhost:3000` 접속
2. 저장소 페이지 → 상단 메뉴 `Settings` 클릭
3. 좌측 메뉴 `Actions` → `Secrets` 선택
4. `Add Secret` 버튼 클릭
5. Name에 `HARBOR_URL`, Value에 `localhost:8080` 입력 후 저장
6. 나머지 시크릿도 동일하게 추가

```bash
# kubeconfig 내용 확인 (이 내용을 KUBECONFIG 시크릿에 붙여넣기)
cat /etc/rancher/k3s/k3s.yaml
```

:::caution 주의
시크릿 값에는 **절대로** 따옴표를 포함하지 마세요. 값만 그대로 입력합니다.
:::

---

## 3. Gitea Actions Runner 설정

### 3.1 Act Runner 설치 및 등록

Gitea Actions는 **Act Runner**라는 별도 프로세스가 워크플로우를 실행합니다.

```bash
# Act Runner 바이너리 다운로드
wget -q https://dl.gitea.com/act_runner/0.2.11/act_runner-0.2.11-linux-amd64 \
  -O /usr/local/bin/act_runner
chmod +x /usr/local/bin/act_runner

# Gitea에서 Runner 등록 토큰 생성
# Gitea 웹 UI → 사이트 관리 → Runner → Create new runner
# 표시된 토큰을 복사합니다

# Runner 등록
act_runner register \
  --instance http://localhost:3000 \
  --token YOUR_REGISTRATION_TOKEN \
  --name wsl2-runner \
  --labels "self-hosted,ubuntu-latest"

# Runner 실행 (백그라운드)
nohup act_runner daemon &
```

### 3.2 Runner 상태 확인

```bash
# Runner 프로세스 확인
ps aux | grep act_runner

# Gitea 웹 UI에서 확인
# 사이트 관리 → Runner → "wsl2-runner" 상태가 "Online"인지 확인
```

### 3.3 Runner 서비스 등록 (자동 시작)

```bash
# systemd 서비스 파일 생성
sudo tee /etc/systemd/system/act-runner.service > /dev/null <<'EOF'
[Unit]
Description=Gitea Act Runner
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/act-runner
ExecStart=/usr/local/bin/act_runner daemon
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable act-runner
sudo systemctl start act-runner

# 상태 확인
sudo systemctl status act-runner
```

---

## 4. CI/CD 파이프라인 이해

### 4.1 워크플로우 파일 위치

```
프로젝트 루트/
├── .gitea/workflows/
│   ├── ci-cd-pipeline.yml   ← 통합 파이프라인 (메인)
│   ├── ci.yml               ← CI 전용 (빌드+테스트)
│   ├── deploy.yml           ← CD 전용 (이미지 빌드+배포)
│   ├── sign-image.yml       ← Cosign 서명
│   └── security.yml         ← 보안 스캔
```

### 4.2 통합 파이프라인 트리거 조건

| 이벤트 | 대상 브랜치 | 실행 범위 |
|--------|-----------|----------|
| `push` | `main` | 전체 파이프라인 (CI + CD + 배포) |
| `push` | `stg` | 전체 파이프라인 (CI + CD + 배포) |
| `push` | `feat/*`, `fix/*` | CI만 (빌드 + 테스트) |
| `pull_request` | `main` | CI만 (빌드 + 테스트) |
| `tag` | `v*` | 전체 파이프라인 (프로덕션 배포) |

### 4.3 파이프라인 실행 과정 (상세)

**[1단계] CI: 빌드 + 테스트** (약 5분)

```yaml
# 자동으로 PostgreSQL + Redis 서비스 컨테이너 생성
services:
  postgres:  # 테스트용 DB
  redis:     # 테스트용 캐시

# 실행 단계
pnpm install --frozen-lockfile  # 의존성 설치 (lock 파일 기준)
pnpm run typecheck              # TypeScript 타입 검사
pnpm run lint                   # ESLint 코드 스타일 검사
pnpm run build                  # 전체 빌드
pnpm run test -- --coverage     # 테스트 + 커버리지 측정
```

**[2단계] 보안 스캔** (약 2분)

```bash
pnpm audit --audit-level=high   # npm 패키지 취약점 검사
# 하드코딩 시크릿 패턴 검사 (API 키, 비밀번호 등)
# Helm 차트 문법 검증
```

**[3단계] Docker 이미지 빌드** (약 10분)

```bash
# 16개 마이크로서비스 + Portal = 17개 이미지 병렬 빌드
docker build → Harbor push → 이미지 검증
# 캐시 활용으로 재빌드 시 2~3분으로 단축
```

**[4단계] Cosign 이미지 서명** (약 2분)

```bash
# 모든 이미지에 디지털 서명 (CSAP D-11: 가상화 보안)
cosign sign --key cosign.key IMAGE_REF
cosign verify --key cosign.pub IMAGE_REF
```

**[5단계] k3s 배포** (약 3분)

```bash
# 환경 자동 감지 후 Helm 배포
helm upgrade --install saas-{env} ./helm/saas-platform/ \
  -f values-{env}.yaml \
  --atomic  # 실패 시 자동 롤백
```

### 4.4 파이프라인 실행 확인

```bash
# Gitea 웹 UI에서 확인
# 저장소 → Actions 탭 → 최근 실행 목록

# 또는 직접 로그 확인
# 각 Job을 클릭하면 단계별 로그를 볼 수 있습니다
```

---

## 5. Harbor 이미지 레지스트리 설정

### 5.1 Harbor 프로젝트 생성

```bash
# Harbor 웹 UI: http://localhost:8080
# 로그인: admin / (설치 시 설정한 비밀번호)

# 프로젝트 생성
# 1. Projects → New Project 클릭
# 2. Project Name: public-saas
# 3. Access Level: Private
# 4. Storage quota: -1 (무제한)
# 5. OK 클릭
```

### 5.2 Harbor에 로그인 테스트

```bash
# Docker CLI로 Harbor 로그인
docker login localhost:8080
# Username: admin
# Password: (Harbor 비밀번호)

# 테스트 이미지 푸시
docker pull alpine:latest
docker tag alpine:latest localhost:8080/public-saas/test:latest
docker push localhost:8080/public-saas/test:latest
# 성공하면 Harbor 웹 UI에서 이미지를 확인할 수 있습니다
```

### 5.3 이미지 정리 정책 설정

디스크 공간 관리를 위해 오래된 이미지를 자동 삭제합니다.

```
Harbor 웹 UI → Projects → public-saas → Policy
→ Add Tag Retention Rule:
  - repositories: **
  - retain: most recent 10 artifacts
  - schedule: Daily
```

---

## 6. Flux GitOps 설정

### 6.1 Flux가 하는 일

Flux CD는 Git 저장소를 지속적으로 모니터링하여, 인프라 설정이 변경되면 **자동으로 k3s에 적용**합니다.

```
Git 저장소 (infra/flux/) 변경
    ↓  (5분 주기 폴링)
Flux Source Controller 감지
    ↓
Flux Kustomize Controller 적용
    ↓
k3s 클러스터에 자동 배포
```

### 6.2 Flux 부트스트랩

```bash
# Flux CLI가 설치되어 있어야 합니다
flux check --pre

# Gitea 저장소에 Flux 부트스트랩
export GITEA_TOKEN="your-gitea-personal-access-token"

flux bootstrap gitea \
  --owner=saas-admin \
  --repository=fleet-infra \
  --hostname=localhost:3000 \
  --path=clusters/wsl-dev \
  --personal
```

### 6.3 Flux 리소스 확인

```bash
# Flux 시스템 상태
flux check

# GitRepository 소스 확인
flux get sources git
# 출력 예:
# NAME         REVISION     SUSPENDED  READY  MESSAGE
# fleet-infra  main@sha1:abc  False    True   stored artifact...

# HelmRelease 상태 확인
flux get helmreleases
# 출력 예:
# NAME           REVISION  SUSPENDED  READY  MESSAGE
# saas-platform  1.0.0     False      True   Helm upgrade succeeded

# Kustomization 상태 확인
flux get kustomizations
# 출력 예:
# NAME            REVISION     SUSPENDED  READY  MESSAGE
# saas-infra      main@sha1    False      True   Applied revision
# saas-monitoring main@sha1    False      True   Applied revision
# saas-apps       main@sha1    False      True   Applied revision
```

### 6.4 Flux 수동 동기화

자동 동기화 주기(5분)를 기다리지 않고 즉시 적용하려면:

```bash
# GitRepository 즉시 새로고침
flux reconcile source git fleet-infra

# HelmRelease 즉시 재적용
flux reconcile helmrelease saas-platform

# Kustomization 즉시 재적용
flux reconcile kustomization saas-apps
```

### 6.5 Flux 배포 순서

`platform-kustomization.yaml`에 정의된 배포 순서:

```
1단계: saas-infra      → PostgreSQL, Redis (인프라 기반)
2단계: saas-monitoring  → Prometheus, Loki, Tempo (모니터링)
3단계: saas-apps        → 마이크로서비스 (애플리케이션)
4단계: saas-network     → NetworkPolicy, Ingress (네트워크)
```

각 단계는 이전 단계가 완료된 후에만 실행됩니다 (`dependsOn` 설정).

---

## 7. 환경별 배포 (dev/stg/prod)

### 7.1 환경 구분

| 환경 | 브랜치 | 네임스페이스 | 특징 |
|------|--------|------------|------|
| **dev** | `feat/*`, `fix/*` | `saas-dev` | 개발자 테스트, 리소스 최소 |
| **stg** | `stg` | `saas-staging` | 통합 테스트, 운영과 유사 |
| **prod** | `main` (태그) | `saas-production` | 프로덕션, CSAP 준수 필수 |

### 7.2 환경별 Values 파일

```bash
helm/saas-platform/
├── values.yaml           # 기본값 (공통)
├── values-dev.yaml       # 개발 환경 (리소스 최소, 디버그 활성화)
├── values-stg.yaml       # 스테이징 환경 (운영 유사)
└── values-prod.yaml      # 프로덕션 환경 (HA, CSAP 준수)
```

### 7.3 환경별 차이점

```yaml
# values-dev.yaml (개발)
replicaCount: 1
resources:
  limits: { cpu: 250m, memory: 256Mi }
debug: true
monitoring: false

# values-stg.yaml (스테이징)
replicaCount: 1
resources:
  limits: { cpu: 500m, memory: 512Mi }
debug: false
monitoring: true

# values-prod.yaml (프로덕션)
replicaCount: 2  # 고가용성
resources:
  limits: { cpu: 1000m, memory: 1Gi }
debug: false
monitoring: true
csapCompliance: true  # CSAP 감사 로그 강화
```

---

## 8. 원클릭 배포 스크립트 사용법

### 8.1 기본 사용법

```bash
# 스테이징 환경에 배포 (기본값)
./scripts/deploy-to-k3s.sh

# 또는 환경을 명시적으로 지정
./scripts/deploy-to-k3s.sh stg

# 개발 환경에 배포
./scripts/deploy-to-k3s.sh dev

# 프로덕션 환경에 배포
./scripts/deploy-to-k3s.sh prod
```

### 8.2 배포 과정 출력 예시

```
========================================================
  공공기관 SaaS 플랫폼 — k3s 배포 (stg)
  CSAP D-06/D-08/D-11/D-12 준수
========================================================

[STEP]  1/8 사전 조건 확인
[OK]    k3s 클러스터 접근 가능
[OK]    Helm v3.16.0 확인
[OK]    Helm 차트 확인: helm/saas-platform/
[OK]    가용 메모리 12GB

[STEP]  2/8 네임스페이스 및 시크릿 설정 (saas-staging)
[OK]    PostgreSQL 시크릿 이미 존재
[OK]    Redis 시크릿 이미 존재
[OK]    네임스페이스 saas-staging 준비 완료

[STEP]  3/8 Docker 이미지 빌드 (선택적)
  이미지를 새로 빌드하시겠습니까? (y/N) N
[INFO]  이미지 빌드 건너뜀 — 기존 Harbor 이미지 사용

[STEP]  4/8 Helm 저장소 등록
[OK]    Helm 저장소 업데이트 완료

[STEP]  5/8 인프라 서비스 배포 (PostgreSQL, Redis)
[OK]    PostgreSQL 배포 완료
[OK]    Redis 배포 완료

[STEP]  6/8 애플리케이션 배포 (Helm)
[OK]    애플리케이션 배포 완료

[STEP]  7/8 Flux GitOps 자동 동기화 설정 (선택적)
[OK]    Flux 시스템 이미 동작 중
[OK]    Flux CRD 리소스 적용 완료

[STEP]  8/8 배포 검증 및 접속 정보

========================================================
  공공기관 SaaS 플랫폼 배포 완료
========================================================
  환경:     stg
  네임스페이스: saas-staging
  API Gateway: http://172.18.120.97:30080
  Portal:      http://172.18.120.97:30000
  Grafana:     http://172.18.120.97:30300
========================================================
```

### 8.3 기타 유틸리티 명령

```bash
# 배포 상태 확인
./scripts/deploy-to-k3s.sh --status

# 이전 버전으로 롤백
./scripts/deploy-to-k3s.sh --rollback

# 전체 제거
./scripts/deploy-to-k3s.sh --uninstall
```

---

## 9. 배포 확인 및 롤백

### 9.1 배포 상태 확인

```bash
# Pod 상태 확인
kubectl get pods -n saas-staging
# 출력 예:
# NAME                            READY   STATUS    RESTARTS   AGE
# api-gateway-5d8f9b7c6-abc12     1/1     Running   0          5m
# auth-service-7b4c6d8e9-def34    1/1     Running   0          5m
# ...

# 서비스 엔드포인트 확인
kubectl get svc -n saas-staging

# Helm 릴리스 이력
helm history saas-stg -n saas-staging
# 출력 예:
# REVISION  UPDATED                   STATUS      DESCRIPTION
# 1         2026-04-09 10:00:00       deployed    Install complete
# 2         2026-04-09 11:00:00       deployed    Upgrade complete
```

### 9.2 롤백 방법

```bash
# 방법 1: Helm 롤백 (이전 릴리스로 복구)
helm rollback saas-stg -n saas-staging
# → REVISION 1로 복구됨

# 방법 2: 특정 릴리스로 롤백
helm rollback saas-stg 1 -n saas-staging
# → REVISION 1로 복구됨

# 방법 3: 원클릭 스크립트
./scripts/deploy-to-k3s.sh --rollback
```

### 9.3 실시간 모니터링

```bash
# Pod 실시간 상태 감시
kubectl get pods -n saas-staging -w

# 특정 서비스 로그 실시간 확인
kubectl logs -f deployment/api-gateway -n saas-staging

# 이벤트 확인 (배포 문제 진단)
kubectl get events -n saas-staging --sort-by='.lastTimestamp' | tail -20
```

---

## 10. Cosign 이미지 서명

### 10.1 왜 이미지 서명이 필요한가?

**CSAP D-11 (가상화 보안)** 요건에 따라, 컨테이너 이미지의 무결성을 보장해야 합니다.
Cosign은 이미지에 디지털 서명을 추가하여, 변조되지 않았음을 검증합니다.

### 10.2 서명 키 생성 (최초 1회)

```bash
# Cosign 키 쌍 생성
cosign generate-key-pair
# Enter password: (서명 키 비밀번호 입력)
# 생성 파일:
#   cosign.key  ← 비밀키 (절대 공유 금지!)
#   cosign.pub  ← 공개키 (검증용, 공유 가능)

# 키 파일을 안전한 위치로 이동
sudo mkdir -p /opt/cosign
sudo mv cosign.key /opt/cosign/
cp cosign.pub infra/cosign/cosign.pub
```

### 10.3 수동 서명 및 검증

```bash
# 이미지 서명
cosign sign --key /opt/cosign/cosign.key \
  --allow-insecure-registry \
  localhost:8080/public-saas/api-gateway:latest

# 서명 검증
cosign verify --key infra/cosign/cosign.pub \
  --insecure-ignore-tlog \
  --allow-insecure-registry \
  localhost:8080/public-saas/api-gateway:latest
```

### 10.4 Kyverno 정책 (미서명 이미지 차단)

Kyverno가 클러스터에 설치되어 있으면, 서명되지 않은 이미지의 배포를 자동으로 차단합니다.

```bash
# Kyverno 정책 확인
kubectl get clusterpolicy verify-image-signature -o yaml

# 미서명 이미지 배포 시도 → 자동 차단됨
kubectl run test --image=localhost:8080/public-saas/unsigned:latest
# Error: admission webhook denied the request: image not signed
```

---

## 11. 문제 해결 가이드

### 11.1 CI 빌드 실패

```bash
# 문제: pnpm install 실패
# 원인: lock 파일 불일치
# 해결:
pnpm install  # 로컬에서 먼저 실행
git add pnpm-lock.yaml
git commit -m "fix: pnpm lock 파일 동기화"
git push
```

```bash
# 문제: typecheck 실패
# 원인: TypeScript 타입 오류
# 해결:
pnpm run typecheck  # 로컬에서 오류 확인 후 수정
```

### 11.2 Docker 빌드 실패

```bash
# 문제: Dockerfile을 찾을 수 없음
# 확인:
ls platform/services/api-gateway/Dockerfile

# 문제: Harbor push 실패
# 원인: 인증 문제
# 해결:
docker login localhost:8080
# Gitea Secrets에 HARBOR_USERNAME, HARBOR_PASSWORD 재확인
```

### 11.3 Helm 배포 실패

```bash
# 문제: Helm upgrade 타임아웃
# 원인: Pod가 Ready 상태에 도달하지 못함
# 진단:
kubectl get pods -n saas-staging
kubectl describe pod <problem-pod> -n saas-staging
kubectl logs <problem-pod> -n saas-staging

# 문제: ImagePullBackOff
# 원인: Harbor에서 이미지를 가져올 수 없음
# 해결:
# 1. Harbor에 이미지가 존재하는지 확인
# 2. imagePullSecrets 설정 확인
kubectl get secret harbor-registry -n saas-staging -o yaml
```

### 11.4 Flux 동기화 실패

```bash
# 문제: Flux reconcile 실패
# 진단:
flux get all
flux logs --all-namespaces

# 문제: GitRepository 접근 실패
# 원인: Gitea 인증 정보 만료
# 해결:
kubectl get secret gitea-credentials -n flux-system -o yaml
# 시크릿 재생성이 필요하면:
flux create secret git gitea-credentials \
  --url=http://localhost:3000/saas-admin/fleet-infra.git \
  --username=saas-admin \
  --password=YOUR_TOKEN
```

### 11.5 Cosign 서명 실패

```bash
# 문제: "no matching signatures" 오류
# 원인: 공개키/비밀키 불일치
# 해결: 키 쌍 재생성
cosign generate-key-pair
# 새 공개키를 infra/cosign/cosign.pub에 복사
```

---

## 12. 감사 로그 확인 (CSAP D-06)

### 12.1 감사 로그 위치

```bash
# 프로젝트 감사 로그
cat .claude/audit.jsonl | grep "DEPLOY"

# CI/CD 파이프라인 감사 로그 (Gitea Actions Artifact)
# Gitea 웹 UI → 저장소 → Actions → 완료된 실행 → Artifacts → pipeline-audit
```

### 12.2 감사 로그 형식

```json
{
  "timestamp": "2026-04-09T10:30:00Z",
  "action": "CI_CD_PIPELINE",
  "event": "DEPLOY",
  "actor": "developer1",
  "ref": "stg",
  "sha": "abc1234",
  "environment": "staging",
  "status": "success",
  "pipeline_run": "12345",
  "csap_ref": "D-06"
}
```

### 12.3 감사 로그 조회

```bash
# 최근 배포 이력 조회
cat .claude/audit.jsonl | grep '"action":"K3S_DEPLOY"' | tail -10

# 실패한 배포만 조회
cat .claude/audit.jsonl | grep '"status":"failure"'

# 특정 환경 배포 이력
cat .claude/audit.jsonl | grep '"environment":"production"'
```

---

## 부록: 자주 사용하는 명령어 모음

```bash
# === 배포 ===
./scripts/deploy-to-k3s.sh stg          # 스테이징 배포
./scripts/deploy-to-k3s.sh --status      # 상태 확인
./scripts/deploy-to-k3s.sh --rollback    # 롤백

# === Helm ===
helm list -n saas-staging                # 릴리스 목록
helm history saas-stg -n saas-staging    # 배포 이력
helm rollback saas-stg -n saas-staging   # 롤백
helm uninstall saas-stg -n saas-staging  # 제거

# === kubectl ===
kubectl get pods -n saas-staging         # Pod 목록
kubectl logs -f deploy/api-gateway -n saas-staging  # 로그
kubectl describe pod <name> -n saas-staging          # 상세 정보
kubectl get events -n saas-staging --sort-by='.lastTimestamp'  # 이벤트

# === Flux ===
flux get all                              # 전체 상태
flux reconcile source git fleet-infra     # 즉시 동기화
flux logs --all-namespaces                # Flux 로그

# === Harbor ===
docker login localhost:8080               # 로그인
docker push localhost:8080/public-saas/IMAGE:TAG  # 이미지 푸시

# === Cosign ===
cosign sign --key /opt/cosign/cosign.key IMAGE_REF   # 서명
cosign verify --key infra/cosign/cosign.pub IMAGE_REF # 검증
```

---

*이 문서는 MTU-N35 CI/CD 완전 자동화 시스템의 사용자 가이드입니다.*
*CSAP D-06/D-08/D-11/D-12 요건을 준수합니다.*
