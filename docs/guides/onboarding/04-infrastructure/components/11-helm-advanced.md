# Helm 심화 가이드 — 차트 개발, 버전 전략, Flux HelmRelease 완전 정복

---

| 항목 | 내용 |
|------|------|
| 문서 ID | GUIDE-INFRA-04-11 |
| 버전 | 1.0.0 |
| 작성일 | 2026-04-13 |
| 목적 | Helm 차트 개발부터 Flux GitOps 자동배포까지 초급자 완전 이해 |
| 선행 학습 | `01-intro/`, `04-infrastructure/01-k3s-setup.md`, `04-infrastructure/05-gitops-flux.md` |
| CSAP 참조 | D-11 가상화 보안, D-12 시스템 개발 보안 |

---

## 목차

1. [Helm 심화 개요](#1-helm-심화-개요)
2. [Helm 차트 개발](#2-helm-차트-개발)
3. [이 프로젝트의 Helm 구성](#3-이-프로젝트의-helm-구성)
4. [Flux HelmRelease 완전 정복](#4-flux-helmrelease-완전-정복)
5. [Helm 테스트](#5-helm-테스트)
6. [차트 버전 관리](#6-차트-버전-관리)
7. [운영 트러블슈팅](#7-운영-트러블슈팅)
8. [변경 이력](#변경-이력)

---

## 1. Helm 심화 개요

### 1.1 왜 Helm이 필요한가

쿠버네티스 애플리케이션을 배포할 때 Raw YAML, Kustomize, Helm 중 무엇을 선택해야 할지 처음에는 혼란스럽습니다. 각 도구는 서로 다른 문제를 해결하기 위해 만들어졌습니다.

**Raw YAML**: 가장 단순한 형태입니다. `kubectl apply -f manifest.yaml`로 바로 배포합니다. 그러나 개발/스테이징/운영 환경마다 이미지 태그, 레플리카 수, 리소스 한도가 달라야 할 때 파일을 복사해서 수동으로 편집해야 합니다. 파일이 100개가 넘어가면 관리가 불가능해집니다.

**Kustomize**: 환경별 오버레이 패치 방식을 사용합니다. 기본 매니페스트(base)에 환경별 변경사항(overlay)을 적용합니다. 별도의 템플릿 언어 없이 순수 YAML을 사용하므로 이해하기 쉽습니다. 그러나 복잡한 조건부 로직이나 반복 구조를 표현하기 어렵습니다.

**Helm**: 템플릿 엔진을 내장한 쿠버네티스 패키지 매니저입니다. `values.yaml`에 변수를 선언하고 템플릿에서 참조하면, 환경별로 다른 값을 주입하여 완성된 매니페스트를 생성합니다. 설치(`install`), 업그레이드(`upgrade`), 롤백(`rollback`), 삭제(`uninstall`) 릴리스 생명주기를 관리합니다.

**선택 기준**:

| 상황 | 권장 도구 |
|------|---------|
| 단순한 단일 서비스, 환경 1개 | Raw YAML |
| 환경별 오버레이만 필요, 복잡한 로직 없음 | Kustomize |
| 복잡한 마이크로서비스, 환경 3개 이상, 외부 배포 필요 | Helm |
| GitOps + 자동 동기화 | Flux + Helm (이 프로젝트 선택) |

이 프로젝트는 16개 마이크로서비스를 개발/스테이징/운영 3개 환경에 배포하므로 Helm을 사용합니다.

### 1.2 Helm 생태계 전체 다이어그램

```mermaid
graph TB
    subgraph "개발자 워크스테이션"
        DEV[개발자]
        CHART[helm/saas-platform/]
        VALUES[values.yaml\nvalues-dev.yaml\nvalues-stg.yaml\nvalues-prod.yaml]
    end

    subgraph "Gitea CI/CD"
        REPO[Git 저장소]
        LINT[helm lint\nhelm template]
        PUSH[OCI 레지스트리\nHarbor]
    end

    subgraph "Flux GitOps"
        FLUX_CTRL[Flux\nHelmController]
        HELMRELEASE[HelmRelease CRD]
        HELMREPO[HelmRepository CRD]
    end

    subgraph "k3s 클러스터"
        NS_DEV[namespace: saas-dev]
        NS_STG[namespace: saas-staging]
        NS_PROD[namespace: saas-production]
        POD1[auth-service Pod]
        POD2[api-gateway Pod]
        POD3[security-service Pod]
    end

    DEV -->|git push| REPO
    CHART --> LINT
    VALUES --> LINT
    LINT -->|통과| PUSH
    REPO -->|감지| FLUX_CTRL
    HELMREPO -->|차트 소스| FLUX_CTRL
    HELMRELEASE -->|배포 명세| FLUX_CTRL
    FLUX_CTRL -->|helm upgrade| NS_DEV
    FLUX_CTRL -->|helm upgrade| NS_STG
    FLUX_CTRL -->|helm upgrade| NS_PROD
    NS_PROD --> POD1
    NS_PROD --> POD2
    NS_PROD --> POD3
```

### 1.3 Helm 핵심 개념 정리

Helm을 처음 접하는 분을 위해 핵심 용어를 정리합니다.

- **차트(Chart)**: 쿠버네티스 애플리케이션을 설치하기 위한 패키지입니다. `Chart.yaml`, `values.yaml`, `templates/` 폴더로 구성됩니다.
- **릴리스(Release)**: 클러스터에 설치된 차트의 인스턴스입니다. 같은 차트를 다른 이름으로 여러 번 설치하면 각각 별도의 릴리스가 됩니다.
- **값(Values)**: 차트 템플릿에 주입되는 설정 변수입니다. `values.yaml`이 기본값이고 `-f` 플래그로 오버라이드합니다.
- **템플릿(Template)**: Go 템플릿 문법으로 작성된 쿠버네티스 매니페스트 파일입니다. `{{ .Values.xxx }}`로 값을 참조합니다.
- **Named Template**: `_helpers.tpl` 파일에 정의된 재사용 가능한 템플릿 조각입니다.

---

## 2. Helm 차트 개발

### 2.1 Chart.yaml 완전 필드 해설

`Chart.yaml`은 차트의 메타데이터를 정의하는 파일입니다. 이 프로젝트의 실제 파일을 기준으로 각 필드를 설명합니다.

```yaml
# helm/saas-platform/Chart.yaml
# Design Ref: DESIGN-MTU-N04 | Plan SC: FR-N04.1

apiVersion: v2          # Helm 3 차트는 반드시 v2. v1은 Helm 2 호환성 전용.
name: saas-platform     # 차트 이름. Helm 릴리스 이름과 다를 수 있음.
description: 공공기관 SaaS 프레임워크 -- CSAP 중/상 등급 인증 대응 마이크로서비스 플랫폼

# type: application 또는 library
# - application: 실제 배포용 차트. 모든 자원을 직접 생성.
# - library: Named Template만 제공하는 공유 라이브러리. 단독 설치 불가.
type: application

# version: 차트 자체의 버전. Chart.yaml/templates 변경 시 올림.
# Semantic Versioning (MAJOR.MINOR.PATCH) 준수 필수.
version: 1.0.0

# appVersion: 차트가 배포하는 애플리케이션의 버전.
# 따옴표로 감싸는 것을 권장 (숫자로 오해 방지).
appVersion: "1.0.0"

# keywords: Helm Hub/ArtifactHub 검색 태그.
keywords:
  - saas
  - public-sector
  - csap
  - n2sf
  - microservices
  - k3s

# home: 프로젝트 홈페이지 URL.
home: https://gitea.local/public-saas/ai-saas

# maintainers: 담당자 목록. 공공기관은 이메일 도메인이 .go.kr 이어야 함.
maintainers:
  - name: Public SaaS Team
    email: saas@example.go.kr

# dependencies: 이 차트가 의존하는 하위 차트 목록.
# 예: PostgreSQL, Redis를 외부 차트로 포함할 때 사용.
# 이 프로젝트는 인프라를 직접 템플릿으로 관리하므로 dependencies 미사용.
dependencies: []

# annotations: 추가 메타데이터. Flux나 Renovate 같은 도구가 읽음.
annotations:
  category: Infrastructure
  licenses: Apache-2.0
```

**버전 올리는 시점**:
- `version` (차트 버전): `templates/`, `values.yaml`, `Chart.yaml` 변경 시
- `appVersion` (앱 버전): 실제 서비스 코드 배포 버전 변경 시

일반적으로 CI/CD 파이프라인에서 자동으로 관리합니다. 이 프로젝트의 `ci-cd-pipeline.yml`에서는 `github.ref_name`(태그)을 이미지 태그로 사용하며, `appVersion`은 git 태그와 동기화합니다.

### 2.2 values.yaml 계층 구조 설계

`values.yaml`은 "기본값(Default)"을 정의합니다. 환경별 파일은 기본값을 **오버라이드**합니다. 값은 병합(merge)되며 완전히 교체되지 않습니다.

```
values.yaml (기본값: 운영 환경 기준으로 보수적으로 설정)
    ↓ 병합 (--values 플래그)
values-dev.yaml   (개발: 최소 리소스, 시크릿 직접 생성)
values-stg.yaml   (스테이징: 중간 리소스, 외부 시크릿 참조)
values-prod.yaml  (운영: 최대 리소스, 고가용성)
```

**중요**: Helm은 deep merge를 수행합니다. 즉, `values.yaml`에 `serviceDefaults.resources.limits.memory: 256Mi`가 있고 `values-prod.yaml`에 `serviceDefaults.resources.limits.memory: 512Mi`만 있으면, `limits.cpu`는 기본값을 유지하고 `memory`만 오버라이드됩니다.

```yaml
# values.yaml (발췌 — 기본값 전체)
global:
  imageRegistry: ""           # Harbor URL은 --set으로 주입
  imagePullPolicy: IfNotPresent
  nodeEnv: production
  logLevel: info
  timezone: Asia/Seoul

csap:
  grade: standard
  n2sfDataGrade: "O"
  auditRetentionDays: 365
  sessionMaxConcurrent: 3     # CSAP D-08: 동시 세션 최대 3개
  jwtAccessExpiry: "15m"      # CSAP D-08: 접근 토큰 15분
  jwtRefreshExpiry: "7d"

secrets:
  create: false               # 운영: false (외부 Vault/ESO에서 주입)
  existingSecretName: saas-secrets

securityContext:
  pod:
    runAsNonRoot: true        # CSAP D-11: 비루트 실행
    runAsUser: 1001
    fsGroup: 1001
  container:
    readOnlyRootFilesystem: true      # CSAP D-11
    allowPrivilegeEscalation: false
    dropCapabilities:
      - ALL
```

```yaml
# values-dev.yaml (개발 환경 오버라이드)
global:
  nodeEnv: development
  logLevel: debug             # 개발: 상세 로그

secrets:
  create: true                # 개발: 직접 생성 허용
  data:
    DATABASE_URL: "postgresql://saas:saas_dev_2026@postgres-svc:5432/saas_platform"
    JWT_SECRET: "dev-jwt-secret-change-in-production"
    # 주의: 이 파일은 개발 환경 전용입니다. 실제 시크릿을 절대 커밋하지 마십시오.

serviceDefaults:
  resources:
    limits:
      memory: 256Mi
      cpu: 500m
    requests:
      memory: 64Mi
      cpu: 50m

backup:
  enabled: false              # 개발: 백업 불필요
monitoring:
  enabled: false              # 개발: 선택적 모니터링
```

```yaml
# values-prod.yaml (운영 환경 오버라이드)
global:
  nodeEnv: production
  logLevel: warn              # 운영: 경고 이상만 출력

secrets:
  create: false               # 운영: ESO/Vault가 주입
  existingSecretName: saas-secrets

serviceDefaults:
  resources:
    limits:
      memory: 512Mi
      cpu: "1"
    requests:
      memory: 256Mi
      cpu: 200m

services:
  api-gateway:
    replicas: 3               # 운영: 3개 레플리카 (고가용성)
  auth-service:
    replicas: 2
  audit-service:
    replicas: 3
    pdb:
      enabled: true
      minAvailable: 2         # 최소 2개 항상 유지
```

### 2.3 Helper 템플릿 작성법

`templates/_helpers.tpl` 파일은 여러 템플릿에서 재사용되는 공통 함수를 정의합니다. 언더스코어(`_`)로 시작하는 파일은 쿠버네티스 자원으로 렌더링되지 않습니다.

이 프로젝트의 실제 `_helpers.tpl` 분석:

```yaml
{{/*
차트 전체 이름 — nameOverride가 있으면 사용, 없으면 Chart.Name 사용.
63자 제한은 쿠버네티스 DNS 레이블 최대 길이입니다.
*/}}
{{- define "saas-platform.fullname" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
공통 레이블 — 모든 자원에 동일하게 붙는 레이블.
kubectl get all -l helm.sh/chart=saas-platform-1.0.0 으로 전체 조회 가능.
*/}}
{{- define "saas-platform.labels" -}}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version | replace "+" "_" }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: saas-platform
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}

{{/*
CSAP D-11: Pod 보안 컨텍스트 공통 정의.
모든 서비스 Pod에 동일하게 적용됩니다.
*/}}
{{- define "saas-platform.podSecurityContext" -}}
runAsNonRoot: true
runAsUser: 1001
fsGroup: 1001
{{- end }}

{{/*
CSAP D-11: 컨테이너 보안 컨텍스트.
루트 파일시스템 읽기 전용, 권한 상승 금지, 모든 Linux capability 제거.
*/}}
{{- define "saas-platform.containerSecurityContext" -}}
readOnlyRootFilesystem: true
allowPrivilegeEscalation: false
capabilities:
  drop: ["ALL"]
{{- end }}

{{/*
시크릿 이름 선택 — values.yaml의 secrets.create 여부에 따라 결정.
*/}}
{{- define "saas-platform.secretName" -}}
{{- if .Values.secrets.create -}}
{{ include "saas-platform.fullname" . }}-secrets
{{- else -}}
{{ .Values.secrets.existingSecretName }}
{{- end -}}
{{- end }}
```

**Helper 작성 시 주의사항**:
- `{{-` (대시 있음): 앞의 공백/줄바꿈 제거
- `-}}` (대시 있음): 뒤의 공백/줄바꿈 제거
- `define` 블록 내부에서 `include`로 다른 헬퍼 호출 가능
- `.` (점)은 현재 컨텍스트 전달. 서브 함수에서는 `$`로 루트 컨텍스트 접근

### 2.4 Named Templates 재사용 패턴

정의한 Named Template은 `include` 함수로 호출합니다.

```yaml
# templates/microservices.yaml 발췌
{{- range $name, $svc := .Values.services }}
{{- if $svc.enabled }}
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ $name }}
  namespace: {{ include "saas-platform.namespace" $ }}
  labels:
    {{- include "saas-platform.labels" $ | nindent 4 }}
    app: {{ $name }}
spec:
  replicas: {{ $svc.replicas | default 1 }}
  selector:
    matchLabels:
      app: {{ $name }}
  template:
    metadata:
      labels:
        app: {{ $name }}
        {{- include "saas-platform.labels" $ | nindent 8 }}
    spec:
      securityContext:
        {{- include "saas-platform.podSecurityContext" $ | nindent 8 }}
      containers:
        - name: {{ $name }}
          securityContext:
            {{- include "saas-platform.containerSecurityContext" $ | nindent 12 }}
          image: "{{ $.Values.global.imageRegistry }}/{{ $svc.image.repository }}:{{ $svc.image.tag }}"
          imagePullPolicy: {{ $.Values.global.imagePullPolicy }}
{{- end }}
{{- end }}
```

`nindent N`은 문자열을 N칸 들여쓰기하고 앞에 줄바꿈을 추가합니다. YAML의 들여쓰기 구조에 Named Template을 삽입할 때 필수입니다.

### 2.5 조건부 렌더링

특정 값이 활성화된 경우에만 쿠버네티스 자원을 생성합니다.

```yaml
# 모니터링 활성화 여부에 따라 ServiceMonitor 생성
{{- if .Values.monitoring.enabled }}
---
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: {{ include "saas-platform.fullname" . }}-monitor
  namespace: {{ include "saas-platform.namespace" . }}
spec:
  selector:
    matchLabels:
      {{- include "saas-platform.selectorLabels" . | nindent 6 }}
  endpoints:
    - port: metrics
      path: /metrics
      interval: 30s
{{- end }}

# PDB 활성화 여부
{{- if and .Values.services.audit-service.pdb.enabled (gt (int .Values.services.audit-service.replicas) 1) }}
---
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: audit-service-pdb
spec:
  minAvailable: {{ .Values.services.audit-service.pdb.minAvailable | default 1 }}
  selector:
    matchLabels:
      app: audit-service
{{- end }}
```

### 2.6 CSAP 준수 레이블 자동 주입 템플릿

공공기관 CSAP 감사 시 모든 Pod에 규정 준수 레이블이 있어야 합니다. Named Template으로 정의하면 모든 자원에 일관되게 주입할 수 있습니다.

```yaml
# _helpers.tpl에 추가할 CSAP 레이블 템플릿
{{/*
CSAP 감사 레이블 — 감사 추적 및 CSAP 증거 수집용
CSAP D-06: 침해사고 관리 — 자원 추적 레이블
*/}}
{{- define "saas-platform.csapLabels" -}}
csap.go.kr/grade: {{ .Values.csap.grade | default "standard" }}
csap.go.kr/n2sf-grade: {{ .Values.csap.n2sfDataGrade | default "O" }}
csap.go.kr/audit-enabled: "true"
app.kubernetes.io/component: microservice
app.kubernetes.io/part-of: public-saas-platform
{{- end }}
```

배포 시 적용 예:

```yaml
# templates/microservices.yaml 에서 사용
metadata:
  name: {{ $name }}
  labels:
    {{- include "saas-platform.labels" $ | nindent 4 }}
    {{- include "saas-platform.csapLabels" $ | nindent 4 }}
```

이렇게 하면 `kubectl get pods -l csap.go.kr/audit-enabled=true`로 감사 대상 모든 Pod를 조회할 수 있습니다.

---

## 3. 이 프로젝트의 Helm 구성

### 3.1 Helm 차트 디렉토리 구조

```
helm/
└── saas-platform/              # 단일 Umbrella 차트
    ├── Chart.yaml              # 차트 메타데이터 (apiVersion: v2, version: 1.0.0)
    ├── values.yaml             # 기본값 (운영 기준으로 보수적 설정)
    ├── values-dev.yaml         # 개발 환경 오버라이드
    ├── values-stg.yaml         # 스테이징 환경 오버라이드
    ├── values-prod.yaml        # 운영 환경 오버라이드
    └── templates/
        ├── _helpers.tpl        # Named Templates (공통 함수)
        ├── namespace.yaml      # Namespace 자원
        ├── secrets.yaml        # Secret 자원 (values.create=true 시)
        ├── configmap.yaml      # ConfigMap (공통 설정)
        ├── microservices.yaml  # 16개 마이크로서비스 Deployment + Service
        ├── api-gateway.yaml    # API Gateway 전용 (Ingress 포함)
        ├── portal.yaml         # 프론트엔드 포털
        ├── network-policy.yaml # CSAP D-10 네트워크 정책
        ├── pdb.yaml            # PodDisruptionBudget (고가용성)
        ├── prometheus-alerts.yaml  # 알림 규칙
        ├── infra-postgres.yaml # PostgreSQL 인프라
        ├── infra-redis.yaml    # Redis 인프라
        ├── infra-minio.yaml    # MinIO 오브젝트 스토리지
        ├── db-backup-cronjob.yaml  # DB 백업 CronJob
        └── NOTES.txt           # 설치 완료 메시지
```

**Umbrella 차트 패턴**: 이 프로젝트는 16개 서비스를 하나의 차트로 관리합니다. `values.yaml`의 `services` 섹션에 각 서비스를 정의하고, `microservices.yaml` 템플릿이 `range`로 순회하며 자원을 생성합니다.

장점: 단일 `helm upgrade` 명령으로 전체 배포. 환경 변수와 시크릿을 한 곳에서 관리.
단점: 서비스가 수백 개가 되면 차트가 거대해짐. 그 때는 서비스별 독립 차트로 분리를 검토.

### 3.2 services 섹션 구조

```yaml
# values.yaml — services 섹션 (발췌)
services:
  api-gateway:
    enabled: true             # false이면 해당 서비스 자원 미생성
    port: 3000
    replicas: 1               # 개발: 1, 스테이징: 2, 운영: 3
    image:
      repository: saas/api-gateway
      tag: dev                # CI/CD에서 --set global.imageTag=v1.2.3으로 주입
    readinessProbe:
      path: /ready
    livenessProbe:
      path: /healthz

  auth-service:
    enabled: true
    port: 3001
    replicas: 1
    image:
      repository: saas/auth-service
      tag: dev
    # auth-service는 JWT 키 관련 추가 환경 변수가 필요함
    extraEnv:
      - name: JWT_KEY_ID
        value: "key-1"        # Design Ref: SVC-AUTH-R1 DESIGN §5 키 회전

  security-service:
    enabled: true
    port: 3010
    replicas: 1
    image:
      repository: saas/security-service
      tag: dev
    # CSAP D-06: 보안 이벤트 감사 로그 서비스
    extraEnv:
      - name: SERVICE_IP
        valueFrom:
          fieldRef:
            fieldPath: status.podIP
```

### 3.3 환경별 values 파일 핵심 차이

| 항목 | values-dev | values-stg | values-prod |
|------|-----------|-----------|------------|
| `global.nodeEnv` | development | staging | production |
| `global.logLevel` | debug | info | warn |
| `secrets.create` | true (직접 생성) | false (ESO 사용) | false (ESO 사용) |
| `serviceDefaults.resources.limits.memory` | 256Mi | 256Mi | 512Mi |
| `services.api-gateway.replicas` | 1 | 2 | 3 |
| `backup.enabled` | false | true | true |
| `monitoring.enabled` | false | true | true |
| `pdb.enabled` | false | 일부 true | 모두 true |

### 3.4 CI/CD에서 Helm 배포 방법

`ci-cd-pipeline.yml` Stage 5에서 실제 배포가 이루어집니다:

```yaml
# .gitea/workflows/ci-cd-pipeline.yml 발췌
- name: Determine environment
  id: env
  run: |
    if [[ "${{ github.ref }}" == refs/tags/v* ]]; then
      echo "values=helm/saas-platform/values-prod.yaml" >> $GITHUB_OUTPUT
      echo "release=saas-prod" >> $GITHUB_OUTPUT
      echo "namespace=saas-production" >> $GITHUB_OUTPUT
    elif [[ "${{ github.ref }}" == "refs/heads/main" ]]; then
      echo "values=helm/saas-platform/values-stg.yaml" >> $GITHUB_OUTPUT
      echo "release=saas-stg" >> $GITHUB_OUTPUT
      echo "namespace=saas-staging" >> $GITHUB_OUTPUT
    else
      echo "values=helm/saas-platform/values-dev.yaml" >> $GITHUB_OUTPUT
      echo "release=saas-dev" >> $GITHUB_OUTPUT
      echo "namespace=saas-dev" >> $GITHUB_OUTPUT
    fi

- name: Helm Deploy
  run: |
    helm upgrade --install ${{ steps.env.outputs.release }} \
      ./helm/saas-platform/ \
      -f ${{ steps.env.outputs.values }} \
      --namespace ${{ steps.env.outputs.namespace }} \
      --set global.imageRegistry=${{ env.HARBOR_REGISTRY }} \
      --set global.imageTag=${{ steps.meta.outputs.version }} \
      --wait \
      --timeout 10m \
      --atomic            # 실패 시 자동 롤백
```

`--atomic` 플래그가 중요합니다. 배포 중 Pod가 Ready 상태가 되지 않으면 자동으로 이전 버전으로 롤백합니다. 이로써 배포 실패가 운영 장애로 이어지지 않습니다.

---

## 4. Flux HelmRelease 완전 정복

### 4.1 Flux란 무엇인가

Flux는 GitOps 도구입니다. Git 저장소의 상태를 쿠버네티스 클러스터에 지속적으로 동기화합니다. 개발자가 `git push`만 하면 Flux가 자동으로 감지하여 배포합니다.

이 프로젝트에서 Flux는:
1. Gitea 저장소의 `helm/` 디렉토리 변경을 감지
2. `HelmRelease` CRD 명세에 따라 자동 배포
3. 배포 실패 시 자동 롤백 및 알림

### 4.2 HelmRelease CRD 전체 필드 해설

HelmRelease는 Flux가 제공하는 커스텀 자원(CRD)입니다. 이 자원을 Git에 커밋하면 Flux가 읽어서 Helm 릴리스를 관리합니다.

```yaml
# gitops/helmrelease/auth-service.yaml (예시)
apiVersion: helm.toolkit.fluxcd.io/v2beta1
kind: HelmRelease
metadata:
  name: auth-service
  namespace: flux-system          # Flux 자신의 네임스페이스에 선언

spec:
  # releaseName: 실제 Helm 릴리스 이름. 미지정 시 metadata.name 사용.
  releaseName: saas-auth-service

  # targetNamespace: 자원이 배포될 네임스페이스.
  targetNamespace: saas-production

  # interval: 이 주기마다 Helm 상태를 체크하고 drift가 있으면 동기화.
  interval: 5m

  # chart: 어떤 차트를 사용할지 지정.
  chart:
    spec:
      chart: saas-platform         # HelmRepository에 있는 차트 이름
      version: ">=1.0.0 <2.0.0"    # SemVer 범위. 자동 업그레이드에 사용.
      sourceRef:
        kind: HelmRepository        # 차트 소스 타입
        name: saas-platform-repo    # HelmRepository 자원 이름
        namespace: flux-system

  # values: 인라인으로 values 주입.
  values:
    global:
      nodeEnv: production
      logLevel: warn

  # valuesFrom: 외부 ConfigMap/Secret에서 values 주입.
  valuesFrom:
    - kind: Secret
      name: auth-service-values     # 시크릿 키=values.yaml 내용
      valuesKey: values.yaml
      optional: false               # false이면 시크릿 없을 때 배포 중단

  # install: 최초 설치 시 동작 설정.
  install:
    remediation:
      retries: 3                    # 최초 설치 실패 시 3회 재시도
    createNamespace: false          # namespace는 별도 자원으로 관리

  # upgrade: 업그레이드 시 동작 설정.
  upgrade:
    remediation:
      retries: 3                    # 업그레이드 실패 시 3회 재시도
      remediateLastFailure: true    # 마지막 실패 상태도 롤백 대상 포함
    cleanupOnFail: true             # 실패한 자원 정리
    rollback:
      timeout: 5m                   # 롤백 타임아웃
      cleanupOnFail: true

  # rollback: 수동 롤백 동작 설정.
  rollback:
    timeout: 5m
    cleanupOnFail: true
    recreate: false                 # true이면 변경 불가 자원도 삭제 후 재생성

  # uninstall: helm uninstall 동작 설정.
  uninstall:
    keepHistory: false              # false이면 히스토리도 삭제

  # test: helm test 자동 실행 여부.
  test:
    enable: true
    ignoreFailures: false

  # postRenderers: 렌더링된 매니페스트에 후처리 적용.
  postRenderers:
    - kustomize:
        patches:
          - target:
              kind: Deployment
              name: auth-service
            patch: |
              - op: add
                path: /spec/template/metadata/annotations/csap.go.kr~1audit-revision
                value: "{{ .Release.Revision }}"
```

### 4.3 dependsOn: 서비스 의존성 설정

auth-service가 먼저 배포되어야 다른 서비스가 동작하는 경우, `dependsOn`으로 순서를 지정합니다.

```yaml
# gitops/helmrelease/api-gateway.yaml
apiVersion: helm.toolkit.fluxcd.io/v2beta1
kind: HelmRelease
metadata:
  name: api-gateway
  namespace: flux-system
spec:
  # api-gateway는 auth-service가 준비된 후에만 배포
  dependsOn:
    - name: auth-service
      namespace: flux-system    # 같은 네임스페이스면 생략 가능
    - name: user-service

  chart:
    spec:
      chart: saas-platform
      sourceRef:
        kind: HelmRepository
        name: saas-platform-repo

  interval: 5m
```

```yaml
# gitops/helmrelease/security-service.yaml
apiVersion: helm.toolkit.fluxcd.io/v2beta1
kind: HelmRelease
metadata:
  name: security-service
  namespace: flux-system
spec:
  # CSAP D-06: 보안 서비스는 audit-service 이후 배포
  dependsOn:
    - name: auth-service
    - name: audit-service

  interval: 5m
```

**의존성 체인 다이어그램**:

```
PostgreSQL (인프라)
    └── auth-service
            ├── user-service
            ├── tenant-service
            └── api-gateway
                    ├── security-service (감사 서비스 의존)
                    └── ai-service
```

### 4.4 upgrade.remediation: 업그레이드 실패 자동 롤백

```yaml
upgrade:
  remediation:
    retries: 3
    # 재시도 전략:
    # - retries: 3이면 최대 3번 업그레이드 재시도
    # - 모두 실패하면 롤백 수행
    remediateLastFailure: true
    # true이면 retries 소진 후 마지막 실패 상태를 이전 성공 버전으로 롤백
    strategy: rollback
    # rollback: 이전 Helm 릴리스 버전으로 되돌림
    # uninstall: 릴리스 삭제 후 재설치 (더 강력한 조치)
```

롤백 발생 시 Flux는 `HelmRelease` 오브젝트의 `status.conditions`에 기록합니다:

```bash
# 롤백 상태 확인 방법
kubectl get helmrelease auth-service -n flux-system -o yaml | grep -A 20 conditions
```

### 4.5 postRenderers: Kustomize 후처리

Helm 템플릿만으로 표현하기 어려운 변경사항을 렌더링 후 Kustomize 패치로 적용합니다.

```yaml
postRenderers:
  - kustomize:
      # patches: 특정 자원에 JSON Patch 또는 Strategic Merge Patch 적용
      patches:
        # 모든 Deployment에 CSAP 어노테이션 추가
        - target:
            kind: Deployment
          patch: |
            apiVersion: apps/v1
            kind: Deployment
            metadata:
              annotations:
                csap.go.kr/compliance: "D-11"
                csap.go.kr/security-review: "2026-04-13"

        # auth-service Deployment에만 추가 환경 변수 주입
        - target:
            kind: Deployment
            name: auth-service
          patch: |
            apiVersion: apps/v1
            kind: Deployment
            spec:
              template:
                spec:
                  containers:
                    - name: auth-service
                      env:
                        - name: JWT_ALGORITHM
                          value: RS256

      # images: 이미지 태그 오버라이드 (Flux ImageUpdateAutomation 연동)
      images:
        - name: harbor.local/public-saas/auth-service
          newTag: v1.2.3
```

### 4.6 HelmRepository 설정

HelmRelease가 참조하는 차트 소스를 정의합니다.

```yaml
# gitops/helmrepository/saas-platform.yaml
apiVersion: source.toolkit.fluxcd.io/v1beta2
kind: HelmRepository
metadata:
  name: saas-platform-repo
  namespace: flux-system
spec:
  # OCI 레지스트리 타입 (Harbor OCI)
  type: oci
  url: oci://harbor.local/public-saas/helm-charts

  # 인증: Harbor 접근용 Secret
  secretRef:
    name: harbor-credentials

  # interval: 차트 레지스트리 폴링 주기
  interval: 5m

  # timeout: 차트 다운로드 타임아웃
  timeout: 60s
```

### 4.7 HelmRelease 배포 흐름 다이어그램

```mermaid
sequenceDiagram
    participant DEV as 개발자
    participant GIT as Gitea
    participant FLUX as Flux HelmController
    participant HELM as Helm Engine
    participant K8S as k3s 클러스터
    participant AUDIT as 감사 로그

    DEV->>GIT: git push (HelmRelease 변경 또는 이미지 태그 업데이트)
    GIT-->>FLUX: 변경 감지 (Gitea webhook 또는 폴링)
    FLUX->>FLUX: HelmRelease 스펙 파싱
    FLUX->>FLUX: dependsOn 확인 (의존 서비스 Ready 여부)

    alt 의존 서비스 미준비
        FLUX->>FLUX: 대기 (최대 interval 주기)
    else 의존 서비스 준비 완료
        FLUX->>HELM: helm upgrade --install 실행
        HELM->>K8S: 매니페스트 적용 (Deployment, Service, ...)
        K8S-->>HELM: Pod 상태 모니터링

        alt Pod Ready (timeout 내)
            HELM-->>FLUX: 성공
            FLUX->>AUDIT: HelmRelease status=Ready 기록
        else Pod 미Ready (timeout 초과)
            HELM-->>FLUX: 실패
            FLUX->>FLUX: remediation.retries 확인

            loop retries 횟수만큼
                FLUX->>HELM: helm upgrade 재시도
                HELM->>K8S: 재적용
            end

            FLUX->>HELM: helm rollback (이전 버전)
            HELM->>K8S: 이전 매니페스트 복원
            FLUX->>AUDIT: HelmRelease status=Failed + 롤백 기록
        end
    end
```

---

## 5. Helm 테스트

### 5.1 helm test 연결 테스트

`helm test`는 차트에 포함된 테스트 Pod를 실행합니다. 테스트 Pod는 `helm.sh/hook: test` 어노테이션이 붙은 Job입니다.

```yaml
# templates/tests/test-auth-connectivity.yaml
apiVersion: v1
kind: Pod
metadata:
  name: "{{ include "saas-platform.fullname" . }}-auth-test"
  namespace: {{ include "saas-platform.namespace" . }}
  labels:
    app.kubernetes.io/managed-by: {{ .Release.Service }}
  annotations:
    "helm.sh/hook": test              # 테스트 훅 어노테이션
    "helm.sh/hook-delete-policy": before-hook-creation,hook-succeeded
    # hook-delete-policy:
    #   before-hook-creation: 새 테스트 실행 전 이전 Pod 삭제
    #   hook-succeeded: 성공 시 Pod 삭제 (실패 시 로그 확인용 유지)
spec:
  restartPolicy: Never
  containers:
    - name: auth-connectivity-test
      image: curlimages/curl:8.5.0
      command:
        - sh
        - -c
        - |
          echo "=== auth-service 연결 테스트 ==="
          # auth-service 헬스체크 엔드포인트 확인
          curl -sf http://auth-service.{{ include "saas-platform.namespace" . }}.svc.cluster.local:3001/healthz
          echo "[OK] auth-service 연결 성공"
          
          # api-gateway 헬스체크
          curl -sf http://api-gateway.{{ include "saas-platform.namespace" . }}.svc.cluster.local:3000/health
          echo "[OK] api-gateway 연결 성공"
```

실행:

```bash
# Helm 테스트 실행
helm test saas-stg -n saas-staging

# 테스트 Pod 로그 확인
kubectl logs saas-platform-auth-test -n saas-staging
```

### 5.2 helm lint CI 통합

CI 파이프라인의 보안 스캔 단계에서 `helm lint`로 차트 문법 오류를 사전에 탐지합니다.

이 프로젝트의 `ci-cd-pipeline.yml`에서는 이미 아래와 같이 실행합니다:

```yaml
# .gitea/workflows/ci-cd-pipeline.yml 발췌
- name: Helm Lint
  run: |
    if [ -d "helm/saas-platform" ]; then
      helm lint helm/saas-platform/
      helm template saas-test helm/saas-platform/ > /dev/null
      echo "[OK] Helm 차트 유효성 검증 통과"
    fi
```

로컬에서도 동일하게 실행할 수 있습니다:

```bash
# 기본 lint
helm lint helm/saas-platform/

# 환경별 values를 포함한 lint
helm lint helm/saas-platform/ -f helm/saas-platform/values-prod.yaml

# 엄격 모드: warning도 오류로 처리
helm lint helm/saas-platform/ --strict

# 렌더링 결과 미리보기 (실제 적용 없음)
helm template saas-preview helm/saas-platform/ \
  -f helm/saas-platform/values-stg.yaml \
  --set global.imageTag=v1.2.3 \
  > /tmp/rendered-manifests.yaml

# 렌더링 결과 검증
kubectl apply --dry-run=server -f /tmp/rendered-manifests.yaml
```

### 5.3 helm template + conftest 정책 검사

Conftest는 OPA(Open Policy Agent) Rego 언어로 쿠버네티스 매니페스트 정책을 검사합니다.

```rego
# policy/helm/csap-security.rego
package main

# CSAP D-11: 모든 컨테이너는 비루트 실행 필수
deny[msg] {
  input.kind == "Deployment"
  container := input.spec.template.spec.containers[_]
  not container.securityContext.runAsNonRoot
  msg := sprintf(
    "CSAP D-11 위반: Deployment '%s'의 컨테이너 '%s'가 runAsNonRoot 미설정",
    [input.metadata.name, container.name]
  )
}

# CSAP D-11: readOnlyRootFilesystem 필수
deny[msg] {
  input.kind == "Deployment"
  container := input.spec.template.spec.containers[_]
  not container.securityContext.readOnlyRootFilesystem
  msg := sprintf(
    "CSAP D-11 위반: '%s' 컨테이너 '%s'가 readOnlyRootFilesystem 미설정",
    [input.metadata.name, container.name]
  )
}

# 하드코딩 시크릿 탐지 (환경 변수에 password/secret 직접 포함)
warn[msg] {
  input.kind == "Deployment"
  container := input.spec.template.spec.containers[_]
  env := container.env[_]
  contains(lower(env.name), "password")
  env.value != ""             # value가 있으면 하드코딩 의심
  msg := sprintf(
    "시크릿 하드코딩 의심: '%s' 컨테이너의 환경 변수 '%s'",
    [container.name, env.name]
  )
}
```

CI 통합:

```bash
# Helm 렌더링 후 conftest 검사
helm template saas-platform helm/saas-platform/ \
  -f helm/saas-platform/values-prod.yaml \
  | conftest test - --policy policy/helm/

# 출력 예시:
# FAIL - Deployment/auth-service: CSAP D-11 위반: readOnlyRootFilesystem 미설정
# WARN - Deployment/dev-service: 시크릿 하드코딩 의심: 환경 변수 'DB_PASSWORD'
```

---

## 6. 차트 버전 관리

### 6.1 Semantic Versioning 전략

```
MAJOR.MINOR.PATCH
  │      │     └── 하위 호환 버그 수정
  │      └──────── 하위 호환 기능 추가
  └─────────────── 하위 비호환 변경 (values 구조 변경 등)
```

**언제 버전을 올리는가**:
- PATCH: `templates/` 내 작은 수정, 버그 수정 (1.0.0 → 1.0.1)
- MINOR: 새 서비스 추가, 새 values 필드 추가 (1.0.0 → 1.1.0)
- MAJOR: `values.yaml` 구조 변경으로 기존 배포가 깨지는 경우 (1.0.0 → 2.0.0)

`appVersion`은 Chart.yaml에서 개별 서비스 버전이 아닌 플랫폼 전체 버전을 나타냅니다.

### 6.2 Helm OCI 레지스트리 (Harbor) 푸시

```bash
# 차트 패키징
helm package helm/saas-platform/ \
  --version 1.1.0 \
  --app-version "1.1.0"
# 결과: saas-platform-1.1.0.tgz

# Harbor OCI 레지스트리에 로그인
helm registry login harbor.local \
  --username admin \
  --password $HARBOR_PASSWORD

# OCI 형식으로 푸시
helm push saas-platform-1.1.0.tgz \
  oci://harbor.local/public-saas/helm-charts

# 푸시 확인
helm show chart oci://harbor.local/public-saas/helm-charts/saas-platform:1.1.0
```

### 6.3 Flux ImageUpdateAutomation 연동

이미지 태그가 변경되면 Flux가 자동으로 GitOps 저장소를 업데이트하고 재배포합니다.

```yaml
# gitops/imageupdateautomation/saas-platform.yaml
apiVersion: image.toolkit.fluxcd.io/v1beta2
kind: ImageUpdateAutomation
metadata:
  name: saas-platform-auto
  namespace: flux-system
spec:
  # 업데이트할 Git 저장소
  sourceRef:
    kind: GitRepository
    name: saas-gitops

  # Git 커밋 설정
  git:
    commit:
      author:
        name: Flux Bot
        email: flux@example.go.kr
      messageTemplate: |
        chore(flux): 자동 이미지 업데이트 {{ range .Updated.Images -}}
        {{ .Repository }}:{{ .NewTag }} {{ end }}

  # 업데이트 주기
  interval: 1m

  # 업데이트 정책: 이미지 태그가 정책과 일치하면 자동 업데이트
  update:
    strategy: Setters      # YAML 파일의 주석 마커를 찾아서 업데이트
```

```yaml
# gitops/imagepolicy/auth-service.yaml
apiVersion: image.toolkit.fluxcd.io/v1beta2
kind: ImagePolicy
metadata:
  name: auth-service
  namespace: flux-system
spec:
  imageRepositoryRef:
    name: auth-service-repo
  policy:
    semver:
      range: ">=1.0.0"    # SemVer 범위 내 최신 태그 자동 선택
```

`HelmRelease`의 values에 마커 주석을 달면 Flux가 자동으로 태그를 업데이트합니다:

```yaml
# gitops/helmrelease/auth-service.yaml
spec:
  values:
    services:
      auth-service:
        image:
          tag: "1.0.0" # {"$imagepolicy": "flux-system:auth-service:tag"}
          # Flux가 위 주석을 찾아서 최신 태그로 자동 교체
```

---

## 7. 운영 트러블슈팅

### 7.1 HelmRelease Stuck 해결

HelmRelease가 `pending-upgrade` 또는 `pending-install` 상태에서 멈추는 경우, 이전 배포 중 강제 종료되어 Helm의 배포 잠금(lock)이 해제되지 않은 것이 원인입니다.

```bash
# 1. HelmRelease 상태 확인
kubectl get helmrelease -n flux-system
# NAME           READY   STATUS                 AGE
# auth-service   False   pending-upgrade        10m   <- 문제!

# 2. 상세 오류 메시지 확인
kubectl describe helmrelease auth-service -n flux-system
# 또는
kubectl get helmrelease auth-service -n flux-system -o jsonpath='{.status.conditions}'

# 3. Helm 릴리스 히스토리 확인
helm history saas-stg -n saas-staging
# REVISION  STATUS    DESCRIPTION
# 1         deployed  Install complete
# 2         pending-upgrade  Preparing upgrade  <- 여기서 멈춤

# 4. 잠금 해제 방법 (Helm 시크릿 상태 수동 변경)
# Helm은 릴리스 상태를 namespace의 Secret에 저장합니다.
kubectl get secret -n saas-staging | grep helm
# sh.helm.release.v1.saas-stg.v1
# sh.helm.release.v1.saas-stg.v2  <- 이 시크릿의 상태가 pending

# 방법 A: 잠긴 릴리스 강제 롤백
helm rollback saas-stg 1 -n saas-staging --force

# 방법 B: Flux HelmRelease 재조정 강제 실행
flux reconcile helmrelease auth-service -n flux-system --with-source

# 방법 C: HelmRelease 어노테이션으로 강제 재설치
kubectl annotate helmrelease auth-service -n flux-system \
  reconcile.fluxcd.io/requestedAt="$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
```

### 7.2 값 렌더링 디버깅

배포된 실제 값과 예상 값이 다를 때, 렌더링 결과를 디버그 모드로 확인합니다.

```bash
# 렌더링 결과 전체 출력 (실제 적용 없음)
helm template saas-debug ./helm/saas-platform/ \
  -f helm/saas-platform/values-stg.yaml \
  --set global.imageTag=v1.2.3 \
  --debug \
  2>&1 | head -100

# --debug 플래그가 추가하는 정보:
# - 렌더링에 사용된 최종 values (병합 후)
# - 각 템플릿 파일의 렌더링 결과
# - 오류 발생 위치

# 특정 서비스만 확인 (show-only 플래그)
helm template saas-debug ./helm/saas-platform/ \
  -f helm/saas-platform/values-prod.yaml \
  --show-only templates/microservices.yaml \
  | grep -A 50 "name: auth-service"

# 실제 배포된 values 확인 (클러스터에서 읽기)
helm get values saas-stg -n saas-staging
helm get values saas-stg -n saas-staging --all  # 기본값 포함

# 실제 배포된 매니페스트 확인
helm get manifest saas-stg -n saas-staging | grep -A 20 "auth-service"
```

### 7.3 Secret 값 변경이 안 반영될 때

쿠버네티스 Secret이 변경되어도 이미 실행 중인 Pod는 자동으로 새 값을 가져오지 않습니다. 환경 변수로 주입된 시크릿은 Pod 재시작이 필요합니다.

```bash
# 1. 현재 Secret 값 확인 (base64 디코딩)
kubectl get secret saas-secrets -n saas-staging -o jsonpath='{.data.JWT_SECRET}' | base64 -d

# 2. Secret 업데이트 (ESO를 사용하지 않는 수동 관리 환경에서)
kubectl create secret generic saas-secrets \
  --from-literal=JWT_SECRET="new-secret-value" \
  --dry-run=client -o yaml | kubectl apply -f -

# 3. 새 Secret을 반영하기 위해 Pod 재시작
# 방법 A: Deployment rollout restart
kubectl rollout restart deployment/auth-service -n saas-staging

# 방법 B: 모든 서비스 재시작 (영향도 주의)
kubectl rollout restart deployment -n saas-staging

# 4. 재시작 상태 모니터링
kubectl rollout status deployment/auth-service -n saas-staging --timeout=120s

# 5. 새 Pod에서 환경 변수 확인
kubectl exec -it deployment/auth-service -n saas-staging -- \
  sh -c 'echo $JWT_SECRET' 2>/dev/null || echo "환경 변수 확인 불가 (보안 정책)"
```

**근본 해결책**: External Secrets Operator(ESO)를 사용하면 Vault의 시크릿이 변경될 때 자동으로 쿠버네티스 Secret을 업데이트하고, `reloader` 컨트롤러를 함께 사용하면 Secret 변경 시 Pod를 자동으로 재시작합니다.

```yaml
# ESO + Reloader 패턴
# ExternalSecret에 어노테이션 추가
metadata:
  annotations:
    reloader.stakater.com/auto: "true"  # Secret 변경 시 Pod 자동 재시작
```

상세한 ESO 설정은 `07-security/10-secret-management-guide.md`를 참조하십시오.

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|-------|
| 1.0.0 | 2026-04-13 | 최초 작성 — Helm 심화 가이드 (온보딩 Iteration 21-B) | Implementer Agent |
