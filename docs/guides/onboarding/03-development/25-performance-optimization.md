# Node.js + Fastify 성능 최적화 완전 가이드

> **문서 ID**: DEV-PERF-25
> **버전**: 1.0.0 | **작성일**: 2026-04-12 | **작성자**: Implementer (Sonnet)
> **목적**: 공공기관 SaaS 플랫폼에서 Node.js + Fastify 서비스의 성능을 측정·분석·최적화하는 완전한 방법론을 제공합니다.
> **선행 학습**: [24-caching-strategies.md](24-caching-strategies.md), [20-error-handling.md](20-error-handling.md)

---

## 목차

1. [성능 최적화 철학](#1-성능-최적화-철학)
2. [Node.js 런타임 최적화](#2-nodejs-런타임-최적화)
3. [Fastify 특화 최적화](#3-fastify-특화-최적화)
4. [데이터베이스 쿼리 최적화](#4-데이터베이스-쿼리-최적화)
5. [Redis 캐싱 성능 튜닝](#5-redis-캐싱-성능-튜닝)
6. [프로파일링 도구 실전](#6-프로파일링-도구-실전)
7. [실전 최적화 시나리오](#7-실전-최적화-시나리오)
8. [성능 테스트 자동화](#8-성능-테스트-자동화)
9. [변경 이력](#변경-이력)

---

## 1. 성능 최적화 철학

### 1.1 측정 없이 최적화 없다

공공기관 SaaS 플랫폼에서 성능 최적화는 **직관이 아닌 데이터에 근거**해야 합니다. 섣부른 최적화(premature optimization)는 코드 복잡성만 증가시키고 실제 병목 구간을 놓칩니다. 올바른 성능 최적화 사이클은 다음과 같습니다.

```
측정 → 병목 식별 → 가설 수립 → 최적화 → 재측정 → 반복
```

이 사이클을 반드시 따르십시오. "느릴 것 같다"는 느낌은 최적화의 근거가 될 수 없습니다.

### 1.2 성능 목표 수립 (SLO 기반)

성능 최적화를 시작하기 전에 측정 가능한 목표를 수립해야 합니다. 본 플랫폼의 기본 SLO는 다음과 같습니다:

| API 유형 | p50 목표 | p95 목표 | p99 목표 |
|---------|---------|---------|---------|
| 일반 CRUD | 50ms | 200ms | 500ms |
| AI 채팅 | 500ms | 2000ms | 5000ms |
| RAG 질의 | 300ms | 1500ms | 3000ms |
| 파일 업로드 | 200ms | 1000ms | 3000ms |

이 수치를 기준으로 어느 구간이 SLO를 위반하는지 파악한 후 최적화를 진행합니다.

### 1.3 성능 최적화 워크플로우

```mermaid
flowchart TD
    A([서비스 배포]) --> B[Grafana 대시보드 확인]
    B --> C{SLO 위반 감지?}
    C -- 아니오 --> D[정상 운영 유지]
    C -- 예 --> E[Prometheus 메트릭 분석]
    E --> F{병목 구간 식별}
    F --> G1[CPU 바운드 문제]
    F --> G2[I/O 바운드 문제]
    F --> G3[메모리 부족]
    F --> G4[네트워크 지연]
    G1 --> H1[Worker Thread / 알고리즘 개선]
    G2 --> H2[DB 쿼리 최적화 / 캐싱]
    G3 --> H3[메모리 누수 탐지 / 힙 튜닝]
    G4 --> H4[연결 풀 튜닝 / CDN]
    H1 & H2 & H3 & H4 --> I[Clinic.js / 0x 프로파일링]
    I --> J[코드 수정 적용]
    J --> K[부하 테스트 재실행]
    K --> L{목표 달성?}
    L -- 아니오 --> E
    L -- 예 --> M[DORA 배포 게이트 통과]
    M --> D
```

### 1.4 성능 최적화 우선순위

모든 최적화가 같은 효과를 내지 않습니다. 투자 대비 효과(ROI) 순으로 접근하십시오:

1. **알고리즘 개선**: O(n²) → O(n log n) 같은 알고리즘 변경은 하드웨어보다 더 큰 효과
2. **N+1 쿼리 제거**: 데이터베이스 왕복 횟수가 가장 큰 병목
3. **캐싱 적용**: Redis로 DB 부하를 90% 이상 감소 가능
4. **연결 풀 최적화**: 연결 생성 비용 제거
5. **하드웨어 증설**: 위 4단계 이후 최후 수단

### 1.5 성능 측정 지표

```typescript
// Design Ref: SVC-AI-2026 DESIGN — 성능 지표 수집
// 표준 성능 지표를 Prometheus 형식으로 노출

import { Registry, Histogram, Counter, Gauge } from 'prom-client';

const register = new Registry();

// HTTP 요청 지연시간 히스토그램
const httpDuration = new Histogram({
  name: 'http_request_duration_ms',
  help: 'HTTP 요청 지연시간 (밀리초)',
  labelNames: ['method', 'route', 'status_code'],
  // 공공기관 SaaS SLO 기준 버킷 설정
  buckets: [10, 50, 100, 200, 500, 1000, 2000, 5000],
  registers: [register],
});

// 데이터베이스 쿼리 지연시간
const dbQueryDuration = new Histogram({
  name: 'db_query_duration_ms',
  help: 'DB 쿼리 지연시간 (밀리초)',
  labelNames: ['operation', 'model'],
  buckets: [1, 5, 10, 50, 100, 500, 1000],
  registers: [register],
});

// 활성 연결 수
const activeConnections = new Gauge({
  name: 'active_connections_total',
  help: '현재 처리 중인 연결 수',
  registers: [register],
});
```

### 1.6 황금 신호 (Golden Signals) 모니터링

구글 SRE가 정의한 4개 황금 신호를 항상 모니터링합니다:

- **레이턴시(Latency)**: 요청 처리 시간 — p50, p95, p99 분위수
- **트래픽(Traffic)**: 초당 요청 수(RPS)
- **에러율(Error Rate)**: 5xx 응답 비율
- **포화도(Saturation)**: CPU/메모리/연결 풀 사용률

---

## 2. Node.js 런타임 최적화

### 2.1 Event Loop 이해와 블로킹 방지

Node.js는 단일 스레드 이벤트 루프 기반으로 동작합니다. I/O 작업은 비동기로 처리하지만, CPU 집약적 작업이 이벤트 루프를 블로킹하면 전체 서비스가 멈춥니다.

**이벤트 루프 단계:**

```
   ┌───────────────────────────┐
   │           timers           │  setTimeout, setInterval 콜백
   ├───────────────────────────┤
   │     pending callbacks      │  이전 루프 I/O 에러 콜백
   ├───────────────────────────┤
   │       idle, prepare        │  내부 전용
   ├───────────────────────────┤
   │           poll             │  새 I/O 이벤트 가져오기 (핵심)
   ├───────────────────────────┤
   │           check            │  setImmediate 콜백
   ├───────────────────────────┤
   │      close callbacks       │  소켓 종료 콜백
   └───────────────────────────┘
```

**블로킹 패턴 감지와 수정:**

```typescript
// ❌ 잘못된 패턴: 대용량 JSON 파싱이 이벤트 루프 블로킹
export async function processLargeDocument(content: string): Promise<ParsedDoc> {
  // 500KB JSON을 동기로 파싱 → 이벤트 루프 수십 ms 점유
  const parsed = JSON.parse(content);
  return transformData(parsed);
}

// ✅ 올바른 패턴 1: setImmediate로 분할 처리
export async function processLargeDocumentSafe(content: string): Promise<ParsedDoc> {
  return new Promise((resolve, reject) => {
    setImmediate(() => {
      try {
        const parsed = JSON.parse(content);
        resolve(transformData(parsed));
      } catch (err) {
        reject(err);
      }
    });
  });
}

// ✅ 올바른 패턴 2: Worker Thread로 오프로드 (권장)
import { workerData, parentPort } from 'worker_threads';

export function parseInWorker(content: string): Promise<ParsedDoc> {
  return new Promise((resolve, reject) => {
    const worker = new Worker('./parse-worker.js', {
      workerData: { content },
    });
    worker.on('message', resolve);
    worker.on('error', reject);
    worker.on('exit', (code) => {
      if (code !== 0) reject(new Error(`Worker 종료: 코드 ${code}`));
    });
  });
}
```

**이벤트 루프 지연 모니터링:**

```typescript
// 이벤트 루프 지연 측정 (100ms 이상이면 경고)
let lastCheck = Date.now();

const loopLagGauge = new Gauge({
  name: 'nodejs_event_loop_lag_ms',
  help: 'Event Loop 지연 (ms)',
});

setInterval(() => {
  const now = Date.now();
  const lag = now - lastCheck - 1000; // 예상 1000ms 대비 실제
  lastCheck = now;
  loopLagGauge.set(Math.max(0, lag));

  if (lag > 100) {
    // 감사 로그: CSAP D-06 — 성능 이상 감지
    process.stderr.write(JSON.stringify({
      level: 'warn',
      component: 'event-loop-monitor',
      msg: `Event Loop 지연 감지: ${lag}ms`,
      ts: new Date().toISOString(),
    }) + '\n');
  }
}, 1000);
```

### 2.2 Worker Thread 활용 패턴

CPU 집약적 작업(암호화, 이미지 처리, 대용량 데이터 변환)은 Worker Thread로 분리합니다.

```mermaid
sequenceDiagram
    participant Client as 클라이언트
    participant Main as 메인 스레드 (Event Loop)
    participant Pool as Worker Thread 풀
    participant W1 as Worker 1
    participant W2 as Worker 2

    Client->>Main: POST /ai/document/analyze (500KB)
    Main->>Main: 요청 수신 + 검증 (비블로킹)
    Main->>Pool: 청킹 작업 위임
    Pool->>W1: chunk(content, maxTokens=512)
    Note over Main: 이벤트 루프 자유 상태
    Client->>Main: POST /ai/chat (동시 요청)
    Main->>Main: 채팅 요청 처리 (병렬)
    W1-->>Pool: 청크 배열 반환
    Pool-->>Main: 처리 완료
    Main->>W2: 임베딩 생성 위임
    W2-->>Main: 벡터 배열 반환
    Main-->>Client: 분석 결과 응답
```

**Worker Thread 풀 구현:**

```typescript
// platform/services/ai-service/src/lib/worker-pool.ts
// Design Ref: SVC-AI-ADV-R1 DESIGN — 고성능 청킹 처리

import { Worker } from 'worker_threads';
import * as os from 'os';

export class WorkerPool {
  private workers: Worker[] = [];
  private queue: Array<{
    data: unknown;
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
  }> = [];
  private activeCount = 0;

  // CPU 코어 수 - 1 (메인 스레드 여유 확보)
  private readonly maxWorkers = Math.max(1, os.cpus().length - 1);

  constructor(private readonly workerScript: string) {}

  async run<T>(data: unknown): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({ data, resolve: resolve as (v: unknown) => void, reject });
      this.processQueue();
    });
  }

  private processQueue(): void {
    if (this.queue.length === 0 || this.activeCount >= this.maxWorkers) return;

    const task = this.queue.shift();
    if (!task) return;

    this.activeCount++;
    const worker = new Worker(this.workerScript, { workerData: task.data });

    worker.on('message', (result) => {
      task.resolve(result);
      this.activeCount--;
      worker.terminate();
      this.processQueue();
    });

    worker.on('error', (err) => {
      task.reject(err);
      this.activeCount--;
      worker.terminate();
      this.processQueue();
    });
  }
}

// 전역 청킹 워커 풀 (싱글턴)
export const chunkWorkerPool = new WorkerPool(
  new URL('./chunk-worker.js', import.meta.url).pathname
);
```

### 2.3 메모리 관리

**힙 메모리 설정:**

```bash
# k8s Pod 메모리 512Mi 기준 힙 설정
# container.yaml
command:
  - node
  - --max-old-space-size=384   # 512Mi의 75%
  - --max-semi-space-size=64   # Young Generation
  - dist/index.js
```

**메모리 누수 탐지 패턴:**

```typescript
// 주기적 힙 통계 수집
const heapStats = new Gauge({
  name: 'nodejs_heap_used_bytes',
  help: '사용 중인 힙 메모리 (bytes)',
});

setInterval(() => {
  const usage = process.memoryUsage();
  heapStats.set(usage.heapUsed);

  // 힙 사용률 80% 초과 시 경고
  const heapUsageRatio = usage.heapUsed / usage.heapTotal;
  if (heapUsageRatio > 0.8) {
    process.stderr.write(JSON.stringify({
      level: 'error',
      component: 'memory-monitor',
      msg: `힙 사용률 위험: ${(heapUsageRatio * 100).toFixed(1)}%`,
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal,
      ts: new Date().toISOString(),
    }) + '\n');
  }
}, 10000);

// 개발 환경 힙 스냅샷 (운영 환경 비활성화)
if (process.env.NODE_ENV === 'development' && process.env.ENABLE_HEAPDUMP === '1') {
  import('v8').then(({ writeHeapSnapshot }) => {
    process.on('SIGUSR2', () => {
      const filename = writeHeapSnapshot();
      console.log(`힙 스냅샷 저장: ${filename}`);
    });
  });
}
```

**Map/Set을 활용한 메모리 효율화:**

```typescript
// ❌ 잘못된 패턴: 배열에서 중복 검색 O(n)
const processedIds: string[] = [];
function isProcessed(id: string): boolean {
  return processedIds.includes(id); // O(n) 검색
}

// ✅ 올바른 패턴: Set으로 O(1) 검색
const processedIds = new Set<string>();
function isProcessed(id: string): boolean {
  return processedIds.has(id); // O(1) 검색
}

// WeakMap으로 메모리 누수 방지 (GC 자동 회수)
const tenantCache = new WeakMap<object, TenantConfig>();
```

### 2.4 스트림 처리로 메모리 절약

대용량 파일이나 데이터는 반드시 스트림으로 처리합니다:

```typescript
// ❌ 잘못된 패턴: 전체 파일을 메모리에 로드
const content = fs.readFileSync('/huge-document.pdf'); // OOM 위험

// ✅ 올바른 패턴: 스트림으로 처리
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';

export async function processLargeFile(
  inputPath: string,
  outputPath: string
): Promise<void> {
  await pipeline(
    createReadStream(inputPath),
    new TextTransformStream(),  // 커스텀 변환
    createWriteStream(outputPath)
  );
  // 메모리에 전체 파일을 올리지 않음
}
```

---

## 3. Fastify 특화 최적화

### 3.1 JSON 스키마 직렬화 최적화

Fastify의 가장 큰 성능 장점은 JSON 스키마 기반 직렬화입니다. `routes.ts`에서 볼 수 있듯이, 모든 응답에 스키마를 정의하면 Fastify가 AJV로 컴파일된 직렬화 함수를 생성하여 `JSON.stringify()`보다 2~8배 빠른 직렬화가 가능합니다.

```typescript
// Design Ref: platform/services/ai-service/src/routes.ts — 스키마 정의 패턴

// ❌ 스키마 없는 라우트: 일반 JSON.stringify() 사용
app.get('/api/data', async (request, reply) => {
  const data = await getData();
  return data; // 느린 직렬화
});

// ✅ 스키마 있는 라우트: AJV 컴파일 직렬화
const dataResponseSchema = {
  type: 'object' as const,
  properties: {
    success: { type: 'boolean' as const },
    data: {
      type: 'object' as const,
      properties: {
        id: { type: 'string' as const },
        name: { type: 'string' as const },
        createdAt: { type: 'string' as const, format: 'date-time' },
      },
      // additionalProperties false로 직렬화 오버헤드 추가 감소
      additionalProperties: false,
    },
  },
};

app.get(
  '/api/data',
  {
    schema: {
      response: { 200: dataResponseSchema },
    },
  },
  async (request, reply) => {
    const data = await getData();
    return { success: true, data }; // AJV 직렬화 — 최대 8배 빠름
  }
);
```

**실제 프로젝트 스키마 공유 패턴 (`routes.ts` 참조):**

```typescript
// Design Ref: platform/services/ai-service/src/routes.ts §OpenAPI JSON Schema 공통 정의
// 공통 스키마를 변수로 재사용하여 중복 제거

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

// 모든 라우트에서 재사용
app.get('/ai/models', {
  schema: { response: { 200: listResponse } },
  preHandler: readLimiter,
}, listModelsHandler as never);
```

### 3.2 Plugin 캐싱 전략

Fastify의 플러그인 시스템은 `fastify-plugin`을 사용하면 컨텍스트 캡슐화를 우회하여 전역 공유가 가능합니다. DB 연결, Redis 클라이언트 등 비용이 높은 리소스는 반드시 플러그인으로 공유합니다.

```typescript
// platform/services/ai-service/src/plugins/prisma.plugin.ts
import fp from 'fastify-plugin';
import { PrismaClient } from '@prisma/client';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

const prismaPlugin = fp(async (app) => {
  const prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development'
      ? ['query', 'error']
      : ['error'],
  });

  await prisma.$connect();

  // Fastify 인스턴스에 데코레이터로 등록
  app.decorate('prisma', prisma);

  // Graceful shutdown 시 연결 종료
  app.addHook('onClose', async () => {
    await prisma.$disconnect();
  });
}, {
  // 플러그인 이름 지정 (중복 등록 방지)
  name: 'prisma',
});

export default prismaPlugin;

// ✅ 올바른 사용: 라우트 핸들러에서 재사용
export async function getUserHandler(request: FastifyRequest, reply: FastifyReply) {
  // app.prisma는 단일 인스턴스 재사용 (연결 풀 공유)
  const user = await request.server.prisma.user.findUnique({
    where: { id: request.params.id },
  });
  return reply.send({ success: true, data: user });
}
```

### 3.3 Keep-Alive 연결 관리

HTTP Keep-Alive는 연결 재사용으로 TCP 핸드셰이크 오버헤드를 제거합니다. 특히 AI Gateway 같은 내부 서비스 간 통신에서 중요합니다.

```typescript
// platform/services/ai-service/src/lib/http-client.ts
import { Agent } from 'undici';

// undici는 Node.js 내장 HTTP 클라이언트 (fetch API 기반)
// Keep-Alive 연결 풀을 유지하여 연결 재사용

const internalHttpAgent = new Agent({
  // 연결 유지 시간 (ms)
  keepAliveTimeout: 60000,
  // 최대 동시 연결 수 (LM Studio 서버 기준)
  connections: 10,
  // 요청 타임아웃
  headersTimeout: 30000,
  bodyTimeout: 120000,
});

// AI 모델 서버 호출 시 재사용
export async function callLLMServer(
  endpoint: string,
  payload: object
): Promise<Response> {
  return fetch(`${endpoint}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    // @ts-expect-error — undici dispatcher
    dispatcher: internalHttpAgent,
  });
}
```

### 3.4 Fastify 라우트 최적화 실전 예제

AI 서비스의 Rate Limiter 패턴을 참조한 최적화된 라우트 구조:

```typescript
// Design Ref: platform/services/ai-service/src/routes.ts — Rate Limiter 패턴

// ✅ preHandler 배열로 복수 전처리 체인
// (인증 → 속도 제한 → 입력 검증 순서)
app.post(
  '/ai/chat',
  {
    schema: {
      body: {
        type: 'object' as const,
        required: ['modelId', 'tenantId', 'message', 'grade'] as const,
        properties: {
          modelId: { type: 'string' as const },
          tenantId: { type: 'string' as const },
          // maxLength로 과도한 입력 차단 (CSAP D-12)
          message: { type: 'string' as const, maxLength: 8192 },
          grade: { type: 'string' as const, enum: ['O'] },
        },
        // AJV가 추가 필드를 컴파일 타임에 제거 (성능 + 보안)
        additionalProperties: false,
      },
      response: {
        200: modelResponse,
        403: errorResponse,
        429: errorResponse, // Rate Limit
        502: errorResponse,
      },
    },
    // chatLimiter는 10회/60초 (에이전트보다 관대)
    preHandler: [authMiddleware, chatLimiter],
  },
  chatHandler as never,
);
```

### 3.5 응답 압축 설정

```typescript
// 응답 압축으로 네트워크 전송량 감소
import compression from '@fastify/compress';

await app.register(compression, {
  // Brotli (br): 최고 압축률, 최신 클라이언트
  // Gzip: 범용 압축
  // Deflate: 구형 클라이언트
  encodings: ['br', 'gzip', 'deflate'],
  // 1KB 미만은 압축 오버헤드가 이득보다 큼
  threshold: 1024,
  // JSON API 응답 압축 비율: 60~80%
});
```

### 3.6 요청 파싱 최적화

```typescript
// bodyLimit으로 과도한 요청 차단 (DDoS 방지 + 메모리 보호)
const app = Fastify({
  // 기본 1MB. AI 문서 분석은 별도 제한 적용
  bodyLimit: 1048576, // 1MB
  // 로거는 pino (Fastify 기본 — JSON 구조화 로그)
  logger: {
    level: process.env.LOG_LEVEL ?? 'info',
    // production에서 사람이 읽기 어려운 JSON으로 성능 우선
    transport: process.env.NODE_ENV === 'development'
      ? { target: 'pino-pretty' }
      : undefined,
  },
});

// 특정 라우트에 다른 bodyLimit 적용
app.addContentTypeParser(
  'application/json',
  { parseAs: 'string', bodyLimit: 300_000 }, // 300KB — 문서 분석용
  (req, body, done) => {
    try {
      done(null, JSON.parse(body as string));
    } catch (err) {
      const error = new Error('유효하지 않은 JSON');
      done(error as Error & { statusCode?: number }, undefined);
    }
  }
);
```

---

## 4. 데이터베이스 쿼리 최적화

### 4.1 Prisma N+1 문제 이해와 해결

N+1 문제는 데이터베이스 성능 저하의 가장 흔한 원인입니다. 부모 레코드 1개를 조회한 후 자식 레코드를 N번 개별 조회하는 패턴입니다.

```typescript
// ❌ N+1 문제 발생 패턴
async function getTenantModelsWithUsage(): Promise<TenantModel[]> {
  // 1번 쿼리: 모든 테넌트 조회
  const tenants = await prisma.tenant.findMany({ take: 50 });

  // N번 쿼리: 각 테넌트마다 개별 사용량 조회 (50번!)
  const result = [];
  for (const tenant of tenants) {
    const usage = await prisma.aiUsage.aggregate({
      where: { tenantId: tenant.id },
      _sum: { tokens: true },
    });
    result.push({ tenant, totalTokens: usage._sum.tokens ?? 0 });
  }
  return result;
  // 총 51번 쿼리 = 심각한 성능 문제
}

// ✅ 해결책 1: include로 JOIN 활용
async function getTenantModelsWithUsageOptimized(): Promise<TenantModel[]> {
  return prisma.tenant.findMany({
    take: 50,
    include: {
      // Prisma가 단일 JOIN 쿼리로 처리
      aiUsages: {
        select: { tokens: true },
      },
    },
  });
  // 총 1번 쿼리
}

// ✅ 해결책 2: findMany + groupBy로 집계
async function getTenantTokenSummary() {
  const [tenants, usageSummary] = await Promise.all([
    prisma.tenant.findMany({ take: 50, select: { id: true, name: true } }),
    prisma.aiUsage.groupBy({
      by: ['tenantId'],
      _sum: { tokens: true },
    }),
  ]);
  // 2번 병렬 쿼리 — N+1 완전 제거
  const usageMap = new Map(usageSummary.map(u => [u.tenantId, u._sum.tokens]));
  return tenants.map(t => ({ ...t, totalTokens: usageMap.get(t.id) ?? 0 }));
}
```

### 4.2 select로 필요한 컬럼만 조회

```typescript
// ❌ SELECT * — 불필요한 데이터 전송
const models = await prisma.aiModel.findMany();
// 전체 컬럼 (config, endpoint 등 민감 + 큰 데이터 포함)

// ✅ select로 필요한 컬럼만 지정
const models = await prisma.aiModel.findMany({
  select: {
    id: true,
    name: true,
    provider: true,
    isActive: true,
    // endpoint, config 같은 큰/민감 데이터 제외
  },
  where: { isActive: true },
  orderBy: { name: 'asc' },
});
```

### 4.3 인덱스 전략

```sql
-- 단순 인덱스: 단일 컬럼 조회
CREATE INDEX idx_ai_model_tenant_id ON "AiModel" ("tenantId");
CREATE INDEX idx_ai_usage_created_at ON "AiUsage" ("createdAt");

-- 복합 인덱스: 자주 함께 사용하는 컬럼
-- tenantId로 필터링 + createdAt 정렬 패턴에 최적화
CREATE INDEX idx_ai_usage_tenant_created
  ON "AiUsage" ("tenantId", "createdAt" DESC);

-- 부분 인덱스: 특정 조건에만 인덱스 생성 (인덱스 크기 감소)
CREATE INDEX idx_ai_model_active
  ON "AiModel" ("tenantId")
  WHERE "isActive" = true;

-- 커버링 인덱스: SELECT 컬럼까지 인덱스에 포함
CREATE INDEX idx_ai_model_list
  ON "AiModel" ("tenantId", "isActive")
  INCLUDE ("id", "name", "provider");
```

**Prisma 스키마에서 인덱스 정의:**

```prisma
// schema.prisma
model AiUsage {
  id        String   @id @default(uuid())
  tenantId  String
  modelId   String
  tokens    Int
  cost      Float
  createdAt DateTime @default(now())

  @@index([tenantId, createdAt(sort: Desc)])
  @@index([modelId])
}

model AiModel {
  id       String  @id @default(uuid())
  tenantId String
  name     String
  isActive Boolean @default(true)

  @@index([tenantId, isActive])
}
```

### 4.4 커넥션 풀 튜닝

```typescript
// Design Ref: platform/services/ai-service/src/lib/prisma.ts

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  // 연결 풀 설정
  // connection_limit: 동시 DB 연결 최대 수
  // pool_timeout: 연결 획득 대기 시간
});

// DATABASE_URL에 풀 설정 추가
// postgresql://user:pass@host:5432/db?connection_limit=10&pool_timeout=10&connect_timeout=10
//
// connection_limit 계산 공식:
// = (CPU 코어 수 * 2) + 효과적인 스핀들 수
// 예: 4코어 서버 → 4*2+1 = 9 → 10 설정
```

**PgBouncer 트랜잭션 풀링 (권장):**

```yaml
# k8s ConfigMap — pgbouncer.ini
[pgbouncer]
pool_mode = transaction           # 트랜잭션 단위 연결 재사용
max_client_conn = 200             # 앱 → PgBouncer 연결
default_pool_size = 20            # PgBouncer → PostgreSQL 연결
reserve_pool_size = 5             # 긴급 예비 연결
reserve_pool_timeout = 5
server_idle_timeout = 600
client_idle_timeout = 0
```

### 4.5 EXPLAIN ANALYZE 해석

```sql
-- 느린 쿼리 분석
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT au.*, am.name as model_name
FROM "AiUsage" au
JOIN "AiModel" am ON au."modelId" = am.id
WHERE au."tenantId" = 'xxx-yyy-zzz'
  AND au."createdAt" >= NOW() - INTERVAL '30 days'
ORDER BY au."createdAt" DESC
LIMIT 100;
```

**실행 계획 해석 포인트:**

| 키워드 | 의미 | 조치 |
|-------|------|------|
| `Seq Scan` | 전체 테이블 스캔 | 인덱스 추가 필요 |
| `Index Scan` | 인덱스 사용 | 정상 |
| `Bitmap Heap Scan` | 부분 인덱스 사용 | 대체로 정상 |
| `Hash Join` | 해시 조인 (대용량) | 정상 |
| `Nested Loop` | 중첩 루프 (소용량) | 정상, 대용량이면 문제 |
| `rows=` (실제) vs 예측 차이 큼 | 통계 오래됨 | ANALYZE 실행 |

---

## 5. Redis 캐싱 성능 튜닝

### 5.1 Pipeline vs 개별 명령

Redis Pipeline은 여러 명령을 한 번에 전송하여 네트워크 왕복 횟수를 줄입니다.

```typescript
// Design Ref: 24-caching-strategies.md 패턴 확장

import { createClient } from 'redis';

const redis = createClient({ url: process.env.REDIS_URL });

// ❌ 개별 명령: 네트워크 왕복 N번
async function setMultipleKeys(data: Record<string, string>): Promise<void> {
  for (const [key, value] of Object.entries(data)) {
    await redis.set(key, value, { EX: 3600 }); // 각각 RTT
  }
  // 100개 키 = 100번 RTT = ~100ms (10ms/RTT 기준)
}

// ✅ Pipeline: 네트워크 왕복 1번
async function setMultipleKeysPipelined(data: Record<string, string>): Promise<void> {
  const pipeline = redis.multi();
  for (const [key, value] of Object.entries(data)) {
    pipeline.set(key, value, { EX: 3600 });
  }
  await pipeline.exec();
  // 100개 키 = 1번 RTT ≈ ~10ms (10배 빠름)
}

// ✅ 실전 패턴: 멀티테넌트 캐시 초기화
async function invalidateTenantCache(tenantId: string): Promise<void> {
  const pattern = `tenant:${tenantId}:*`;
  const keys = await redis.keys(pattern);

  if (keys.length === 0) return;

  // Pipeline으로 일괄 삭제
  const pipeline = redis.multi();
  for (const key of keys) {
    pipeline.del(key);
  }
  await pipeline.exec();
}
```

### 5.2 직렬화 최적화

```typescript
// JSON vs MessagePack 성능 비교
// MessagePack: 바이너리 직렬화 — JSON 대비 40% 작고 2배 빠름

// JSON (기본): 사람이 읽을 수 있는 텍스트
const jsonSize = Buffer.byteLength(JSON.stringify(largeObject)); // 예: 10KB

// MessagePack: 바이너리 (권장 — 대용량 벡터 캐시 시)
import { encode, decode } from '@msgpack/msgpack';
const msgpackSize = encode(largeObject).byteLength; // 예: 6KB (40% 감소)

// 캐시 저장 시
async function cacheVector(key: string, embedding: number[]): Promise<void> {
  const serialized = Buffer.from(encode(embedding));
  await redis.set(key, serialized, { EX: 86400 }); // 24시간
}

// 캐시 조회 시
async function getCachedVector(key: string): Promise<number[] | null> {
  const raw = await redis.getBuffer(key);
  if (!raw) return null;
  return decode(raw) as number[];
}
```

### 5.3 메모리 정책 설정

```bash
# redis.conf 또는 k8s ConfigMap

# 최대 메모리 제한 (Pod 메모리의 70~80%)
maxmemory 400mb

# 메모리 초과 시 정책
# allkeys-lru: 모든 키 중 LRU 제거 (캐시 전용 Redis 권장)
# volatile-lru: TTL 있는 키 중 LRU 제거 (캐시+저장소 혼용)
# noeviction: 메모리 초과 시 에러 반환 (세션 저장소)
maxmemory-policy allkeys-lru

# LRU 정확도 (샘플 수, 기본 5 → 10으로 증가하면 정확도 향상)
maxmemory-samples 10
```

### 5.4 캐시 히트율 모니터링

```typescript
// Redis 캐시 히트/미스 메트릭 수집
const cacheHits = new Counter({
  name: 'redis_cache_hits_total',
  help: 'Redis 캐시 히트 수',
  labelNames: ['cache_type'],
});

const cacheMisses = new Counter({
  name: 'redis_cache_misses_total',
  help: 'Redis 캐시 미스 수',
  labelNames: ['cache_type'],
});

export async function getCachedData<T>(
  key: string,
  cacheType: string,
  fetcher: () => Promise<T>,
  ttlSeconds = 3600
): Promise<T> {
  const cached = await redis.get(key);

  if (cached) {
    cacheHits.inc({ cache_type: cacheType });
    return JSON.parse(cached) as T;
  }

  cacheMisses.inc({ cache_type: cacheType });
  const data = await fetcher();
  await redis.set(key, JSON.stringify(data), { EX: ttlSeconds });
  return data;
}

// 목표 캐시 히트율: 80% 이상
// Grafana 알림: (hits / (hits + misses)) < 0.8 이면 경고
```

---

## 6. 프로파일링 도구 실전

### 6.1 Clinic.js 사용법

Clinic.js는 Node.js 성능 문제를 자동으로 진단하는 도구 모음입니다.

```bash
# 설치
npm install -g clinic

# Doctor: 이벤트 루프 지연, CPU 사용률 분석
clinic doctor -- node dist/index.js

# Flame: CPU 핫스팟 플레임 그래프 (가장 유용)
clinic flame -- node dist/index.js

# Bubbleprof: 비동기 I/O 지연 분석
clinic bubbleprof -- node dist/index.js
```

**Doctor 결과 해석:**

```
Potential issues detected:
  1. Event loop delay detected
     The event loop is delayed by ~50ms on average.
     This usually means CPU-intensive work is blocking the loop.
     → 해결: CPU 집약적 코드를 Worker Thread로 이동

  2. I/O issue detected
     I/O callbacks are taking longer than expected.
     → 해결: DB 쿼리 최적화 또는 연결 풀 증가
```

### 6.2 0x 플레임 그래프 해석

```bash
# 0x으로 플레임 그래프 생성
npx 0x dist/index.js

# 30초 부하 테스트 후 Ctrl+C → flamegraph.html 생성
```

**플레임 그래프 읽는 법:**

```
넓이 = CPU 시간 비율 (넓을수록 많은 시간 소비)
높이 = 호출 스택 깊이

[JSON.parse] ████████████████████████████ 45%  ← 병목 구간!
  [ragQueryHandler]    ████████████ 25%
    [maskPII]       ████ 8%
    [semanticSearch] ████████ 17%
```

넓은 구간이 병목입니다. 위 예시에서 `JSON.parse`가 45%를 차지하면 직렬화 최적화가 필요합니다.

### 6.3 Pyroscope 연속 프로파일링

Pyroscope는 운영 환경에서 상시 프로파일링하여 성능 회귀를 즉시 감지합니다.

```typescript
// platform/services/ai-service/src/index.ts — Pyroscope 설정

import Pyroscope from '@pyroscope/nodejs';

if (process.env.PYROSCOPE_SERVER_ADDRESS) {
  Pyroscope.init({
    serverAddress: process.env.PYROSCOPE_SERVER_ADDRESS,
    appName: `ai-service.${process.env.NODE_ENV}`,
    // CPU 프로파일링 활성화
    profileTypes: ['cpu', 'wall', 'heap'],
    // 테넌트 ID를 레이블로 추가 (테넌트별 성능 분석)
    tags: {
      region: process.env.REGION ?? 'kr',
      version: process.env.APP_VERSION ?? 'unknown',
    },
  });
  Pyroscope.start();
}
```

**k8s 배포 설정:**

```yaml
# k8s Deployment — ai-service
spec:
  template:
    spec:
      containers:
        - name: ai-service
          env:
            - name: PYROSCOPE_SERVER_ADDRESS
              value: "http://pyroscope.monitoring.svc:4040"
            - name: REGION
              value: "kr-gov-1"
```

### 6.4 프로파일링 → 병목 식별 → 수정 사이클

```mermaid
flowchart LR
    A[부하 테스트 실행\nk6 + 실제 시나리오] --> B[Clinic.js Doctor\n이벤트 루프 분석]
    B --> C{이벤트 루프 지연?}
    C -- 예 --> D[0x 플레임 그래프\nCPU 핫스팟 식별]
    C -- 아니오 --> E[Bubbleprof\nI/O 지연 분석]
    D --> F[핫 함수 최적화\nWorker Thread 이동]
    E --> G[DB 쿼리 개선\n연결 풀 튜닝]
    F --> H[Pyroscope\n연속 모니터링]
    G --> H
    H --> I{성능 목표 달성?}
    I -- 아니오 --> A
    I -- 예 --> J[DORA 배포 게이트\n통과]
```

---

## 7. 실전 최적화 시나리오

### 7.1 시나리오 1: AI RAG 응답시간 500ms → 120ms

**문제 상황:**

```
초기 측정: p95 = 480ms
목표: p95 = 150ms
SLO: AI 서비스 p95 < 200ms
```

**단계 1: 프로파일링 실행**

```bash
# 실제 RAG 요청 시나리오로 부하 테스트
k6 run --vus 10 --duration 60s scripts/k6/rag-query.js

# Clinic.js Doctor로 이벤트 루프 분석
clinic doctor -- node dist/index.js &
k6 run --vus 5 --duration 30s scripts/k6/rag-query.js
# Ctrl+C 후 clinic 리포트 확인
```

**단계 2: 병목 식별**

```
0x 플레임 그래프 분석 결과:
  [runRAG]                    ████████████████████████ 100%
    [semanticSearch]          ████████████ 48%   ← 벡터 검색 병목
    [JSON.parse]              ████████ 32%       ← 직렬화 병목
    [maskPII]                 ████ 15%           ← PII 마스킹
    [provider.chat]           ▌ 5%               ← LLM은 빠름
```

**단계 3: 최적화 적용**

```typescript
// Design Ref: platform/services/ai-service/src/lib/rag-engine.ts

// 최적화 1: 임베딩 결과 캐싱 (동일 질문 재사용)
// Plan SC: FR-AI26.1

const embeddingCache = new Map<string, number[]>();

export async function getCachedEmbedding(
  question: string,
  embedModelId?: string
): Promise<number[]> {
  const cacheKey = `embed:${question.slice(0, 100)}:${embedModelId ?? 'default'}`;

  // 메모리 캐시 (TTL 없음 — 서버 재시작 시 초기화)
  if (embeddingCache.has(cacheKey)) {
    return embeddingCache.get(cacheKey)!;
  }

  // Redis 캐시 (24시간)
  const redisKey = `rag:embedding:${Buffer.from(cacheKey).toString('base64')}`;
  const cached = await redis.getBuffer(redisKey);
  if (cached) {
    const embedding = decode(cached) as number[];
    embeddingCache.set(cacheKey, embedding);
    return embedding;
  }

  const embedding = await generateEmbedding(question, embedModelId);
  await redis.set(redisKey, Buffer.from(encode(embedding)), { EX: 86400 });
  embeddingCache.set(cacheKey, embedding);
  return embedding;
}

// 최적화 2: 벡터 검색 병렬화
// 기존: 시맨틱 검색 후 순차 컨텍스트 구성
// 개선: 검색과 메타데이터 조회 병렬화

export async function runRAGOptimized(
  tenantId: string,
  question: string,
  options: RAGOptions = {}
): Promise<RAGResponse> {
  const { topK = 5, minScore = 0.25 } = options;

  // 임베딩 생성 (캐시 우선)
  const queryEmbedding = await getCachedEmbedding(question);

  // 벡터 검색 + PII 마스킹 병렬 실행
  const [searchResults, maskedQuestion] = await Promise.all([
    semanticSearch(queryEmbedding, tenantId, topK, minScore),
    Promise.resolve(maskPII(question)),
  ]);

  // 나머지 처리...
}
```

**결과:**

```
최적화 후 측정:
  임베딩 캐시 히트율: 68% (동일/유사 질문)
  p50: 45ms (기존 180ms → -75%)
  p95: 125ms (기존 480ms → -74%)
  목표 달성: SLO p95 < 200ms 충족
```

### 7.2 시나리오 2: 멀티테넌트 쿼리 1000ms → 80ms

**문제 상황:**

```
/ai/analytics/trend API
초기 측정: p95 = 980ms
목표: p95 < 100ms
원인: 전체 테이블 스캔 (30일 데이터 집계)
```

**분석:**

```sql
-- EXPLAIN ANALYZE 결과
EXPLAIN ANALYZE
SELECT DATE_TRUNC('day', "createdAt") as day, SUM(tokens) as total
FROM "AiUsage"
WHERE "tenantId" = 'xxx' AND "createdAt" >= NOW() - INTERVAL '30 days'
GROUP BY 1 ORDER BY 1;

-- 실행 계획:
-- Seq Scan on "AiUsage" (cost=0.00..45231.00 rows=2456321) ← 전체 스캔!
-- Planning Time: 2.5ms
-- Execution Time: 876ms
```

**최적화 적용:**

```sql
-- 복합 인덱스 추가
CREATE INDEX CONCURRENTLY idx_ai_usage_tenant_created_tokens
  ON "AiUsage" ("tenantId", "createdAt" DESC)
  INCLUDE ("tokens");  -- 커버링 인덱스로 테이블 접근 제거

-- 또는 집계 결과 Materialized View (일별 배치 갱신)
CREATE MATERIALIZED VIEW daily_usage_summary AS
SELECT
  "tenantId",
  DATE_TRUNC('day', "createdAt") as usage_date,
  SUM("tokens") as total_tokens,
  COUNT(*) as request_count
FROM "AiUsage"
GROUP BY 1, 2;

CREATE UNIQUE INDEX ON daily_usage_summary ("tenantId", usage_date);

-- 매일 자정 갱신 (cron job 또는 pg_cron)
REFRESH MATERIALIZED VIEW CONCURRENTLY daily_usage_summary;
```

```typescript
// 쿼리 최적화 + Redis 캐싱 조합
export async function getUsageTrend(tenantId: string, days: number) {
  const cacheKey = `usage:trend:${tenantId}:${days}`;

  return getCachedData(
    cacheKey,
    'usage-trend',
    async () => {
      // Materialized View 조회 (1ms 이하)
      return prisma.$queryRaw`
        SELECT
          usage_date::text as day,
          total_tokens as tokens,
          request_count as requests
        FROM daily_usage_summary
        WHERE "tenantId" = ${tenantId}
          AND usage_date >= NOW() - INTERVAL '${days} days'
        ORDER BY usage_date DESC
      `;
    },
    300 // 5분 캐시 (데이터 신선도 vs 성능 트레이드오프)
  );
}
```

**결과:**

```
인덱스 추가 후:
  실행 계획: Index Scan → 커버링 인덱스 사용
  쿼리 실행 시간: 8ms (기존 876ms → -99%)
  캐시 적용 후 p95: 12ms
  목표 달성: SLO p95 < 100ms 초과 달성
```

### 7.3 시나리오 3: 알림 발송 처리량 100/s → 1000/s

**문제 상황:**

```
SLO 에스컬레이션 알림 발송
초기 처리량: ~100 TPS
목표: 1000 TPS
원인: 동기 순차 발송 + 개별 Redis SET
```

**참조 코드 (`escalation-controller.ts`):**

```typescript
// Design Ref: packages/slo-escalation/src/escalation-controller.ts

// ❌ 기존 패턴: 순차 알림 발송
for (const contact of levelPolicy.contacts) {
  await this.notify(contact.channel, contact.target, data);
  // 각 notify가 100ms → contacts 5개 = 500ms
}
```

**최적화 적용:**

```typescript
// ✅ 최적화 1: 병렬 알림 발송
await Promise.allSettled(
  levelPolicy.contacts.map(contact =>
    this.notify(contact.channel, contact.target, data)
  )
);
// contacts 5개 병렬 = 100ms (5배 향상)

// ✅ 최적화 2: 알림 큐 + 배치 처리
import { Queue, Worker } from 'bullmq';

const notificationQueue = new Queue('notifications', {
  connection: { host: 'redis', port: 6379 },
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

// 알림을 큐에 추가 (비동기, 즉시 반환)
export async function enqueueNotification(
  channel: string,
  target: string,
  data: Record<string, unknown>
): Promise<void> {
  await notificationQueue.add('send', { channel, target, data }, {
    // 중복 방지: 같은 서비스+레벨의 알림은 30초에 1번
    jobId: `${data.service}-${data.level}-${Math.floor(Date.now() / 30000)}`,
  });
}

// 배치 처리 Worker (concurrency: 50)
const notificationWorker = new Worker(
  'notifications',
  async (job) => {
    const { channel, target, data } = job.data;
    await sendToChannel(channel, target, data);
  },
  {
    connection: { host: 'redis', port: 6379 },
    concurrency: 50, // 동시 50개 처리
  }
);
```

**결과:**

```
최적화 후:
  단순 병렬화: 500 TPS
  큐 + 배치 처리: 1200 TPS
  목표 달성: 1000 TPS 초과
  추가 효과: 알림 실패 시 자동 재시도
```

---

## 8. 성능 테스트 자동화

### 8.1 k6 부하 테스트 스크립트

```javascript
// scripts/k6/rag-performance.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('error_rate');
const ragLatency = new Trend('rag_latency_ms');

export const options = {
  stages: [
    { duration: '1m', target: 10 },   // 웜업
    { duration: '3m', target: 50 },   // 목표 부하
    { duration: '1m', target: 0 },    // 쿨다운
  ],
  thresholds: {
    // SLO 기준 (DORA 게이트 연동)
    http_req_duration: ['p(95)<1500'], // RAG p95 < 1500ms
    error_rate: ['rate<0.01'],         // 에러율 1% 미만
    rag_latency_ms: ['p(99)<3000'],    // p99 < 3000ms
  },
};

export default function () {
  const payload = JSON.stringify({
    tenantId: '00000000-0000-0000-0000-000000000001',
    grade: 'O',
    question: '공공기관 정보시스템 보안 요건은 무엇인가요?',
    topK: 5,
  });

  const res = http.post(
    `${__ENV.AI_SERVICE_URL}/ai/rag/query`,
    payload,
    {
      headers: {
        'Content-Type': 'application/json',
        'x-internal-service-key': __ENV.INTERNAL_SERVICE_KEY,
      },
      timeout: '10s',
    }
  );

  const success = check(res, {
    'status 200': (r) => r.status === 200,
    '응답에 answer 포함': (r) => r.json('data.answer') !== null,
  });

  errorRate.add(!success);
  ragLatency.add(res.timings.duration);

  sleep(1);
}
```

### 8.2 DORA 게이트와 성능 테스트 연동

```yaml
# Design Ref: .gitea/workflows/dora-gate.yml — 성능 게이트 통합

# .gitea/workflows/performance-gate.yml
name: 성능 게이트

on:
  workflow_call:
    inputs:
      service:
        required: true
        type: string

jobs:
  k6-performance:
    runs-on: self-hosted
    steps:
      - name: k6 부하 테스트
        run: |
          k6 run \
            --env AI_SERVICE_URL=http://ai-service.stg.svc:3000 \
            --env INTERNAL_SERVICE_KEY=${{ secrets.INTERNAL_SERVICE_KEY }} \
            --out json=k6-results.json \
            scripts/k6/rag-performance.js

      - name: 성능 임계값 검증
        run: |
          P95=$(jq '.metrics.http_req_duration.values."p(95)"' k6-results.json)
          if (( $(echo "$P95 > 1500" | bc -l) )); then
            echo "::error::성능 게이트 실패: RAG p95 ${P95}ms > 1500ms"
            exit 1
          fi
          echo "성능 게이트 통과: p95 ${P95}ms"
```

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|-----|------|------|-------|
| 1.0.0 | 2026-04-12 | 최초 작성 — Node.js + Fastify 성능 최적화 완전 가이드 | Implementer (Sonnet) |
