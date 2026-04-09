# Design: MTU-N24 Flux GitOps 연동 심화

> **버전**: 1.0.0 | **작성일**: 2026-04-08 | **작성자**: PM Lead

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 폐쇄망 환경에서 Gitea 기반 GitOps 자동 배포 파이프라인 |
| 기술 | Flux v2.8 + Gitea HTTP + Kustomization 패턴 |
| 보안 | Secret 기반 인증, RBAC 분리, 감사 로그 연동 |
| 운영 | Git Push → 5분 이내 자동 배포, 상태 알림 |

---

## 아키텍처 선택: Option B — Pragmatic Balance

### 구성도

```
Gitea (localhost:3000)
  └── fleet-infra 저장소
       ├── clusters/
       │   └── wsl-dev/
       │       ├── flux-system/   (Flux 자체 관리)
       │       └── apps/          (앱 Kustomization)
       └── apps/
           └── sample-app/
               ├── namespace.yaml
               ├── deployment.yaml
               └── service.yaml

Flux v2 (k3s)
  ├── GitRepository → Gitea fleet-infra
  ├── Kustomization → clusters/wsl-dev/apps/
  ├── Provider → Gitea 웹훅 알림
  └── Alert → 배포 상태 알림
```

### 인증 방식

- Gitea API Token + Basic Auth (HTTP)
- Kubernetes Secret (flux-system 네임스페이스)
- RBAC: flux-system ServiceAccount에 최소 권한

---

## 상세 설계

### 1. Gitea 저장소 준비

```bash
# Gitea에 fleet-infra 저장소 생성
curl -X POST "http://localhost:3000/api/v1/user/repos" \
  -H "Authorization: token ${GITEA_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"name":"fleet-infra","auto_init":true,"default_branch":"main"}'
```

### 2. GitRepository 리소스

```yaml
# infra/flux/gitea-source.yaml
apiVersion: source.toolkit.fluxcd.io/v1
kind: GitRepository
metadata:
  name: fleet-infra
  namespace: flux-system
spec:
  interval: 5m
  url: http://gitea.saas-platform.svc.cluster.local:3000/saas-admin/fleet-infra.git
  ref:
    branch: main
  secretRef:
    name: gitea-credentials
  timeout: 3m
```

### 3. Kustomization 리소스

```yaml
# infra/flux/app-kustomization.yaml
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: sample-apps
  namespace: flux-system
spec:
  interval: 5m
  sourceRef:
    kind: GitRepository
    name: fleet-infra
  path: ./apps/sample-app
  prune: true
  targetNamespace: default
  timeout: 3m
```

### 4. 알림 설정

```yaml
# infra/flux/notification.yaml
apiVersion: notification.toolkit.fluxcd.io/v1beta3
kind: Provider
metadata:
  name: gitea-provider
  namespace: flux-system
spec:
  type: gitea
  address: http://gitea.saas-platform.svc.cluster.local:3000
  secretRef:
    name: gitea-credentials
---
apiVersion: notification.toolkit.fluxcd.io/v1beta3
kind: Alert
metadata:
  name: flux-alerts
  namespace: flux-system
spec:
  providerRef:
    name: gitea-provider
  eventSeverity: info
  eventSources:
    - kind: GitRepository
      name: '*'
    - kind: Kustomization
      name: '*'
```

### 5. 샘플 앱

```yaml
# apps/sample-app/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: gitops-demo

# apps/sample-app/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx-demo
  namespace: gitops-demo
spec:
  replicas: 1
  selector:
    matchLabels:
      app: nginx-demo
  template:
    metadata:
      labels:
        app: nginx-demo
    spec:
      containers:
      - name: nginx
        image: nginx:alpine
        ports:
        - containerPort: 80

# apps/sample-app/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: nginx-demo
  namespace: gitops-demo
spec:
  selector:
    app: nginx-demo
  ports:
  - port: 80
    targetPort: 80
```

---

## Session Guide

1. Gitea에 fleet-infra 저장소 생성
2. Kubernetes Secret 생성 (gitea-credentials)
3. GitRepository 리소스 적용 및 Ready 확인
4. 샘플 앱을 fleet-infra에 Push
5. Kustomization 리소스 적용 및 자동 배포 확인
6. 알림 Provider/Alert 리소스 적용
7. 변경 Push → 자동 업데이트 확인 (3분 이내)
8. 가이드 문서 작성

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-08 | 최초 작성 | PM Lead |
