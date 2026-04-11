# 전체 시스템 아키텍처

> **문서 ID**: ONBOARD-02-01
> **버전**: 1.0.0 | **작성일**: 2026-04-11 | **작성자**: Implementer (Sonnet)
> **학습 대상**: 1장을 완료한 팀원
> **예상 학습 시간**: 3시간
> **선행 문서**: `01-getting-started/01-welcome.md`

---

## 목차

1. [전체 시스템 아키텍처 (C4 다이어그램)](#1-전체-시스템-아키텍처-c4-다이어그램)
2. [17개 서비스 간 통신 흐름](#2-17개-서비스-간-통신-흐름)
3. [클라이언트 → API Gateway → 서비스 → DB 흐름](#3-클라이언트--api-gateway--서비스--db-흐름)
4. [네임스페이스 구조 (k3s)](#4-네임스페이스-구조-k3s)
5. [공유 패키지 (Platform Packages) 구조](#5-공유-패키지-platform-packages-구조)

---

## 1. 전체 시스템 아키텍처 (C4 다이어그램)

C4 모델은 소프트웨어 아키텍처를 4개의 추상화 수준으로 표현하는 방법입니다.
- **Context**: 시스템이 외부와 어떻게 연결되는가 (가장 큰 그림)
- **Container**: 시스템 내부의 독립 실행 단위 (서비스, 데이터베이스)
- **Component**: 각 컨테이너 내부 구성요소
- **Code**: 실제 클래스, 함수

### 1.1 Context 다이어그램 (Level 1 — 가장 큰 그림)

```mermaid
graph TB
    subgraph "사용자 및 외부 시스템"
        Officer["공무원\n브라우저 + 모바일"]
        Agency["공공기관 시스템\n행정망 API 연동"]
        Admin["시스템 관리자\n플랫폼 운영"]
    end

    subgraph "공공기관 SaaS 플랫폼"
        Platform["공공기관 SaaS 플랫폼\n\nCSAP 표준 등급 79항목\nN2SF C/S/O 데이터 격리\n행안부 감리 기준 준수\n\n멀티테넌트 SaaS 인프라"]
    end

    subgraph "외부 서비스"
        AIGateway["AI Gateway\nAnthropic/OpenAI\n(O등급 데이터 + PII 마스킹 후만 연결)"]
        SMTP["이메일 서버\nSMTP"]
        SMS["SMS 게이트웨이"]
    end

    subgraph "감사/규제 기관"
        KISA["KISA\nCSAP 감사"]
        MoI["행안부\n정보화사업 감리"]
        NIS["국가정보원\nN2SF 검증"]
    end

    Officer -- "HTTPS\n공공 인터넷" --> Platform
    Agency -- "행정망 전용선\nAPI 호출" --> Platform
    Admin -- "VPN + 관리 콘솔" --> Platform
    Platform -- "O등급 마스킹 데이터만" --> AIGateway
    Platform -- "알림 발송" --> SMTP
    Platform -- "SMS 발송" --> SMS
    Platform -- "준수 보고서 제출" --> KISA
    Platform -- "감리 산출물 제출" --> MoI
    Platform -- "N2SF 준수 현황 보고" --> NIS

    style Platform fill:#1565C0,color:#fff,font-weight:bold
    style AIGateway fill:#4A148C,color:#fff
```

### 1.2 Container 다이어그램 (Level 2 — 서비스 단위)

이 다이어그램은 플랫폼 내부에 있는 독립 실행 단위들을 보여줍니다.

```mermaid
graph TB
    subgraph "클라이언트 계층"
        Portal["Next.js 15 포털\nplatform/apps/portal\n포트 3100\n\nSSR + App Router\nCSP 보안 미들웨어"]
    end

    subgraph "API Gateway 계층"
        GW["API Gateway\nplatform/services/api-gateway\n포트 3000\n\nJWT 검증 (auth-service 위임)\nRate Limiting (100req/min/테넌트)\nCircuit Breaker\nIP 필터링 (CSAP D-10)"]
    end

    subgraph "인증·보안 서비스 계층"
        Auth["auth-service :3001\nJWT 발급·검증\nMFA (TOTP)\n세션 관리 (Redis)"]
        Security["security-service :3012\n보안 이벤트 탐지\n위협 인텔리전스"]
        SecurityMon["security-monitor-service :3013\n실시간 위협 모니터링\n대시보드"]
        AuditSvc["audit-service :3010\n감사 로그 수집·보존\n1년 이상 보존 (CSAP D-06)"]
        Compliance["compliance-service :3011\nCSAP 79항목 준수 현황\nN2SF 데이터 등급 현황"]
    end

    subgraph "핵심 비즈니스 서비스 계층"
        User["user-service :3002\n사용자 CRUD\nRBAC 권한"]
        Tenant["tenant-service :3003\n테넌트 온보딩\nC/S/O 등급 격리"]
        Subscription["subscription-service :3004\n구독 플랜 관리"]
        Billing["billing-service :3005\n과금·청구서\nAES-256 암호화"]
        CRM["crm-service :3008\n고객 관계 관리"]
        Menu["menu-service :3009\n메뉴·권한 구조"]
    end

    subgraph "부가 서비스 계층"
        Catalog["catalog-service :3005\nSaaS 카탈로그"]
        Notification["notification-service :3010\n이메일·SMS·푸시"]
        File["file-service :3015\n파일 업로드·다운로드\nAES-256 암호화"]
        AI["ai-service :3009\nRAG 엔진\nN2SF AI Gateway 패턴"]
    end

    subgraph "데이터 계층"
        PG[(PostgreSQL 17\n주 데이터베이스\n테넌트별 Row-Level Security)]
        Redis[(Redis 7\n세션·캐시·Rate Limit\nBlacklist 토큰 관리)]
    end

    subgraph "관측성 계층"
        Prom[Prometheus\n메트릭 수집]
        Grafana[Grafana\n대시보드]
        Loki[Loki\n로그 집계]
        Tempo[Tempo\n분산 추적]
    end

    Portal --> GW
    GW --> Auth
    GW --> User
    GW --> Tenant
    GW --> Subscription
    GW --> Billing
    GW --> CRM
    GW --> Menu
    GW --> Catalog
    GW --> Notification
    GW --> File
    GW --> AI
    GW --> Compliance

    Auth --> PG
    Auth --> Redis
    User --> PG
    Tenant --> PG
    Billing --> PG
    AuditSvc --> PG
    AI --> PG

    Auth -.->|"감사 로그"| AuditSvc
    User -.->|"감사 로그"| AuditSvc
    Billing -.->|"감사 로그"| AuditSvc

    style GW fill:#1565C0,color:#fff,font-weight:bold
    style Auth fill:#B71C1C,color:#fff
    style AI fill:#4A148C,color:#fff
    style PG fill:#1B5E20,color:#fff
    style Redis fill:#E65100,color:#fff
```

---

## 2. 17개 서비스 간 통신 흐름

### 2.1 서비스 간 통신 방식

이 플랫폼에서 서비스 간 통신은 두 가지 방식을 사용합니다.

```mermaid
graph LR
    subgraph "동기 통신 (HTTP/REST)"
        direction TB
        S1[요청 서비스] -->|"fetch() 또는\nhttpProxy"| S2[응답 서비스]
        S2 -->|즉시 응답| S1
    end

    subgraph "비동기 통신 (Redis Pub/Sub)"
        direction TB
        Pub[발행자 서비스] -->|"event-bus.publish()"| Redis[(Redis Channel)]
        Redis -->|"event-bus.subscribe()"| Sub1[구독자 서비스 A]
        Redis -->|"event-bus.subscribe()"| Sub2[구독자 서비스 B]
    end
```

| 통신 방식 | 사용 패키지 | 사용 시나리오 | 예시 |
|---------|-----------|------------|------|
| HTTP 동기 | `fetch()`, `@fastify/http-proxy` | 즉시 응답이 필요한 경우 | 로그인, 데이터 조회 |
| Redis 비동기 | `@public-saas/event-bus` | 이벤트 전파, 알림 | 사용자 생성 → 알림 발송 |

### 2.2 핵심 통신 흐름 — 로그인 요청

```mermaid
sequenceDiagram
    participant Client as 브라우저
    participant Portal as Next.js 포털
    participant GW as API Gateway :3000
    participant Auth as auth-service :3001
    participant PG as PostgreSQL
    participant Redis as Redis
    participant AuditSvc as audit-service :3010

    Client->>Portal: 로그인 폼 제출
    Portal->>GW: POST /auth/login\n(Authorization 헤더 없음)
    Note over GW: /auth/* 경로는 인증 검사 없이 통과
    GW->>GW: Rate Limit 확인\n(10회/분/IP 초과 시 429)
    GW->>Auth: 프록시: POST /auth/login\n{email, password, tenantSlug}
    Auth->>Auth: Zod 입력 검증
    Auth->>PG: 테넌트 확인\n(slug → tenantId)
    Auth->>PG: 사용자 조회\n(email + tenantId)
    Auth->>Auth: bcrypt 비밀번호 검증
    Auth->>Auth: MFA 코드 검증 (활성화된 경우)
    Auth->>Auth: JWT 발급\n(접근 15분 + 갱신 7일)
    Auth->>Redis: 세션 저장\n(TTL: 7일, 최대 3개)
    Auth->>AuditSvc: LOGIN_SUCCESS 이벤트\n(actor, ip, timestamp)
    Auth-->>GW: {accessToken, refreshToken}
    GW-->>Portal: 응답 전달
    Portal-->>Client: 로그인 성공\n(HttpOnly 쿠키에 토큰 저장)
```

### 2.3 핵심 통신 흐름 — 보호된 API 요청

```mermaid
sequenceDiagram
    participant Client as 브라우저
    participant GW as API Gateway :3000
    participant Auth as auth-service :3001
    participant UserSvc as user-service :3002
    participant PG as PostgreSQL

    Client->>GW: GET /users/me\nAuthorization: Bearer <token>
    Note over GW: 보호된 경로 — 인증 preHandler 실행
    GW->>Auth: GET /auth/verify\nAuthorization: Bearer <token>
    Auth->>Auth: JWT 서명 검증
    Auth->>Redis: 토큰 블랙리스트 확인\n(로그아웃된 토큰 차단)
    Auth-->>GW: {userId, tenantId, role, permissions}
    GW->>GW: x-user-id, x-user-role 헤더 주입
    GW->>GW: RBAC 권한 확인\n(user:read 권한 있는가?)
    GW->>UserSvc: GET /users/me\nx-user-id, x-user-role 헤더 포함
    UserSvc->>PG: 사용자 조회\n(WHERE tenantId = ? AND id = ?)
    UserSvc-->>GW: 사용자 정보
    GW-->>Client: 200 OK {user data}
```

---

## 3. 클라이언트 → API Gateway → 서비스 → DB 흐름

### 3.1 요청 처리 단계 상세

```mermaid
flowchart TD
    Request([클라이언트 요청]) --> Step1

    subgraph "API Gateway 처리 단계"
        Step1["1단계: TLS 종료\n(CSAP D-09: TLS 1.3+)"]
        Step2["2단계: IP 필터링\n(CSAP D-10: 허용 IP만 통과)"]
        Step3["3단계: 보안 응답 헤더 추가\n(X-Frame-Options, CSP 등)"]
        Step4["4단계: Correlation ID 생성\n(분산 추적용 고유 ID)"]
        Step5["5단계: Rate Limiting 확인\n(100req/min/테넌트, Redis 기반)"]
        Step6{"6단계: 인증 필요 경로?\n(/auth/* 는 제외)"}
        Step7["7단계: auth-service로\nJWT 검증 위임\n(/auth/verify 호출)"]
        Step8["8단계: RBAC 권한 확인\n(필요 권한 있는가?)"]
        Step9["9단계: 감사 로그 기록\n(CSAP D-06)"]
        Step10["10단계: Circuit Breaker 확인\n(서비스 장애 시 빠른 실패)"]
        Step11["11단계: 대상 서비스로 프록시\n(httpProxy)"]
    end

    subgraph "대상 서비스 처리"
        SvcStep1["입력 검증 (Zod)"]
        SvcStep2["비즈니스 로직 실행"]
        SvcStep3["데이터베이스 쿼리\n(Prisma 매개변수화)"]
        SvcStep4["감사 로그 기록"]
        SvcStep5["응답 반환"]
    end

    Step1 --> Step2 --> Step3 --> Step4 --> Step5 --> Step6
    Step6 -- "인증 필요" --> Step7
    Step6 -- "인증 불필요\n(/auth/login 등)" --> Step9
    Step7 -- "인증 실패" --> AuthFail([401 반환])
    Step7 -- "인증 성공" --> Step8
    Step8 -- "권한 없음" --> PermFail([403 반환])
    Step8 -- "권한 있음" --> Step9
    Step9 --> Step10
    Step10 -- "Circuit Open" --> CircuitFail([503 반환])
    Step10 -- "Circuit Closed" --> Step11
    Step11 --> SvcStep1
    SvcStep1 -- "검증 실패" --> ValidationFail([400 반환])
    SvcStep1 -- "검증 성공" --> SvcStep2
    SvcStep2 --> SvcStep3 --> SvcStep4 --> SvcStep5

    style AuthFail fill:#B71C1C,color:#fff
    style PermFail fill:#B71C1C,color:#fff
    style CircuitFail fill:#E65100,color:#fff
    style ValidationFail fill:#F57F17,color:#fff
```

### 3.2 데이터베이스 접근 패턴

모든 서비스는 Prisma ORM을 통해 PostgreSQL에 접근합니다. 직접 SQL 문자열 결합은 절대 금지입니다.

```typescript
// 실제 코드 위치: platform/services/auth-service/src/lib/prisma.ts

// ✅ 올바른 방법 — Prisma 매개변수화 쿼리 (CSAP D-12)
const user = await prisma.user.findUnique({
  where: {
    tenantId_email: {
      tenantId: tenant.id,  // 변수값, 내부에서 매개변수화됨
      email: email,         // 변수값, 내부에서 매개변수화됨
    }
  }
})

// ❌ 절대 금지 — SQL 직접 결합 (SQL 주입 취약점)
const user = await prisma.$queryRaw`
  SELECT * FROM users WHERE email = '${email}'
`  // 이렇게 하면 CSAP D-12 위반이며 AgentShield가 차단합니다
```

### 3.3 멀티테넌트 격리

모든 데이터베이스 쿼리에서 tenantId가 반드시 포함되어야 합니다.

```typescript
// ✅ 올바른 방법 — tenantId 격리
const users = await prisma.user.findMany({
  where: {
    tenantId: request.headers['x-user-tenant-id'],  // GW가 주입한 헤더
  }
})

// ❌ 절대 금지 — tenantId 없는 전체 조회 (다른 테넌트 데이터 노출)
const allUsers = await prisma.user.findMany()
```

---

## 4. 네임스페이스 구조 (k3s)

### 4.1 k8s 네임스페이스 분리

k3s 클러스터에서 서비스들은 역할에 따라 다른 네임스페이스에 배포됩니다.

```mermaid
graph TB
    subgraph "k3s 클러스터"
        subgraph "ns: saas-core (핵심 서비스)"
            api-gw[api-gateway\nDeployment]
            auth[auth-service\nDeployment]
            user[user-service\nDeployment]
            tenant[tenant-service\nDeployment]
        end

        subgraph "ns: saas-security (보안 서비스)"
            security[security-service\nDeployment]
            secmon[security-monitor-service\nDeployment]
            audit-d[audit-service\nDeployment]
            compliance[compliance-service\nDeployment]
        end

        subgraph "ns: saas-ai (AI 서비스)"
            ai[ai-service\nDeployment]
        end

        subgraph "ns: saas-data (데이터)"
            pg[(PostgreSQL\nStatefulSet)]
            redis[(Redis\nStatefulSet)]
        end

        subgraph "ns: monitoring (관측성)"
            prom[Prometheus]
            grafana[Grafana]
            loki[Loki]
            tempo[Tempo]
        end

        subgraph "ns: flux-system (GitOps)"
            flux-ctrl[Flux Controller\nGitRepository 감시]
        end
    end

    api-gw --> auth
    api-gw --> user
    api-gw --> tenant
    auth --> pg
    auth --> redis
    flux-ctrl -.->|"GitOps 동기화"| api-gw
    flux-ctrl -.->|"GitOps 동기화"| auth

    style flux-ctrl fill:#1565C0,color:#fff
    style ai fill:#4A148C,color:#fff
```

### 4.2 네트워크 정책 (Kyverno)

네임스페이스 간 통신은 Kyverno NetworkPolicy로 제한됩니다.

```yaml
# 예: saas-core에서 saas-data로만 DB 접근 허용
# 실제 파일 위치: platform/k8s/policies/network-policy.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-core-to-data
  namespace: saas-data
spec:
  podSelector: {}
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              name: saas-core  # saas-core 네임스페이스만 허용
```

이 정책 덕분에 외부에서 PostgreSQL에 직접 접근하는 것이 불가능합니다.

---

## 5. 공유 패키지 (Platform Packages) 구조

### 5.1 왜 공유 패키지를 사용하는가

17개 서비스가 모두 독자적으로 JWT 검증, 감사 로그, Rate Limiting을 구현하면 코드가 중복되고 보안 로직이 각각 달라질 위험이 있습니다. `platform/packages/` 에 있는 공유 패키지를 통해 한 번만 구현하고 모든 서비스에서 재사용합니다.

```mermaid
graph TB
    subgraph "platform/packages/ (공유 라이브러리)"
        RBAC["@public-saas/rbac\n역할 기반 접근 제어"]
        AUDIT["@public-saas/audit-sdk\n감사 로그 SDK"]
        AUTH["@public-saas/auth-sdk\nJWT 발급·검증"]
        OBS["@public-saas/observability\nOpenTelemetry 계측"]
        HEALTH["@public-saas/health\n헬스체크 플러그인"]
        CIRCUIT["@public-saas/circuit-breaker\n서킷 브레이커"]
        EVTBUS["@public-saas/event-bus\nRedis Pub/Sub"]
        TENISL["@public-saas/tenant-isolation\n테넌트 격리 유틸"]
        RATELIM["@public-saas/rate-limit\nRate Limit 미들웨어"]
        SECMGR["@public-saas/secret-manager\nVault 시크릿 관리"]
        MESHREADY["@public-saas/mesh-ready\nGraceful Shutdown"]
        CONFIG["@public-saas/config-vault\n중앙 설정 관리"]
    end

    subgraph "서비스들이 공유 패키지 사용"
        Auth["auth-service"] --> AUTH
        Auth --> AUDIT
        Auth --> SECMGR
        User["user-service"] --> RBAC
        User --> AUDIT
        User --> EVTBUS
        GW["api-gateway"] --> RATELIM
        GW --> HEALTH
        GW --> CIRCUIT
        GW --> MESHREADY
        GW --> CONFIG
        All["모든 서비스"] --> OBS
    end
```

### 5.2 주요 패키지 사용 방법

#### @public-saas/audit-sdk — 감사 로그

모든 중요 작업에 반드시 감사 로그를 남겨야 합니다 (CSAP D-06).

```typescript
// 실제 사용 위치 예: platform/services/auth-service/src/handlers/login.handler.ts
import { logAuthEvent } from '../lib/audit.js'
// 내부적으로 @public-saas/audit-sdk 사용

// 감사 로그 기록
await logAuthEvent('LOGIN_SUCCESS', user.id, tenant.id, ip, userAgent)
// 기록되는 내용: actor, action, target, timestamp, ip, result
```

#### @public-saas/rbac — 역할 기반 접근 제어

```typescript
// api-gateway에서 RBAC 플러그인 등록
// 실제 위치: platform/services/api-gateway/src/index.ts
await app.register(rbacPlugin, {
  auditLogger: (event) => {
    app.log.info({ rbacEvent: event }, 'RBAC 감사 로그')
  }
})

// 개별 라우트에서 권한 확인
app.get('/admin/users', {
  preHandler: [app.rbac.require('user:admin')]
}, handler)
```

#### @public-saas/observability — 분산 추적

```typescript
// 모든 서비스 진입점에서 OpenTelemetry 초기화
// 실제 위치: platform/services/api-gateway/src/index.ts
import { initTelemetry, shutdownTelemetry } from '@public-saas/observability'

initTelemetry({
  serviceName: 'api-gateway',
  serviceVersion: '0.2.0'
})
// 이후 모든 HTTP 요청이 자동으로 추적됩니다
// Grafana Tempo에서 분산 추적 확인 가능
```

---

## 다음 단계

시스템 전체 구조를 파악했습니다. 이제 개별 서비스를 더 자세히 알아봅니다.

**[다음: services/README.md — 17개 서비스 전체 목록]**

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|------|
| 1.0.0 | 2026-04-11 | 최초 작성 | Implementer (Sonnet) |
