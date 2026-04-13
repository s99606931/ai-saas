# API Gateway 패턴 완전 가이드

> 대상: 공공기관 SaaS 플랫폼 백엔드 개발자 및 인프라 담당자
> CSAP 준수: D-08-06 Rate Limiting, D-10 네트워크 보안
> 최종 수정: 2026-04-13

---

## 목차

1. [API Gateway란 무엇인가](#1-api-gateway란-무엇인가)
2. [API Gateway 아키텍처 다이어그램](#2-api-gateway-아키텍처-다이어그램)
3. [routes.ts 완전 분석 — Fastify 라우터 구조](#3-routests-완전-분석--fastify-라우터-구조)
4. [ai-rag.handler.ts 분석 — 요청 검증과 Rate Limiting](#4-ai-raghandlerts-분석--요청-검증과-rate-limiting)
5. [Traefik Middleware 체인 설계](#5-traefik-middleware-체인-설계)
6. [ForwardAuth 패턴 — JWT 검증 위임](#6-forwardauth-패턴--jwt-검증-위임)
7. [Rate Limiting 전략 — Redis Sliding Window](#7-rate-limiting-전략--redis-sliding-window)
8. [API 버전 관리 — URI 버전, Header 버전, Deprecation 정책](#8-api-버전-관리)
9. [Circuit Breaker at Gateway 레벨](#9-circuit-breaker-at-gateway-레벨)
10. [요청·응답 변환 — 헤더 주입과 응답 캐싱](#10-요청응답-변환--헤더-주입과-응답-캐싱)
11. [API Gateway 보안 — JWT, CORS, XSS 방지](#11-api-gateway-보안)
12. [API Gateway 모니터링 — 레이턴시 P99, 에러율](#12-api-gateway-모니터링)
13. [인증 실패 분기 플로우차트](#13-인증-실패-분기-플로우차트)

---

## 1. API Gateway란 무엇인가

### 1.1 API Gateway의 역할

API Gateway는 클라이언트와 백엔드 서비스 사이에 위치하는 역방향 프록시(Reverse Proxy)입니다. 단순히 요청을 전달하는 것이 아니라 다음 기능을 한 곳에서 수행합니다.

- **인증 및 인가**: 모든 요청의 JWT 토큰 검증, RBAC 정책 확인
- **Rate Limiting**: IP별, 테넌트별, 엔드포인트별 호출 횟수 제한
- **라우팅**: URL 경로에 따라 적절한 서비스로 전달
- **로드 밸런싱**: 여러 인스턴스에 트래픽 분산
- **SSL/TLS 종단**: HTTPS를 받아 내부 HTTP로 전달 (또는 mTLS로 재암호화)
- **보안 헤더 추가**: X-Content-Type-Options, X-Frame-Options 등
- **요청/응답 변환**: 헤더 추가/제거, 경로 변환
- **Circuit Breaker**: 다운스트림 서비스 장애 시 자동 차단

### 1.2 공공기관 SaaS에서 API Gateway의 특수 요건

공공기관 SaaS는 일반 SaaS보다 엄격한 요건이 있습니다.

**N2SF 데이터 등급 헤더 전달**: 모든 요청은 데이터 등급(O/C/S) 정보를 헤더에 포함해야 하며, 서비스는 이 헤더를 검증하여 C/S 등급 데이터의 AI API 전송을 차단해야 합니다.

**테넌트 격리 헤더**: `X-Tenant-ID` 헤더를 통해 각 요청이 어느 기관(테넌트)에서 왔는지 서비스에 전달합니다. 이 헤더는 Gateway에서 주입되므로 클라이언트가 위조할 수 없습니다.

**감사 로그 연계**: 모든 요청에 고유 요청 ID(`X-Request-ID`)를 부여하여 Gateway 로그와 서비스 로그를 연결합니다. CSAP D-06 감사 추적에 필수입니다.

**CSAP 접근 통제**: RBAC 정책에 따라 특정 역할만 특정 API를 호출할 수 있도록 Gateway 레벨에서 차단합니다.

### 1.3 Traefik이 선택된 이유

공공기관 SaaS에서 Nginx 대신 Traefik을 선택한 이유입니다.

| 항목 | Nginx | Traefik |
|---|---|---|
| 설정 방식 | 정적 파일 (재시작 필요) | 동적 (재시작 불필요) |
| Kubernetes 통합 | IngressController 별도 설치 | 내장 Kubernetes Provider |
| 미들웨어 | Lua 스크립트 필요 | 내장 미들웨어 체인 |
| ForwardAuth | 플러그인 필요 | 내장 기능 |
| Rate Limiting | Redis 모듈 별도 | 내장 (Redis 연동) |
| 서킷 브레이커 | 별도 구성 필요 | 내장 |
| 설정 복잡도 | 높음 | 낮음 |
| CNCF 지원 | 비공식 | 공식 |

---

## 2. API Gateway 아키텍처 다이어그램

### 2.1 전체 요청 흐름 다이어그램

```mermaid
graph LR
    subgraph 클라이언트["클라이언트 계층"]
        BROWSER["공무원 브라우저<br/>Next.js Portal"]
        MOBILE["모바일 앱<br/>(미래 계획)"]
        API_CLIENT["외부 API 클라이언트<br/>(정부 연동 시스템)"]
    end

    subgraph TRAEFIK_LAYER["Traefik API Gateway (포트 443)"]
        direction TB
        TLS["TLS 1.3 종단<br/>인증서: cert-manager"]
        ROUTER["라우터<br/>Host + PathPrefix 규칙"]

        subgraph MIDDLEWARE_CHAIN["미들웨어 체인 (순서 중요)"]
            M1["1. RateLimit<br/>IP/테넌트별 쿼터"]
            M2["2. ForwardAuth<br/>/auth/verify 위임"]
            M3["3. StripPrefix<br/>/api/v1 제거"]
            M4["4. Headers<br/>보안 헤더 주입"]
            M5["5. CircuitBreaker<br/>응답시간 5s 초과 차단"]
        end

        TLS --> ROUTER
        ROUTER --> M1 --> M2 --> M3 --> M4 --> M5
    end

    subgraph AUTH["인증 서비스"]
        AUTH_SVC["auth-service<br/>JWT 서명 검증<br/>RBAC 평가"]
        REDIS_SESSION["Redis Sentinel<br/>세션 블랙리스트<br/>Rate Limit 카운터"]
    end

    subgraph SERVICES["백엔드 서비스 (서비스 메시)"]
        AI["ai-service<br/>:3010<br/>Fastify"]
        SEC["security-service<br/>:3009"]
        COMP["compliance-service<br/>:3008"]
        MON["security-monitor<br/>:3011"]
        PORTAL["portal<br/>:3000<br/>Next.js"]
    end

    subgraph HEADERS_IN["Traefik → 서비스 주입 헤더"]
        direction TB
        H1["X-User-ID: uuid"]
        H2["X-Tenant-ID: uuid"]
        H3["X-User-Role: admin|user|viewer"]
        H4["X-Request-ID: uuid v4"]
        H5["X-Forwarded-For: 원본 IP"]
    end

    BROWSER -->|"HTTPS"| TLS
    MOBILE -->|"HTTPS"| TLS
    API_CLIENT -->|"mTLS + API Key"| TLS

    M2 -->|"GET /auth/verify\nAuthorization: Bearer {token}"| AUTH_SVC
    AUTH_SVC <-->|"세션 조회/블랙리스트"| REDIS_SESSION
    AUTH_SVC -->|"200 + X-User-ID, X-Tenant-ID\n또는 401 Unauthorized"| M2

    M5 -->|"라우팅 + 헤더 주입"| SERVICES

    HEADERS_IN -.->|"서비스로 전달"| SERVICES

    classDef gateway fill:#fff3cd,stroke:#856404
    classDef auth fill:#d4edda,stroke:#155724
    classDef service fill:#cce5ff,stroke:#004085
    classDef client fill:#f8d7da,stroke:#721c24

    class TLS,ROUTER,M1,M2,M3,M4,M5 gateway
    class AUTH_SVC,REDIS_SESSION auth
    class AI,SEC,COMP,MON,PORTAL service
    class BROWSER,MOBILE,API_CLIENT client
```

### 2.2 미들웨어 체인 순서의 중요성

미들웨어는 **순서가 중요**합니다. 잘못된 순서는 보안 취약점 또는 성능 문제를 야기합니다.

**왜 RateLimit이 ForwardAuth보다 먼저인가?**
ForwardAuth는 auth-service를 호출하는 네트워크 I/O가 발생합니다. Rate Limit을 먼저 체크하지 않으면 DDoS 공격 시 auth-service에 과부하가 걸립니다. Rate Limit으로 과도한 요청을 먼저 걸러내고, 정상 요청만 인증합니다.

**왜 StripPrefix가 ForwardAuth 이후인가?**
ForwardAuth는 원본 경로(`/api/v1/ai/chat`)를 auth-service에 전달하여 경로 기반 RBAC을 수행합니다. 경로를 먼저 제거하면 auth-service가 어떤 리소스에 접근하려는지 알 수 없게 됩니다.

**왜 Headers가 CircuitBreaker 이전인가?**
CircuitBreaker가 요청을 차단할 때도 보안 헤더는 응답에 포함되어야 합니다. 헤더를 Circuit Breaker 이전에 설정하면 차단 응답에도 헤더가 포함됩니다.

---

## 3. routes.ts 완전 분석 — Fastify 라우터 구조

### 3.1 routes.ts 파일 개요

`/data/ai-saas/platform/services/ai-service/src/routes.ts`는 ai-service의 모든 HTTP 엔드포인트를 등록하는 핵심 파일입니다. 총 776줄이며 다음 구조를 가집니다.

```
registerRoutes(app: FastifyInstance)
  ├── 내부 서비스 키 검증 훅 (onRequest)
  ├── Rate Limiter 초기화 (7종)
  ├── OpenAPI JSON Schema 공통 정의
  ├── 모델 관리 API (GET/POST/PUT /ai/models)
  ├── 채팅 API (POST /ai/chat, /ai/chat/stream)
  ├── 임베딩 API (POST /ai/embed)
  ├── 사용량/비용 API (GET /ai/usage, /ai/cost)
  ├── 분석 API (GET /ai/analytics/*)
  ├── 제공자 관리 API (GET /ai/provider/*)
  ├── RAG API (POST /ai/rag/ingest, /ai/rag/query, /ai/rag/query/advanced)
  ├── 에이전트 API (POST /ai/agent, /ai/agent/advanced)
  ├── 구조화 출력 API (POST /ai/structured)
  ├── Function Calling API (POST /ai/function-call)
  ├── 문서 분석 API (POST /ai/document/analyze, /ai/document/compare)
  ├── 워크플로우 API (POST /ai/workflow)
  ├── 에이전트 마켓플레이스 API (5개)
  ├── 공공 AI API (5개)
  ├── ESG/거버넌스 AI API (4개)
  ├── 보안 AI API (3개)
  └── 데이터 플랫폼 AI API (3개)
```

### 3.2 내부 서비스 키 검증 훅 — Zero Trust 구현

```typescript
// Design Ref: C-03 수정 (CSAP D-08): 서비스 간 내부 인증 — API 게이트웨이 우회 차단
const internalKey = process.env['INTERNAL_SERVICE_KEY'];
if (!internalKey && process.env['NODE_ENV'] === 'production') {
  throw new Error('[SECURITY] INTERNAL_SERVICE_KEY 환경변수가 설정되지 않았습니다. 서비스를 시작할 수 없습니다.');
}
if (internalKey) {
  app.addHook('onRequest', async (request, reply) => {
    if (request.url === '/health' || request.url === '/ready') return;
    const provided = request.headers['x-internal-service-key'];
    if (provided !== internalKey) {
      await reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: '내부 서비스 인증 실패' },
      });
    }
  });
}
```

**이 코드가 하는 일을 단계별로 설명합니다.**

1단계: `INTERNAL_SERVICE_KEY` 환경 변수를 읽습니다. 이 키는 Kubernetes Secret에서 주입됩니다. 절대 소스 코드에 하드코딩하면 안 됩니다.

2단계: 운영 환경(`NODE_ENV=production`)에서 키가 없으면 서비스 시작 자체를 거부합니다. "설정 오류가 있어도 일단 실행"하는 것보다 명시적으로 실패하는 것이 훨씬 안전합니다.

3단계: 모든 요청(헬스체크 제외)에 `x-internal-service-key` 헤더를 요구합니다.

**왜 이것이 중요한가?** ai-service는 Traefik을 통해서만 접근되어야 합니다. 하지만 Kubernetes 내부에서 직접 서비스를 호출하는 것은 NetworkPolicy로만 막으면 한계가 있습니다. 이 코드는 "Traefik이 요청에 내부 키를 심어서 전달한다"는 추가 검증층을 만들어, 설령 누군가 NetworkPolicy를 우회하더라도 내부 키 없이는 AI 서비스를 호출할 수 없게 합니다.

### 3.3 Rate Limiter 초기화 패턴 분석

```typescript
// CSAP D-08-06: Rate Limiting
const readLimiter   = createRateLimiter(100, 60, 'rl:ai:read');
const writeLimiter  = createRateLimiter(20,  60, 'rl:ai:write');
const chatLimiter   = createRateLimiter(10,  60, 'rl:ai:chat');
const embedLimiter  = createRateLimiter(30,  60, 'rl:ai:embed');
const ragLimiter    = createRateLimiter(20,  60, 'rl:ai:rag');
const agentLimiter  = createRateLimiter(5,   60, 'rl:ai:agent');
const workflowLimiter = createRateLimiter(10, 60, 'rl:ai:workflow');
```

`createRateLimiter(limit, windowSeconds, keyPrefix)` 함수는 Rate Limiter를 생성합니다.

| 리미터 | 분당 호출 한도 | Redis 키 접두사 | 이유 |
|---|---|---|---|
| readLimiter | 100회 | `rl:ai:read` | 읽기 전용, 부하 낮음 |
| writeLimiter | 20회 | `rl:ai:write` | 쓰기 작업, 부하 중간 |
| chatLimiter | 10회 | `rl:ai:chat` | LLM 추론 비용 높음 |
| embedLimiter | 30회 | `rl:ai:embed` | 임베딩은 채팅보다 저렴 |
| ragLimiter | 20회 | `rl:ai:rag` | DB 조회 + LLM 복합 |
| agentLimiter | 5회 | `rl:ai:agent` | **에이전트는 비용이 가장 높아 가장 엄격** |
| workflowLimiter | 10회 | `rl:ai:workflow` | 멀티스텝 처리 비용 |

특히 `agentLimiter`의 한도가 분당 5회로 가장 낮은 것에 주목하세요. 코드 주석에도 `// 에이전트는 비용이 높아 제한`이라고 명시되어 있습니다. ReAct 패턴 에이전트는 한 번의 요청에 최대 10번의 LLM 추론을 수행하므로, 분당 5회만 허용해도 실질적으로 분당 50회의 LLM 호출이 발생할 수 있습니다.

### 3.4 OpenAPI 스키마 공통 정의 분석

```typescript
const modelResponse = {
  type: 'object' as const,
  properties: {
    success: { type: 'boolean' as const },
    data: { type: 'object' as const },
  },
};
const listResponse = {
  type: 'object' as const,
  properties: {
    success: { type: 'boolean' as const },
    data: { type: 'array' as const, items: { type: 'object' as const } },
  },
};
const errorResponse = {
  type: 'object' as const,
  properties: {
    success: { type: 'boolean' as const },
    error: { type: 'object' as const },
  },
};
```

세 가지 공통 응답 스키마를 정의합니다. 이 패턴의 장점은 다음과 같습니다.

첫째, **일관성**: 모든 API 응답이 `{ success: boolean, data/error: ... }` 형식을 따릅니다. 클라이언트는 `success` 필드를 먼저 확인하여 성공/실패를 판단합니다.

둘째, **Swagger UI 자동 생성**: Fastify의 Swagger 플러그인이 이 스키마를 읽어 API 문서를 자동 생성합니다. 개발자가 별도 문서를 작성하지 않아도 됩니다.

셋째, **입력 검증 자동화**: Fastify는 요청 body가 스키마를 벗어나면 자동으로 400 응답을 반환합니다. 서비스 코드에서 별도 검증 없이도 기본 입력 검증이 됩니다.

### 3.5 N2SF 데이터 등급 강제 — grade 필드 분석

```typescript
// POST /ai/chat 요청 스키마
body: {
  type: 'object' as const,
  required: ['modelId', 'tenantId', 'message', 'grade'] as const,
  properties: {
    // ...
    grade: { type: 'string' as const, enum: ['O'] },
  },
},
```

`grade` 필드가 `enum: ['O']`로 고정되어 있는 것에 주목하세요. 현재는 O등급(공개 데이터)만 AI API 호출이 허용됩니다. C등급(비밀) 또는 S등급(민감)을 입력하면 Fastify가 자동으로 400 에러를 반환합니다.

이것은 스키마 레벨의 첫 번째 방어선입니다. 두 번째 방어선은 핸들러 내부의 `validateDataGrade()` 함수 호출입니다. 중첩 방어로 N2SF 위반을 완벽히 차단합니다.

### 3.6 preHandler를 이용한 Rate Limiter 적용

```typescript
app.post(
  '/ai/agent',
  {
    schema: { /* ... */ },
    preHandler: agentLimiter,  // ← Rate Limiter 적용
  },
  agentHandler as never,
);
```

Fastify의 `preHandler` 훅은 실제 핸들러 실행 전에 호출됩니다. `agentLimiter`는 Redis Sliding Window 알고리즘으로 호출 횟수를 확인하고, 한도 초과 시 `429 Too Many Requests` 응답을 반환합니다. 핸들러 코드는 Rate Limit 로직을 전혀 알지 못합니다.

---

## 4. ai-rag.handler.ts 분석 — 요청 검증과 Rate Limiting

### 4.1 핸들러 파일 구조

`/data/ai-saas/platform/services/ai-service/src/handlers/ai-rag.handler.ts`는 RAG(Retrieval-Augmented Generation) 관련 3개 엔드포인트를 담당합니다.

- `POST /ai/rag/ingest` — `ragIngestHandler`
- `POST /ai/rag/query` — `ragQueryHandler`
- `POST /ai/rag/query/advanced` — `ragAdvancedQueryHandler`

### 4.2 Zod 스키마 검증 패턴 — CSAP D-12 구현

```typescript
const ingestSchema = z.object({
  tenantId: z.string().uuid(),          // UUID 형식 강제
  grade: z.enum(['O']),                 // N2SF: O등급만 허용
  title: z.string().min(1).max(200),    // 길이 제한
  content: z.string().min(1).max(500_000), // 최대 50만자
  sourceUrl: z.string().url().optional(),  // URI 형식 검증
  metadata: z.record(z.unknown()).optional(),
  embedModelId: z.string().optional(),
});
```

각 필드의 제약 조건을 설명합니다.

`tenantId: z.string().uuid()` — UUID 형식이 아닌 입력은 즉시 거부됩니다. SQL 주입 방지의 첫 번째 방어선입니다. UUID는 정규 표현식으로 검증되므로 특수 문자 주입이 불가능합니다.

`grade: z.enum(['O'])` — N2SF 데이터 등급 강제. 'C' 또는 'S'를 입력하면 Zod가 자동으로 ValidationError를 발생시킵니다.

`content: z.string().min(1).max(500_000)` — 최대 50만자 제한. 무제한 입력을 허용하면 메모리 고갈 공격(DoS)이 가능합니다. 50만자(약 500KB)는 일반적인 공공문서 전체를 처리하기에 충분하면서 시스템에 과부하를 주지 않는 적절한 한도입니다.

`sourceUrl: z.string().url().optional()` — URI 형식 검증. 임의의 문자열이 URL 필드에 들어오는 것을 방지합니다.

### 4.3 N2SF 등급 검증 — 이중 방어

```typescript
export async function ragIngestHandler(
  request: FastifyRequest<{ Body: IngestBody }>,
  reply: FastifyReply,
): Promise<void> {
  const body = ingestSchema.parse(request.body);  // 1차 검증: Zod 스키마
  const actor = (request.headers['x-user-id'] as string) || 'system';

  // N2SF N-05: C/S등급 차단 (2차 검증)
  try {
    validateDataGrade(body.grade as DataGrade);
  } catch (error) {
    if (error instanceof DataGradeViolationError) {
      await logAiEvent('AI_GRADE_VIOLATION', actor, 'rag', body.tenantId,
        request.ip, request.headers['user-agent'] ?? 'unknown',
        { grade: body.grade, blocked: true, endpoint: 'rag/ingest' });
      await reply.status(403).send({
        success: false,
        error: { code: error.code, message: error.message }
      });
      return;
    }
    throw error;
  }
```

등급 검증 실패 시 단순히 403을 반환하는 것이 아니라 **감사 로그를 먼저 기록**합니다. 이 순서가 중요합니다. 감사 로그 기록 실패 시 에러가 발생해도 catch로 처리되지 않으므로, 로그 기록 자체가 선행되어야 합니다. N2SF 위반 시도를 모두 추적할 수 있어야 합니다.

`logAiEvent`에 전달되는 `{ grade: body.grade, blocked: true, endpoint: 'rag/ingest' }`는 어느 엔드포인트에서, 어떤 등급 데이터를, 누가 보내려 했는지 기록합니다. 보안 감사 시 이 로그로 N2SF 위반 패턴을 분석할 수 있습니다.

### 4.4 RAG 파이프라인 전체 흐름

```typescript
// 1. 문서 레코드 생성 (upsert: title+tenantId 기준)
const existing = await db['aiKnowledgeDocument']?.findFirst({
  where: { tenantId: body.tenantId, title: body.title },
}).catch(() => null);

if (existing) {
  document = await db['aiKnowledgeDocument'].update({ /* ... */ });
} else {
  document = await db['aiKnowledgeDocument'].create({
    data: {
      tenantId: body.tenantId,
      title: maskPII(body.title),  // ← PII 마스킹
      // ...
    },
  });
}

// 2. 텍스트 청킹 (512토큰, 50토큰 오버랩)
const chunks = chunkText(body.content, 512, 50);

// 3. 임베딩 생성 (배치 병렬 처리)
const chunksWithEmbeddings = await Promise.all(
  chunks.map(async (chunk) => {
    const embedding = await generateEmbedding(chunk.content, body.embedModelId);
    return { ...chunk, embedding };
  }),
);

// 4. 벡터 저장소에 저장
await storeChunks(body.tenantId, documentId, chunksWithEmbeddings);
```

`maskPII(body.title)` 호출에 주목하세요. 문서 제목에 개인정보(이름, 주민등록번호 등)가 포함될 수 있으므로 DB에 저장 전 PII를 마스킹합니다. `content` 자체는 마스킹하지 않는데, 이는 검색 시 정확한 내용이 필요하기 때문입니다. 대신 content는 O등급 데이터만 허용하는 정책으로 PII가 포함된 C/S등급 데이터를 원천 차단합니다.

### 4.5 Rate Limiting 키 네이밍 전략

Rate Limiter의 Redis 키는 `{접두사}:{사용자/테넌트 식별자}` 형식입니다.

```
rl:ai:chat:user:{userId}        → 사용자별 채팅 Rate Limit
rl:ai:chat:tenant:{tenantId}    → 테넌트별 채팅 Rate Limit
rl:ai:agent:user:{userId}       → 사용자별 에이전트 Rate Limit
rl:ai:rag:tenant:{tenantId}     → 테넌트별 RAG Rate Limit
```

이 네이밍 전략의 장점입니다.

`SCAN rl:ai:chat:*` — 모든 채팅 Rate Limit 키 조회 가능
`DEL rl:ai:*:tenant:{tenantId}` — 특정 테넌트의 Rate Limit 리셋 (긴급 시)
`TTL rl:ai:agent:user:{userId}` — 특정 사용자의 Rate Limit 만료 시간 확인

---

## 5. Traefik Middleware 체인 설계

### 5.1 Traefik 설치 — k3s 환경

```yaml
# traefik-values.yaml (Helm 설치)
globalArguments:
  - "--global.checknewversion=false"
  - "--global.sendanonymoususage=false"

additionalArguments:
  - "--entrypoints.websecure.http.tls=true"
  - "--entrypoints.websecure.http.tls.options=modern@file"
  - "--providers.kubernetesingress.allowexternalnameservices=true"
  - "--serversTransport.insecureSkipVerify=false"  # 내부 TLS 검증

ports:
  web:
    port: 80
    redirectTo: websecure  # HTTP → HTTPS 리다이렉션
  websecure:
    port: 443
    tls:
      enabled: true

tlsOptions:
  modern:
    minVersion: VersionTLS13  # TLS 1.3 최소 버전 강제 (CSAP D-09)
    cipherSuites:
      - TLS_AES_128_GCM_SHA256
      - TLS_AES_256_GCM_SHA384
      - TLS_CHACHA20_POLY1305_SHA256
```

### 5.2 IngressRoute — AI 서비스 라우팅 설정

```yaml
# ai-service-ingressroute.yaml
apiVersion: traefik.io/v1alpha1
kind: IngressRoute
metadata:
  name: ai-service-route
  namespace: default
  annotations:
    csap-control: "D-08, D-10"
spec:
  entryPoints:
    - websecure
  routes:
    - match: "Host(`api.saas.go.kr`) && PathPrefix(`/api/v1/ai`)"
      kind: Rule
      middlewares:
        - name: ai-rate-limit      # 1. Rate Limiting
        - name: forward-auth        # 2. JWT 검증
        - name: strip-api-prefix   # 3. 경로 변환
        - name: security-headers    # 4. 보안 헤더
        - name: ai-circuit-breaker # 5. 서킷 브레이커
      services:
        - name: ai-service
          port: 3010
  tls:
    secretName: api-saas-go-kr-tls
    options:
      name: modern
```

### 5.3 미들웨어 정의 — 4가지 핵심 미들웨어

**미들웨어 1: Rate Limiting**

```yaml
apiVersion: traefik.io/v1alpha1
kind: Middleware
metadata:
  name: ai-rate-limit
  namespace: default
  annotations:
    csap-control: "D-08-06"
    description: "AI 서비스 Rate Limiting — IP별 + 글로벌 쿼터"
spec:
  rateLimit:
    average: 100          # 초당 평균 100 요청
    burst: 50             # 버스트 허용 50 요청
    period: 1m            # 1분 기준
    sourceCriterion:
      requestHeaderName: X-Tenant-ID  # 테넌트 ID 기준 (IP보다 정확)
```

`sourceCriterion.requestHeaderName: X-Tenant-ID`는 IP 기반 Rate Limiting의 한계를 보완합니다. NAT 뒤에 있는 기관에서는 다수의 사용자가 같은 IP를 공유하므로, IP 기반 Rate Limiting은 기관 전체를 제한할 수 있습니다. 테넌트 ID 기반으로 기관별 독립적인 쿼터를 부여합니다.

**미들웨어 2: ForwardAuth**

```yaml
apiVersion: traefik.io/v1alpha1
kind: Middleware
metadata:
  name: forward-auth
  namespace: default
  annotations:
    csap-control: "D-08-01, D-08-03"
    description: "JWT 검증 + RBAC 정책 위임 — auth-service"
spec:
  forwardAuth:
    address: "http://auth-service.default.svc.cluster.local:3001/auth/verify"
    trustForwardHeader: true
    authResponseHeaders:
      - "X-User-ID"      # auth-service가 헤더로 반환하면 Traefik이 백엔드로 전달
      - "X-Tenant-ID"
      - "X-User-Role"
      - "X-Permissions"
    authRequestHeaders:
      - "Authorization"  # auth-service에 전달할 요청 헤더
      - "X-Original-URL"
      - "X-Forwarded-For"
```

**미들웨어 3: StripPrefix**

```yaml
apiVersion: traefik.io/v1alpha1
kind: Middleware
metadata:
  name: strip-api-prefix
  namespace: default
spec:
  stripPrefix:
    prefixes:
      - "/api/v1"    # 외부: /api/v1/ai/chat → 내부: /ai/chat
    forceSlash: false
```

**미들웨어 4: 보안 헤더**

```yaml
apiVersion: traefik.io/v1alpha1
kind: Middleware
metadata:
  name: security-headers
  namespace: default
  annotations:
    csap-control: "D-10, D-12"
    description: "OWASP 권장 보안 헤더 일괄 적용"
spec:
  headers:
    # XSS 방지
    browserXssFilter: true
    contentTypeNosniff: true
    # 클릭재킹 방지
    frameDeny: true
    customFrameOptionsValue: "DENY"
    # HSTS (TLS 강제)
    forceSTSHeader: true
    stsSeconds: 31536000      # 1년
    stsIncludeSubdomains: true
    stsPreload: true
    # CSP (스크립트 주입 방지)
    contentSecurityPolicy: >
      default-src 'self';
      script-src 'self' 'nonce-{nonce}';
      style-src 'self' 'unsafe-inline';
      img-src 'self' data: https:;
      connect-src 'self';
      frame-ancestors 'none'
    # 기타 보안 헤더
    referrerPolicy: "strict-origin-when-cross-origin"
    permissionsPolicy: "camera=(), microphone=(), geolocation=()"
    # 커스텀 헤더 추가
    customResponseHeaders:
      X-Request-ID: ""  # 빈 값 → Traefik이 자동 생성
      Server: ""        # 서버 정보 숨김
```

---

## 6. ForwardAuth 패턴 — JWT 검증 위임

### 6.1 ForwardAuth 동작 원리

ForwardAuth는 다음 순서로 동작합니다.

```
1. 클라이언트 → Traefik: POST /api/v1/ai/chat
   헤더: Authorization: Bearer eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9...

2. Traefik → auth-service: GET /auth/verify
   헤더: Authorization: Bearer eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9...
         X-Original-URL: /api/v1/ai/chat
         X-Forwarded-For: 211.xxx.xxx.xxx

3a. 인증 성공 시: auth-service → Traefik: 200 OK
    응답 헤더: X-User-ID: user-uuid
              X-Tenant-ID: tenant-uuid
              X-User-Role: user
              X-Permissions: ai:chat,ai:read

3b. 인증 실패 시: auth-service → Traefik: 401 Unauthorized
    응답 body: { "error": "TOKEN_EXPIRED" }

4a. 인증 성공: Traefik → ai-service: POST /ai/chat
    헤더: X-User-ID: user-uuid (auth-service에서 받은 헤더 주입)
          X-Tenant-ID: tenant-uuid
          X-User-Role: user
          Authorization: [제거됨 — 내부 서비스에 JWT 전달 불필요]

4b. 인증 실패: Traefik → 클라이언트: 401 Unauthorized
    (ai-service는 전혀 호출되지 않음)
```

### 6.2 auth-service 검증 로직 예시

```typescript
// auth-service/src/handlers/verify.handler.ts
// Design Ref: CSAP D-08-01, D-08-03

import { z } from 'zod';
import { verifyJwt } from '../lib/jwt.js';
import { hasPermission } from '../lib/rbac.js';
import { isTokenBlacklisted } from '../lib/session.js';

export async function verifyHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const authHeader = request.headers.authorization;
  const originalUrl = request.headers['x-original-url'] as string;

  // 토큰 추출
  if (!authHeader?.startsWith('Bearer ')) {
    await reply.status(401).send({ error: 'TOKEN_MISSING' });
    return;
  }

  const token = authHeader.slice(7);

  try {
    // JWT 서명 검증 (ES256 알고리즘, 공개키로 검증)
    const payload = await verifyJwt(token);

    // 토큰 블랙리스트 확인 (로그아웃된 토큰 차단)
    const blacklisted = await isTokenBlacklisted(payload.jti);
    if (blacklisted) {
      await reply.status(401).send({ error: 'TOKEN_REVOKED' });
      return;
    }

    // 경로 기반 RBAC 검사
    const resource = extractResource(originalUrl);  // '/ai/chat' → 'ai:chat'
    if (!hasPermission(payload.role, resource)) {
      await reply.status(403).send({ error: 'INSUFFICIENT_PERMISSION' });
      return;
    }

    // 인증 성공 — 사용자 정보를 헤더로 반환 (Traefik이 백엔드에 주입)
    reply.header('X-User-ID', payload.sub);
    reply.header('X-Tenant-ID', payload.tenantId);
    reply.header('X-User-Role', payload.role);
    await reply.status(200).send();

  } catch (error) {
    if (error instanceof TokenExpiredError) {
      await reply.status(401).send({ error: 'TOKEN_EXPIRED' });
    } else if (error instanceof InvalidTokenError) {
      await reply.status(401).send({ error: 'TOKEN_INVALID' });
    } else {
      // 내부 오류 — 민감 정보 노출 금지 (CSAP D-12)
      request.log.error(error, 'JWT 검증 내부 오류');
      await reply.status(500).send({ error: 'AUTH_SERVICE_ERROR' });
    }
  }
}
```

### 6.3 ForwardAuth 성능 최적화

ForwardAuth는 모든 요청에 auth-service 호출을 추가합니다. 이는 지연 시간을 증가시킵니다.

**최적화 전략 1: 캐싱**

auth-service는 검증 결과를 Redis에 캐싱합니다.

```typescript
// JWT를 Redis에 캐싱 (토큰 만료 시간만큼)
const cacheKey = `auth:verified:${payload.jti}`;
const cached = await redis.get(cacheKey);
if (cached) {
  // 캐시 히트 — auth-service DB 조회 불필요
  const cachedPayload = JSON.parse(cached);
  reply.header('X-User-ID', cachedPayload.sub);
  // ...
  return;
}

// 캐시 미스 — 검증 후 캐싱
await redis.setex(cacheKey, 60, JSON.stringify(payload));  // 60초 캐싱
```

**최적화 전략 2: 경량 auth-service**

auth-service는 JWT 라이브러리 외에 불필요한 기능 없이 최대한 가볍게 유지합니다. 응답 목표: P99 < 5ms

**최적화 전략 3: 동일 노드 배치**

Kubernetes Pod Affinity를 설정하여 auth-service가 Traefik과 같은 노드에서 실행되도록 합니다. 네트워크 홉을 줄여 지연을 최소화합니다.

---

## 7. Rate Limiting 전략 — Redis Sliding Window

### 7.1 Sliding Window 알고리즘

Redis Sliding Window는 다음 방식으로 동작합니다.

```
시간: ──────────────────────────────────────────────────────▶
                              [1분 슬라이딩 윈도우]
                              ◄──────────────────────────────
  요청:   ●   ●   ●   ● ● ●   ● ●   ●   ●   ●   NEW_REQUEST
  타임스탬프: t1  t2  t3  t4 t5 t6  t7  t8  t9  t10 t11

현재 시각 기준 1분 이전의 요청 제거:
  만약 1분 기준으로 t1~t6이 범위 밖이면 제거
  남은 요청 수 = 5 < 한도(10) → 허용
```

Sliding Window는 Fixed Window(정해진 창)보다 정확합니다. Fixed Window에서는 창의 경계 부분에서 2배 버스트가 가능한 취약점이 있습니다.

### 7.2 Redis Sliding Window 구현

`@public-saas/rate-limit` 패키지 내부 구현입니다.

```typescript
// packages/rate-limit/src/index.ts
import { createClient } from 'redis';

export function createRateLimiter(
  limit: number,
  windowSeconds: number,
  keyPrefix: string,
) {
  const redis = createClient({ url: process.env.REDIS_URL });

  return async function rateLimiterMiddleware(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    // Rate Limit 키: 접두사 + 테넌트 ID + 사용자 ID
    const tenantId = request.headers['x-tenant-id'] as string || 'unknown';
    const userId = request.headers['x-user-id'] as string || request.ip;
    const key = `${keyPrefix}:${tenantId}:${userId}`;

    const now = Date.now();
    const windowStart = now - windowSeconds * 1000;

    // Redis 트랜잭션: 원자적 실행
    const pipeline = redis.multi();
    pipeline.zRemRangeByScore(key, 0, windowStart);    // 오래된 요청 제거
    pipeline.zCard(key);                                // 현재 요청 수 조회
    pipeline.zAdd(key, [{ score: now, value: String(now) }]); // 현재 요청 추가
    pipeline.expire(key, windowSeconds * 2);            // TTL 갱신

    const results = await pipeline.exec();
    const currentCount = results[1] as number;

    // Rate Limit 헤더 설정 (클라이언트에게 현황 제공)
    reply.header('X-RateLimit-Limit', limit);
    reply.header('X-RateLimit-Remaining', Math.max(0, limit - currentCount - 1));
    reply.header('X-RateLimit-Reset', Math.floor((now + windowSeconds * 1000) / 1000));

    if (currentCount >= limit) {
      reply.header('Retry-After', windowSeconds);
      await reply.status(429).send({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: `분당 요청 한도(${limit}회) 초과. ${windowSeconds}초 후 재시도하십시오.`,
        },
      });
    }
  };
}
```

### 7.3 Rate Limiting 정책 테이블

공공기관 SaaS 전체 Rate Limiting 정책입니다.

| 레벨 | 대상 | 한도 | 기준 | 초과 시 |
|---|---|---|---|---|
| Gateway | 전체 트래픽 | 1000 req/min | 테넌트 | 503 |
| Gateway | 단일 IP | 200 req/min | IP | 429 |
| 서비스 | 채팅 API | 10 req/min | 사용자 | 429 |
| 서비스 | 에이전트 API | 5 req/min | 사용자 | 429 |
| 서비스 | RAG 수집 | 20 req/min | 테넌트 | 429 |
| 서비스 | 문서 분석 | 20 req/min | 테넌트 | 429 |
| 서비스 | 임베딩 | 30 req/min | 사용자 | 429 |
| 서비스 | 읽기 전용 | 100 req/min | 사용자 | 429 |

### 7.4 Rate Limit 쿼터 관리 API

관리자가 특정 테넌트의 Rate Limit을 조정하는 API입니다.

```typescript
// 특정 테넌트의 Rate Limit 임시 상향
// POST /admin/rate-limit/override
await redis.setex(
  `rl:override:${tenantId}`,
  3600,  // 1시간
  JSON.stringify({ limit: 1000, reason: '월말 대량 처리 허가' })
);

// Rate Limit 긴급 리셋 (테넌트 전체)
const keys = await redis.keys(`rl:ai:*:${tenantId}:*`);
if (keys.length > 0) {
  await redis.del(keys);
}
```

---

## 8. API 버전 관리

### 8.1 URI 버전 관리 — /v1, /v2 구분

공공기관 SaaS는 URI 경로에 버전을 포함하는 방식을 사용합니다.

```
외부 URL: https://api.saas.go.kr/api/v1/ai/chat
                              ── v1 ──
내부 URL (StripPrefix 후): /ai/chat

외부 URL v2: https://api.saas.go.kr/api/v2/ai/chat
내부 URL: /ai/v2/chat (별도 서비스 또는 라우트 핸들러)
```

URI 버전의 장점과 단점입니다.

장점: URL만 보고 버전을 알 수 있어 디버깅이 쉽습니다. 브라우저 즐겨찾기, 로그 분석이 직관적입니다.

단점: URL이 길어집니다. 버전 이동 시 URL 변경 필요합니다.

### 8.2 Traefik 멀티 버전 라우팅

```yaml
# v1과 v2를 동시에 운영하는 IngressRoute
apiVersion: traefik.io/v1alpha1
kind: IngressRoute
metadata:
  name: ai-service-multi-version
  namespace: default
spec:
  entryPoints:
    - websecure
  routes:
    # v1 — 기존 ai-service
    - match: "Host(`api.saas.go.kr`) && PathPrefix(`/api/v1/ai`)"
      kind: Rule
      middlewares:
        - name: strip-v1-prefix
        - name: forward-auth
        - name: security-headers
      services:
        - name: ai-service
          port: 3010

    # v2 — 신규 ai-service-v2 (Canary 배포)
    - match: "Host(`api.saas.go.kr`) && PathPrefix(`/api/v2/ai`)"
      kind: Rule
      middlewares:
        - name: strip-v2-prefix
        - name: forward-auth
        - name: security-headers
      services:
        - name: ai-service-v2
          port: 3020
---
apiVersion: traefik.io/v1alpha1
kind: Middleware
metadata:
  name: strip-v1-prefix
spec:
  stripPrefix:
    prefixes:
      - "/api/v1"
---
apiVersion: traefik.io/v1alpha1
kind: Middleware
metadata:
  name: strip-v2-prefix
spec:
  stripPrefix:
    prefixes:
      - "/api/v2"
```

### 8.3 Deprecation 정책

API 버전을 폐기할 때는 다음 절차를 따릅니다.

**단계 1: Deprecation 경고 헤더 추가 (폐기 6개월 전)**

```typescript
// routes.ts에 Deprecation 미들웨어 추가
app.addHook('onSend', async (request, reply) => {
  if (request.url.startsWith('/ai/old-endpoint')) {
    reply.header(
      'Deprecation',
      'Sun, 01 Oct 2026 00:00:00 GMT'
    );
    reply.header(
      'Sunset',
      'Sun, 01 Oct 2026 00:00:00 GMT'
    );
    reply.header(
      'Link',
      '</api/v2/ai/new-endpoint>; rel="successor-version"'
    );
  }
});
```

**단계 2: 호출 빈도 모니터링 (폐기 3개월 전)**

Grafana에서 deprecated API 호출 빈도를 모니터링합니다. 아직 호출하는 클라이언트가 있으면 해당 기관에 개별 통보합니다.

**단계 3: 응답 코드 변경 (폐기 1개월 전)**

```typescript
// 폐기된 엔드포인트: 410 Gone 반환
app.post('/ai/old-endpoint', {}, async (request, reply) => {
  await reply.status(410).send({
    success: false,
    error: {
      code: 'API_DEPRECATED',
      message: '이 API는 2026-10-01에 폐기되었습니다.',
      successor: '/api/v2/ai/new-endpoint',
    },
  });
});
```

**단계 4: 완전 제거 (폐기일 이후)**

라우트 등록 코드 삭제, CHANGELOG에 기록, Traefik IngressRoute에서 제거합니다.

---

## 9. Circuit Breaker at Gateway 레벨

### 9.1 Circuit Breaker란

Circuit Breaker는 전기 회로 차단기에서 이름을 따온 패턴입니다. 다운스트림 서비스(ai-service)가 느려지거나 오류를 반환할 때, Gateway가 더 이상 요청을 보내지 않고 즉시 에러를 반환합니다. 이를 통해 장애가 전체 시스템으로 확산되는 것을 막습니다.

```
상태 전환:
[Closed: 정상] ──── 에러율 50% 초과 ────▶ [Open: 차단]
     ▲                                        │
     │              대기 30초 후              │
     └───── 일부 요청 성공 ────── [Half-Open: 탐색] ◀┘
```

### 9.2 Traefik CircuitBreaker 미들웨어

```yaml
apiVersion: traefik.io/v1alpha1
kind: Middleware
metadata:
  name: ai-circuit-breaker
  namespace: default
  annotations:
    csap-control: "D-10"
    description: "AI 서비스 장애 전파 차단 — 에러율 50% 또는 응답시간 5초 초과 시 차단"
spec:
  circuitBreaker:
    expression: >
      ResponseCodeRatio(500, 600, 0, 600) > 0.50
      || NetworkErrorRatio() > 0.10
      || LatencyAtQuantileMS(99.0) > 5000
    checkPeriod: 10s     # 10초마다 조건 재평가
    fallbackDuration: 30s  # Open 상태 유지 시간
    recoveryDuration: 10s  # Half-Open 탐색 시간
```

조건 설명입니다.

`ResponseCodeRatio(500, 600, 0, 600) > 0.50` — 전체 응답(0~599) 중 5xx 에러가 50% 초과 시 차단

`NetworkErrorRatio() > 0.10` — 네트워크 오류(연결 거부, 타임아웃 등)가 10% 초과 시 차단

`LatencyAtQuantileMS(99.0) > 5000` — P99 응답 시간이 5초 초과 시 차단 (LLM 추론 시간 고려한 넉넉한 임계값)

### 9.3 서킷 브레이커 상태 모니터링

```yaml
# Prometheus AlertRule
- alert: AIServiceCircuitBreakerOpen
  expr: traefik_service_server_up{service="ai-service"} == 0
  for: 1m
  labels:
    severity: critical
    csap-control: D-10
  annotations:
    summary: "AI 서비스 Circuit Breaker OPEN — 서비스 차단 중"
    description: |
      ai-service의 Circuit Breaker가 열렸습니다.
      모든 AI API 요청이 차단됩니다.
      ai-service 로그를 확인하십시오.
      runbook: https://runbook.saas.go.kr/ai-service-circuit-breaker
```

---

## 10. 요청·응답 변환 — 헤더 주입과 응답 캐싱

### 10.1 요청 헤더 변환

Traefik은 요청이 백엔드 서비스로 전달되기 전에 헤더를 조작할 수 있습니다.

```yaml
apiVersion: traefik.io/v1alpha1
kind: Middleware
metadata:
  name: request-transformation
  namespace: default
spec:
  headers:
    customRequestHeaders:
      # ForwardAuth에서 받은 헤더 외에 추가 헤더 주입
      X-Request-ID: ""          # 자동 생성 (UUID v4)
      X-Gateway-Version: "1.2.0"
      X-Platform: "public-saas"

      # 민감 헤더 제거 — 클라이언트가 보낸 것을 신뢰하지 않음
      X-User-ID: ""             # ForwardAuth에서 재주입 (클라이언트 위조 차단)
      X-Tenant-ID: ""           # ForwardAuth에서 재주입
      X-Admin-Override: ""      # 완전 제거
    customResponseHeaders:
      # 응답에서 민감 정보 제거
      X-Powered-By: ""          # 기술 스택 노출 방지
      Server: ""                # 서버 버전 노출 방지
      X-AspNet-Version: ""      # .NET 버전 노출 방지
```

`X-User-ID: ""`와 `X-Tenant-ID: ""`를 커스텀 요청 헤더에 빈 값으로 설정하는 것이 핵심입니다. 클라이언트가 `X-User-ID: some-admin-uuid`를 헤더에 넣어 보내도, Traefik이 먼저 이 헤더를 비워서 ForwardAuth의 결과로 덮어씁니다. 헤더 위조 공격을 방지합니다.

### 10.2 응답 캐싱 전략

읽기 전용 API의 응답을 캐싱하면 성능을 크게 향상시킬 수 있습니다.

```yaml
# Traefik 응답 캐싱 (플러그인 필요)
# 실제로는 ai-service 내부에서 Redis 캐싱 구현
```

ai-service 내부 캐싱 예시입니다.

```typescript
// GET /ai/models — 1분 캐싱
export async function listModelsHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const cacheKey = 'models:list:all';
  const cached = await redis.get(cacheKey);

  if (cached) {
    reply.header('X-Cache', 'HIT');
    reply.header('Cache-Control', 'private, max-age=60');
    await reply.status(200).send(JSON.parse(cached));
    return;
  }

  const models = await prisma.aiModel.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' },
  });

  const response = { success: true, data: models };
  await redis.setex(cacheKey, 60, JSON.stringify(response));

  reply.header('X-Cache', 'MISS');
  reply.header('Cache-Control', 'private, max-age=60');
  await reply.status(200).send(response);
}
```

| API 종류 | 캐싱 여부 | TTL | 이유 |
|---|---|---|---|
| 모델 목록 | 캐싱 | 60초 | 자주 변경되지 않음 |
| 사용량 통계 | 캐싱 | 300초 | 실시간 불필요 |
| 채팅/에이전트 | 캐싱 불가 | - | 매 응답이 달라야 함 |
| RAG 질의 | 캐싱 가능 | 600초 | 같은 질문=같은 답변 가능 |
| 헬스체크 | 캐싱 불가 | - | 실시간 상태 필요 |

---

## 11. API Gateway 보안

### 11.1 JWT 토큰 검증 — ES256 알고리즘

공공기관 SaaS는 HMAC(HS256) 대신 ECDSA(ES256)를 사용합니다. 이유는 다음과 같습니다.

HMAC은 서명과 검증에 동일한 비밀키를 사용합니다. 여러 서비스가 JWT를 검증해야 하면 모든 서비스에 비밀키를 공유해야 합니다. 키가 유출되면 누구나 JWT를 서명할 수 있습니다.

ECDSA는 개인키로 서명하고 공개키로 검증합니다. auth-service만 개인키를 가집니다. 다른 서비스는 공개키로 검증만 합니다. 공개키가 유출되어도 JWT 위조가 불가능합니다.

```typescript
// auth-service: ES256 키 생성
import { generateKeyPair } from 'crypto';

const { privateKey, publicKey } = await generateKeyPair('ec', {
  namedCurve: 'prime256v1',  // P-256
  publicKeyEncoding: { type: 'pkcs1', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

// 공개키는 ConfigMap으로 전체 클러스터에 배포
// 개인키는 Vault에만 저장 (CSAP D-09)
```

### 11.2 CORS 정책

```typescript
// Fastify CORS 설정
await app.register(cors, {
  origin: (origin, callback) => {
    const allowedOrigins = [
      'https://portal.saas.go.kr',
      'https://admin.saas.go.kr',
      // 개발 환경만 localhost 허용
      ...(process.env.NODE_ENV !== 'production'
        ? ['http://localhost:3000']
        : []),
    ];

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS 위반: 허용되지 않은 Origin — ${origin}`), false);
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Request-ID',
  ],
  exposedHeaders: [
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
    'X-Request-ID',
  ],
  credentials: true,
  maxAge: 7200,  // Preflight 캐싱 2시간
});
```

### 11.3 XSS 방지 — 입력 새니타이제이션

```typescript
import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

const window = new JSDOM('').window;
const purify = DOMPurify(window as unknown as Window);

// HTML을 반환하는 API에서만 사용 (JSON API는 불필요)
export function sanitizeHtml(input: string): string {
  return purify.sanitize(input, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br'],
    ALLOWED_ATTR: [],  // 모든 속성 제거
  });
}

// 사용 예시 — 공공문서 요약 결과
const sanitizedSummary = sanitizeHtml(aiResponse.summary);
```

JSON API에서는 XSS가 직접적으로 발생하지 않습니다. XSS는 브라우저가 HTML을 렌더링할 때 발생하므로, JSON을 반환하는 API는 DOMPurify 대신 Zod 스키마 검증으로 충분합니다.

---

## 12. API Gateway 모니터링

### 12.1 핵심 메트릭 — Grafana 패널 쿼리

**레이턴시 P99 모니터링**

```promql
# AI 서비스 API P99 응답 시간
histogram_quantile(
  0.99,
  sum by (route, le) (
    rate(traefik_service_request_duration_seconds_bucket{
      service="ai-service@kubernetes"
    }[5m])
  )
)
```

**에러율 모니터링**

```promql
# AI 서비스 5xx 에러율
sum(rate(traefik_service_requests_total{
  service="ai-service@kubernetes",
  code=~"5.."
}[5m]))
/
sum(rate(traefik_service_requests_total{
  service="ai-service@kubernetes"
}[5m]))
```

**Rate Limit 초과 현황**

```promql
# 429 응답 빈도 (Rate Limit 초과)
sum by (service) (
  rate(traefik_service_requests_total{
    code="429"
  }[1m])
)
```

**Circuit Breaker 상태**

```promql
# Circuit Breaker가 열린 서비스 목록
traefik_service_server_up{service=~"ai-service.*"} == 0
```

### 12.2 SLO 기반 API Gateway 경보

ai-service API의 SLO를 Gateway 레벨에서 모니터링합니다.

```yaml
# SLO: AI 서비스 API P99 응답시간 < 3초 (99.9%)
- alert: AIServiceLatencySLOBreach
  expr: |
    histogram_quantile(0.99,
      sum by (le) (
        rate(traefik_service_request_duration_seconds_bucket{
          service="ai-service@kubernetes"
        }[5m])
      )
    ) > 3
  for: 5m
  labels:
    severity: warning
    slo: ai-service-latency
  annotations:
    summary: "AI 서비스 P99 레이턴시 SLO 위반"
    description: |
      AI 서비스 P99 응답시간이 {{ $value | humanizeDuration }}으로
      SLO(3초)를 초과합니다.
      에러 버짓이 소진 중입니다.
```

### 12.3 Grafana 대시보드 구성

권장 Grafana 패널 구성입니다.

```
Row 1: API Gateway 개요
  ├── 총 요청 수 (Counter)
  ├── 에러율 % (Gauge)
  ├── P50/P95/P99 레이턴시 (Time Series)
  └── 활성 연결 수 (Gauge)

Row 2: Rate Limiting
  ├── Rate Limit 초과 건수 (Time Series)
  ├── 테넌트별 요청 분포 (Bar Chart)
  └── Redis Rate Limit 키 개수 (Gauge)

Row 3: 인증
  ├── 인증 성공/실패 비율 (Pie Chart)
  ├── ForwardAuth 응답시간 (Histogram)
  └── 블랙리스트 토큰 수 (Counter)

Row 4: Circuit Breaker
  ├── 서비스별 Circuit Breaker 상태 (State Timeline)
  └── CB 오픈 이벤트 이력 (Table)
```

---

## 13. 인증 실패 분기 플로우차트

### 13.1 완전한 인증/인가 분기 흐름

```mermaid
flowchart TD
    REQ(["클라이언트 요청\nPOST /api/v1/ai/chat"]) --> RATE_CHECK

    RATE_CHECK{"Rate Limit 확인\n분당 호출 수 조회"}
    RATE_CHECK -->|"한도 초과"| RATE_ERR["429 Too Many Requests\nX-RateLimit-Remaining: 0\nRetry-After: 60"]
    RATE_CHECK -->|"한도 이내"| TOKEN_CHECK

    TOKEN_CHECK{"Authorization 헤더\n존재 여부"}
    TOKEN_CHECK -->|"헤더 없음"| NO_TOKEN["401 Unauthorized\n{ error: 'TOKEN_MISSING' }"]
    TOKEN_CHECK -->|"Bearer 토큰 있음"| JWT_VERIFY

    JWT_VERIFY{"JWT 서명 검증\nES256 공개키"}
    JWT_VERIFY -->|"서명 오류"| INVALID_TOKEN["401 Unauthorized\n{ error: 'TOKEN_INVALID' }"]
    JWT_VERIFY -->|"만료됨"| EXPIRED_TOKEN["401 Unauthorized\n{ error: 'TOKEN_EXPIRED' }"]
    JWT_VERIFY -->|"유효한 서명"| BLACKLIST_CHECK

    BLACKLIST_CHECK{"토큰 블랙리스트\nRedis jti 조회"}
    BLACKLIST_CHECK -->|"블랙리스트에 존재\n(로그아웃된 토큰)"| REVOKED_TOKEN["401 Unauthorized\n{ error: 'TOKEN_REVOKED' }"]
    BLACKLIST_CHECK -->|"블랙리스트에 없음"| TENANT_CHECK

    TENANT_CHECK{"테넌트 활성 상태\n확인"}
    TENANT_CHECK -->|"테넌트 비활성\n또는 계약 만료"| TENANT_INACTIVE["403 Forbidden\n{ error: 'TENANT_INACTIVE' }"]
    TENANT_CHECK -->|"테넌트 활성"| RBAC_CHECK

    RBAC_CHECK{"RBAC 권한 확인\n역할 ↔ 리소스 매핑"}
    RBAC_CHECK -->|"권한 없음\n(viewer가 쓰기 시도 등)"| PERMISSION_DENIED["403 Forbidden\n{ error: 'INSUFFICIENT_PERMISSION' }"]
    RBAC_CHECK -->|"권한 있음"| HEADER_INJECT

    HEADER_INJECT["헤더 주입 (Traefik)\nX-User-ID: {uuid}\nX-Tenant-ID: {uuid}\nX-User-Role: {role}"]
    HEADER_INJECT --> GRADE_CHECK

    GRADE_CHECK{"N2SF 데이터 등급\ngrade 필드 검증"}
    GRADE_CHECK -->|"grade=C 또는 S\n(AI API 전송 금지)"| GRADE_VIOLATION["403 Forbidden\n{ error: 'GRADE_VIOLATION' }\n감사 로그 기록"]
    GRADE_CHECK -->|"grade=O\n(공개 데이터)"| SCHEMA_VALIDATE

    SCHEMA_VALIDATE{"Zod 스키마 검증\n입력 형식 확인"}
    SCHEMA_VALIDATE -->|"스키마 위반\n(필수 필드 누락 등)"| VALIDATION_ERR["400 Bad Request\n{ error: 'VALIDATION_ERROR' }"]
    SCHEMA_VALIDATE -->|"스키마 통과"| PROCESS

    PROCESS(["비즈니스 로직 실행\nRAG/LLM 처리"])
    PROCESS -->|"성공"| SUCCESS["200 OK\n{ success: true, data: {...} }\n감사 로그 기록"]
    PROCESS -->|"LLM 서버 오류"| LLM_ERR["502 Bad Gateway\n{ error: 'LLM_UNAVAILABLE' }"]
    PROCESS -->|"내부 오류"| INTERNAL_ERR["500 Internal Server Error\n{ error: 'INTERNAL_ERROR' }\n에러 ID만 노출 (민감정보 숨김)"]

    subgraph AUDIT["감사 로그 기록 (CSAP D-06)"]
        direction LR
        AUDIT1["성공: action=AI_CHAT, result=success"]
        AUDIT2["등급 위반: action=AI_GRADE_VIOLATION"]
        AUDIT3["인증 실패: action=AUTH_FAILURE"]
    end

    GRADE_VIOLATION -.->|"감사 기록"| AUDIT2
    NO_TOKEN -.->|"감사 기록"| AUDIT3
    INVALID_TOKEN -.->|"감사 기록"| AUDIT3
    SUCCESS -.->|"감사 기록"| AUDIT1

    classDef error fill:#f8d7da,stroke:#721c24
    classDef success fill:#d4edda,stroke:#155724
    classDef check fill:#fff3cd,stroke:#856404
    classDef action fill:#cce5ff,stroke:#004085
    classDef audit fill:#e2e3e5,stroke:#383d41

    class RATE_ERR,NO_TOKEN,INVALID_TOKEN,EXPIRED_TOKEN,REVOKED_TOKEN,TENANT_INACTIVE,PERMISSION_DENIED,GRADE_VIOLATION,VALIDATION_ERR,LLM_ERR,INTERNAL_ERR error
    class SUCCESS success
    class RATE_CHECK,TOKEN_CHECK,JWT_VERIFY,BLACKLIST_CHECK,TENANT_CHECK,RBAC_CHECK,GRADE_CHECK,SCHEMA_VALIDATE check
    class HEADER_INJECT,PROCESS action
    class AUDIT1,AUDIT2,AUDIT3 audit
```

### 13.2 오류 응답 코드 일람

| HTTP 코드 | 에러 코드 | 의미 | 처리 방법 |
|---|---|---|---|
| 400 | VALIDATION_ERROR | 요청 형식 오류 | 요청 body 수정 후 재시도 |
| 401 | TOKEN_MISSING | 토큰 없음 | 로그인 후 토큰 포함 |
| 401 | TOKEN_EXPIRED | 토큰 만료 | 토큰 갱신 후 재시도 |
| 401 | TOKEN_INVALID | 토큰 위조/변조 | 재로그인 |
| 401 | TOKEN_REVOKED | 로그아웃된 토큰 | 재로그인 |
| 403 | INSUFFICIENT_PERMISSION | 권한 없음 | 관리자에게 권한 요청 |
| 403 | TENANT_INACTIVE | 테넌트 비활성 | 계약 상태 확인 |
| 403 | GRADE_VIOLATION | N2SF 등급 위반 | grade=O 데이터만 사용 |
| 429 | RATE_LIMIT_EXCEEDED | 호출 한도 초과 | Retry-After 초 대기 |
| 502 | LLM_UNAVAILABLE | LLM 서버 응답 없음 | 운영팀에 문의 |
| 500 | INTERNAL_ERROR | 내부 오류 | errorId로 운영팀에 문의 |

---

*이 문서는 ai-service routes.ts 및 ai-rag.handler.ts를 기반으로 작성된 실무 가이드입니다.*
*최신 버전: docs/guides/onboarding/03-development/47-api-gateway-patterns.md*
