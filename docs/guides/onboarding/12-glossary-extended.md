# 용어 사전 확장판 — 공공기관 SaaS 프레임워크

> **문서 ID**: ONBOARD-12-EXT
> **버전**: 1.0.0 | **작성일**: 2026-04-12 | **작성자**: Implementer (Sonnet)
> **선행 문서**: `12-glossary.md` (기본 123개 용어)
> **목적**: 기본 용어 사전에서 다루지 않은 60개 이상의 심화 용어 수록
> **대상**: 인프라, 개발, 보안, AI/LLM, CSAP/N2SF 각 분야를 깊이 있게 이해하려는 팀원

---

## 목차

- [인프라 추가 용어 (15개)](#인프라-추가-용어-15개)
- [개발 추가 용어 (15개)](#개발-추가-용어-15개)
- [보안 추가 용어 (15개)](#보안-추가-용어-15개)
- [AI/LLM 추가 용어 (10개)](#aillm-추가-용어-10개)
- [CSAP/N2SF 추가 용어 (5개)](#csapn2sf-추가-용어-5개)
- [알파벳 빠른 참조 색인](#알파벳-빠른-참조-색인)

---

> **읽는 방법**: 각 용어는 `분류`, `정의`, `이 프로젝트에서` 사용 사례, `관련 용어`, `참고 파일`로 구성됩니다.
> 기본 용어 사전(`12-glossary.md`)과 함께 참조하세요.

---

## 인프라 추가 용어 (15개)

---

### StatefulSet (스테이트풀셋)

**분류**: 인프라
**정의**: Kubernetes에서 데이터베이스처럼 상태(State)를 영구적으로 보관해야 하는 애플리케이션을 위한 워크로드 리소스입니다. 일반 Deployment와 달리 Pod에 고정된 이름과 순서가 부여되며, 각 Pod는 자신만의 PersistentVolumeClaim을 가집니다. Pod이 재시작되어도 동일한 스토리지와 네트워크 ID를 유지합니다.
**이 프로젝트에서**: PostgreSQL과 Redis가 StatefulSet으로 배포됩니다. `pg-0`, `redis-0` 같은 고정 이름으로 서비스 간 연결이 안정적으로 유지됩니다.
**관련 용어**: PersistentVolumeClaim, Deployment, CloudNative PG
**참고 파일**: `platform/k8s/statefulsets/postgresql.yaml`

---

### PodDisruptionBudget (파드 중단 예산)

**분류**: 인프라
**정의**: Kubernetes에서 클러스터 유지보수(노드 업그레이드, 드레이닝 등) 중에 동시에 중단될 수 있는 Pod의 최대 수를 제한하는 정책입니다. `minAvailable` 또는 `maxUnavailable` 값으로 설정합니다. 이를 통해 유지보수 작업 중에도 서비스 가용성을 보장할 수 있습니다.
**이 프로젝트에서**: 핵심 서비스(`api-gateway`, `auth-service`)에 PDB를 설정하여 노드 유지보수 시에도 최소 1개 Pod이 항상 실행되도록 보장합니다. CSAP D-05 가용성 요건과 연관됩니다.
**관련 용어**: 가용성, SLO, 에러 버짓
**참고 파일**: `platform/k8s/pdb/core-services-pdb.yaml`

---

### ResourceQuota (리소스 쿼터)

**분류**: 인프라
**정의**: Kubernetes 네임스페이스에서 사용할 수 있는 총 CPU, 메모리, Pod 수, PVC 수 등의 자원 상한을 설정하는 리소스입니다. 특정 네임스페이스가 클러스터 전체 자원을 독점하는 것을 방지합니다.
**이 프로젝트에서**: `saas-ai` 네임스페이스에 별도 ResourceQuota를 설정하여 AI 서비스가 GPU/CPU를 과도하게 사용할 때 다른 핵심 서비스에 영향을 주지 않도록 격리합니다.
**관련 용어**: LimitRange, 네임스페이스, k3s
**참고 파일**: `platform/k8s/namespaces/saas-ai-quota.yaml`

---

### LimitRange (리밋레인지)

**분류**: 인프라
**정의**: Kubernetes 네임스페이스 내 개별 Pod 또는 컨테이너가 사용할 수 있는 CPU와 메모리의 최소/최대/기본값을 설정합니다. ResourceQuota가 네임스페이스 전체 제한이라면, LimitRange는 개별 Pod 수준의 제한입니다.
**이 프로젝트에서**: 리소스 requests/limits를 명시하지 않은 컨테이너에 기본값을 자동 주입하여, 개발자가 설정을 잊어도 OOM(Out Of Memory) 문제로 다른 Pod가 중단되는 것을 방지합니다.
**관련 용어**: ResourceQuota, Pod
**참고 파일**: `platform/k8s/namespaces/limitrange.yaml`

---

### NetworkPolicy (네트워크 폴리시)

**분류**: 인프라
**정의**: Kubernetes에서 Pod 간 네트워크 트래픽을 허용하거나 차단하는 규칙입니다. 기본적으로 모든 Pod는 서로 통신할 수 있으나, NetworkPolicy를 적용하면 허용된 Pod 간 통신만 가능해집니다. 방화벽의 Kubernetes 버전이라고 이해할 수 있습니다.
**이 프로젝트에서**: `saas-data` 네임스페이스(PostgreSQL, Redis)에 NetworkPolicy를 적용하여 `saas-core` 네임스페이스에서만 접근이 가능하게 합니다. 외부에서 DB에 직접 접근하는 것을 인프라 레벨에서 차단합니다.
**관련 용어**: 네임스페이스, Kyverno, 제로 트러스트
**참고 파일**: `platform/k8s/policies/network-policy.yaml`

---

### Velero (벨레로)

**분류**: 인프라
**정의**: Kubernetes 클러스터의 리소스(Deployment, ConfigMap, Secret 등)와 PersistentVolume 데이터를 백업하고 복구하는 오픈소스 도구입니다. 재해 복구(DR) 시나리오와 클러스터 마이그레이션에 활용됩니다.
**이 프로젝트에서**: CSAP DR(재해복구) 요건을 충족하기 위해 PostgreSQL 데이터와 클러스터 설정을 오프사이트 스토리지에 주기적으로 백업합니다. 백업 실패 시 AlertManager로 알림이 발송됩니다.
**관련 용어**: PersistentVolumeClaim, CNPG, 재해 복구
**참고 파일**: `infra/monitoring/velero-performance-alerts.yaml`

---

### CNPG (CloudNative PostgreSQL)

**분류**: 인프라
**정의**: Cloud Native PostgreSQL의 약자로, Kubernetes Operator 방식으로 PostgreSQL을 관리하는 도구입니다. 고가용성 구성, 자동 장애조치(Failover), WAL 아카이빙을 Kubernetes CRD로 선언적으로 관리합니다.
**이 프로젝트에서**: 운영 환경에서 PostgreSQL HA 구성을 위해 CNPG를 사용합니다. 주 DB(Primary)가 장애 시 복제본(Replica)이 자동으로 주 DB로 승격됩니다. `infra/cloudnative-pg/` 에 설정이 있습니다.
**관련 용어**: WAL 아카이빙, StatefulSet, Velero
**참고 파일**: `infra/cloudnative-pg/cluster.yaml`

---

### WAL 아카이빙 (WAL Archiving)

**분류**: 인프라
**정의**: WAL(Write-Ahead Log)은 PostgreSQL이 데이터 변경을 디스크에 쓰기 전에 기록하는 순차 로그입니다. WAL 아카이빙은 이 로그를 외부 스토리지에 지속적으로 보관하는 기법으로, 장애 발생 시 임의의 시점으로 복구(Point-in-Time Recovery, PITR)를 가능하게 합니다.
**이 프로젝트에서**: CNPG를 통해 WAL 파일이 오브젝트 스토리지에 자동 아카이빙됩니다. 이를 통해 최대 RPO(복구 목표 시점) 5분을 달성합니다.
**관련 용어**: CNPG, Velero, StatefulSet
**참고 파일**: `infra/cloudnative-pg/cluster.yaml`

---

### etcd (엣시디)

**분류**: 인프라
**정의**: Kubernetes 클러스터의 모든 상태 정보(Pod 목록, 설정, 시크릿 등)를 저장하는 분산 키-값 저장소입니다. Kubernetes의 "두뇌"에 해당하며, etcd가 손상되면 클러스터 전체가 작동 불능이 됩니다.
**이 프로젝트에서**: k3s는 기본적으로 SQLite를 etcd 대신 사용하여 운영 복잡도를 낮춥니다. 고가용성 다중 마스터 구성이 필요할 경우 embedded etcd 모드로 전환합니다.
**관련 용어**: k3s, kubelet, kube-proxy
**참고 파일**: `docs/01-plan/mtus/` (k3s 설정 관련 MTU)

---

### kubelet (큐블릿)

**분류**: 인프라
**정의**: 각 Kubernetes 노드에서 실행되는 에이전트입니다. API 서버로부터 Pod 실행 명령을 받아 컨테이너 런타임(containerd 등)을 통해 실제로 컨테이너를 시작/중지합니다. livenessProbe와 readinessProbe 결과를 확인하고 헬스체크를 수행합니다.
**이 프로젝트에서**: k3s를 설치하면 kubelet이 자동으로 설정됩니다. `kubectl describe node`로 각 노드의 kubelet 상태를 확인할 수 있습니다.
**관련 용어**: 헬스체크, 파드, etcd
**참고 파일**: `docs/guides/onboarding/01-getting-started/01-local-setup.md`

---

### kube-proxy (큐브 프록시)

**분류**: 인프라
**정의**: 각 Kubernetes 노드에서 실행되는 네트워크 프록시로, Service의 가상 IP로 들어오는 트래픽을 실제 Pod IP로 라우팅합니다. iptables 또는 eBPF 규칙을 사용하여 로드밸런싱을 수행합니다.
**이 프로젝트에서**: k3s에서 kube-proxy가 자동으로 설정됩니다. api-gateway Service로 들어오는 트래픽이 여러 api-gateway Pod에 분산되는 것이 kube-proxy의 역할입니다.
**관련 용어**: 서비스(Kubernetes), kubelet, Linkerd
**참고 파일**: `platform/k8s/services/api-gateway-svc.yaml`

---

### CoreDNS (코어DNS)

**분류**: 인프라
**정의**: Kubernetes 클러스터 내부의 DNS 서버입니다. 서비스 이름(예: `auth-service.saas-core.svc.cluster.local`)을 해당 서비스의 클러스터 IP로 변환합니다. Pod 간 서비스 이름 기반 통신이 가능한 것은 CoreDNS 덕분입니다.
**이 프로젝트에서**: 서비스가 `http://auth-service:3001/auth/verify`와 같이 서비스 이름으로 다른 서비스에 접근할 때 CoreDNS가 IP를 해석합니다.
**관련 용어**: 서비스(Kubernetes), kube-proxy
**참고 파일**: `platform/services/api-gateway/src/index.ts` (서비스 간 HTTP 호출 참조)

---

### HPA (Horizontal Pod Autoscaler — 수평 파드 자동 확장)

**분류**: 인프라
**정의**: CPU 사용률, 메모리 사용량, 또는 커스텀 메트릭(Prometheus 메트릭 등)을 기반으로 Deployment의 Pod 수를 자동으로 늘리거나 줄이는 Kubernetes 리소스입니다. 트래픽 급증 시 자동 확장으로 가용성을 유지합니다.
**이 프로젝트에서**: `api-gateway`와 `auth-service`에 HPA를 설정하여 민원 서비스 이용이 집중되는 업무 시간에 Pod이 자동으로 증가하고, 야간에는 감소합니다. 기본 용어 사전에도 등록되어 있습니다.
**관련 용어**: VPA, KEDA, 메트릭, Prometheus
**참고 파일**: `platform/k8s/hpa/api-gateway-hpa.yaml`

---

### VPA (Vertical Pod Autoscaler — 수직 파드 자동 확장)

**분류**: 인프라
**정의**: Pod의 CPU requests/limits와 메모리 requests/limits를 실제 사용량에 맞게 자동으로 조정하는 Kubernetes 리소스입니다. HPA가 Pod 수를 늘리는 방식이라면, VPA는 개별 Pod에 할당되는 자원을 조정합니다.
**이 프로젝트에서**: 초기 서비스 배포 시 적절한 리소스 requests를 모르는 경우 VPA를 "Recommendation 모드"로 운영하여 최적 설정값을 파악합니다.
**관련 용어**: HPA, KEDA, ResourceQuota
**참고 파일**: `platform/k8s/vpa/` (설정 파일)

---

### KEDA (Kubernetes Event-Driven Autoscaler)

**분류**: 인프라
**정의**: Kubernetes에서 이벤트 소스(Redis 큐 길이, Prometheus 메트릭, Kafka 파티션 지연 등)를 기반으로 워크로드를 자동 확장하는 오픈소스 도구입니다. HPA가 기본적으로 CPU/메모리만 지원하는 반면, KEDA는 다양한 외부 이벤트 소스와 연동됩니다.
**이 프로젝트에서**: Redis Pub/Sub 메시지 큐 길이를 기반으로 알림 처리 워커를 자동 확장하는 시나리오에서 활용합니다. 큐에 메시지가 쌓이면 Pod이 자동으로 증가합니다.
**관련 용어**: HPA, Redis Pub/Sub, 이벤트 소싱
**참고 파일**: `platform/k8s/keda/notification-scaler.yaml`

---

## 개발 추가 용어 (15개)

---

### pnpm workspace protocol (워크스페이스 프로토콜)

**분류**: 개발
**정의**: pnpm 모노레포에서 로컬 패키지를 외부 npm 패키지처럼 참조하기 위한 특수 버전 구문입니다. `"@public-saas/audit-sdk": "workspace:*"`로 선언하면 npm 레지스트리 대신 로컬 `platform/packages/audit-sdk` 디렉토리를 참조합니다.
**이 프로젝트에서**: 모든 서비스가 공유 패키지를 `workspace:*`로 참조합니다. 공유 패키지를 수정하면 별도의 npm publish 없이 즉시 모든 서비스에 반영됩니다.
**관련 용어**: pnpm workspace, Turbo DAG, 모노레포
**참고 파일**: `platform/services/api-gateway/package.json`

---

### Turbo pipeline (터보 파이프라인)

**분류**: 개발
**정의**: Turborepo에서 패키지 간 빌드 순서와 의존성을 선언하는 설정입니다. `turbo.json`의 `pipeline` 섹션에서 "A 패키지의 build는 B 패키지의 build 완료 후 실행"과 같은 순서를 정의합니다. Turbo는 이 의존성 그래프를 분석하여 가능한 최대로 병렬 실행합니다.
**이 프로젝트에서**: `@public-saas/audit-sdk` 빌드 → `auth-service` 빌드 순서가 Turbo pipeline으로 선언되어 있습니다. 변경되지 않은 패키지는 캐시에서 즉시 완료됩니다.
**관련 용어**: Turbo DAG, pnpm workspace, 모노레포
**참고 파일**: `turbo.json`

---

### Fastify lifecycle hooks (패스티파이 라이프사이클 훅)

**분류**: 개발
**정의**: Fastify가 HTTP 요청을 처리하는 각 단계에 코드를 삽입할 수 있는 훅 메커니즘입니다. `onRequest` → `preParsing` → `preValidation` → `preHandler` → `handler` → `preSerialization` → `onSend` → `onResponse` 순서로 실행됩니다. 인증, 로깅, Rate Limit 미들웨어가 이 훅을 통해 동작합니다.
**이 프로젝트에서**: `preHandler` 훅에 JWT 검증과 RBAC 권한 확인이 등록되어 있습니다. 모든 보호된 라우트는 `preHandler`를 통과한 후에만 실제 핸들러가 실행됩니다.
**관련 용어**: Fastify 5, RBAC, JWT
**참고 파일**: `platform/services/api-gateway/src/plugins/auth.plugin.ts`

---

### Prisma `$transaction` (프리즈마 트랜잭션)

**분류**: 개발
**정의**: Prisma에서 여러 DB 작업을 하나의 원자적 트랜잭션으로 묶는 API입니다. 배열 방식(`prisma.$transaction([op1, op2])`)과 인터랙티브 방식(`prisma.$transaction(async (tx) => {...})`)이 있습니다. 하나라도 실패하면 모두 롤백됩니다.
**이 프로젝트에서**: 테넌트 온보딩 시 `테넌트 레코드 생성` + `관리자 계정 생성` + `기본 권한 설정`을 하나의 트랜잭션으로 처리합니다. 관리자 생성이 실패하면 테넌트도 생성되지 않아 데이터 일관성이 유지됩니다.
**관련 용어**: Prisma ORM, ACID, 멀티테넌시
**참고 파일**: `platform/services/tenant-service/src/lib/onboarding.ts`

---

### Zod refinement (조드 리파인먼트)

**분류**: 개발
**정의**: Zod에서 기본 타입 검증 이후 추가 커스텀 검증 로직을 적용하는 기능입니다. `.refine()` 메서드를 사용하며, 단순한 타입 체크로 불가능한 복잡한 비즈니스 규칙(예: 비밀번호 복잡도, 날짜 범위)을 검증합니다.
**이 프로젝트에서**: 비밀번호가 대문자, 소문자, 숫자, 특수문자를 모두 포함하는지 검증할 때 Zod refinement를 사용합니다. CSAP 비밀번호 복잡도 요건(D-08-01)을 스키마 레벨에서 강제합니다.
**관련 용어**: Zod, 입력 검증, CSAP D-12
**참고 파일**: `platform/services/auth-service/src/schemas/password.schema.ts`

---

### decorator pattern (데코레이터 패턴)

**분류**: 개발
**정의**: 객체에 동적으로 기능을 추가하는 구조 패턴입니다. 원본 객체를 수정하지 않고 래퍼(Wrapper) 클래스로 감싸서 새로운 동작을 추가합니다. TypeScript에서 `@Decorator` 문법 또는 HOF(고차 함수)로 구현합니다.
**이 프로젝트에서**: 감사 로그 데코레이터를 사용하여 핸들러 함수에 감사 로그 기록 기능을 추가합니다. 비즈니스 로직과 감사 로직을 분리하여 단일 책임 원칙을 유지합니다.
**관련 용어**: 감사 로그, CSAP D-06, repository pattern
**참고 파일**: `platform/packages/audit-sdk/src/decorators/`

---

### repository pattern (레포지토리 패턴)

**분류**: 개발
**정의**: 데이터 접근 로직을 비즈니스 로직으로부터 분리하는 설계 패턴입니다. `UserRepository` 같은 클래스가 Prisma 쿼리를 캡슐화하고, 서비스 레이어는 `userRepository.findByEmail()` 처럼 데이터 접근의 세부 사항을 모릅니다.
**이 프로젝트에서**: 일부 복잡한 서비스에서 repository 패턴을 사용하여 Prisma 의존성을 한 곳에 모읍니다. 테스트 시 Prisma 대신 인메모리 repository로 교체가 용이합니다.
**관련 용어**: Prisma ORM, CQRS, decorator pattern
**참고 파일**: `platform/services/user-service/src/repositories/user.repository.ts`

---

### CQRS (Command Query Responsibility Segregation — 명령·조회 책임 분리)

**분류**: 개발
**정의**: 데이터를 변경하는 명령(Command)과 데이터를 읽는 조회(Query)를 다른 모델로 분리하는 아키텍처 패턴입니다. 조회가 많고 명령이 적은 시스템에서 조회 경로를 최적화할 수 있습니다.
**이 프로젝트에서**: 감사 로그 시스템에서 CQRS를 부분 적용합니다. 로그 기록(Command)은 append-only 방식으로 빠르게 처리하고, 보고서 생성(Query)은 별도 읽기 모델을 통해 집계합니다.
**관련 용어**: event sourcing, repository pattern, 감사 로그
**참고 파일**: `platform/services/compliance-service/src/lib/audit.ts`

---

### event sourcing (이벤트 소싱)

**분류**: 개발
**정의**: 현재 상태를 직접 저장하는 대신, 상태를 변경한 이벤트의 시퀀스를 저장하는 패턴입니다. 현재 상태는 이벤트를 처음부터 재생(replay)하여 계산합니다. 변경 이력이 완전히 보존되므로 감사에 적합합니다.
**이 프로젝트에서**: CSAP D-06 감사 로그가 이벤트 소싱의 원칙에 기반합니다. 사용자 상태 변경 이력을 이벤트로 저장하여 언제, 누가, 어떤 변경을 했는지 재구성할 수 있습니다.
**관련 용어**: CQRS, 감사 로그, append-only
**참고 파일**: `platform/services/ai-service/src/lib/agent-audit-trail.ts`

---

### idempotency (멱등성)

**분류**: 개발
**정의**: 동일한 요청을 여러 번 실행해도 결과가 한 번 실행한 것과 동일한 성질입니다. HTTP 메서드 관점에서 GET, PUT, DELETE는 멱등하지만 POST는 기본적으로 멱등하지 않습니다. 네트워크 재시도 시 중복 처리 방지에 핵심적입니다.
**이 프로젝트에서**: 과금 처리 API에서 `Idempotency-Key` 헤더를 사용하여 동일 요청의 중복 청구를 방지합니다. 네트워크 타임아웃으로 재시도해도 청구는 한 번만 발생합니다.
**관련 용어**: Redis, saga orchestration, dead letter queue
**참고 파일**: `platform/services/billing-service/src/lib/idempotency.ts`

---

### dead letter queue (데드 레터 큐)

**분류**: 개발
**정의**: 메시지 큐에서 정상적으로 처리되지 못한(소비에 실패한) 메시지를 별도 저장하는 큐입니다. 처리 실패의 원인을 분석하고 수동 또는 자동으로 재처리할 때 사용합니다.
**이 프로젝트에서**: Redis Pub/Sub의 특성상 기본 DLQ가 없으므로, 중요한 이벤트(결제 완료, 사용자 삭제 등)는 Redis Streams을 사용하여 미처리 이벤트를 별도로 추적합니다.
**관련 용어**: Redis Pub/Sub, saga orchestration, idempotency
**참고 파일**: `platform/packages/event-bus/src/streams/dlq.ts`

---

### saga orchestration (사가 오케스트레이션)

**분류**: 개발
**정의**: 여러 마이크로서비스에 걸친 분산 트랜잭션을 조율하는 패턴입니다. 오케스트레이션 방식에서는 중앙 조율자(Orchestrator)가 각 서비스에 순서대로 명령을 전달하고 실패 시 보상(Compensation) 트랜잭션을 실행합니다.
**이 프로젝트에서**: 테넌트 온보딩(Tenant 생성 → Admin 생성 → 권한 설정 → 알림 발송) 시 사가 패턴을 적용합니다. 중간 단계 실패 시 이전 단계를 보상 처리합니다.
**관련 용어**: saga choreography, 이벤트 소싱, idempotency
**참고 파일**: `platform/services/tenant-service/src/lib/onboarding-saga.ts`

---

### saga choreography (사가 코레오그래피)

**분류**: 개발
**정의**: 분산 트랜잭션 조율 패턴 중 하나로, 중앙 조율자 없이 각 서비스가 이벤트를 발행하고 구독하며 자율적으로 협력합니다. 서비스 간 결합도가 낮아지지만 전체 흐름 파악이 어렵습니다.
**이 프로젝트에서**: 알림 발송 시나리오에서 코레오그래피를 사용합니다. `user-service`가 USER_CREATED 이벤트를 발행하면 `notification-service`가 구독하여 자동으로 환영 이메일을 발송합니다. 두 서비스는 서로 직접 알지 못합니다.
**관련 용어**: saga orchestration, Redis Pub/Sub, event sourcing
**참고 파일**: `platform/packages/event-bus/src/index.ts`

---

### feature toggle (기능 토글)

**분류**: 개발
**정의**: 코드 변경이나 재배포 없이 특정 기능을 켜고 끌 수 있는 메커니즘입니다. 기능 플래그(Feature Flag)라고도 합니다. 점진적 롤아웃, A/B 테스트, 긴급 기능 비활성화에 활용됩니다.
**이 프로젝트에서**: `packages/feature-flag-sdk`를 통해 기능 토글을 관리합니다. 예를 들어 새 AI 기능을 특정 테넌트에만 활성화하거나, 장애 발생 시 특정 기능을 즉시 비활성화합니다.
**관련 용어**: feature-flag-sdk, 카나리 배포, 테넌트
**참고 파일**: `packages/feature-flag-sdk/src/index.ts`

---

### trunk-based development (트렁크 기반 개발)

**분류**: 개발
**정의**: 모든 개발자가 단일 메인 브랜치(trunk/main)에 짧은 주기로 직접 통합하는 개발 방식입니다. 장기 실행 브랜치를 피하고, 작은 단위로 자주 통합하여 머지 충돌과 통합 위험을 줄입니다. 기능 토글과 함께 사용하면 미완성 기능도 안전하게 병합할 수 있습니다.
**이 프로젝트에서**: 모든 기능은 `feat/` 브랜치에서 개발 후 PR을 통해 `main` 브랜치로 통합됩니다. 기능 개발이 길어질 경우 Feature Toggle로 감싸서 미완성 상태로도 main에 병합합니다.
**관련 용어**: feature toggle, GitOps, 카나리 배포
**참고 파일**: `.gitea/workflows/` (CI/CD 파이프라인 참조)

---

## 보안 추가 용어 (15개)

---

### STRIDE (스트라이드)

**분류**: 보안
**정의**: Microsoft가 개발한 위협 모델링 프레임워크입니다. Spoofing(사칭), Tampering(변조), Repudiation(부인), Information Disclosure(정보 노출), Denial of Service(서비스 거부), Elevation of Privilege(권한 상승) 6가지 위협 유형의 앞글자를 딴 약어입니다.
**이 프로젝트에서**: 신규 API 설계 시 STRIDE 모델로 위협을 체계적으로 분석합니다. 예를 들어 JWT 토큰(Spoofing 방지), 감사 로그(Repudiation 방지), RBAC(Elevation of Privilege 방지)가 각 위협에 대응합니다.
**관련 용어**: DREAD, OWASP Top 10, CSAP D-08
**참고 파일**: `docs/02-design/security/threat-model.md`

---

### DREAD (드레드)

**분류**: 보안
**정의**: 보안 취약점의 위험도를 정량적으로 평가하는 프레임워크입니다. Damage(피해), Reproducibility(재현 가능성), Exploitability(악용 용이성), Affected users(영향 받는 사용자), Discoverability(발견 가능성) 각 항목을 1~10점으로 평가합니다.
**이 프로젝트에서**: 보안 취약점 발견 시 DREAD 점수로 우선순위를 결정합니다. 점수 7 이상은 즉각 패치(24시간 이내), 5~6은 다음 스프린트, 4 이하는 백로그로 관리합니다.
**관련 용어**: STRIDE, OWASP Top 10, 침투 테스트
**참고 파일**: `docs/02-design/security/vulnerability-policy.md`

---

### SBOM (Software Bill of Materials — 소프트웨어 자재 명세서)

**분류**: 보안
**정의**: 소프트웨어를 구성하는 모든 컴포넌트(라이브러리, 의존성, 버전)의 목록입니다. 식품의 성분표에 해당합니다. 취약점 발생 시 영향 받는 컴포넌트를 즉시 파악할 수 있으며, 공급망 보안(Supply Chain Security)의 핵심 요소입니다.
**이 프로젝트에서**: Syft를 사용하여 컨테이너 이미지의 SBOM을 자동 생성하고 Grype로 취약점을 스캔합니다. CI/CD 파이프라인에서 배포 전 SBOM 검증이 수행됩니다.
**관련 용어**: SLSA, Cosign, Syft, Grype, supply chain attack
**참고 파일**: `.gitea/workflows/csap-evidence.yml`

---

### SLSA (Supply-chain Levels for Software Artifacts)

**분류**: 보안
**정의**: 소프트웨어 공급망 보안의 수준을 정의하는 프레임워크입니다. Google이 제안했으며, 빌드 환경의 무결성, 출처(Provenance) 증명, 의존성 관리를 Level 1~4로 단계적으로 요구합니다. 기본 용어 사전에도 등록되어 있습니다.
**이 프로젝트에서**: Cosign을 사용한 이미지 서명으로 SLSA Level 2를 달성합니다. 빌드 출처(어떤 Git 커밋에서 빌드되었는지)가 이미지 메타데이터에 서명됩니다.
**관련 용어**: SBOM, Cosign, Sigstore, supply chain attack
**참고 파일**: `.gitea/workflows/` (빌드/서명 워크플로우)

---

### Cosign (코사인)

**분류**: 보안
**정의**: 컨테이너 이미지와 OCI 아티팩트에 암호학적 서명을 추가하는 도구입니다. Sigstore 프로젝트의 일부로, 서명을 OCI 레지스트리에 이미지와 함께 저장합니다. 배포 시 서명 검증으로 공급망 공격을 탐지합니다. 기본 용어 사전에도 등록되어 있습니다.
**이 프로젝트에서**: 모든 서비스 이미지 빌드 후 Cosign으로 서명하며, Kyverno 정책에서 서명 없는 이미지 배포를 차단합니다.
**관련 용어**: SBOM, SLSA, Sigstore, Kyverno
**참고 파일**: `.gitea/workflows/` (이미지 서명 단계)

---

### Sigstore (시그스토어)

**분류**: 보안
**정의**: 오픈소스 소프트웨어의 서명, 검증, 투명성 로그를 위한 무료 공개 인프라 프로젝트입니다. Cosign(서명), Fulcio(인증서 발급), Rekor(투명성 로그) 세 구성요소로 이루어집니다. 키 관리 없이 OIDC 기반으로 서명할 수 있어 개발자 부담을 줄입니다.
**이 프로젝트에서**: Cosign을 통해 Sigstore 인프라를 활용합니다. 이미지 서명 정보가 Rekor 투명성 로그에 기록되어 감사 추적이 가능합니다.
**관련 용어**: Cosign, SLSA, SBOM
**참고 파일**: `.gitea/workflows/` (Cosign 단계)

---

### Syft (사이프트)

**분류**: 보안
**정의**: Anchore가 개발한 오픈소스 SBOM 생성 도구입니다. 컨테이너 이미지, 파일시스템, 패키지 디렉토리에서 설치된 패키지 목록을 CycloneDX 또는 SPDX 형식으로 추출합니다.
**이 프로젝트에서**: CI/CD 파이프라인에서 각 서비스 이미지 빌드 후 Syft로 SBOM을 생성합니다. 생성된 SBOM은 Grype에 전달되어 알려진 CVE 취약점을 검사합니다.
**관련 용어**: SBOM, Grype, supply chain attack
**참고 파일**: `.gitea/workflows/csap-evidence.yml`

---

### Grype (그라이프)

**분류**: 보안
**정의**: Anchore가 개발한 오픈소스 취약점 스캐너입니다. Syft가 생성한 SBOM 또는 컨테이너 이미지를 직접 입력으로 받아 NVD, GitHub Security Advisory 등의 취약점 데이터베이스와 대조하여 CVE를 탐지합니다.
**이 프로젝트에서**: Trivy와 함께 이중 취약점 스캔을 구성합니다. CI/CD 파이프라인에서 Critical/High 등급 CVE가 발견되면 배포를 차단합니다.
**관련 용어**: Syft, SBOM, Trivy, supply chain attack
**참고 파일**: `.gitea/workflows/` (취약점 스캔 단계)

---

### Semgrep SAST (셈그렙 정적 분석)

**분류**: 보안
**정의**: 소스 코드를 실행하지 않고 코드 패턴을 분석하여 보안 취약점을 탐지하는 정적 분석(SAST, Static Application Security Testing) 도구입니다. SQL 인젝션, 하드코딩된 시크릿, XSS 등의 패턴을 규칙 기반으로 탐지합니다.
**이 프로젝트에서**: CI/CD 파이프라인에서 Semgrep이 자동으로 실행됩니다. CSAP D-12(개발 보안) 위반 패턴(예: SQL 직접 결합, `console.log`로 민감 정보 출력)을 자동 탐지하여 PR 병합을 차단합니다.
**관련 용어**: SBOM, SLSA, AgentShield, OWASP Top 10
**참고 파일**: `.gitea/workflows/` (SAST 단계)

---

### Falco runtime security (팔코 런타임 보안)

**분류**: 보안
**정의**: Kubernetes 워크로드의 런타임 동작을 실시간으로 모니터링하는 오픈소스 보안 도구입니다. 시스템 콜 레벨에서 비정상적인 행동(예: 컨테이너 내 셸 실행, 예상치 못한 네트워크 연결, 민감 파일 접근)을 탐지합니다.
**이 프로젝트에서**: `infra/falco/` 설정을 통해 컨테이너 내에서 발생하는 보안 이벤트를 AlertManager로 전달합니다. CSAP D-06 침해사고 감지 요건을 런타임 레벨에서 충족합니다.
**관련 용어**: 보안 모니터, Kyverno, CSAP D-06
**참고 파일**: `infra/falco/rules.yaml`

---

### Kyverno admission webhook (키버네로 어드미션 웹훅)

**분류**: 보안
**정의**: Kubernetes API 서버가 리소스 생성/수정 요청을 처리하기 전에 Kyverno가 가로채어 정책을 평가하는 메커니즘입니다. 정책 위반 시 요청을 거부(Validating)하거나 수정(Mutating)합니다.
**이 프로젝트에서**: Cosign 서명 없는 이미지 배포 차단, ResourceQuota 설정 없는 네임스페이스 생성 차단, runAsRoot 권한 요청 차단 등을 Kyverno admission webhook으로 구현합니다.
**관련 용어**: Kyverno, Cosign, NetworkPolicy, OPA Gatekeeper
**참고 파일**: `platform/k8s/policies/kyverno-policies.yaml`

---

### OPA Gatekeeper (오픈 폴리시 에이전트 게이트키퍼)

**분류**: 보안
**정의**: Open Policy Agent(OPA)를 Kubernetes admission controller로 통합한 도구입니다. Rego 언어로 작성된 정책을 Kubernetes 리소스에 적용합니다. Kyverno와 유사한 역할이지만 더 복잡한 정책 로직을 표현할 수 있습니다.
**이 프로젝트에서**: 주요 정책 엔진으로 Kyverno를 사용하지만, 복잡한 멀티 조건 정책이 필요할 경우 OPA Gatekeeper를 보조적으로 활용합니다.
**관련 용어**: Kyverno, OPA, Rego, NetworkPolicy
**참고 파일**: `platform/k8s/policies/opa-constraints.yaml`

---

### mTLS (Mutual TLS — 상호 TLS)

**분류**: 보안
**정의**: TLS 연결에서 서버뿐만 아니라 클라이언트도 인증서를 제시하여 서로를 인증하는 방식입니다. 일반 TLS는 서버만 인증되지만, mTLS는 클라이언트도 인증되어 인가된 서비스만 통신할 수 있습니다. 기본 용어 사전에도 등록되어 있습니다.
**이 프로젝트에서**: Linkerd 서비스 메시가 모든 Pod 간 통신에 mTLS를 자동으로 적용합니다. 인증서 관리는 Linkerd가 자동으로 수행하며, CSAP D-09 서비스 간 암호화 요건을 인프라 레벨에서 충족합니다.
**관련 용어**: Linkerd, TLS 1.3, CSAP D-09, 서비스 메시
**참고 파일**: `docs/guides/onboarding/02-architecture/06-adr-deep-dive.md` (ADR-007 참조)

---

### zero trust network (제로 트러스트 네트워크)

**분류**: 보안
**정의**: "내부 네트워크는 신뢰할 수 있다"는 가정을 완전히 배제하는 보안 모델입니다. 모든 사용자, 디바이스, 서비스는 위치에 관계없이 항상 인증과 권한 확인을 거쳐야 합니다. 내부자 위협과 측면 이동(Lateral Movement) 공격을 방어합니다.
**이 프로젝트에서**: mTLS(서비스 간 상호 인증), JWT 검증(모든 요청), RBAC(권한 기반 접근 제어), NetworkPolicy(네트워크 레벨 격리)를 조합하여 제로 트러스트 아키텍처를 구현합니다.
**관련 용어**: mTLS, RBAC, NetworkPolicy, CSAP D-08
**참고 파일**: `infra/cilium-zero-trust/`

---

### supply chain attack (공급망 공격)

**분류**: 보안
**정의**: 소프트웨어의 개발·빌드·배포 과정에서 의존하는 써드파티 컴포넌트(라이브러리, CI/CD 도구, 컨테이너 이미지 등)를 악용하는 사이버 공격입니다. 유명한 사례로 SolarWinds 공격과 Log4Shell이 있습니다.
**이 프로젝트에서**: SBOM 생성(Syft), 취약점 스캔(Grype, Trivy), 이미지 서명(Cosign), 의존성 잠금(`pnpm-lock.yaml`의 `--frozen-lockfile`)으로 공급망 공격에 대응합니다.
**관련 용어**: SBOM, SLSA, Cosign, Sigstore, Grype
**참고 파일**: `.gitea/workflows/` (보안 스캔 파이프라인)

---

## AI/LLM 추가 용어 (10개)

---

### RAG (Retrieval-Augmented Generation — 검색 증강 생성)

**분류**: AI
**정의**: LLM이 학습 데이터에 없는 최신 정보나 내부 문서를 참조하여 응답의 정확도를 높이는 기법입니다. 사용자 질문을 벡터로 변환 → 유사 문서 검색 → 관련 문서를 프롬프트에 포함 → LLM이 문서를 참조하여 응답하는 흐름으로 동작합니다. 기본 용어 사전에도 등록되어 있습니다.
**이 프로젝트에서**: `platform/services/ai-service/src/lib/rag-engine.ts`에 RAG 엔진이 구현되어 있습니다. 공공기관 내부 문서(법령, 지침, 공문)를 벡터 DB에 저장하고, 담당자 질의 시 관련 문서를 검색하여 정확한 답변을 생성합니다.
**관련 용어**: vector embedding, cosine similarity, chunking strategy, hallucination
**참고 파일**: `platform/services/ai-service/src/lib/rag-engine.ts`

---

### vector embedding (벡터 임베딩)

**분류**: AI
**정의**: 텍스트, 이미지 등의 데이터를 고차원 숫자 벡터로 변환하는 기법입니다. 의미가 유사한 텍스트는 벡터 공간에서 가까운 위치에 매핑됩니다. 예를 들어 "강아지"와 "개"의 벡터는 "고양이"보다 서로 더 가깝습니다.
**이 프로젝트에서**: RAG 시스템에서 공공 문서를 임베딩 벡터로 변환하여 `platform/services/ai-service/src/lib/vector-store.ts`에 저장합니다. 사용자 질의도 동일한 방식으로 벡터화하여 유사 문서를 검색합니다.
**관련 용어**: RAG, cosine similarity, chunking strategy
**참고 파일**: `platform/services/ai-service/src/lib/vector-store.ts`

---

### cosine similarity (코사인 유사도)

**분류**: AI
**정의**: 두 벡터 간의 유사도를 측정하는 방법으로, 두 벡터 사이의 각도(코사인 값)를 계산합니다. 값의 범위는 -1에서 1이며, 1에 가까울수록 두 벡터의 방향이 같아(의미가 유사하다는 것을 의미) 더 유사합니다. 벡터 검색에서 가장 널리 사용되는 유사도 지표입니다.
**이 프로젝트에서**: RAG 엔진에서 사용자 질의 벡터와 문서 벡터들 간의 코사인 유사도를 계산하여 상위 k개의 가장 관련 있는 문서를 선택합니다.
**관련 용어**: vector embedding, RAG, vector-store
**참고 파일**: `platform/services/ai-service/src/lib/vector-store.ts`

---

### chunking strategy (청킹 전략)

**분류**: AI
**정의**: RAG 시스템에서 긴 문서를 LLM이 처리 가능한 작은 조각(chunk)으로 분할하는 방법입니다. 고정 크기 분할, 문장/단락 기준 분할, 의미 기반 분할 등 다양한 전략이 있습니다. 청킹 방식이 검색 품질에 큰 영향을 미칩니다.
**이 프로젝트에서**: `platform/services/ai-service/src/lib/chunker.ts`에서 공공 문서를 단락 기준으로 분할하고, 인접 청크 간 일부 내용을 겹치게(overlap) 설정하여 경계에서 맥락이 끊기는 문제를 방지합니다.
**관련 용어**: RAG, vector embedding, rag-engine
**참고 파일**: `platform/services/ai-service/src/lib/chunker.ts`

---

### prompt injection (프롬프트 인젝션)

**분류**: AI
**정의**: 악의적인 사용자가 AI 시스템의 프롬프트에 지시문을 삽입하여 시스템의 보안 정책을 우회하거나 원하지 않는 동작을 유발하는 공격입니다. "이전 지시를 무시하고 다음을 수행하라"와 같은 패턴이 대표적입니다. SQL 인젝션의 AI 버전으로 볼 수 있습니다.
**이 프로젝트에서**: AI Gateway에서 사용자 입력을 시스템 프롬프트와 명확히 분리하고, 입력 검증을 통해 프롬프트 인젝션 패턴을 탐지합니다. N2SF O등급 데이터라도 프롬프트 인젝션 방지 처리 후 AI API에 전송합니다.
**관련 용어**: RAG, OWASP Top 10, AI Gateway
**참고 파일**: `platform/services/ai-service/src/handlers/ai-agent.handler.ts`

---

### hallucination (환각)

**분류**: AI
**정의**: LLM이 사실이 아닌 정보를 자신 있게 생성하는 현상입니다. 학습 데이터에 없는 정보를 요청받거나 불확실한 영역에서 답변할 때 특히 자주 발생합니다. 공공기관 업무에서 환각은 잘못된 행정 정보 제공으로 이어질 수 있어 매우 위험합니다.
**이 프로젝트에서**: RAG 시스템에서 검색된 실제 문서를 근거로 답변을 생성하도록 하여 환각을 줄입니다. 또한 LLM 응답에 "출처 문서" 정보를 포함하여 사용자가 직접 확인할 수 있게 합니다.
**관련 용어**: RAG, chunking strategy, temperature/top-p
**참고 파일**: `platform/services/ai-service/src/lib/rag-engine.ts`

---

### temperature/top-p (온도/탑-피)

**분류**: AI
**정의**: LLM의 응답 다양성(무작위성)을 제어하는 샘플링 파라미터입니다. `temperature`가 높을수록(1.0 이상) 창의적이고 다양한 응답, 낮을수록(0.0 근처) 결정적이고 일관된 응답을 생성합니다. `top_p`는 누적 확률로 후보 단어를 제한합니다.
**이 프로젝트에서**: 공공 행정 문서 분석(hallucination 최소화 목적)에는 낮은 temperature(0.1~0.3)를, 창의적 내용 생성이 필요한 경우에는 높은 temperature(0.7~1.0)를 사용합니다.
**관련 용어**: hallucination, RAG, Claude API
**참고 파일**: `platform/services/ai-service/src/handlers/ai-rag.handler.ts`

---

### context window (컨텍스트 윈도우)

**분류**: AI
**정의**: LLM이 한 번의 추론에서 처리할 수 있는 최대 토큰(단어·문자 단위) 수입니다. 이 범위를 초과하면 이전 내용이 잘려나갑니다. Claude의 경우 최대 200K 토큰으로 약 150,000 단어 분량의 문서를 단일 요청으로 처리할 수 있습니다.
**이 프로젝트에서**: 긴 행정 문서(예: 연간 감사 보고서)를 전체적으로 분석해야 할 때 Claude의 200K 컨텍스트 윈도우가 중요합니다. RAG chunking 설계 시 청크 크기와 컨텍스트 윈도우 한계를 함께 고려합니다.
**관련 용어**: chunking strategy, RAG, Claude API, hallucination
**참고 파일**: `platform/services/ai-service/src/lib/rag-engine.ts`

---

### function calling/tool use (함수 호출/도구 사용)

**분류**: AI
**정의**: LLM이 미리 정의된 함수나 도구를 자율적으로 선택하고 호출할 수 있는 기능입니다. LLM이 응답 생성 중 "이 작업은 데이터베이스 조회가 필요하다"고 판단하면 지정된 함수를 호출하여 실제 데이터를 가져옵니다. AI 에이전트 구현의 핵심 메커니즘입니다.
**이 프로젝트에서**: `platform/services/ai-service/src/lib/ai-tools.ts`에 AI 에이전트가 사용할 수 있는 도구들이 정의되어 있습니다. 예를 들어 문서 검색, 감사 로그 조회, 테넌트 정보 확인 도구가 있으며, AI가 필요에 따라 자율적으로 선택하여 호출합니다.
**관련 용어**: RAG, Claude API, AI 에이전트
**참고 파일**: `platform/services/ai-service/src/lib/ai-tools.ts`

---

### PII (Personally Identifiable Information — 개인식별정보)

**분류**: AI
**정의**: 특정 개인을 식별하거나 식별 가능하게 하는 모든 정보입니다. 이름, 주민등록번호, 전화번호, 이메일, IP 주소, 위치 정보 등이 해당합니다. 기본 용어 사전에도 등록되어 있습니다.
**이 프로젝트에서**: AI API 전송 전 O등급 데이터에서 PII를 마스킹하는 것이 N2SF N-05 필수 요건입니다. 주민번호 패턴(`\d{6}-\d{7}`), 전화번호 패턴, 이메일 패턴을 정규식으로 탐지하여 `***`로 대체합니다.
**관련 용어**: N2SF, AI Gateway, maskPII, CSAP D-12
**참고 파일**: `platform/services/ai-service/src/lib/` (PII 마스킹 모듈)

---

## CSAP/N2SF 추가 용어 (5개)

---

### 클라우드 보안 인증 (Cloud Security Assurance Program)

**분류**: CSAP/N2SF
**정의**: 클라우드 서비스 제공자(CSP)가 공공기관에 서비스를 제공하기 위해 취득해야 하는 국내 보안 인증 제도입니다. 과학기술정보통신부와 한국인터넷진흥원(KISA)이 주관합니다. 일반(下), 표준(中), 중요(上) 세 등급으로 구성되며 각 등급별 통제항목 수가 다릅니다.
**이 프로젝트에서**: 표준(中) 등급 79개 통제항목을 모두 구현하고, 일부 중요(上) 항목을 선제적으로 반영했습니다. 공공기관 조달 입찰에서 CSAP 인증 보유 여부가 필수 자격 요건입니다.
**관련 용어**: CSAP, N2SF, 등급 심사, 취약점 점검
**참고 파일**: `CLAUDE.md` (CSAP 요건 상세)

---

### 등급 심사 (Grade Assessment)

**분류**: CSAP/N2SF
**정의**: CSAP 인증 취득을 위해 외부 심사 기관이 서비스의 보안 통제항목 준수 여부를 평가하는 프로세스입니다. 서류 심사(정책·절차 문서), 기술 심사(설정·코드 점검), 현장 심사(물리적 보안) 세 단계로 진행됩니다.
**이 프로젝트에서**: Q-Gate 7단계(G1~G7)가 등급 심사를 위한 자체 사전 점검 체계입니다. Auditor 에이전트가 CSAP 통제항목별 준수 현황을 자동으로 검증하여 심사 대응 산출물을 생성합니다.
**관련 용어**: 클라우드 보안 인증, 취약점 점검, Q-Gate
**참고 파일**: `platform/services/compliance-service/src/` (준수 현황 서비스)

---

### 취약점 점검 (Vulnerability Assessment)

**분류**: CSAP/N2SF
**정의**: 시스템에 존재하는 알려진 보안 취약점을 체계적으로 식별하고 평가하는 활동입니다. 자동화된 스캐닝 도구(Trivy, Grype, Semgrep)와 전문가의 수동 점검을 병행합니다. CSAP 심사 전 취약점 점검 결과서 제출이 필수입니다.
**이 프로젝트에서**: CI/CD 파이프라인에서 Trivy(컨테이너 이미지), Grype(SBOM 기반), Semgrep(SAST 코드)의 3중 자동 취약점 점검이 수행됩니다. 주기적으로 외부 전문 기관의 취약점 점검도 병행합니다.
**관련 용어**: 클라우드 보안 인증, 침투 테스트, SBOM, Trivy, Semgrep
**참고 파일**: `.gitea/workflows/` (취약점 스캔 파이프라인)

---

### 침투 테스트 (Penetration Testing, Pentest)

**분류**: CSAP/N2SF
**정의**: 실제 공격자의 시각에서 시스템의 보안 취약점을 능동적으로 탐색하고 악용해보는 보안 평가 방법입니다. 단순한 취약점 스캐닝과 달리, 실제 공격 시나리오를 수행하여 방어 체계의 실효성을 검증합니다. CSAP 중요(上) 등급은 침투 테스트 보고서 제출을 요구합니다.
**이 프로젝트에서**: 연 1회 이상 외부 전문 기관에 침투 테스트를 의뢰합니다. OWASP Top 10 취약점, 멀티테넌트 격리 우회 시도, 인증·인가 우회 시도가 주요 테스트 범위입니다.
**관련 용어**: 취약점 점검, DREAD, OWASP Top 10
**참고 파일**: `docs/02-design/security/pentest-scope.md`

---

### 보안 공시 (Security Disclosure)

**분류**: CSAP/N2SF
**정의**: 클라우드 서비스 제공자가 발생한 보안 사고, 취약점 패치, CSAP 인증 현황 등을 공공기관 이용자에게 투명하게 공개하는 의무입니다. CSAP 인증 보유 서비스는 보안 사고 발생 시 정해진 기한 내에 이용 기관에 통보해야 합니다.
**이 프로젝트에서**: 보안 사고 발생 시 `platform/services/compliance-service/`를 통해 영향받은 테넌트에 자동으로 보안 공시 알림이 발송됩니다. CSAP D-06(침해사고 관리) 요건의 일환입니다.
**관련 용어**: 클라우드 보안 인증, 취약점 점검, CSAP D-06, 감사 로그
**참고 파일**: `platform/services/compliance-service/src/lib/audit.ts`

---

## 알파벳 빠른 참조 색인

이 확장 용어 사전에 수록된 60개 용어의 알파벳순 색인입니다.

| 용어 | 분류 | 섹션 |
|------|------|------|
| chunking strategy | AI | AI/LLM |
| CNPG (CloudNative PostgreSQL) | 인프라 | 인프라 |
| context window | AI | AI/LLM |
| CoreDNS | 인프라 | 인프라 |
| Cosign | 보안 | 보안 |
| cosine similarity | AI | AI/LLM |
| CQRS | 개발 | 개발 |
| dead letter queue | 개발 | 개발 |
| decorator pattern | 개발 | 개발 |
| DREAD | 보안 | 보안 |
| etcd | 인프라 | 인프라 |
| event sourcing | 개발 | 개발 |
| Falco runtime security | 보안 | 보안 |
| Fastify lifecycle hooks | 개발 | 개발 |
| feature toggle | 개발 | 개발 |
| function calling/tool use | AI | AI/LLM |
| Grype | 보안 | 보안 |
| hallucination | AI | AI/LLM |
| HPA | 인프라 | 인프라 |
| idempotency | 개발 | 개발 |
| KEDA | 인프라 | 인프라 |
| kubelet | 인프라 | 인프라 |
| kube-proxy | 인프라 | 인프라 |
| Kyverno admission webhook | 보안 | 보안 |
| LimitRange | 인프라 | 인프라 |
| mTLS | 보안 | 보안 |
| NetworkPolicy | 인프라 | 인프라 |
| OPA Gatekeeper | 보안 | 보안 |
| PII | AI | AI/LLM |
| pnpm workspace protocol | 개발 | 개발 |
| PodDisruptionBudget | 인프라 | 인프라 |
| Prisma `$transaction` | 개발 | 개발 |
| prompt injection | AI | AI/LLM |
| RAG | AI | AI/LLM |
| repository pattern | 개발 | 개발 |
| ResourceQuota | 인프라 | 인프라 |
| saga choreography | 개발 | 개발 |
| saga orchestration | 개발 | 개발 |
| SBOM | 보안 | 보안 |
| Semgrep SAST | 보안 | 보안 |
| Sigstore | 보안 | 보안 |
| SLSA | 보안 | 보안 |
| StatefulSet | 인프라 | 인프라 |
| STRIDE | 보안 | 보안 |
| supply chain attack | 보안 | 보안 |
| Syft | 보안 | 보안 |
| temperature/top-p | AI | AI/LLM |
| trunk-based development | 개발 | 개발 |
| Turbo pipeline | 개발 | 개발 |
| vector embedding | AI | AI/LLM |
| Velero | 인프라 | 인프라 |
| VPA | 인프라 | 인프라 |
| WAL 아카이빙 | 인프라 | 인프라 |
| zero trust network | 보안 | 보안 |
| Zod refinement | 개발 | 개발 |
| 등급 심사 | CSAP/N2SF | CSAP/N2SF |
| 보안 공시 | CSAP/N2SF | CSAP/N2SF |
| 침투 테스트 | CSAP/N2SF | CSAP/N2SF |
| 취약점 점검 | CSAP/N2SF | CSAP/N2SF |
| 클라우드 보안 인증 | CSAP/N2SF | CSAP/N2SF |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|------|
| 1.0.0 | 2026-04-12 | 최초 작성 — 60개 심화 용어 수록 (인프라 15, 개발 15, 보안 15, AI 10, CSAP 5) | Implementer (Sonnet) |
