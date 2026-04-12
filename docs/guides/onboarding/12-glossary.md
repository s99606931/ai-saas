# 용어 사전 — 공공기관 SaaS 프레임워크

> **버전**: 1.0.0 | **작성일**: 2026-04-12
> **대상**: 프로젝트에 처음 합류하는 모든 구성원
> **목적**: 프로젝트 전용 용어, CSAP/보안, 인프라, 개발, 모니터링, CI/CD 용어를 한 곳에서 참조

---

## 목차

- [가 ~ 나](#가--나)
- [다 ~ 라](#다--라)
- [마 ~ 바](#마--바)
- [사 ~ 아](#사--아)
- [자 ~ 카](#자--카)
- [타 ~ 하](#타--하)
- [영문 / 약어](#영문--약어)

---

> **표기 규칙**: **한국어 용어** (영문 표기) — 설명 순서로 기술합니다.
> 영문이 주로 쓰이는 용어는 영문 표기를 먼저 쓰고 한국어 설명을 덧붙입니다.

---

## 가 ~ 나

**가용성** (Availability) — 서비스가 정상적으로 동작하는 시간의 비율입니다. 이 프로젝트의 SLO 기준으로 월간 99.9%(월 43.2분 허용 다운타임)를 목표로 합니다. Prometheus의 HTTP 성공 응답 비율로 측정됩니다.

**감리** (Audit / Inspection) — 행안부 정보시스템 감리기준(고시 제2023-1호)에 따라 공공기관 IT 사업의 적정성을 제3자가 검증하는 제도입니다. 이 프로젝트는 CSAP 인증과 함께 감리 준수를 핵심 요건으로 설정합니다.

**감사 로그** (Audit Log) — 시스템 내 민감한 작업(로그인, 데이터 변경, 권한 변경 등)을 전수 기록한 불변 로그입니다. CSAP D-06 요건으로 최소 1년 보존이 의무화됩니다. 이 프로젝트에서는 `.claude/audit.jsonl`에 저장됩니다.

**게이트웨이** (API Gateway) — 모든 외부 요청이 내부 서비스로 진입하기 전에 통과하는 단일 진입점입니다. 인증, 속도 제한, 라우팅, 로깅을 담당합니다. 이 프로젝트에서는 `platform/services/api-gateway`가 해당 역할을 합니다.

**공공기관 SaaS** — 정부, 지자체 등 공공기관이 사용하는 클라우드 기반 소프트웨어 서비스입니다. CSAP 인증, N2SF 준수, 행안부 감리기준이 적용되어 일반 SaaS보다 엄격한 보안·규제 요건이 요구됩니다.

**그라파나** (Grafana) — 메트릭, 로그, 추적 데이터를 시각화하는 오픈소스 대시보드 플랫폼입니다. 이 프로젝트에서는 Prometheus(메트릭), Loki(로그), Tempo(추적)를 데이터소스로 연결하여 관측가능성 통합 플랫폼으로 사용합니다.

**깃옵스** (GitOps) — Git 저장소를 단일 진실 공급원(Single Source of Truth)으로 삼아 인프라와 애플리케이션 배포를 선언적으로 관리하는 운영 방식입니다. 이 프로젝트에서는 Flux를 통해 GitOps를 구현합니다.

**노드** (Node) — Kubernetes 클러스터를 구성하는 서버(물리적 또는 가상 머신)입니다. 각 노드에서 여러 Pod이 실행됩니다. 이 프로젝트는 k3s 기반 경량 클러스터를 사용하며 WSL2 환경에서 개발됩니다.

---

## 다 ~ 라

**대시보드 템플릿** (Dashboard Template) — Grafana에서 사용하는 재사용 가능한 시각화 레이아웃입니다. 이 프로젝트의 포털 UI에서는 `DashboardTemplate.tsx`로 구현된 React 컴포넌트를 사용합니다.

**도라** (DORA — DevOps Research and Assessment) — 소프트웨어 개발팀의 성과를 측정하는 4대 지표 체계입니다. 배포 빈도(DF), 변경 리드타임(LT), 변경 실패율(CFR), 평균 복구 시간(MTTR)으로 구성됩니다. 이 프로젝트에서는 `packages/dora-exporter`로 자동 측정합니다.

**도라 익스포터** (DORA Exporter) — CI/CD 파이프라인 이벤트를 수집하여 DORA 4대 지표를 Prometheus 메트릭으로 변환하는 패키지입니다. 경로: `packages/dora-exporter/src/index.ts`.

**디플로이먼트** (Deployment) — Kubernetes에서 애플리케이션의 원하는 상태(몇 개의 Pod이 어떤 이미지로 실행될지)를 선언하는 리소스입니다. 롤링 업데이트와 롤백을 자동으로 관리합니다.

**런북** (Runbook) — 특정 장애 상황에서 담당자가 따라야 하는 대응 절차서입니다. AlertManager 알림에 `runbook_url` 어노테이션으로 연결되어, 장애 수신 즉시 링크를 통해 절차를 확인할 수 있습니다.

**레이턴시** (Latency) — 요청 처리에 걸리는 시간입니다. 이 프로젝트의 SLO 기준은 P99 200ms 이하입니다. Histogram 메트릭으로 측정하며 `histogram_quantile(0.99, ...)` PromQL로 계산합니다.

**로그** (Log) — 시스템 이벤트의 텍스트 기록입니다. 이 프로젝트는 Loki를 로그 집계 시스템으로 사용하며, LogQL로 조회합니다. CSAP D-10(로그 관리) 요건에 따라 구조화된 JSON 형식으로 저장합니다.

**로키** (Loki) — Grafana Labs가 개발한 경량 로그 집계 시스템입니다. Prometheus의 레이블 방식을 로그에 적용하여 메트릭과 로그를 동일한 레이블 체계로 연결합니다. 이 프로젝트의 LGTM 스택(Loki+Grafana+Tempo+Prometheus)의 L 구성요소입니다.

---

## 마 ~ 바

**멀티테넌시** (Multi-tenancy) — 하나의 시스템을 여러 조직(테넌트)이 독립적으로 사용하는 아키텍처입니다. 이 프로젝트에서는 `platform/services/tenant-service`가 테넌트 격리와 관리를 담당합니다.

**메시 레디** (mesh-ready) — 서비스 메시(Istio/Cilium) 환경에서 안전하게 작동하기 위한 기반 기능을 제공하는 패키지입니다. 그레이스풀 셧다운, 헬스체크, mTLS 지원이 포함됩니다. 경로: `platform/packages/mesh-ready/`.

**메트릭** (Metric) — 시스템 상태를 수치로 표현한 시계열 데이터입니다. Counter(누적 카운터), Gauge(현재값), Histogram(분포), Summary(사전 계산 백분위수) 4가지 타입이 있습니다. Prometheus가 수집합니다.

**모노레포** (Monorepo) — 여러 패키지/서비스를 하나의 Git 저장소에서 관리하는 방식입니다. 이 프로젝트는 pnpm workspace 기반 모노레포로, `platform/services/`, `platform/packages/`, `packages/`의 세 영역으로 구성됩니다.

**뮤텍스** (mTLS — Mutual TLS) — 서버와 클라이언트 양쪽 모두 TLS 인증서를 교환하여 상호 인증하는 방식입니다. 서비스 메시 내부 서비스 간 통신에 사용됩니다. CSAP D-09 암호화 요건을 충족합니다.

**바이너리 서명** (Binary Signing) — 컨테이너 이미지 등 빌드 산출물에 Cosign으로 서명하여 무결성을 보증하는 공급망 보안 기법입니다. 이 프로젝트의 Gitea Actions CI/CD에서 자동 실행됩니다.

**배포 동결** (Deploy Freeze) — SLO 에러버짓이 90% 이상 소진되면 추가 장애 방지를 위해 신규 배포를 자동으로 차단하는 정책입니다. `packages/slo-escalation`의 `ErrorBudgetPolicyEngine`이 관리합니다.

**번 레이트** (Burn Rate) — SLO 에러버짓이 소진되는 속도입니다. 번 레이트 1.0은 측정 기간 말에 정확히 버짓이 소진됨을 의미합니다. 2.0이면 측정 기간의 절반에 소진됩니다. AlertManager SLO 알림의 핵심 지표입니다.

**보안 모니터** (Security Monitor) — 런타임 보안 이벤트(비정상 접근, 정책 위반 등)를 감지하고 기록하는 서비스입니다. 경로: `platform/services/security-monitor-service/`. Falco 이벤트를 수신하여 감사 로그에 기록합니다.

---

## 사 ~ 아

**서비스 메시** (Service Mesh) — 마이크로서비스 간 통신을 투명하게 관리하는 인프라 레이어입니다. mTLS 암호화, 트래픽 관리, 관측가능성을 제공합니다. 이 프로젝트에서는 Cilium을 서비스 메시로 사용합니다.

**서비스 모니터** (ServiceMonitor) — Kubernetes CRD(Custom Resource Definition)로, Prometheus에게 특정 서비스의 메트릭을 수집하도록 지시합니다. 이 프로젝트의 모든 마이크로서비스는 ServiceMonitor를 통해 Prometheus에 자동 등록됩니다.

**서킷 브레이커** (Circuit Breaker) — 의존 서비스 장애 시 연쇄 장애를 방지하기 위해 요청을 일시 차단하는 패턴입니다. 전기 회로 차단기에서 이름을 따왔습니다. 이 프로젝트에서는 전용 패키지로 구현되어 있습니다.

**세마포어** (Semgrep) — 소스 코드에서 보안 취약점과 코드 품질 문제를 정적으로 탐지하는 도구입니다. 이 프로젝트의 Gitea Actions CI/CD 파이프라인에서 자동 실행됩니다.

**셀프 서비스 포털** (Self-Service Portal) — 테넌트 관리자가 직접 사용자, 권한, 설정을 관리할 수 있는 웹 인터페이스입니다. 경로: `platform/apps/portal/`.

**속도 제한** (Rate Limit) — API 호출 횟수를 시간당 제한하는 보안/부하 방지 메커니즘입니다. 이 프로젝트에서는 `rate-limit` 패키지로 구현됩니다. CSAP D-08 접근통제 요건에 해당합니다.

**스케줄러** (Scheduler) — Kubernetes에서 Pod을 어느 노드에 배치할지 결정하는 컴포넌트입니다. 자원 사용량, 어피니티(Affinity), 테인트(Taint)/톨러레이션(Toleration)을 기반으로 최적 노드를 선택합니다.

**시크릿** (Secret) — API 키, 비밀번호, 인증서 등 민감한 설정값입니다. Kubernetes Secret 또는 외부 비밀 관리 시스템(HashiCorp Vault 등)에 저장합니다. `.env` 파일이나 코드에 하드코딩하는 것은 CSAP D-09 위반으로 절대 금지됩니다.

**실로** (Silo) — 조직 내 팀이 정보를 공유하지 않고 독립적으로 운영되는 상태를 말합니다. 이 프로젝트의 Cascade 메서드는 에이전트 분업을 통해 사일로 없이 협력하는 구조를 지향합니다.

**알림 피로** (Alert Fatigue) — 너무 많은 알림이 쏟아져서 담당자가 알림을 무시하게 되는 현상입니다. 이를 방지하기 위해 이 프로젝트는 증상 기반 알림 설계, 적절한 `for` 시간 설정, 억제 규칙을 권장합니다.

**에러 버짓** (Error Budget) — SLO에서 허용하는 장애/오류의 총량입니다. 예를 들어 99.9% SLO는 월간 43.2분의 다운타임을 에러버짓으로 허용합니다. 에러버짓 내에서는 자유롭게 배포하고, 소진 시에는 안정화에 집중합니다.

**에스컬레이션** (Escalation) — 장애나 SLO 위반이 해소되지 않을 때 더 높은 권한자나 추가 담당자에게 문제를 전달하는 프로세스입니다. `packages/slo-escalation`이 에러버짓 소진율 기반 자동 에스컬레이션을 구현합니다.

**엔드포인트** (Endpoint) — API 서버에서 특정 기능을 수행하는 URL 경로입니다. 예: `POST /api/v1/auth/login`. 이 프로젝트의 모든 엔드포인트는 RBAC 검사가 적용됩니다 (CSAP D-08).

**오파** (OPA — Open Policy Agent) — 정책(Policy)을 코드로 정의하고 자동 평가하는 엔진입니다. Rego 언어로 작성된 정책이 Kubernetes 리소스 생성 전에 검증됩니다. Gatekeeper/Kyverno와 함께 사용됩니다.

---

## 자 ~ 카

**제로 트러스트** (Zero Trust) — "내부 네트워크는 신뢰할 수 있다"는 기존 가정을 버리고, 모든 요청을 항상 검증하는 보안 모델입니다. Cilium Zero-Trust 설정(`infra/cilium-zero-trust/`)이 이를 구현합니다.

**직렬화** (Serialization) — 데이터를 전송하거나 저장하기 위해 특정 형식(JSON, protobuf 등)으로 변환하는 과정입니다. 이 프로젝트에서는 Zod를 사용해 직렬화 전 입력값을 검증합니다 (CSAP D-12 입력 검증).

**추적** (Tracing) — 하나의 요청이 여러 마이크로서비스를 거치는 전체 경로를 시각화하는 관측가능성 기법입니다. 이 프로젝트는 OpenTelemetry + Grafana Tempo로 분산 추적을 구현합니다.

**카나리 배포** (Canary Deployment) — 새 버전을 일부 사용자(예: 5%)에게만 먼저 배포하고 안정성을 확인 후 전체 배포하는 전략입니다. 이 프로젝트에서는 Flagger(`infra/flagger/`)로 자동 카나리 분석을 수행합니다.

**카디널리티** (Cardinality) — Prometheus에서 레이블 값의 고유 조합 수입니다. 레이블 카디널리티가 너무 높으면(예: user_id를 레이블로 사용) 메모리 문제가 발생합니다. 레이블 값의 종류는 100개 미만을 권장합니다.

**컨테이너** (Container) — 애플리케이션과 실행에 필요한 라이브러리, 설정을 하나로 패키징한 경량 실행 단위입니다. Docker 이미지로 빌드되어 Kubernetes Pod에서 실행됩니다.

**컨피그맵** (ConfigMap) — 민감하지 않은 설정 데이터를 Kubernetes 리소스로 관리하는 방법입니다. 환경 변수나 파일 형태로 Pod에 주입됩니다. 민감 데이터는 반드시 Secret을 사용해야 합니다.

**코사인** (Cosign) — 컨테이너 이미지와 아티팩트에 암호학적 서명을 하는 도구입니다. 공급망 보안(Supply Chain Security)의 핵심 도구이며, SLSA 요건을 충족합니다. 이 프로젝트의 CI/CD 파이프라인에서 자동 서명을 수행합니다.

**컴플라이언스 서비스** (Compliance Service) — CSAP, N2SF 등 보안 규정 준수 여부를 자동 검증하고 보고서를 생성하는 서비스입니다. 경로: `platform/services/compliance-service/`.

**키버네로** (Kyverno) — Kubernetes 네이티브 정책 엔진입니다. 리소스 생성/변경 시 정책을 자동 검증하고, 기본값 주입(Mutate), 검증(Validate)을 수행합니다. OPA/Gatekeeper와 유사하며 YAML 기반으로 정책을 작성합니다.

---

## 타 ~ 하

**테넌트** (Tenant) — 멀티테넌시 시스템에서 독립적인 사용 주체(기관, 조직)입니다. 각 테넌트는 격리된 데이터와 설정을 가집니다. `tenant-id` 레이블이 메트릭과 로그에 포함되어 테넌트별 모니터링이 가능합니다.

**템포** (Tempo) — Grafana Labs가 개발한 분산 추적 백엔드입니다. OpenTelemetry 형식의 트레이스를 저장하고 조회합니다. 이 프로젝트의 LGTM 스택의 T 구성요소입니다.

**트라이비** (Trivy) — 컨테이너 이미지, 파일시스템, IaC(Infrastructure as Code)의 보안 취약점을 스캔하는 도구입니다. 이 프로젝트의 CI/CD 파이프라인에서 배포 전 자동으로 취약점을 검사합니다.

**파드** (Pod) — Kubernetes의 가장 작은 배포 단위입니다. 하나 이상의 컨테이너가 같은 네트워크 네임스페이스를 공유하며 실행됩니다. 이 프로젝트의 각 마이크로서비스는 하나 이상의 Pod으로 실행됩니다.

**팔코** (Falco) — 런타임에 Kubernetes 워크로드의 비정상 행동(파일 접근, 네트워크 연결 등)을 탐지하는 오픈소스 보안 도구입니다. `infra/falco/`에 설정이 있으며, 탐지 이벤트는 AlertManager로 전달됩니다.

**포스트모템** (Postmortem) — 장애 또는 SLO 위반 후 원인 분석, 대응 과정, 재발 방지 계획을 문서화한 보고서입니다. 비난 없는(Blameless) 방식으로 작성됩니다. SLO 위반(에러버짓 100% 소진) 시 자동으로 생성이 권고됩니다.

**프로메테우스** (Prometheus) — 메트릭 수집과 알림 규칙 평가를 담당하는 오픈소스 모니터링 시스템입니다. Pull 방식으로 서비스의 `/metrics` 엔드포인트에서 15초마다 데이터를 수집합니다. PromQL로 시계열 데이터를 조회합니다.

**프로메테우스룰** (PrometheusRule) — Prometheus Operator가 인식하는 Kubernetes CRD입니다. 알림 규칙과 기록 규칙을 선언적으로 정의합니다. `infra/monitoring/alerting-rules.yaml`이 이 형식을 사용합니다.

**플럭스** (Flux) — GitOps 방식으로 Kubernetes 클러스터를 관리하는 CNCF 프로젝트입니다. Git 저장소의 변경을 감지하여 클러스터에 자동 적용합니다. 드리프트 감지와 자동 조정 기능을 제공합니다.

**헬름** (Helm) — Kubernetes 애플리케이션 패키지 매니저입니다. Chart라고 불리는 패키지 형식으로 복잡한 Kubernetes 리소스 집합을 관리합니다. 이 프로젝트에서는 kube-prometheus-stack 등 외부 차트를 Helm으로 설치합니다.

**헬스체크** (Health Check) — 서비스가 정상인지 확인하는 엔드포인트입니다. Kubernetes의 `livenessProbe`(재시작 여부 결정)와 `readinessProbe`(트래픽 수신 여부 결정)가 이를 호출합니다. 경로는 보통 `/healthz` 또는 `/health`입니다.

---

## 영문 / 약어

**AES-256** — 256비트 키를 사용하는 대칭키 암호화 알고리즘입니다. CSAP D-09 요건으로 데이터베이스에 저장되는 민감 데이터(개인정보 등)는 AES-256으로 암호화해야 합니다.

**auth-sdk** — JWT 기반 인증 기능을 제공하는 공통 SDK 패키지입니다. 토큰 발급, 검증, 갱신 기능을 제공하며 모든 서비스가 이 SDK를 사용해 일관된 인증 처리를 구현합니다.

**bkit** — BuildKit 기반 개발 프레임워크 약칭입니다. 이 프로젝트에서는 `.bkit/` 디렉토리에 에이전트 상태, PDCA 현황, 감사 로그가 저장됩니다.

**Cascade 메서드** (Cascade Method) — 이 프로젝트의 에이전트 분업 방법론입니다. 연구→계획→구현→리뷰→감리→테스트→리팩토링 순서로 5개 전문 에이전트가 순차적으로 작업합니다. 에이전트 간 결과물은 파일로 전달합니다.

**circuit-breaker** — 외부 서비스 장애 시 연쇄 장애를 방지하는 회로 차단기 패턴 구현 패키지입니다. CLOSED(정상), OPEN(차단), HALF-OPEN(복구 시도) 세 가지 상태를 관리합니다.

**CSAP** (Cloud Security Assurance Program) — 과학기술정보통신부가 운영하는 클라우드 보안 인증 프로그램입니다. 공공기관이 클라우드 서비스를 이용하기 위해 서비스 제공자가 취득해야 하는 인증입니다. 79개 통제항목으로 구성됩니다. 이 프로젝트는 중/상 등급 취득을 목표로 합니다.

**D-06** — CSAP 통제항목 중 침해사고 관리 항목입니다. 보안 이벤트 감지, 감사 로그 기록(1년 보존), 이상 징후 알림 등을 요구합니다. AlertManager와 감사 로그 시스템이 이 요건을 충족합니다.

**D-08** — CSAP 통제항목 중 접근통제 항목입니다. RBAC 기반 권한 관리, JWT 토큰 만료 정책, 세션 관리 등을 요구합니다. 모든 API 엔드포인트에 권한 검사가 필요합니다.

**D-09** — CSAP 통제항목 중 암호화 항목입니다. 데이터 저장 시 AES-256, 전송 시 TLS 1.3+ 사용을 요구합니다. 하드코딩된 암호키는 이 항목 위반입니다.

**D-12** — CSAP 통제항목 중 시스템 개발 보안 항목입니다. SQL 인젝션 방지(매개변수화 쿼리), XSS 방지(입력 새니타이제이션), Zod 기반 입력 검증 등을 요구합니다.

**ECC** (Everything Claude Code) — Anthropic의 Claude Code 기반 AI 에이전트 프레임워크입니다. 이 프로젝트는 ECC v1.9.0을 기반으로 하며, 구현·리뷰·감리·테스트·리팩토링 에이전트가 Cascade 메서드로 협력합니다.

**EscalationLevel** — `packages/slo-escalation`에서 정의된 에스컬레이션 단계 열거형입니다. Normal(정상), Warning(경고), Danger(위험), Critical(긴급), Violated(위반) 5단계로 구성됩니다.

**event-bus** — 서비스 간 비동기 이벤트를 발행/구독하는 메시지 버스 패키지입니다. 직접 서비스 호출 대신 이벤트를 통해 느슨하게 결합된 아키텍처를 구현합니다.

**Falco** — 런타임 보안 감시 도구입니다. 컨테이너 내 비정상 시스템 호출(파일 쓰기, 네트워크 접속 등)을 실시간 감지합니다. CSAP D-06 침해사고 감지 요건을 충족합니다.

**feature-flag-sdk** — 기능 플래그(Feature Flag)를 관리하는 SDK 패키지입니다. 코드 변경 없이 특정 기능을 켜고 끌 수 있습니다. 카나리 배포, A/B 테스트, 긴급 기능 차단에 활용됩니다. 경로: `packages/feature-flag-sdk/`.

**Flux** — Kubernetes GitOps 도구입니다. Git 저장소를 감시하여 변경 시 클러스터를 자동 동기화합니다. Kustomize와 Helm을 지원합니다. `infra/flux/`에 설정이 있습니다.

**FR** (Functional Requirement) — 기능 요구사항입니다. 이 프로젝트에서는 `FR-{모듈}.{번호}` 형식으로 관리합니다(예: FR-2.1). 모든 구현에는 FR ID가 추적성 매트릭스에 매핑되어야 합니다.

**GitOps** — Git을 인프라 선언의 단일 진실 공급원으로 사용하는 운영 방식입니다. 모든 인프라 변경은 PR을 통해 이루어지며, CI/CD가 자동으로 클러스터에 적용합니다.

**graceful-shutdown** — 서비스 종료 시 현재 처리 중인 요청을 완료한 후 안전하게 종료하는 패턴입니다. `platform/packages/mesh-ready/src/graceful-shutdown.ts`에 구현되어 있습니다. Pod 교체 시 요청 유실을 방지합니다.

**Histogram** — 값의 분포를 버킷 단위로 집계하는 Prometheus 메트릭 타입입니다. P99 레이턴시 계산에 필수적입니다. `histogram_quantile(0.99, rate(...bucket[5m]))` PromQL로 백분위수를 계산합니다.

**HPA** (Horizontal Pod Autoscaler) — CPU/메모리 사용률이나 커스텀 메트릭에 따라 Pod 수를 자동으로 늘리거나 줄이는 Kubernetes 리소스입니다.

**Ingress** — 외부 HTTP/HTTPS 트래픽을 클러스터 내부 서비스로 라우팅하는 Kubernetes 리소스입니다. 도메인 기반 라우팅, TLS 종료, 로드밸런싱을 담당합니다.

**JWT** (JSON Web Token) — 사용자 인증 정보를 JSON 형식으로 인코딩한 토큰입니다. Header.Payload.Signature 세 부분으로 구성됩니다. 이 프로젝트의 JWT 정책: 접근 토큰 15분 유효, 갱신 토큰 7일 유효.

**k3s** — Rancher Labs가 개발한 경량 Kubernetes 배포판입니다. 메모리 사용량을 최소화하여 IoT, 엣지, 개발 환경에 적합합니다. 이 프로젝트는 WSL2 환경의 k3s 클러스터를 사용합니다.

**Kyverno** — Kubernetes 네이티브 정책 엔진입니다. 리소스 생성/수정 시 YAML 기반 정책을 자동 검증합니다. OPA/Gatekeeper보다 Kubernetes 친화적입니다. 보안 정책 위반 시 AlertManager에 알림이 전달됩니다.

**LGTM 스택** — Loki + Grafana + Tempo + Prometheus의 조합으로, 이 프로젝트의 관측가능성 3대 기둥(메트릭, 로그, 추적)을 모두 구현합니다.

**LogQL** — Loki의 쿼리 언어입니다. PromQL과 유사한 문법으로 로그를 필터링하고 집계합니다. `{namespace="saas-services"} |= "ERROR"` 형식으로 레이블 기반 필터링을 합니다.

**ml-pipeline** — 머신러닝 모델의 CI/CD 파이프라인을 관리하는 패키지입니다. 모델 학습, 평가, 배포를 자동화합니다. 경로: `packages/ml-pipeline/src/model-ci.ts`.

**MTU** (Minimal Testable Unit) — 이 프로젝트의 작업 단위입니다. 각 MTU는 PDCA(Plan-Do-Check-Act) 문서를 가지며, `docs/01-plan/mtus/` 디렉토리에 관리됩니다. MTU 번호 체계: MTU-N{번호}.

**mesh-ready** — 서비스 메시 환경에서 안전하게 작동하기 위한 기능을 제공하는 공통 패키지입니다. 그레이스풀 셧다운, 헬스체크 엔드포인트, 사이드카 지원이 포함됩니다.

**N2SF** (National Network Security Framework) — 국가망 보안 서비스 체계입니다. 공공 클라우드 서비스의 데이터를 C(기밀), S(민감), O(공개) 3개 등급으로 분류합니다. C/S 등급 데이터는 AI API 전송이 절대 금지됩니다.

**OWASP Top 10** — 웹 애플리케이션 보안 취약점 상위 10개 목록입니다. SQL 인젝션, XSS, CSRF, 취약한 인증 등이 포함됩니다. Q-Gate G5에서 OWASP Top 10 통과 여부를 자동 검증합니다.

**PDCA** (Plan-Do-Check-Act) — 품질 관리를 위한 4단계 반복 사이클입니다. 이 프로젝트의 모든 MTU는 PDCA 문서를 거쳐야 합니다. Plan(계획 문서), Do(구현), Check(리뷰/테스트), Act(리팩토링/개선) 순서로 진행합니다.

**PII** (Personally Identifiable Information) — 개인을 식별할 수 있는 정보입니다. 이름, 주민번호, 전화번호 등이 해당됩니다. AI API 전송 전 반드시 마스킹이 필요합니다 (N2SF N-05 요건).

**pnpm workspace** — pnpm 패키지 매니저의 모노레포 관리 기능입니다. `pnpm-workspace.yaml`로 여러 패키지를 하나의 저장소에서 통합 관리합니다. 이 프로젝트는 pnpm workspace 기반 모노레포입니다.

**Pod** — Kubernetes의 최소 배포 단위입니다. 하나 이상의 컨테이너로 구성되며, 같은 네트워크와 스토리지를 공유합니다. Pod이 삭제되면 데이터가 사라지므로 영구 데이터는 PVC(PersistentVolumeClaim)에 저장합니다.

**Prisma ORM** — TypeScript 친화적인 Node.js ORM(Object-Relational Mapper)입니다. 타입 안전한 데이터베이스 쿼리를 제공하며, SQL 직접 작성 없이 매개변수화 쿼리를 자동 생성합니다. SQL 인젝션을 원천 차단합니다 (CSAP D-12).

**PromQL** (Prometheus Query Language) — Prometheus의 시계열 데이터 조회 언어입니다. `rate()`, `sum()`, `histogram_quantile()` 등의 함수로 메트릭을 분석합니다. Grafana 패널과 AlertManager 알림 규칙에서 사용됩니다.

**Q-Gate** (Quality Gate) — 이 프로젝트의 7단계 품질 검증 관문입니다. G1(요구사항 검증), G2(설계 완전성), G3(코드 품질), G4(테스트 커버리지 80%+), G5(OWASP Top 10), G6(CSAP 통제항목), G7(감사 추적)으로 구성됩니다.

**RAG** (Retrieval-Augmented Generation) — 외부 지식베이스에서 관련 문서를 검색하여 LLM의 응답 품질을 높이는 AI 기법입니다. `platform/services/ai-service/src/lib/rag-engine.ts`에 구현됩니다.

**RBAC** (Role-Based Access Control) — 역할 기반 접근 통제입니다. 사용자에게 직접 권한을 부여하는 대신, 역할에 권한을 부여하고 사용자에게 역할을 할당합니다. CSAP D-08 요건으로 모든 API에 RBAC 검사가 필수입니다.

**rbac** — RBAC 기능을 제공하는 공통 패키지입니다. 역할 정의, 권한 검사, 정책 관리를 담당합니다. 모든 서비스가 이 패키지를 통해 일관된 접근 통제를 구현합니다.

**SLI** (Service Level Indicator) — 서비스 품질의 실제 측정값입니다. Prometheus에서 PromQL로 계산됩니다. 가용성(성공 응답율), 레이턴시(P99), 에러율(5xx 비율)이 대표적입니다.

**SLA** (Service Level Agreement) — 서비스 제공자와 사용자 간의 법적 품질 약속입니다. 위반 시 페널티가 발생합니다. 이 프로젝트의 SLO는 항상 SLA보다 엄격하게 설정합니다.

**SLO** (Service Level Objective) — 팀이 달성하려는 서비스 품질 목표입니다. 이 프로젝트의 핵심 SLO는 가용성 99.9%, P99 레이턴시 200ms, 에러율 0.1%입니다. `packages/slo-escalation`이 SLO 모니터링과 에스컬레이션을 담당합니다.

**SLSA** (Supply-chain Levels for Software Artifacts) — 소프트웨어 공급망 보안 프레임워크입니다. 빌드 산출물의 무결성과 출처를 증명합니다. 이 프로젝트는 Cosign을 사용해 SLSA 요건을 충족합니다.

**slo-escalation** — 에러버짓 계산과 에스컬레이션을 담당하는 패키지입니다. `ErrorBudgetPolicyEngine`(버짓 계산 + 배포 동결), `SLOEscalationController`(에스컬레이션 라우팅)로 구성됩니다. 경로: `packages/slo-escalation/src/`.

**Tempo** — Grafana Labs의 분산 추적 백엔드입니다. OpenTelemetry 트레이스를 저장하고 TraceQL로 조회합니다. Grafana와 통합하여 로그-트레이스 간 연결 탐색이 가능합니다.

**TLS 1.3** — 전송 계층 보안 프로토콜의 최신 버전입니다. 이전 버전보다 핸드셰이크가 빠르고 보안이 강화됐습니다. CSAP D-09 요건으로 모든 서비스 간 통신은 TLS 1.3 이상을 사용해야 합니다.

**Trivy** — Aqua Security의 오픈소스 취약점 스캐너입니다. 컨테이너 이미지, IaC, 패키지 의존성의 CVE를 탐지합니다. 이 프로젝트의 CI/CD 파이프라인에서 배포 전 필수 실행됩니다.

**Turbo DAG** — Turborepo의 의존성 기반 빌드 그래프입니다. 패키지 간 의존관계를 분석하여 변경된 패키지만 빌드하고, 가능한 경우 병렬로 실행합니다. 모노레포 빌드 속도를 획기적으로 단축합니다.

**Zod** — TypeScript 런타임 스키마 검증 라이브러리입니다. `z.object({ email: z.string().email() })` 형식으로 입력값을 선언적으로 검증합니다. CSAP D-12 입력 검증 요건을 충족하는 표준 도구로 사용합니다.

**4 Golden Signals** (황금 신호 4가지) — SRE(Site Reliability Engineering)에서 서비스 건강을 모니터링하는 핵심 4가지 지표입니다. Latency(레이턴시), Traffic(트래픽), Errors(에러율), Saturation(포화도)으로 구성됩니다. 이 프로젝트의 알림 규칙은 이 4가지 신호를 기반으로 설계됩니다.

**OpenTelemetry** — 분산 시스템의 관측가능성(메트릭, 로그, 추적)을 수집하는 오픈소스 표준입니다. 벤더 중립적인 API와 SDK를 제공하여 Prometheus, Jaeger, Grafana Tempo 등 다양한 백엔드로 데이터를 전송합니다. 이 프로젝트의 `ai-service`, `audit-service` 등이 OpenTelemetry를 사용합니다.

**Gitea** — 경량 셀프호스팅 Git 서비스입니다. GitHub과 유사한 PR, 이슈, Actions CI/CD 기능을 제공합니다. 이 프로젝트는 외부 클라우드 서비스 사용 금지 정책에 따라 Gitea를 자체 운영합니다. `.gitea/workflows/`에 CI/CD 파이프라인이 정의됩니다.

**Botkube** — Kubernetes 이벤트를 Slack 등 메시지 플랫폼으로 전달하는 ChatOps 도구입니다. AlertManager 알림을 Slack 채널(`#incidents`, `#operations`, `#audit`)로 라우팅합니다. `infra/chatops/botkube-values.yaml`에 설정이 있습니다.

**Fastify** — Node.js 고성능 웹 프레임워크입니다. Express보다 빠른 처리 속도와 내장 스키마 검증 기능을 제공합니다. 이 프로젝트의 일부 마이크로서비스가 Fastify를 사용합니다.

**HPA** (Horizontal Pod Autoscaler) — Kubernetes에서 CPU/메모리 사용률이나 커스텀 메트릭 기반으로 Pod 수를 자동으로 늘리거나 줄이는 리소스입니다. 트래픽 급증 시 자동 스케일아웃으로 가용성을 유지합니다. `HighCPUUsage` 알림 발생 시 HPA 스케일아웃을 먼저 검토합니다.

**Flagger** — Kubernetes에서 카나리 배포, 블루/그린 배포, A/B 테스트를 자동화하는 도구입니다. 배포 중 에러율과 레이턴시를 모니터링하여 임계값 초과 시 자동 롤백합니다. `infra/flagger/`에 설정이 있습니다.

**CloudNative PG** (Cloud Native PostgreSQL) — Kubernetes 네이티브 PostgreSQL 운영자(Operator)입니다. 고가용성, 자동 백업, 장애조치(Failover)를 Kubernetes CRD로 관리합니다. `infra/cloudnative-pg/`에 설정이 있습니다.

**Velero** — Kubernetes 클러스터와 영구 볼륨(Persistent Volume)을 백업하고 복구하는 도구입니다. CSAP DR(재해복구) 요건을 충족하기 위해 사용됩니다. `infra/monitoring/velero-performance-alerts.yaml`에 알림 규칙이 있습니다.

---

**audit-collector** — 감사 이벤트를 수집하고 `.claude/audit.jsonl`에 기록하는 패키지입니다. CSAP D-06 감사 로그 요건을 충족하며, 모든 민감 작업(로그인, 데이터 변경, 권한 수정)을 append-only 방식으로 기록합니다. 경로: `packages/audit-collector/`.

**tech-debt-scanner** — 코드베이스의 기술 부채(미사용 함수, 오래된 TODO, 복잡도 초과 파일 등)를 탐지하는 패키지입니다. `npm run audit:dead-code` 명령으로 실행되며, 주간 자동 스캔이 권장됩니다. 경로: `packages/tech-debt-scanner/`.

**Pyroscope** — 연속 프로파일링(Continuous Profiling) 도구입니다. CPU 사용량과 메모리 할당을 함수 단위로 세밀하게 측정하여 성능 병목의 정확한 위치를 찾습니다. `infra/pyroscope/`에 설정이 있으며, Grafana와 통합하여 트레이스-프로파일 연결 탐색이 가능합니다.

**Cert-Manager** — Kubernetes에서 TLS 인증서를 자동으로 발급하고 갱신하는 도구입니다. Let's Encrypt 또는 내부 CA에서 인증서를 받아 Secret으로 저장합니다. CSAP D-09 전송 암호화 요건을 자동화합니다. `infra/cert-manager/`에 설정이 있습니다.

---

## 용어 빠른 참조 색인

### 프로젝트 전용 용어

| 용어 | 섹션 | 관련 파일/경로 |
|------|------|--------------|
| MTU | 영문/약어 | `docs/01-plan/mtus/` |
| PDCA | 영문/약어 | `.bkit/state/pdca-status.json` |
| Q-Gate | 영문/약어 | `CLAUDE.md §6` |
| Cascade 메서드 | 영문/약어 | `CLAUDE.md §2`, `.claude/agents/` |
| bkit | 영문/약어 | `.bkit/` |
| ECC | 영문/약어 | `CLAUDE.md` |

### CSAP/보안 용어

| 용어 | 섹션 | 관련 파일/경로 |
|------|------|--------------|
| CSAP | 영문/약어 | `.claude/rules/csap-compliance.md` |
| N2SF | 영문/약어 | `.claude/rules/csap-compliance.md` |
| D-06, D-08, D-09, D-12 | 영문/약어 | `infra/monitoring/alerting-rules.yaml` |
| RBAC | 영문/약어 | `platform/packages/` |
| JWT | 영문/약어 | `platform/services/auth-service/` |
| mTLS | 마~바 | `infra/cilium-zero-trust/` |
| SLSA | 영문/약어 | `infra/` CI/CD 파이프라인 |

### 인프라 용어

| 용어 | 섹션 | 관련 파일/경로 |
|------|------|--------------|
| k3s | 영문/약어 | `infra/` |
| Pod, Deployment, Service | 영문/약어 | `infra/k8s/` |
| Ingress | 영문/약어 | `infra/ingress/` |
| Helm | 영문/약어 | `infra/helm/` |
| Flux | 영문/약어 | `infra/flux/` |
| GitOps | 영문/약어 | `infra/flux/` |

### 개발 용어

| 용어 | 섹션 | 관련 파일/경로 |
|------|------|--------------|
| 모노레포 | 마~바 | `pnpm-workspace.yaml` |
| pnpm workspace | 영문/약어 | `pnpm-workspace.yaml` |
| Turbo DAG | 영문/약어 | `turbo.json` |
| Prisma ORM | 영문/약어 | `platform/services/*/prisma/` |
| Zod | 영문/약어 | 모든 서비스 입력 검증 |

### 모니터링 용어

| 용어 | 섹션 | 관련 파일/경로 |
|------|------|--------------|
| Prometheus | 타~하 | `infra/monitoring/` |
| Grafana | 가~나 | `infra/monitoring/` |
| Loki | 다~라 | `infra/monitoring/` |
| Tempo | 영문/약어 | `infra/monitoring/` |
| DORA 4Keys | 다~라 | `packages/dora-exporter/` |
| SLO, SLI, SLA | 영문/약어 | `packages/slo-escalation/` |

### CI/CD 용어

| 용어 | 섹션 | 관련 파일/경로 |
|------|------|--------------|
| Gitea Actions | 사~아 | `.gitea/workflows/` |
| Q-Gate | 영문/약어 | `.gitea/workflows/q-gate.yml` |
| Semgrep | 사~아 | CI/CD 파이프라인 |
| Trivy | 영문/약어 | CI/CD 파이프라인 |
| Cosign | 영문/약어 | CI/CD 파이프라인 |
| Kyverno | 자~카 | `infra/kyverno/` |
| Falco | 영문/약어 | `infra/falco/` |

### 패키지 용어

| 용어 | 섹션 | 관련 파일/경로 |
|------|------|--------------|
| auth-sdk | 영문/약어 | `platform/packages/auth-sdk/` |
| rbac | 영문/약어 | `platform/packages/rbac/` |
| rate-limit | 사~아 | `platform/packages/rate-limit/` |
| event-bus | 영문/약어 | `platform/packages/event-bus/` |
| circuit-breaker | 영문/약어 | `platform/packages/circuit-breaker/` |
| mesh-ready | 마~바 | `platform/packages/mesh-ready/` |
| slo-escalation | 영문/약어 | `packages/slo-escalation/` |
| feature-flag-sdk | 영문/약어 | `packages/feature-flag-sdk/` |
| dora-exporter | 다~라 | `packages/dora-exporter/` |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|------|
| 1.0.0 | 2026-04-12 | 초기 작성 — 60개 이상 용어 정의 | Public SaaS Dev |

---

> 이 용어 사전에 없는 용어가 있다면 해당 모듈의 담당자에게 문의하거나, 이 파일에 추가하고 CHANGELOG.md에 기록하십시오.
> 모든 문서는 한국어 전용, 공공기관 표준 용어를 사용합니다 (CLAUDE.md §1 절대 제약).
