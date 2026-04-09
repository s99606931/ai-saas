# Flux GitOps 연동 가이드 — Gitea + k3s

> **버전**: 1.0.0 | **작성일**: 2026-04-08 | **작성자**: PM Lead
> **MTU**: MTU-N24 | **CSAP**: D-12 (시스템 개발 보안)

---

## 1. 개요

이 문서는 WSL2 환경에서 Gitea와 Flux v2를 연동하여 GitOps 기반 자동 배포 파이프라인을 구축하는 절차를 설명합니다.

### 아키텍처

```
개발자 → Git Push → Gitea (localhost:3000)
                        ↓
              Flux Source Controller (GitRepository)
                        ↓
              Flux Kustomize Controller (Kustomization)
                        ↓
              k3s 클러스터 자동 배포
                        ↓
              Flux Notification Controller → Gitea 커밋 상태
```

### 사전 요구사항

- k3s 클러스터 (Ready)
- Flux v2 컨트롤러 4개 Running (helm, kustomize, notification, source)
- Gitea (Docker, localhost:3000)
- WSL2 IP 확인: `hostname -I | awk '{print $1}'`

---

## 2. Gitea 저장소 준비

### 2.1 API Token 생성

```bash
# Gitea API Token 생성
GITEA_PASS="<관리자 비밀번호>"
curl -X POST "http://localhost:3000/api/v1/users/saas-admin/tokens" \
  -u "saas-admin:${GITEA_PASS}" \
  -H "Content-Type: application/json" \
  -d '{"name":"flux-gitops","scopes":["all"]}'
```

### 2.2 fleet-infra 저장소 생성

```bash
GITEA_TOKEN="<생성된 토큰>"
curl -X POST "http://localhost:3000/api/v1/user/repos" \
  -H "Authorization: token ${GITEA_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"name":"fleet-infra","auto_init":true,"default_branch":"main"}'
```

---

## 3. Kubernetes Secret 생성

```bash
kubectl create secret generic gitea-credentials \
  --namespace=flux-system \
  --from-literal=username=saas-admin \
  --from-literal=password="${GITEA_TOKEN}"
```

---

## 4. GitRepository 리소스

```yaml
# infra/flux/gitea-source.yaml
apiVersion: source.toolkit.fluxcd.io/v1
kind: GitRepository
metadata:
  name: fleet-infra
  namespace: flux-system
spec:
  interval: 5m
  url: http://<WSL_IP>:3000/saas-admin/fleet-infra.git
  ref:
    branch: main
  secretRef:
    name: gitea-credentials
  timeout: 3m
```

적용 및 확인:

```bash
kubectl apply -f infra/flux/gitea-source.yaml
kubectl get gitrepositories -n flux-system
# READY: True, STATUS: stored artifact for revision 'main@sha1:...'
```

---

## 5. 샘플 앱 Push

fleet-infra 저장소에 Kubernetes 매니페스트를 Push합니다:

```bash
git clone http://saas-admin:${GITEA_TOKEN}@localhost:3000/saas-admin/fleet-infra.git
cd fleet-infra
mkdir -p apps/sample-app

# namespace.yaml, deployment.yaml, service.yaml, kustomization.yaml 생성
# (infra/flux/sample-app/ 참조)

git add -A
git commit -m "feat: add sample-app"
git push origin main
```

---

## 6. Kustomization 리소스

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
  targetNamespace: gitops-demo
  timeout: 3m
  wait: true
  healthChecks:
    - apiVersion: apps/v1
      kind: Deployment
      name: nginx-demo
      namespace: gitops-demo
```

적용 및 확인:

```bash
kubectl apply -f infra/flux/app-kustomization.yaml
kubectl get kustomizations -n flux-system
# READY: True, STATUS: Applied revision: main@sha1:...

kubectl get pods -n gitops-demo
# nginx-demo-xxx   Running
```

---

## 7. 알림 설정 (선택)

Flux 배포 이벤트를 Gitea 커밋 상태로 알림합니다:

```yaml
# infra/flux/notification.yaml
apiVersion: notification.toolkit.fluxcd.io/v1beta3
kind: Provider
metadata:
  name: gitea-provider
  namespace: flux-system
spec:
  type: gitea
  address: http://<WSL_IP>:3000
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

---

## 8. 변경 자동 반영 테스트

```bash
# deployment.yaml에서 replicas 변경
cd fleet-infra
sed -i 's/replicas: 1/replicas: 2/' apps/sample-app/deployment.yaml
git add -A && git commit -m "feat: scale to 2 replicas" && git push origin main

# 즉시 reconcile 트리거 (interval 대기 없이)
kubectl annotate gitrepository fleet-infra -n flux-system \
  reconcile.fluxcd.io/requestedAt="$(date +%s)" --overwrite

# 15초 후 확인
kubectl get pods -n gitops-demo
# 2개 Pod Running 확인
```

---

## 9. 트러블슈팅

### 9.1 GitRepository가 Ready=False

```bash
kubectl describe gitrepository fleet-infra -n flux-system
# 원인: 인증 실패 → Secret 확인
# 원인: URL 접근 불가 → WSL IP 확인
```

### 9.2 Kustomization path not found

```bash
# GitRepository가 최신 커밋을 가져오지 않았을 수 있음
kubectl annotate gitrepository fleet-infra -n flux-system \
  reconcile.fluxcd.io/requestedAt="$(date +%s)" --overwrite
```

### 9.3 Gitea REQUIRE_SIGNIN_VIEW 403

Gitea가 로그인 없이 접근을 차단하는 경우, Secret에 올바른 토큰이 설정되어 있는지 확인합니다. Flux는 Secret을 통해 인증하므로 REQUIRE_SIGNIN_VIEW가 켜져 있어도 동작합니다.

### 9.4 WSL2 IP 변경 시

WSL2 재시작 시 IP가 변경될 수 있습니다:

```bash
NEW_IP=$(hostname -I | awk '{print $1}')
kubectl patch gitrepository fleet-infra -n flux-system \
  --type=merge -p "{\"spec\":{\"url\":\"http://${NEW_IP}:3000/saas-admin/fleet-infra.git\"}}"
```

---

## 10. CSAP/감리 매핑

| CSAP 항목 | 구현 내용 |
|-----------|---------|
| D-12-01 | GitOps 기반 배포 자동화 → 변경 추적 100% |
| D-12-02 | Git 커밋 기반 감사 로그 → 배포 이력 완전 보존 |
| D-06-01 | Flux 알림 → 배포 상태 모니터링 자동화 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-08 | 최초 작성 | PM Lead |
