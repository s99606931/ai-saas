# Helm — Kubernetes 패키지 관리

> **버전**: 1.0.0 | **작성일**: 2026-04-11
> **대상**: 신규 개발자, DevOps 엔지니어
> **CSAP**: D-12 (시스템 개발 보안)
> **관련 문서**: `04-infrastructure.md` §7, `docs/07-infra/helm-umbrella-guide.md`, `docs/07-infra/helm-deployment-guide.md`

---

## 목차

1. [Helm이란](#1-helm이란)
2. [Chart, Release, Values 개념](#2-chart-release-values-개념)
3. [자주 쓰는 Helm 명령어](#3-자주-쓰는-helm-명령어)
4. [saas-platform Umbrella Chart 구조](#4-saas-platform-umbrella-chart-구조)
5. [values.yaml 커스터마이징 방법](#5-valuesyaml-커스터마이징-방법)
6. [새 서비스 Helm Chart 추가하기](#6-새-서비스-helm-chart-추가하기)
7. [배포 후 확인 방법](#7-배포-후-확인-방법)
8. [자주 하는 실수](#8-자주-하는-실수)

---

## 1. Helm이란

### 1.1 패키지 관리자 비유

Helm은 Kubernetes의 패키지 관리자입니다. apt(Ubuntu), npm(Node.js)과 동일한 역할을 합니다.

```
비유:
  apt install nginx           → helm install traefik traefik/traefik
  apt upgrade nginx           → helm upgrade traefik traefik/traefik
  apt remove nginx            → helm uninstall traefik
  apt show nginx              → helm show chart traefik/traefik
```

Helm 없이 서비스를 배포하면 Deployment, Service, ConfigMap, Secret, ServiceAccount, RBAC 등 수십 개의 YAML 파일을 각각 관리해야 합니다. Helm은 이것을 하나의 패키지(Chart)로 묶어 배포·업데이트·롤백을 단순화합니다.

### 1.2 왜 이 프레임워크에서 Helm을 사용하는가

| 필요 | Helm이 해결하는 방법 |
|------|------------------|
| 환경별 설정 (개발/스테이징/프로덕션) | values.yaml 파일로 환경별 값 오버라이드 |
| 의존성 관리 (서비스가 DB 먼저 뜨도록) | `dependencies` 필드 선언 |
| 롤백 | `helm rollback` 으로 이전 버전 복구 |
| 감사 추적 | Helm Release 이력이 클러스터에 저장됨 |
| 반복 가능한 배포 | 동일 Chart + values = 항상 동일한 클러스터 상태 |

---

## 2. Chart, Release, Values 개념

### 2.1 Chart — 설치 패키지

Chart는 Kubernetes 리소스들을 묶은 패키지입니다. 하나의 Chart로 여러 환경에 배포할 수 있습니다.

```
helm/auth-service/           ← Chart 디렉토리
├── Chart.yaml               ← 메타데이터 (이름, 버전, 의존성)
├── values.yaml              ← 기본 설정값
└── templates/               ← Kubernetes YAML 템플릿
    ├── deployment.yaml
    ├── service.yaml
    ├── configmap.yaml
    ├── serviceaccount.yaml
    └── ingress.yaml
```

```yaml
# Chart.yaml 예시
apiVersion: v2
name: auth-service
description: 공공기관 SaaS 인증 서비스
type: application
version: 1.2.3              # Chart 버전
appVersion: "1.2.3"         # 앱 버전 (이미지 태그와 일치)
dependencies:
  - name: common
    version: "2.x"
    repository: "https://charts.bitnami.com/bitnami"
```

### 2.2 Release — 설치된 Chart 인스턴스

Chart를 실제로 클러스터에 설치하면 Release가 됩니다. 동일한 Chart를 다른 이름으로 여러 번 설치할 수 있습니다.

```
Chart:   auth-service (패키지 정의)
           ↓ helm install
Release: auth-service (클러스터에 설치된 인스턴스 — 이름, 버전, 상태)
           ↓ helm upgrade
Release: auth-service (새 버전으로 업그레이드된 동일 Release)
```

```bash
# Release 목록 확인
helm list -n saas-platform
# NAME          NAMESPACE      REVISION  STATUS    CHART                    APP VERSION
# auth-service  saas-platform  3         deployed  auth-service-1.2.3       1.2.3
# api-gateway   saas-platform  5         deployed  api-gateway-2.0.1        2.0.1
```

`REVISION`은 해당 Release의 배포 횟수입니다. rollback 시 이 번호를 사용합니다.

### 2.3 Values — 설정 주입

Values는 Chart 템플릿에 주입되는 설정값입니다. 기본값은 `values.yaml`에 정의하고, 환경별 오버라이드는 별도 파일로 제공합니다.

```yaml
# helm/auth-service/values.yaml (기본값)
replicaCount: 2
image:
  repository: localhost:8080/public-saas/auth-service
  tag: "1.2.3"
  pullPolicy: IfNotPresent

service:
  type: ClusterIP
  port: 3001

resources:
  requests:
    cpu: 50m
    memory: 128Mi
  limits:
    cpu: 250m
    memory: 256Mi

database:
  host: postgres.saas.svc.cluster.local
  port: 5432
  name: auth_db

monitoring:
  enabled: true
```

---

## 3. 자주 쓰는 Helm 명령어

### 3.1 조회 명령어

```bash
# --- Release 조회 ---
# 특정 네임스페이스의 Release 목록
helm list -n saas-platform

# 전체 네임스페이스의 Release 목록
helm list -A

# Release 상세 정보
helm status auth-service -n saas-platform

# 현재 적용된 values 확인
helm get values auth-service -n saas-platform

# 기본값 포함 전체 values 확인
helm get values auth-service -n saas-platform --all

# Release 배포 이력
helm history auth-service -n saas-platform

# Chart 정보 확인
helm show chart ./helm/auth-service
helm show values ./helm/auth-service    # 기본 values 출력
```

### 3.2 배포 명령어

```bash
# --- 설치 ---
# 로컬 Chart 설치 (네임스페이스 자동 생성)
helm install auth-service ./helm/auth-service \
  -n saas-platform \
  --create-namespace

# values 파일 지정
helm install auth-service ./helm/auth-service \
  -n saas-platform \
  -f helm/auth-service/values.yaml \
  -f helm/auth-service/values-stg.yaml  # 스테이징 오버라이드

# 드라이런 (실제 배포 없이 렌더링 결과 확인)
helm install auth-service ./helm/auth-service \
  -n saas-platform --dry-run

# --- 업그레이드 ---
# 이미 설치된 Release 업그레이드
helm upgrade auth-service ./helm/auth-service \
  -n saas-platform \
  -f helm/auth-service/values.yaml

# 없으면 설치, 있으면 업그레이드 (--install 플래그)
helm upgrade --install auth-service ./helm/auth-service \
  -n saas-platform \
  -f helm/auth-service/values.yaml

# 특정 값만 CLI에서 오버라이드
helm upgrade auth-service ./helm/auth-service \
  -n saas-platform \
  --set replicaCount=3 \
  --set image.tag=v1.3.0
```

### 3.3 롤백 명령어

```bash
# 이전 버전으로 롤백 (revision 1개 이전)
helm rollback auth-service -n saas-platform

# 특정 revision으로 롤백
helm history auth-service -n saas-platform  # 이력 확인 후
helm rollback auth-service 2 -n saas-platform  # revision 2로 롤백

# 롤백 후 상태 확인
helm status auth-service -n saas-platform
kubectl rollout status deployment/auth-service -n saas-platform
```

### 3.4 삭제 및 검증

```bash
# Release 삭제 (리소스도 함께 삭제)
helm uninstall auth-service -n saas-platform

# --- Chart 검증 ---
# Chart 문법 검사
helm lint ./helm/auth-service

# 템플릿 렌더링 결과 확인 (YAML 미리보기)
helm template auth-service ./helm/auth-service \
  -n saas-platform \
  -f helm/auth-service/values.yaml

# Repository 관리
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update
helm search repo bitnami/postgresql
```

---

## 4. saas-platform Umbrella Chart 구조

Umbrella Chart는 여러 서비스를 하나의 Chart로 묶어 함께 배포·관리하는 패턴입니다. 이 프레임워크에서는 `helm/saas-platform/`이 Umbrella Chart 역할을 합니다.

### 4.1 디렉토리 구조

```
helm/saas-platform/           ← Umbrella Chart
├── Chart.yaml                ← 의존성으로 하위 서비스 Chart 나열
├── values.yaml               ← 전체 서비스 공통 기본값
├── values-dev.yaml           ← 개발 환경 오버라이드
├── values-stg.yaml           ← 스테이징 환경 오버라이드
└── charts/                   ← 의존 Chart 저장 디렉토리 (helm dep update 후 생성)
    ├── api-gateway/
    ├── auth-service/
    ├── user-service/
    ├── tenant-service/
    └── ai-service/
```

```yaml
# helm/saas-platform/Chart.yaml (Umbrella Chart 의존성 선언)
apiVersion: v2
name: saas-platform
description: 공공기관 SaaS 플랫폼 — 전체 서비스 패키지
type: application
version: 2.0.0

dependencies:
  - name: api-gateway
    version: "2.0.x"
    repository: "file://../api-gateway"   # 로컬 Chart 참조
  - name: auth-service
    version: "1.2.x"
    repository: "file://../auth-service"
  - name: user-service
    version: "1.1.x"
    repository: "file://../user-service"
  - name: tenant-service
    version: "1.0.x"
    repository: "file://../tenant-service"
  - name: ai-service
    version: "0.5.x"
    repository: "file://../ai-service"
```

### 4.2 Umbrella Chart values 구조

Umbrella Chart의 values.yaml에서 각 하위 서비스의 설정을 통합 관리합니다.

```yaml
# helm/saas-platform/values.yaml
global:
  imageRegistry: localhost:8080
  imageProject: public-saas
  environment: staging
  database:
    host: postgres.saas.svc.cluster.local
    port: 5432
  redis:
    host: redis.saas-platform.svc.cluster.local
    port: 6379

# 각 하위 서비스 설정 (서비스명이 키)
api-gateway:
  replicaCount: 2
  image:
    tag: "2.0.1"
  resources:
    requests: { cpu: 100m, memory: 256Mi }
    limits: { cpu: 500m, memory: 512Mi }

auth-service:
  replicaCount: 2
  image:
    tag: "1.2.3"
  resources:
    requests: { cpu: 50m, memory: 128Mi }
    limits: { cpu: 250m, memory: 256Mi }
```

### 4.3 Flux HelmRelease와 Umbrella Chart 연동

실제로 Umbrella Chart는 Flux HelmRelease로 배포됩니다. 개발자가 Git에 values 변경을 push하면 Flux가 자동으로 Helm upgrade를 실행합니다.

```yaml
# infra/flux/helm-release.yaml (참고용)
apiVersion: helm.toolkit.fluxcd.io/v2
kind: HelmRelease
metadata:
  name: saas-platform
  namespace: flux-system
spec:
  chart:
    spec:
      chart: ./helm/saas-platform
      sourceRef:
        kind: GitRepository
        name: fleet-infra
  values:
    global:
      environment: staging
    auth-service:
      replicaCount: 2
```

---

## 5. values.yaml 커스터마이징 방법

### 5.1 환경별 values 파일 구조

```
기본값:     values.yaml          (모든 환경 공통 기본값)
개발:       values-dev.yaml      (개발 환경 오버라이드)
스테이징:   values-stg.yaml      (스테이징 오버라이드)
프로덕션:   values-prod.yaml     (프로덕션 오버라이드)
```

오버라이드 우선순위: `values-prod.yaml` > `values-stg.yaml` > `values.yaml`

```yaml
# values-prod.yaml (프로덕션 전용 오버라이드)
global:
  imageRegistry: registry.agency.go.kr   # 프로덕션 레지스트리로 교체
  environment: production

api-gateway:
  replicaCount: 3    # 프로덕션은 3개 (스테이징은 2개)
  resources:
    requests: { cpu: 200m, memory: 512Mi }
    limits: { cpu: 1000m, memory: 1Gi }

auth-service:
  replicaCount: 3
  resources:
    requests: { cpu: 100m, memory: 256Mi }
    limits: { cpu: 500m, memory: 512Mi }
```

### 5.2 Flux 환경별 Kustomization

`infra/flux/environments/` 디렉토리에 환경별 HelmRelease 패치가 있습니다.

```yaml
# infra/flux/environments/prod-kustomization.yaml
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: saas-platform-prod
  namespace: flux-system
spec:
  interval: 5m
  sourceRef:
    kind: GitRepository
    name: fleet-infra
  path: ./helm/saas-platform
  patches:
    - patch: |
        apiVersion: helm.toolkit.fluxcd.io/v2
        kind: HelmRelease
        metadata:
          name: saas-platform
        spec:
          valuesFrom:
            - kind: ConfigMap
              name: saas-platform-prod-values
```

### 5.3 특정 값만 빠르게 오버라이드 (긴급 대응)

GitOps 흐름이 원칙이지만, 긴급 상황에서 즉시 값을 변경해야 할 때:

```bash
# Flux를 일시 중지하고 직접 Helm 명령 실행
flux suspend helmrelease saas-platform -n flux-system

# 특정 값만 변경 (이미지 태그 핫픽스)
helm upgrade saas-platform ./helm/saas-platform \
  -n saas-platform \
  --reuse-values \              # 기존 values 유지 + 아래 값만 변경
  --set auth-service.image.tag=v1.2.4-hotfix

# 동작 확인 후 Git에 동일 변경 반영
git commit -m "fix: auth-service v1.2.4-hotfix 이미지 태그 반영"
git push origin main

# Flux 재개
flux resume helmrelease saas-platform -n flux-system
```

---

## 6. 새 서비스 Helm Chart 추가하기

새 마이크로서비스를 이 프레임워크에 추가하는 단계별 절차입니다.

### 단계 1: Chart 디렉토리 생성

```bash
# helm/ 디렉토리로 이동
cd /data/ai-saas/helm

# 새 서비스 Chart 스캐폴딩
helm create notification-service

# 생성된 구조
ls helm/notification-service/
# Chart.yaml  charts/  templates/  values.yaml
```

### 단계 2: Chart.yaml 수정

```yaml
# helm/notification-service/Chart.yaml
apiVersion: v2
name: notification-service
description: 공공기관 SaaS 알림 서비스 (이메일, SMS, 앱 푸시)
type: application
version: 1.0.0
appVersion: "1.0.0"
```

### 단계 3: values.yaml 작성

```yaml
# helm/notification-service/values.yaml
replicaCount: 2

image:
  repository: localhost:8080/public-saas/notification-service
  tag: "1.0.0"
  pullPolicy: IfNotPresent

service:
  type: ClusterIP
  port: 3005

resources:
  requests:
    cpu: 50m
    memory: 128Mi
  limits:
    cpu: 250m
    memory: 256Mi

env:
  SMTP_HOST: "smtp.agency.go.kr"
  SMTP_PORT: "587"
  LOG_LEVEL: "info"

# 민감 정보는 Secret 참조 (직접 기재 금지)
existingSecret: notification-service-credentials

monitoring:
  enabled: true
  serviceMonitor:
    enabled: true
    labels:
      release: kube-prometheus-stack
```

### 단계 4: Deployment 템플릿 작성

```yaml
# helm/notification-service/templates/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "notification-service.fullname" . }}
  namespace: {{ .Release.Namespace }}
  labels:
    {{- include "notification-service.labels" . | nindent 4 }}
spec:
  replicas: {{ .Values.replicaCount }}
  selector:
    matchLabels:
      {{- include "notification-service.selectorLabels" . | nindent 6 }}
  template:
    metadata:
      labels:
        {{- include "notification-service.selectorLabels" . | nindent 8 }}
    spec:
      # CSAP D-11: 비루트 컨테이너 실행
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        fsGroup: 2000
      containers:
        - name: {{ .Chart.Name }}
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag }}"
          imagePullPolicy: {{ .Values.image.pullPolicy }}
          ports:
            - containerPort: {{ .Values.service.port }}
          envFrom:
            - configMapRef:
                name: {{ include "notification-service.fullname" . }}-config
          env:
            - name: SMTP_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: {{ .Values.existingSecret }}
                  key: smtp-password
          resources:
            {{- toYaml .Values.resources | nindent 12 }}
          livenessProbe:
            httpGet:
              path: /health
              port: {{ .Values.service.port }}
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /ready
              port: {{ .Values.service.port }}
            initialDelaySeconds: 10
            periodSeconds: 5
```

### 단계 5: Umbrella Chart에 추가

```yaml
# helm/saas-platform/Chart.yaml에 의존성 추가
dependencies:
  # ... 기존 서비스들 ...
  - name: notification-service
    version: "1.0.x"
    repository: "file://../notification-service"
```

```yaml
# helm/saas-platform/values.yaml에 기본값 추가
notification-service:
  replicaCount: 2
  image:
    tag: "1.0.0"
```

### 단계 6: Chart 린트 및 템플릿 검증

```bash
# Chart 문법 검사
helm lint ./helm/notification-service

# 템플릿 렌더링 결과 확인
helm template notification-service ./helm/notification-service \
  -n saas-platform \
  -f helm/notification-service/values.yaml

# 드라이런 (실제 클러스터 연결 필요)
helm install notification-service ./helm/notification-service \
  -n saas-platform \
  --dry-run --debug
```

### 단계 7: Git 커밋 및 배포

```bash
git add helm/notification-service/ helm/saas-platform/Chart.yaml
git commit -m "feat(helm): notification-service Chart 추가 (FR-5.1)"
git push origin feat/notification-service

# PR 생성 → 리뷰 → main 머지
# → Flux가 자동으로 배포 (5분 이내)
```

---

## 7. 배포 후 확인 방법

### 7.1 Helm Release 상태 확인

```bash
# Release 상태 확인
helm status saas-platform -n flux-system
# 또는 saas-platform 네임스페이스에서
helm status notification-service -n saas-platform

# 배포된 values 확인
helm get values saas-platform -n flux-system

# 배포된 매니페스트 전체 확인
helm get manifest saas-platform -n flux-system
```

### 7.2 Pod 정상 동작 확인

```bash
# 새 서비스 Pod 상태
kubectl get pods -n saas-platform -l app=notification-service

# 롤아웃 완료 대기
kubectl rollout status deployment/notification-service -n saas-platform

# 로그 확인
kubectl logs -l app=notification-service -n saas-platform --tail=50
```

### 7.3 서비스 연결 확인

```bash
# Service 존재 확인
kubectl get service notification-service -n saas-platform

# 헬스체크
kubectl run healthcheck --image=busybox --rm -it \
  -n saas-platform --restart=Never -- \
  wget -qO- http://notification-service.saas-platform.svc.cluster.local:3005/health
```

### 7.4 Flux 동기화 상태

```bash
# Flux HelmRelease 상태
flux get helmrelease -n flux-system

# 동기화 강제 실행
flux reconcile helmrelease saas-platform -n flux-system

# Flux 이벤트 확인
flux events -n flux-system
```

---

## 8. 자주 하는 실수

### 실수 1: values 파일 오타로 배포 실패

```bash
# helm template으로 먼저 렌더링 확인 필수
helm template saas-platform ./helm/saas-platform \
  -f helm/saas-platform/values-stg.yaml | grep -A10 "notification-service"
```

### 실수 2: 새 Chart 추가 후 의존성 업데이트 누락

```bash
# Chart.yaml에 새 의존성 추가 후 반드시 실행
helm dependency update ./helm/saas-platform
# charts/ 디렉토리에 패키지 파일 생성됨
```

### 실수 3: Secret을 values.yaml에 직접 기재

```yaml
# 절대 금지 — Git에 평문 시크릿이 노출됨
smtp-password: "my-secret-password"  # 금지

# 올바른 방법
existingSecret: notification-service-credentials  # Secret 이름만 참조
```

### 실수 4: Helm으로 직접 배포 후 Flux와 충돌

이 프레임워크에서 운영 환경 배포는 반드시 Git → Flux 경로를 사용합니다. `helm upgrade` 직접 실행은 Flux가 다음 동기화 시 덮어씁니다. 긴급 상황 외에는 항상 Git push 방식을 사용하십시오.

---

다음 단계: `03-gitops-flux.md`에서 GitOps 철학과 Flux를 통한 자동 배포 흐름을 학습합니다.
