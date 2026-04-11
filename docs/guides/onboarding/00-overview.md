# 공공기관 SaaS 프레임워크 — 신규 직원 가이드북

> **문서 ID**: ONBOARD-00
> **버전**: 1.0.0 | **작성일**: 2026-04-11 | **작성자**: Implementer (Sonnet)
> **학습 대상**: 신규 입사자, 프로젝트 이전 인원
> **학습 기간**: 2주 권장
> **인증 목표**: CSAP 중/상 등급 + 행안부 정보화사업 감리기준 준수

---

## 목차

1. [이 가이드북의 구성](#1-이-가이드북의-구성)
2. [전체 아키텍처 개요](#2-전체-아키텍처-개요)
   - 2.1 프로젝트 목적
   - 2.2 기술 스택
   - 2.3 기술 스택 레이어 다이어그램
   - 2.4 시스템 아키텍처
   - 2.5 멀티테넌시 격리 모델
3. [서비스 구조](#3-서비스-구조)
   - 3.1 서비스 목록
   - 3.2 서비스 계층 다이어그램
   - 3.3 서비스 표준 디렉토리 구조
   - 3.4 서비스 간 통신 방식
4. [패키지 구조](#4-패키지-구조)
5. [핵심 인증 및 규정 체계](#5-핵심-인증-및-규정-체계)
   - 5.1 CSAP 주요 통제 항목
   - 5.2 CSAP 도메인 매핑 다이어그램
   - 5.3 N2SF 데이터 등급 분류
   - 5.4 N2SF 데이터 등급 분류 도식
   - 5.5 Q-Gate 7단계 품질 게이트
   - 5.6 Q-Gate 7단계 파이프라인 다이어그램
6. [개발 도구 및 환경](#6-개발-도구-및-환경)
7. [CC 하네스 (Claude Code 자동화)](#7-cc-하네스-claude-code-자동화)
8. [역할별 학습 경로](#8-역할별-학습-경로)
9. [첫 주 체크리스트](#9-첫-주-체크리스트)
10. [변경 이력](#10-변경-이력)

---

## 1. 이 가이드북의 구성

본 가이드북은 신규 팀원이 프로젝트에 빠르게 합류할 수 있도록 설계된 단계별 학습 경로입니다.
감리·CSAP 인증 준수 환경에서 작업하는 데 필요한 최소한의 지식을 체계적으로 전달합니다.

| 장 | 파일 | 제목 | 학습 시간 | 우선순위 |
|---|------|-----|---------|--------|
| 0장 | `00-overview.md` | 프로젝트 개요 및 아키텍처 (본 문서) | 1일 | 필수 |
| 1장 | `01-document-management.md` | 문서 관리 및 PDCA 사이클 | 반일 | 필수 |
| 2장 | `02-code-management.md` | 코드 관리 및 모노레포 | 1일 | 필수 |
| 3장 | `03-vibe-coding.md` | Claude Code 바이브코딩 | 반일 | 권장 |
| 4장 | `04-infra-k3s.md` | 인프라 및 k3s | 2일 | 역할별 |
| 5장 | `05-monitoring.md` | 모니터링 및 관측성 | 1일 | 역할별 |
| 6장 | `06-cicd-devops.md` | CI/CD 및 DevOps | 1일 | 역할별 |
| 7장 | `07-security-csap.md` | 보안 및 CSAP 준수 | 1일 | 필수 |

> **0장(본 문서)을 반드시 먼저 읽으세요.** 프로젝트 전반을 이해하지 않은 상태에서 개별 서비스 코드를 보면 맥락을 파악하기 어렵습니다.

---

## 2. 전체 아키텍처 개요

### 2.1 프로젝트 목적

공공기관 SaaS 플랫폼은 다음 세 가지 규정·인증 체계를 동시에 충족하는 멀티테넌트 SaaS 인프라입니다.

| 인증/규정 | 발행 기관 | 핵심 내용 | 프레임워크 지원 |
|---------|---------|---------|--------------|
| **CSAP** (클라우드 보안 인증) | KISA | 일반/표준/중요 3등급, 최대 79개 통제항목 | 표준등급 79항목 전수 커버리지 |
| **N2SF** (국가 네트워크 보안 체계) | 국정원/KISA | C/S/O 3등급 데이터 분류, 6개 보안 영역 | 등급별 격리 + AI 연동 데이터 통제 |
| **행안부 감리** | 행안부 | 고시 제2023-1호, 착수~종료 7단계 산출물 | T01~T07 감리 산출물 템플릿 전수 |

### 2.2 기술 스택

```
프론트엔드
  Next.js 15 (App Router) + React 19 + TypeScript 5.7
  Server Component 우선 설계, CSP nonce 보안 미들웨어

백엔드
  Node.js 22 + Fastify 5 + TypeScript 5.7
  Zod 입력 검증, Pino 구조화 로그, OpenTelemetry 분산 추적

데이터
  PostgreSQL 17 (주 데이터베이스)
  Redis 7 (세션, 캐시, Rate Limit)
  Prisma 6 (ORM, 타입 안전 쿼리)

인프라
  k3s (경량 Kubernetes, WSL2 로컬 개발)
  Flux (GitOps 지속 배포)
  Helm (k8s 패키지 관리)
  Harbor (컨테이너 레지스트리, 취약점 스캔)

CI/CD
  Gitea + Gitea Actions (자체 호스팅)
  Turbo (모노레포 빌드 파이프라인)
  pnpm workspace (패키지 관리)

모니터링/관측성
  Prometheus + Grafana (메트릭)
  Loki (로그 집계)
  Tempo (분산 추적)
  OpenTelemetry (계측 표준)

보안
  Kyverno (Policy as Code)
  Cosign (컨테이너 서명)
  Sealed Secrets (k8s 시크릿 암호화)
  OPA/Gatekeeper (정책 시행)
```

### 2.3 기술 스택 레이어 다이어그램

기술 스택이 데이터 계층에서 사용자 인터페이스까지 어떻게 연결되는지 레이어별로 시각화한 다이어그램입니다.

```mermaid
graph BT
  subgraph "데이터 계층"
    PG[(PostgreSQL 17\n주 데이터베이스)]
    REDIS[(Redis 7\n세션·캐시·Rate Limit)]
  end

  subgraph "ORM / 데이터 접근 계층"
    PRISMA[Prisma 6\n타입 안전 ORM]
  end

  subgraph "서비스 계층 — Fastify 5 + Node.js 22"
    SVC_CORE["핵심 서비스\nauth / user / tenant / billing"]
    SVC_AI["AI 서비스\nai-service (RAG + Gateway)"]
    SVC_SEC["보안 서비스\nsecurity / audit / compliance"]
    SVC_OPS["운영 서비스\nnotification / file / catalog"]
  end

  subgraph "API 게이트웨이 계층"
    GW[API Gateway\n라우팅·Rate Limit·인증 검사]
  end

  subgraph "프론트엔드 계층"
    FE["Next.js 15 포털\nApp Router + React 19\nServer Component 우선"]
  end

  subgraph "관측성 계층"
    OTEL[OpenTelemetry\n계측 표준]
    PROM[Prometheus]
    GRAF[Grafana]
    LOKI[Loki\n로그 집계]
    TEMPO[Tempo\n분산 추적]
  end

  subgraph "보안/정책 계층"
    KYV[Kyverno\nPolicy as Code]
    OPA[OPA/Gatekeeper\n정책 시행]
    COSIGN[Cosign\n컨테이너 서명]
  end

  PG --> PRISMA
  REDIS --> PRISMA
  PRISMA --> SVC_CORE
  PRISMA --> SVC_AI
  PRISMA --> SVC_SEC
  REDIS --> SVC_OPS
  SVC_CORE --> GW
  SVC_AI --> GW
  SVC_SEC --> GW
  SVC_OPS --> GW
  GW --> FE
  SVC_CORE --> OTEL
  SVC_AI --> OTEL
  OTEL --> PROM
  OTEL --> LOKI
  OTEL --> TEMPO
  PROM --> GRAF
  KYV --> GW
  OPA --> GW

  style GW fill:#1565C0,color:#fff,font-weight:bold
  style FE fill:#0D47A1,color:#fff
  style SVC_AI fill:#4A148C,color:#fff
  style SVC_SEC fill:#B71C1C,color:#fff
```

**레이어별 설명**

- **데이터 계층**: PostgreSQL 17이 영속 데이터를, Redis 7이 세션·캐시·Rate Limit 상태를 담당합니다. 두 데이터 저장소는 서비스에서 직접 접근하지 않고 반드시 ORM 또는 SDK를 경유합니다.
- **ORM 계층**: Prisma 6가 모든 SQL 쿼리를 타입 안전하게 생성합니다. 원시 SQL(`$queryRaw`)은 CSAP D-12에 따라 매개변수화 쿼리만 허용됩니다.
- **서비스 계층**: 17개 Fastify 5 마이크로서비스가 도메인별로 분리됩니다. 각 서비스는 독립 배포 단위이며 `@public-saas/*` 공유 패키지를 통해 공통 기능을 재사용합니다.
- **API 게이트웨이 계층**: 모든 외부 요청의 단일 진입점입니다. JWT 검증, RBAC 사전 검사, Rate Limit, 라우팅을 담당합니다. 게이트웨이를 우회한 직접 서비스 접근은 불가합니다.
- **관측성 계층**: OpenTelemetry로 계측된 메트릭·로그·추적 데이터가 Prometheus/Loki/Tempo로 수집되고 Grafana 대시보드에 통합 표시됩니다.

### 2.4 시스템 아키텍처

```mermaid
graph TD
  subgraph "외부"
    Browser[브라우저 / 모바일]
    Agency[공공기관 시스템]
  end

  subgraph "진입점"
    Portal[Next.js 포털\n platform/apps/portal]
    GW[API Gateway\n platform/services/api-gateway]
  end

  subgraph "인증/보안"
    Auth[인증 서비스\n auth-service]
    Security[보안 모니터\n security-service]
  end

  subgraph "비즈니스 서비스"
    User[사용자 서비스]
    Tenant[테넌트 서비스]
    Sub[구독 서비스]
    Billing[과금 서비스]
    Catalog[카탈로그 서비스]
    AI[AI 서비스]
    Notification[알림 서비스]
  end

  subgraph "데이터"
    PG[(PostgreSQL)]
    Redis[(Redis)]
  end

  subgraph "관측성"
    Prom[Prometheus]
    Grafana[Grafana]
    Loki[Loki]
  end

  Browser --> Portal
  Browser --> GW
  Agency --> GW
  Portal --> GW
  GW --> Auth
  GW --> User
  GW --> Tenant
  GW --> Sub
  GW --> Billing
  GW --> AI
  Auth --> PG
  Auth --> Redis
  User --> PG
  Tenant --> PG
  Security --> Prom
  Prom --> Grafana
```

### 2.5 멀티테넌시 격리 모델

본 플랫폼은 N2SF 등급별 격리 정책을 적용합니다.

| 테넌트 등급 | 격리 수준 | 적용 대상 |
|-----------|---------|---------|
| O 등급 | 논리적 격리 (공유 DB + 스키마 분리) | 일반 공공기관 |
| S 등급 | 네임스페이스 격리 (전용 파드 풀) | 민감 데이터 처리 기관 |
| C 등급 | 물리적 격리 (전용 클러스터) | 국가 핵심 인프라 |

---

## 3. 서비스 구조

`platform/services/` 하위에 총 17개 Fastify 마이크로서비스가 있습니다.

### 3.1 서비스 목록

| 서비스 디렉토리 | 패키지명 | 역할 | 기본 포트 | CSAP 항목 |
|--------------|--------|-----|---------|---------|
| `api-gateway` | `@public-saas/api-gateway` | 단일 진입점, 라우팅, Rate Limit | 3000 | D-08 |
| `auth-service` | `@public-saas/auth-service` | JWT 인증, MFA, 세션 관리 | 3001 | D-08 |
| `user-service` | `@public-saas/user-service` | 사용자 CRUD, 프로필 | 3002 | D-08 |
| `tenant-service` | `@public-saas/tenant-service` | 테넌트 온보딩, 격리 | 3003 | D-08, N2SF |
| `subscription-service` | `@public-saas/subscription-service` | 구독 플랜 관리 | 3004 | - |
| `billing-service` | `@public-saas/billing-service` | 과금, 청구서 | 3005 | D-09 |
| `catalog-service` | `@public-saas/catalog-service` | SaaS 서비스 카탈로그 | 3006 | - |
| `saas-catalog-service` | `@public-saas/saas-catalog-service` | 확장 카탈로그 | 3007 | - |
| `crm-service` | `@public-saas/crm-service` | 고객 관계 관리 | 3008 | D-08 |
| `menu-service` | `@public-saas/menu-service` | 메뉴/권한 구조 | 3009 | D-08 |
| `audit-service` | `@public-saas/audit-service` | 감사 로그 수집·저장 | 3010 | D-06 |
| `compliance-service` | `@public-saas/compliance-service` | CSAP/N2SF 준수 현황 | 3011 | D-06, D-08 |
| `security-service` | `@public-saas/security-service` | 보안 이벤트 탐지 | 3012 | D-06 |
| `security-monitor-service` | `@public-saas/security-monitor-service` | 실시간 위협 모니터링 | 3013 | D-06 |
| `notification-service` | `@public-saas/notification-service` | 이메일/SMS/푸시 알림 | 3014 | - |
| `file-service` | `@public-saas/file-service` | 파일 업로드/다운로드 | 3015 | D-09 |
| `ai-service` | `@public-saas/ai-service` | AI 게이트웨이, RAG | 3016 | N2SF AI규칙 |

### 3.2 서비스 계층 다이어그램

17개 서비스가 API Gateway를 중심으로 어떤 계층 구조로 배치되는지, 그리고 공유 패키지(`platform/packages/`)가 어떻게 서비스를 지원하는지 보여줍니다.

```mermaid
graph TB
  subgraph "클라이언트"
    BR[브라우저 / 공공기관 시스템]
    PORTAL["Next.js 포털\nplatform/apps/portal"]
  end

  subgraph "API Layer"
    GW["api-gateway\n@public-saas/api-gateway\n:3000"]
  end

  subgraph "인증·보안 서비스"
    AUTH["auth-service\n:3001"]
    SEC["security-service\n:3012"]
    SECM["security-monitor-service\n:3013"]
    COMP["compliance-service\n:3011"]
    AUDIT_SVC["audit-service\n:3010"]
  end

  subgraph "핵심 비즈니스 서비스"
    USER["user-service\n:3002"]
    TENANT["tenant-service\n:3003"]
    SUB["subscription-service\n:3004"]
    BILL["billing-service\n:3005"]
    CRM["crm-service\n:3008"]
    MENU["menu-service\n:3009"]
  end

  subgraph "부가 서비스"
    CAT["catalog-service\n:3006"]
    SAASCAT["saas-catalog-service\n:3007"]
    NOTIF["notification-service\n:3014"]
    FILE["file-service\n:3015"]
    AI["ai-service\n:3016"]
  end

  subgraph "Platform Packages (@public-saas/*)"
    RBAC["rbac\nRBAC 플러그인"]
    AUDITSDK["audit-sdk\n감사 로그 SDK"]
    AUTHHDR["auth-sdk\nJWT 발급·검증"]
    OBS["observability\nOpenTelemetry"]
    RATELIM["rate-limit\nRate Limit"]
    EVTBUS["event-bus\nRedis Pub/Sub"]
    TENISL["tenant-isolation\n테넌트 격리"]
    HEALTH["health\n헬스체크"]
    CIRCUIT["circuit-breaker\n서킷 브레이커"]
    SECMGR["secret-manager\nVault 연동"]
  end

  BR --> PORTAL
  BR --> GW
  PORTAL --> GW
  GW --> AUTH
  GW --> USER
  GW --> TENANT
  GW --> SUB
  GW --> BILL
  GW --> CRM
  GW --> MENU
  GW --> CAT
  GW --> SAASCAT
  GW --> NOTIF
  GW --> FILE
  GW --> AI
  GW --> COMP

  AUTH --> AUTHHDR
  AUTH --> AUDITSDK
  USER --> RBAC
  USER --> AUDITSDK
  TENANT --> TENISL
  TENANT --> AUDITSDK
  BILL --> AUDITSDK
  AI --> AUDITSDK
  SEC --> AUDITSDK
  SECM --> OBS
  COMP --> AUDITSDK
  AUDIT_SVC --> AUDITSDK
  GW --> RATELIM
  GW --> HEALTH
  GW --> CIRCUIT
  AUTH --> SECMGR
  USER --> EVTBUS
  NOTIF --> EVTBUS

  style GW fill:#1565C0,color:#fff,font-weight:bold
  style AI fill:#4A148C,color:#fff
  style RBAC fill:#E65100,color:#fff
  style AUDITSDK fill:#B71C1C,color:#fff
```

**서비스 계층 구성요소 설명**

- **API Layer (api-gateway)**: 포트 3000번으로 모든 외부 요청을 수신합니다. JWT 사전 검증, Rate Limit 적용, 적절한 서비스로 프록시 라우팅을 담당합니다. 이 계층을 통과하지 않은 서비스 직접 호출은 k3s 네트워크 정책으로 차단됩니다.
- **인증·보안 서비스 그룹**: auth-service가 JWT 생명주기를, security-service와 security-monitor-service가 위협 탐지를, compliance-service와 audit-service가 CSAP 증거 수집을 담당합니다.
- **핵심 비즈니스 서비스 그룹**: 멀티테넌트 SaaS의 핵심 도메인(사용자, 테넌트, 구독, 과금, CRM, 메뉴) 서비스들입니다. 각 서비스는 독립 배포 가능하며 `rbac`, `audit-sdk` 패키지를 공통으로 사용합니다.
- **Platform Packages**: 서비스 간 코드 중복을 제거하는 공유 라이브러리 계층입니다. `rbac`, `audit-sdk`, `auth-sdk`는 CSAP 준수의 핵심 패키지로, 서비스가 직접 보안 로직을 구현하지 않고 이 패키지를 사용해야 합니다.

### 3.3 서비스 표준 디렉토리 구조

모든 서비스는 다음 구조를 따릅니다 (auth-service 기준).

```
platform/services/auth-service/
├── src/
│   ├── index.ts          # 서비스 진입점 (Fastify 인스턴스 생성·플러그인 등록)
│   ├── routes.ts         # 라우트 등록 (registerRoutes 함수 내보내기)
│   ├── handlers/         # 요청 핸들러 (검증 → 로직 → 응답)
│   │   ├── login.handler.ts
│   │   └── logout.handler.ts
│   ├── middleware/       # Fastify 플러그인 형태의 미들웨어
│   │   └── auth.middleware.ts
│   ├── lib/              # 도메인 비즈니스 로직 (순수 함수)
│   │   ├── prisma.ts     # PrismaClient 싱글턴
│   │   ├── token.ts      # JWT 발급·검증
│   │   └── audit.ts      # 감사 로그 헬퍼
│   └── schemas/          # Zod 입력 검증 스키마
│       └── login.schema.ts
├── tests/
│   └── *.test.ts         # Vitest 단위/통합 테스트
├── Dockerfile
├── package.json
└── tsconfig.json
```

### 3.4 서비스 간 통신 방식

```
동기 호출:  HTTP/REST (API Gateway → 서비스)
비동기 호출: Redis Pub/Sub 또는 이벤트 버스 (@public-saas/event-bus)
서비스 탐색: k3s 내부 DNS (서비스명.네임스페이스.svc.cluster.local)
```

---

## 4. 패키지 구조

### 4.1 공유 패키지 (`platform/packages/`)

총 27개 공유 패키지가 `@public-saas/*` 네임스페이스로 제공됩니다.

**핵심 패키지**

| 패키지 | 설명 | 주요 내보내기 |
|--------|------|------------|
| `@public-saas/types` | 공유 TypeScript 타입 | `User`, `Tenant`, `ApiResponse`, `DataGrade` |
| `@public-saas/auth-sdk` | JWT 발급·검증 유틸리티 | `signAccessToken`, `verifyToken` |
| `@public-saas/audit-sdk` | 감사 로그 기록 SDK | `logAuditEvent`, `AuditAction` |
| `@public-saas/rbac` | Fastify RBAC 플러그인 | `rbacPlugin`, `hasPermission` |
| `@public-saas/observability` | OpenTelemetry 계측 | `initTelemetry`, `responseTimePlugin` |
| `@public-saas/health` | 헬스체크 엔드포인트 | `healthPlugin`, `CommonCheckers` |
| `@public-saas/rate-limit` | Rate Limiting 플러그인 | `rateLimitPlugin` |
| `@public-saas/mesh-ready` | 그레이스풀 셧다운, 서비스 메타데이터 | `meshReadyPlugin` |
| `@public-saas/tenant-isolation` | 테넌트 컨텍스트 격리 | `TenantContext`, `isolateByGrade` |
| `@public-saas/event-bus` | 이벤트 버스 (Redis 기반) | `EventBus`, `subscribe`, `publish` |
| `@public-saas/config-vault` | 환경 설정 관리 | `configPlugin` |
| `@public-saas/secret-manager` | 시크릿 관리 (Vault 연동) | `SecretManager` |
| `@public-saas/circuit-breaker` | 서킷 브레이커 | `CircuitBreaker` |
| `@public-saas/request-validator` | 공통 요청 검증 | `validateRequest` |
| `@public-saas/cache` | Redis 캐시 래퍼 | `CacheManager` |

**기타 전문 패키지**

| 패키지 | 설명 |
|--------|------|
| `@public-saas/api-gateway-advanced` | 고급 게이트웨이 기능 |
| `@public-saas/api-version` | API 버저닝 |
| `@public-saas/audit-chain` | 감사 로그 무결성 체인 |
| `@public-saas/chaos` | 카오스 엔지니어링 도구 |
| `@public-saas/workflow-engine` | 비즈니스 워크플로우 엔진 |
| `@public-saas/business-sdk` | 비즈니스 로직 SDK |
| `@public-saas/business-plugin-sdk` | 플러그인 확장 SDK |
| `@public-saas/health-aggregator` | 다중 서비스 헬스 집계 |
| `@public-saas/rate-limit-advanced` | 고급 Rate Limit (토큰 버킷) |
| `@public-saas/rate-limiter` | 분산 Rate Limiter |
| `@public-saas/ui` | 공유 UI 컴포넌트 |

### 4.2 루트 패키지 (`packages/`)

플랫폼 운영 도구 6개 패키지입니다. 서비스 내부에서 직접 의존하지 않고 독립적으로 실행됩니다.

| 패키지 | 설명 |
|--------|------|
| `dora-exporter` | DORA 메트릭 (배포 빈도, 변경 실패율 등) 내보내기 |
| `ml-pipeline` | ML 모델 CI/CD 파이프라인 |
| `slo-escalation` | SLO 위반 시 에스컬레이션 자동화 |
| `feature-flag-sdk` | 기능 플래그 SDK |
| `audit-collector` | 감사 로그 중앙 수집기 |
| `tech-debt-scanner` | 기술 부채 스캐너 |

### 4.3 앱 (`platform/apps/`)

| 앱 | 설명 | 기술 |
|----|------|------|
| `portal` | 관리자 및 테넌트 포털 UI | Next.js 15 + React 19 |

---

## 5. 핵심 인증 및 규정 체계

### 5.1 CSAP 주요 통제 항목 (D-시리즈)

코드를 작성할 때 반드시 숙지해야 하는 CSAP 통제 항목입니다.

| 항목 | 분야 | 개발자 영향 |
|------|------|----------|
| **D-06** | 침해사고 관리 | 모든 민감 작업에 감사 로그 기록 필수 (`audit-sdk` 사용) |
| **D-08** | 접근 통제 | 모든 API 엔드포인트에 RBAC 검사 필수 (`rbac` 패키지 사용) |
| **D-09** | 암호화 | 민감 데이터 AES-256 암호화, 전송 TLS 1.3+ |
| **D-12** | 시스템 개발 보안 | 입력 검증(Zod), 매개변수화 쿼리, XSS 방지 |

### 5.2 CSAP 도메인 매핑 다이어그램

CSAP 4개 핵심 통제 항목(D-06, D-08, D-09, D-12)이 17개 서비스 중 어느 서비스에 어떻게 적용되는지 매핑한 다이어그램입니다.

```mermaid
graph LR
  subgraph "CSAP 통제 항목"
    D06["D-06\n침해사고 관리\n(감사 로그)"]
    D08["D-08\n접근 통제\n(RBAC·인증)"]
    D09["D-09\n암호화\n(AES-256·TLS)"]
    D12["D-12\n개발 보안\n(입력검증·SQL)"]
  end

  subgraph "적용 서비스"
    GW_SVC["api-gateway\n:3000"]
    AUTH_SVC["auth-service\n:3001"]
    USER_SVC["user-service\n:3002"]
    TENANT_SVC["tenant-service\n:3003"]
    BILL_SVC["billing-service\n:3005"]
    CRM_SVC["crm-service\n:3008"]
    MENU_SVC["menu-service\n:3009"]
    AUDIT_SVC2["audit-service\n:3010"]
    COMP_SVC["compliance-service\n:3011"]
    SEC_SVC["security-service\n:3012"]
    SECM_SVC["security-monitor-service\n:3013"]
    FILE_SVC["file-service\n:3015"]
    AI_SVC["ai-service\n:3016"]
  end

  subgraph "공유 패키지 (구현 위임)"
    PKG_RBAC["@public-saas/rbac"]
    PKG_AUDIT["@public-saas/audit-sdk"]
    PKG_AUTH["@public-saas/auth-sdk"]
    PKG_VAL["@public-saas/request-validator"]
  end

  D08 --> PKG_RBAC
  D08 --> PKG_AUTH
  D06 --> PKG_AUDIT
  D12 --> PKG_VAL

  PKG_RBAC --> GW_SVC
  PKG_RBAC --> AUTH_SVC
  PKG_RBAC --> USER_SVC
  PKG_RBAC --> TENANT_SVC
  PKG_RBAC --> CRM_SVC
  PKG_RBAC --> MENU_SVC
  PKG_RBAC --> COMP_SVC

  PKG_AUDIT --> AUTH_SVC
  PKG_AUDIT --> USER_SVC
  PKG_AUDIT --> TENANT_SVC
  PKG_AUDIT --> BILL_SVC
  PKG_AUDIT --> AUDIT_SVC2
  PKG_AUDIT --> COMP_SVC
  PKG_AUDIT --> SEC_SVC
  PKG_AUDIT --> SECM_SVC
  PKG_AUDIT --> AI_SVC

  PKG_AUTH --> AUTH_SVC
  PKG_AUTH --> GW_SVC

  D09 --> BILL_SVC
  D09 --> FILE_SVC
  D09 --> AUTH_SVC

  PKG_VAL --> GW_SVC
  PKG_VAL --> AUTH_SVC
  PKG_VAL --> USER_SVC
  PKG_VAL --> TENANT_SVC
  PKG_VAL --> AI_SVC

  style D06 fill:#B71C1C,color:#fff
  style D08 fill:#1565C0,color:#fff
  style D09 fill:#E65100,color:#fff
  style D12 fill:#1B5E20,color:#fff
  style PKG_RBAC fill:#1565C0,color:#fff
  style PKG_AUDIT fill:#B71C1C,color:#fff
```

**CSAP 도메인 매핑 설명**

- **D-06 (감사 로그)**: `@public-saas/audit-sdk`를 통해 9개 서비스에 적용됩니다. 새 서비스를 개발할 때 민감 작업(생성·수정·삭제·인증)은 반드시 `logAuditEvent()`를 호출해야 합니다. 감사 로그 누락은 Q-Gate G7 불통과 원인입니다.
- **D-08 (접근 통제)**: `@public-saas/rbac` 플러그인이 Fastify 라우트에 RBAC 검사를 자동 삽입합니다. API Gateway에서 1차 JWT 검증, 개별 서비스에서 2차 권한 검사가 이중으로 적용됩니다.
- **D-09 (암호화)**: billing-service(결제 정보), file-service(첨부 파일), auth-service(비밀번호 해시)에 직접 적용됩니다. 모든 서비스 간 통신은 TLS 1.3+를 사용하며 k3s 내부 통신도 mTLS를 권장합니다.
- **D-12 (개발 보안)**: `@public-saas/request-validator`가 Zod 스키마 검증을 공통 처리합니다. 서비스에서 직접 `req.body`를 사용하지 않고 반드시 검증된 파싱 결과를 사용해야 합니다.

### 5.3 N2SF 데이터 등급 분류

AI API 호출 전 반드시 데이터 등급을 확인해야 합니다.

| 등급 | 설명 | AI API 전송 | 처리 방법 |
|------|------|-----------|---------|
| **C** (기밀) | 국가 기밀, 개인정보 | 절대 금지 | 내부 처리만 |
| **S** (민감) | 내부 민감 정보 | 절대 금지 | 내부 처리만 |
| **O** (일반) | 공개 가능 정보 | PII 마스킹 후 가능 | AI Gateway 경유 |

### 5.4 N2SF 데이터 등급 분류 도식

C/S/O 등급별 허용 처리 범위와 AI API 전송 정책을 시각화한 흐름도입니다.

```mermaid
flowchart TD
  START([데이터 처리 요청]) --> CLASSIFY{데이터 등급 분류}

  CLASSIFY -->|C 등급\n국가기밀·개인식별정보| C_BLOCK
  CLASSIFY -->|S 등급\n내부 민감 정보| S_BLOCK
  CLASSIFY -->|O 등급\n일반 공개 정보| O_PROC

  subgraph "C 등급 처리 영역 — 물리적 격리 클러스터"
    C_BLOCK["외부 전송 완전 차단\nAI API 호출 불가\n내부 온프레미스만"]
    C_STORE["AES-256 암호화 저장\n전용 PostgreSQL 인스턴스\n접근 로그 전수 기록"]
    C_BLOCK --> C_STORE
  end

  subgraph "S 등급 처리 영역 — 네임스페이스 격리"
    S_BLOCK["외부 AI API 전송 차단\n내부 ML 모델만 사용 가능\nN2SF N-05 준수"]
    S_STORE["암호화 저장\n테넌트 전용 파드"]
    S_BLOCK --> S_STORE
  end

  subgraph "O 등급 처리 영역 — 공유 클러스터"
    O_PROC["PII 마스킹 필수\n(이름→홍*동, 전화→010-****-****)"]
    O_GATE["AI Gateway 경유\nai-service :3016\nN2SF 검사 + 감사 로그"]
    O_EXT["외부 AI API 호출 허용\n(마스킹 완료 데이터만)"]
    O_PROC --> O_GATE --> O_EXT
  end

  subgraph "공통 — 모든 등급"
    AUDIT_LOG["감사 로그 기록\naudit-sdk logAuditEvent()\nCSAP D-06 준수"]
  end

  C_STORE --> AUDIT_LOG
  S_STORE --> AUDIT_LOG
  O_EXT --> AUDIT_LOG

  style C_BLOCK fill:#B71C1C,color:#fff
  style S_BLOCK fill:#E65100,color:#fff
  style O_PROC fill:#1565C0,color:#fff
  style O_GATE fill:#1B5E20,color:#fff
  style AUDIT_LOG fill:#4A148C,color:#fff
  style START fill:#37474F,color:#fff
```

**N2SF 등급별 처리 규칙 설명**

- **C 등급 (기밀)**: 국가 기밀, 주민등록번호, 의료정보 등이 해당합니다. 물리적으로 격리된 전용 클러스터에서만 처리하며, 외부 네트워크 전송이 기술적으로 차단됩니다. AI API 호출은 코드 수준에서 예외를 발생시켜 완전히 차단합니다.
- **S 등급 (민감)**: 내부 업무 문서, 계약 정보, 인사 정보 등이 해당합니다. 외부 AI API 전송은 금지되나 내부 온프레미스 ML 모델은 사용 가능합니다. 테넌트 전용 파드에서 네임스페이스 격리로 처리합니다.
- **O 등급 (일반)**: 공개 가능한 일반 업무 정보가 해당합니다. PII 마스킹 처리 후 AI Gateway(`ai-service`)를 반드시 경유해야 하며, 직접 외부 AI API를 호출하는 것은 N2SF N-05 위반입니다.

### 5.5 7단계 품질 게이트 (Q-Gate)

모든 코드는 배포 전 7개 게이트를 통과해야 합니다.

| 게이트 | 기준 | 담당 에이전트 |
|--------|------|------------|
| G1 | 요구사항 FR ID 전수 확인 | Auditor |
| G2 | 설계 완전성 (Plan + Design 문서 완비) | Auditor |
| G3 | 코드 품질 + AgentShield 102 규칙 | Reviewer |
| G4 | 테스트 커버리지 80% 이상 | Tester |
| G5 | OWASP Top10 통과 | Reviewer |
| G6 | CSAP 해당 Phase 100% | Auditor |
| G7 | 감사 추적 `audit.jsonl` 완비 | Auditor |

### 5.6 Q-Gate 7단계 파이프라인 다이어그램

PR 생성부터 배포 완료까지 Q-Gate 7단계가 어떤 순서로 실행되고 어느 에이전트가 담당하는지 보여줍니다.

```mermaid
flowchart LR
  PR([PR 생성\nfeat/* 브랜치]) --> G1

  subgraph "Auditor 에이전트 — claude-opus-4-6"
    G1["G1\nFR ID 전수 확인\n요구사항 추적성"]
    G2["G2\n설계 완전성\nPlan + Design 완비"]
    G6["G6\nCSAP Phase 100%\n79개 통제항목"]
    G7["G7\naudit.jsonl 완비\n감사 추적"]
  end

  subgraph "Reviewer 에이전트 — claude-sonnet-4-6"
    G3["G3\n코드 품질\nAgentShield 102규칙"]
    G5["G5\nOWASP Top10\n보안 취약점"]
  end

  subgraph "Tester 에이전트 — claude-sonnet-4-6"
    G4["G4\n테스트 커버리지\n80% 이상"]
  end

  G1 -->|통과| G2
  G1 -->|실패| FAIL1["FR ID 추가\n후 재제출"]
  G2 -->|통과| G3
  G2 -->|실패| FAIL2["Plan/Design\n문서 작성"]
  G3 -->|통과| G4
  G3 -->|실패| FAIL3["코드 수정\n후 재검사"]
  G4 -->|통과| G5
  G4 -->|실패| FAIL4["테스트 추가\n커버리지 확보"]
  G5 -->|통과| G6
  G5 -->|실패| FAIL5["보안 취약점\n수정"]
  G6 -->|통과| G7
  G6 -->|실패| FAIL6["CSAP 통제항목\n누락 보완"]
  G7 -->|통과| DEPLOY["stg 배포\nFlux GitOps"]
  G7 -->|실패| FAIL7["auditLog() 추가\n감사 로그 완비"]

  FAIL1 --> PR
  FAIL2 --> PR
  FAIL3 --> PR
  FAIL4 --> PR
  FAIL5 --> PR
  FAIL6 --> PR
  FAIL7 --> PR

  DEPLOY --> PROD["main 머지\n후 prod 배포"]

  style G1 fill:#4A148C,color:#fff
  style G2 fill:#4A148C,color:#fff
  style G6 fill:#4A148C,color:#fff
  style G7 fill:#4A148C,color:#fff
  style G3 fill:#1565C0,color:#fff
  style G5 fill:#1565C0,color:#fff
  style G4 fill:#1B5E20,color:#fff
  style DEPLOY fill:#37474F,color:#fff
  style PROD fill:#37474F,color:#fff
  style PR fill:#E65100,color:#fff
```

**Q-Gate 파이프라인 구성요소 설명**

- **G1 (FR ID 전수 확인)**: 코드에 `// Plan SC: FR-x.x` 형태의 요구사항 추적 주석이 있는지, 그리고 해당 FR이 Plan 문서에 실제로 존재하는지 확인합니다. 추적성 없는 코드는 감리에서 결함으로 처리됩니다.
- **G2 (설계 완전성)**: 구현 전 `docs/01-plan/`과 `docs/02-design/` 문서가 완비되어야 합니다. 문서 없는 구현은 절대 제약 위반으로 즉시 차단됩니다.
- **G3 (코드 품질)**: AgentShield 102개 정적 분석 규칙이 자동 실행됩니다. 하드코딩 시크릿, SQL 직접 결합, 인증 누락 등이 탐지되면 즉시 실패 처리됩니다.
- **G4 (테스트 커버리지)**: Vitest 기준 80% 이상의 라인·브랜치 커버리지가 필요합니다. 새 기능 추가 시 반드시 단위 테스트와 통합 테스트를 함께 작성해야 합니다.
- **G5 ~ G7**: OWASP Top10 취약점 스캔(Semgrep), CSAP 79개 통제항목 체크리스트, `audit.jsonl` 완비 여부를 순서대로 검증합니다. 하나라도 실패하면 PR이 차단되고 원인 수정 후 재검사를 받아야 합니다.

---

## 6. 개발 도구 및 환경

### 6.1 필수 설치 도구

| 도구 | 버전 | 설치 명령 |
|------|------|---------|
| Node.js | 22.x LTS | `nvm install 22` |
| pnpm | 9.x | `npm install -g pnpm@9` |
| Docker | 27.x | Docker Desktop 또는 공식 설치 |
| k3s | 1.29+ | WSL2 환경에서 자동 설치 스크립트 |

### 6.2 프로젝트 설정

```bash
# 1. 저장소 클론
git clone <gitea-repo-url> ai-saas
cd ai-saas

# 2. 의존성 설치 (전체 워크스페이스)
pnpm install

# 3. 환경 변수 설정
cp docs/env.example .env
# .env 편집 후 실제 값 입력

# 4. 데이터베이스 초기화
pnpm prisma migrate dev
pnpm prisma db seed

# 5. 전체 빌드 (Turbo 활용)
pnpm build

# 6. 개발 서버 시작 (특정 서비스)
pnpm --filter @public-saas/auth-service dev
```

### 6.3 주요 루트 스크립트

루트 `package.json`에 정의된 워크스페이스 단위 명령입니다.

| 명령 | 설명 |
|------|------|
| `pnpm test` | 전체 워크스페이스 테스트 실행 |
| `pnpm typecheck` | 전체 TypeScript 타입 검사 |
| `pnpm build` | 전체 빌드 (Turbo 병렬 처리) |
| `pnpm run audit:security` | 보안 감사 스크립트 실행 |
| `pnpm run audit:dead-code` | Dead code 탐지 |

### 6.4 Turbo 빌드 파이프라인

`turbo.json`에 정의된 태스크 의존성입니다.

- `build`: 의존 패키지 먼저 빌드 (`dependsOn: ["^build"]`), 출력 캐시 (`dist/**`, `.next/**`)
- `lint` / `typecheck`: 빌드 완료 후 실행
- `test`: 빌드 완료 후 실행, 환경 변수 주입 (`DATABASE_URL`, `REDIS_URL`)
- `dev`: 캐시 없음, 영구 실행 모드

---

## 7. CC 하네스 (Claude Code 자동화)

### 7.1 하네스 개요

본 프로젝트는 **ECC (Everything Claude Code) v1.9.0** 기반 AI 하네스를 사용합니다.
구현, 리뷰, 감리, 테스트, 리팩토링 5개 에이전트가 자동 분업합니다.

| 에이전트 | 모델 | 역할 |
|---------|------|------|
| Implementer | claude-sonnet-4-6 | 설계 기반 구현 |
| Reviewer | claude-sonnet-4-6 | 코드 품질·보안 검사 (수정 불가) |
| Auditor | claude-opus-4-6 | CSAP·N2SF·감리 준수 검증 (읽기 전용) |
| Tester | claude-sonnet-4-6 | 테스트 케이스 작성·실행 |
| Refactorer | claude-haiku-4-5 | Dead code 제거·구조 개선 |

### 7.2 절대 제약 (CLAUDE.md)

하네스가 강제하는 절대 제약입니다. 위반 시 커밋이 차단됩니다.

- 구현 착수 전 Plan + Design 문서 완비 필수
- `.env`, `secrets.*`, `*credential*` 파일 커밋 금지
- `git push --force`, `DROP TABLE`, `DELETE FROM` (WHERE 없음) 금지
- `git commit --no-verify` 사용 금지 (훅 우회 금지)
- AI API 호출 시 N2SF C/S 등급 데이터 전송 금지
- 외부 클라우드 서비스 사용 금지 (AI API만 예외, O등급 + 마스킹 후)

### 7.3 감사 로그

모든 민감 작업은 `.claude/audit.jsonl`에 자동 기록됩니다 (CSAP D-06 준수).

---

## 8. 역할별 학습 경로

### 8.1 백엔드 개발자

```
0장 (본 문서) → 1장 (문서 관리) → 2장 (코드 관리) → 7장 (보안·CSAP)
→ 서비스별 Plan/Design 문서 (docs/01-plan/mtus/SVC-*.plan.md)
→ 첫 이슈 할당
```

**필수 숙지 파일**:
- `/data/ai-saas/docs/guidelines/coding-standards.md` — TypeScript/Fastify 패턴
- `/data/ai-saas/docs/guidelines/documentation-standards.md` — 코드 주석 표준
- `/data/ai-saas/.claude/rules/csap-compliance.md` — 보안 코딩 규칙

### 8.2 프론트엔드 개발자

```
0장 → 1장 → 2장 → 7장
→ platform/apps/portal/ 코드베이스 탐색
→ Next.js 15 Server Component 패턴 학습 (coding-standards.md §6)
```

**필수 숙지 파일**:
- `/data/ai-saas/docs/guidelines/coding-standards.md` §6 (프론트엔드 패턴)
- `/data/ai-saas/platform/apps/portal/` 디렉토리 구조

### 8.3 인프라 엔지니어

```
0장 → 4장 (인프라·k3s) → 5장 (모니터링) → 6장 (CI/CD)
→ docs/framework/08-infra/ 심화 학습
→ infra/ 디렉토리 탐색
```

**필수 숙지 파일**:
- `/data/ai-saas/docs/framework/08-infra/` — k3s, Gitea, Flux, Harbor
- `/data/ai-saas/helm/` — Helm 차트
- `/data/ai-saas/k8s/` — k8s 매니페스트

### 8.4 보안 담당자

```
0장 → 7장 (보안·CSAP) → docs/framework/02-csap/ → docs/framework/04-n2sf/
→ CSAP 자가진단 체크리스트 작성
```

**필수 숙지 파일**:
- `/data/ai-saas/docs/framework/02-csap/` — CSAP 일반/표준등급
- `/data/ai-saas/docs/framework/04-n2sf/` — N2SF 등급 분류
- `/data/ai-saas/.claude/rules/csap-compliance.md`

### 8.5 PM / 기획자

```
0장 → 1장 (문서 관리) → 7장 (보안·CSAP 개요)
→ docs/roadmap/ → docs/01-plan/mtus/ 현황 파악
```

**필수 숙지 파일**:
- `/data/ai-saas/docs/framework/00-getting-started/AUDIT-CSAP-SUBMISSION-GUIDE.md`
- `/data/ai-saas/docs/01-plan/mtus/` — 현재 진행 중인 MTU 목록
- `/data/ai-saas/CHANGELOG.md`

---

## 9. 첫 주 체크리스트

### 9.1 1일차 (환경 구성)

- [ ] 저장소 클론 및 `pnpm install` 완료
- [ ] `.env` 파일 구성 완료 (`docs/env.example` 참조)
- [ ] `pnpm build` 성공 확인
- [ ] `pnpm test` 통과 확인
- [ ] k3s 로컬 클러스터 기동 확인 (선택: 인프라 담당만)

### 9.2 2~3일차 (문서 파악)

- [ ] 본 문서(0장) 완독
- [ ] `docs/guidelines/coding-standards.md` 완독
- [ ] `docs/guidelines/documentation-standards.md` 완독
- [ ] `.claude/rules/csap-compliance.md` 완독
- [ ] `CLAUDE.md` 완독 (절대 제약 숙지)

### 9.3 4~5일차 (코드 탐색)

- [ ] 담당 서비스의 Plan 문서 (`docs/01-plan/mtus/SVC-*.plan.md`) 읽기
- [ ] 담당 서비스의 Design 문서 (`docs/02-design/mtus/SVC-*.design.md`) 읽기
- [ ] 담당 서비스 소스코드 (`platform/services/{서비스}/src/`) 탐색
- [ ] 첫 이슈 할당 요청

### 9.4 2주차 (실습)

- [ ] 간단한 버그 픽스 또는 문서 개선 PR 작성
- [ ] PR 리뷰 프로세스 경험
- [ ] 감사 로그 작성 실습 (`audit-sdk` 사용)
- [ ] CSAP D-12 입력 검증 패턴 구현 실습

---

## 10. 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|-------|
| 1.0.0 | 2026-04-11 | 초기 작성 — 프로젝트 실제 구조 기반 | Implementer (Sonnet) |
| 1.1.0 | 2026-04-11 | Mermaid 다이어그램 6개 추가 — 기술 스택 레이어, 서비스 계층, CSAP 도메인 매핑, N2SF 등급 분류 흐름, Q-Gate 파이프라인, 목차 확장 | Implementer (Sonnet) |
