# 10장: 심화 디버깅 가이드

> **버전**: 1.0.0 | **작성일**: 2026-04-12
> **대상**: 개발자, DevOps 엔지니어 (분산 시스템 디버깅 경험자)
> **CSAP**: D-06 (침해사고 관리), D-12 (시스템 개발 보안)
> **선행 문서**: `09-troubleshooting/02-debugging-guide.md` (기초 디버깅 필수 이수)
> **관련 서비스**: `platform/services/ai-service/src/routes.ts`, Tempo, Loki, Pyroscope

이 문서는 기초 디버깅(`02-debugging-guide.md`)을 이미 이수한 분을 위한 심화 과정입니다. 분산 시스템 특유의 복잡한 문제를 추적하고, 메모리 누수를 분석하며, 슬로우 쿼리를 최적화하는 방법을 다룹니다.

---

## 목차

1. [디버깅 마인드셋: 5-Why 심화](#1-디버깅-마인드셋-5-why-심화)
2. [로컬 디버깅 심화](#2-로컬-디버깅-심화)
3. [분산 시스템 디버깅](#3-분산-시스템-디버깅)
4. [메모리 누수 디버깅](#4-메모리-누수-디버깅)
5. [DB 쿼리 디버깅](#5-db-쿼리-디버깅)
6. [실전 디버깅 시나리오 3가지](#6-실전-디버깅-시나리오-3가지)
7. [디버깅 도구 치트시트](#7-디버깅-도구-치트시트)
8. [학습 체크리스트](#8-학습-체크리스트)
9. [다음 단계](#9-다음-단계)

---

## 1. 디버깅 마인드셋: 5-Why 심화

### 1.1 분산 시스템에서 5-Why가 어려운 이유

기초 디버깅 가이드에서 5-Why 방법론을 배웠습니다. 분산 시스템에서는 같은 방법론이 훨씬 복잡해집니다. 하나의 사용자 요청이 수십 개의 서비스를 거치기 때문입니다.

```
단일 서비스 시대:
  사용자 요청 → 서버 → DB
  (로그 하나, 에러 스택 트레이스 하나)

분산 시스템 시대:
  사용자 요청 → API Gateway → Auth Service → User Service → AI Service
                                                         → DB (Prisma)
                                                         → Redis (캐시)
                                                         → 외부 LLM API
  (8개 서비스의 로그, 여러 DB 쿼리, 네트워크 레이턴시)
```

### 1.2 분산 시스템 5-Why 예시

```
증상: "AI 채팅 API가 P99 기준 15초 이상 걸린다"

1번째 왜?
  도구: Grafana → Tempo에서 느린 Trace 찾기
  발견: ai-service의 /ai/chat 핸들러가 12초를 소비
  답: ai-service 내부에서 병목 발생

2번째 왜?
  도구: Tempo Trace 상세 → ai-service 내 Span 확인
  발견: ragQueryHandler에서 vector_store.search() 호출이 10초
  답: 벡터 검색 쿼리가 너무 느림

3번째 왜?
  도구: PostgreSQL pg_stat_statements
  발견: pgvector의 <=> 연산자가 인덱스를 사용하지 않고 순차 스캔 중
  답: 벡터 인덱스 없이 풀 스캔

4번째 왜?
  도구: EXPLAIN ANALYZE 실행
  발견: vector_embeddings 테이블에 ivfflat 인덱스가 없음
  답: 마이그레이션 파일에 인덱스 생성이 누락됨

5번째 왜?
  도구: git log -- migrations/
  발견: 지난 배포에서 새 테이블만 생성하고 인덱스 마이그레이션이 별도 PR이었는데 누락됨
  답: PR 체크리스트에 "마이그레이션 파일에 인덱스 포함 확인" 항목 없음

근본 원인: DB 마이그레이션 PR 리뷰 체크리스트 불완전
해결책:
  즉시: CREATE INDEX CONCURRENTLY ... 실행
  근본: PR 체크리스트에 벡터 인덱스 확인 항목 추가
```

### 1.3 "탓하지 않는" 사후 분석 (Blameless Postmortem)

심각한 장애 후에는 사후 분석 문서를 작성합니다. 이 문서는 누구의 잘못인지가 아닌 시스템 개선에 초점을 맞춥니다.

```markdown
# 사후 분석: AI 채팅 레이턴시 급증 (2026-04-11)

## 요약
- 영향: AI 채팅 P99 레이턴시 15초 이상 (정상: 2초), 2시간 지속
- 원인: pgvector 인덱스 마이그레이션 누락
- 해결: 인덱스 생성으로 즉시 복구 (RTO 15분)

## 타임라인
- 14:00 - 배포 완료 (v1.4.2)
- 14:05 - 알림: ai-service P99 > 5s
- 14:12 - 엔지니어 조사 시작
- 14:25 - 원인 파악 (인덱스 누락)
- 14:35 - 인덱스 생성 완료, 서비스 정상화

## 5-Why 분석
(위의 예시 내용)

## 재발 방지 조치
- [ ] PR 체크리스트에 마이그레이션 인덱스 확인 항목 추가 (담당: xxx, 기한: 04-15)
- [ ] pgvector 인덱스 존재 여부 자동 검사 CI 추가 (담당: yyy, 기한: 04-20)
- [ ] 느린 벡터 쿼리 Prometheus 알림 추가 (담당: zzz, 기한: 04-18)
```

---

## 2. 로컬 디버깅 심화

### 2.1 VS Code 디버거로 Fastify 서비스 브레이크포인트 설정

로컬에서 코드의 특정 지점에 브레이크포인트를 설정하면 변수 값을 실시간으로 확인할 수 있습니다. `console.log`보다 훨씬 강력합니다.

#### VS Code launch.json 설정

```jsonc
// .vscode/launch.json (프로젝트 루트)
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug: ai-service",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/platform/services/ai-service/src/index.ts",
      "runtimeExecutable": "node",
      "runtimeArgs": [
        "--loader", "ts-node/esm",
        "--inspect"
      ],
      "env": {
        "NODE_ENV": "development",
        "PORT": "3010",
        "DATABASE_URL": "postgresql://postgres:postgres@localhost:5432/saas_dev"
      },
      "sourceMaps": true,
      "outFiles": ["${workspaceFolder}/platform/services/ai-service/dist/**/*.js"],
      "resolveSourceMapLocations": [
        "${workspaceFolder}/**",
        "!**/node_modules/**"
      ],
      "skipFiles": ["<node_internals>/**", "**/node_modules/**"]
    },
    {
      "name": "Debug: auth-service",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/platform/services/auth-service/src/index.ts",
      "runtimeExecutable": "node",
      "runtimeArgs": ["--loader", "ts-node/esm", "--inspect"],
      "env": {
        "NODE_ENV": "development",
        "PORT": "3001"
      },
      "sourceMaps": true,
      "skipFiles": ["<node_internals>/**", "**/node_modules/**"]
    },
    {
      "name": "Debug: 현재 파일 (TypeScript)",
      "type": "node",
      "request": "launch",
      "program": "${file}",
      "runtimeExecutable": "node",
      "runtimeArgs": ["--loader", "ts-node/esm"],
      "sourceMaps": true,
      "skipFiles": ["<node_internals>/**", "**/node_modules/**"]
    }
  ]
}
```

#### 브레이크포인트 사용법

```
1. VS Code에서 디버깅하려는 .ts 파일 열기
2. 줄 번호 왼쪽을 클릭 → 빨간 점(브레이크포인트) 생성
3. F5 또는 "Run and Debug" → "Debug: ai-service" 선택
4. API 요청 전송 (curl 또는 Postman으로)
5. 브레이크포인트에서 자동 멈춤
6. 패널에서 변수 값 확인:
   - Variables: 현재 스코프의 모든 변수
   - Watch: 특정 표현식 계산
   - Call Stack: 호출 스택 전체

단계 실행:
   F10: 다음 줄 (Step Over) — 함수 내부 진입 없이
   F11: 함수 내부로 진입 (Step Into)
   Shift+F11: 현재 함수에서 빠져나옴 (Step Out)
   F5: 다음 브레이크포인트까지 실행 (Continue)
```

### 2.2 Node.js 인스펙터 모드

VS Code 없이 Chrome DevTools에서 디버깅할 수 있습니다.

```bash
# 인스펙터 모드로 서비스 시작 (시작 즉시 일시 중지)
node --inspect-brk \
  --loader ts-node/esm \
  platform/services/ai-service/src/index.ts

# 출력:
# Debugger listening on ws://127.0.0.1:9229/uuid-here
# For help, see: https://nodejs.org/en/docs/inspector
# Debugger attached.

# Chrome에서 디버거 열기:
# 주소창에 입력: chrome://inspect
# "Remote Target"의 "inspect" 클릭
```

```bash
# 이미 실행 중인 Node.js 프로세스에 디버거 연결
# (서비스를 재시작하지 않고도 가능)
kill -USR1 $(pgrep -f "ai-service")
# → 9229 포트로 디버거 활성화됨
```

### 2.3 TypeScript Source Maps 설정

Source Maps가 없으면 디버거에서 컴파일된 JavaScript만 보입니다. TypeScript 원본 코드를 보려면 Source Maps를 활성화해야 합니다.

```jsonc
// platform/services/ai-service/tsconfig.json
{
  "compilerOptions": {
    "sourceMap": true,           // Source Map 생성 필수
    "inlineSources": true,       // Map 파일에 원본 소스 포함 (한 파일로 통합)
    "outDir": "./dist",
    "rootDir": "./src",
    "target": "ESNext",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "declaration": true,
    "declarationMap": true       // .d.ts 파일에도 Map 포함
  }
}
```

```bash
# Source Map이 올바르게 생성되었는지 확인
ls platform/services/ai-service/dist/
# → index.js, index.js.map, handlers/, lib/ ...

# .map 파일 내용 확인 (sources 필드에 원본 경로 있어야 함)
node -e "const m = require('./platform/services/ai-service/dist/index.js.map'); console.log(m.sources)"
```

### 2.4 조건부 브레이크포인트 (고급)

특정 조건에서만 브레이크포인트를 발동시킬 수 있습니다.

```
VS Code에서:
  1. 브레이크포인트 우클릭 → "Edit Breakpoint"
  2. Expression 입력: tenantId === 'tenant-abc-problematic'

→ 해당 tenantId를 가진 요청에서만 멈춤
  (모든 요청에서 멈추면 디버깅이 너무 느려지므로)
```

```typescript
// 코드 레벨에서 조건부 디버거 진입
export async function chatHandler(request: FastifyRequest, reply: FastifyReply) {
  const { tenantId } = request.body;

  // 특정 테넌트에서만 디버거 활성화
  if (tenantId === 'tenant-problematic-001' && process.env.NODE_ENV === 'development') {
    debugger;  // VS Code 디버거가 여기서 멈춤
  }

  // ... 나머지 로직
}
```

---

## 3. 분산 시스템 디버깅

### 3.1 분산 추적의 전체 흐름

```mermaid
sequenceDiagram
  participant USER as 사용자
  participant GW as API Gateway
  participant AUTH as auth-service
  participant AI as ai-service
  participant DB as PostgreSQL
  participant TEMPO as Grafana Tempo

  USER->>GW: POST /ai/chat (TraceID 자동 생성)
  GW->>AUTH: 인증 검사 (TraceID 전파)
  AUTH-->>GW: 200 OK (10ms)
  GW->>AI: POST /ai/chat (동일 TraceID)
  AI->>DB: SELECT embeddings... (TraceID 전파)
  DB-->>AI: 결과 반환 (8500ms!) ← 문제!
  AI-->>GW: 응답
  GW-->>USER: 응답 (총 8600ms)

  GW--)TEMPO: Span 전송 (비동기)
  AUTH--)TEMPO: Span 전송 (비동기)
  AI--)TEMPO: Span 전송 (비동기)
  DB--)TEMPO: Span 전송 (비동기)

  Note over TEMPO: TraceID로 모든 Span 연결<br/>전체 요청 흐름 시각화
```

### 3.2 Tempo TraceQL로 특정 요청 추적하기

#### TraceQL 기본 문법

```
# Grafana Explore → 데이터소스: Tempo 선택

# 기본: 서비스로 검색
{ resource.service.name = "ai-service" }

# HTTP 상태 코드로 필터링
{ resource.service.name = "ai-service" && http.status_code = 500 }

# 레이턴시 기준 필터 (5초 이상 걸린 요청)
{ resource.service.name = "ai-service" && duration > 5s }

# 특정 에러가 발생한 트레이스
{ resource.service.name = "ai-service" && status = error }

# tenantId로 특정 테넌트 요청만
{ resource.service.name = "ai-service" && span.tenantId = "tenant-001" }
```

#### 실전 TraceQL 쿼리

```
# 시나리오: "어제 오후 특정 테넌트에서 에러가 있었는데 무슨 일이 있었는지 확인"

# Step 1: 에러 있는 Trace 찾기
{ resource.service.name = "ai-service" && status = error }
  | select(span.tenantId, http.url, span.error.message)

# Step 2: 해당 Trace ID 클릭 → Trace 상세 보기
# → 각 Span의 소요 시간과 태그 확인

# Step 3: 느린 Span 찾기 (10초 이상)
{ resource.service.name = "ai-service" } | rate()
{ duration > 10s } | select(name, duration, span.error)

# Step 4: 특정 Span 이름으로 검색 (DB 쿼리 Span)
{ span.db.system = "postgresql" && duration > 1s }
  | select(span.db.statement, duration)
```

#### Trace에서 Span 구조 이해하기

```
Trace (전체 요청 흐름)
  └── Span: api-gateway.POST /ai/chat  (총 8650ms)
        ├── Span: auth-service.verifyToken  (8ms)
        └── Span: ai-service.chatHandler  (8600ms)
              ├── Span: ai-service.ragQuery  (8550ms)
              │     ├── Span: postgresql.SELECT (8500ms) ← 병목!
              │     └── Span: redis.GET (5ms)
              └── Span: ai-service.formatResponse (45ms)

이 Trace를 보면:
- 전체 8650ms 중 8500ms가 PostgreSQL 쿼리
- ragQuery의 vector_store.search() 호출 내부
```

### 3.3 Loki LogQL로 에러 패턴 찾기

#### LogQL 기본 문법

```
# Grafana Explore → 데이터소스: Loki 선택

# 기본: 서비스 로그 보기
{app="ai-service"}

# 에러 레벨만 필터
{app="ai-service"} | json | level="error"

# 특정 키워드 포함 로그
{app="ai-service"} |= "tenantId" |= "error"

# 특정 시간 범위의 에러
{app="ai-service", namespace="saas-platform"}
  | json
  | level="error"
  | line_format "{{.timestamp}} [{{.level}}] {{.msg}}"
```

#### 실전 LogQL 쿼리

```
# 1. 에러 발생 빈도 (시계열 그래프)
sum by (app) (
  rate({namespace="saas-platform"} |= "error" [5m])
)

# 2. 특정 tenantId의 모든 로그
{namespace="saas-platform"} | json | tenantId="tenant-001"
  | line_format "[{{.level}}] {{.msg}} ({{.timestamp}})"

# 3. 지난 1시간 에러 메시지 유형 집계
{namespace="saas-platform"}
  | json
  | level="error"
  | line_format "{{.msg}}"
  | pattern `<message>`
  | label_format error_type=message

# 4. 응답 시간 분포 (숫자 추출)
{app="ai-service"} | json | responseTime > 5000
  | unwrap responseTime
  | quantile_over_time(0.99, [1h]) by (route)
```

### 3.4 stern으로 여러 서비스 로그 동시 보기

```bash
# stern 설치
kubectl krew install stern

# 또는 바이너리 직접 설치
curl -sL https://github.com/stern/stern/releases/download/v1.28.0/stern_1.28.0_linux_amd64.tar.gz \
  | tar xz && sudo mv stern /usr/local/bin/

# 기본 사용: 네임스페이스의 모든 Pod 로그
stern . -n saas-platform

# 특정 서비스만 (레이블 또는 이름 패턴)
stern "ai-service|auth-service" -n saas-platform

# 에러만 필터링 (컬러 출력)
stern . -n saas-platform | grep -E '"level":"error"'

# 특정 tenantId 관련 로그만
stern . -n saas-platform | grep "tenant-001"

# JSON 로그를 읽기 쉽게 포맷 (jq 사용)
stern . -n saas-platform --output raw | \
  grep '"level":"error"' | \
  jq -r '"\(.ts) [\(.level)] \(.service): \(.msg)"'

# 특정 시간 이후 로그만 (분산 추적 시 유용)
stern . -n saas-platform --since 30m

# 여러 네임스페이스 동시 모니터링
stern . -n saas-platform -n velero -n monitoring
```

#### stern 출력 예시

```
+ ai-service-7f9b-xxxxx › ai-service
+ auth-service-5c8a-xxxxx › auth-service

ai-service-7f9b-xxxxx ai-service {"level":"info","ts":"14:00:01","msg":"요청 처리","tenantId":"t-001","route":"/ai/chat"}
auth-service-5c8a-xxxxx auth-service {"level":"info","ts":"14:00:01","msg":"토큰 검증","userId":"u-123"}
ai-service-7f9b-xxxxx ai-service {"level":"error","ts":"14:00:09","msg":"벡터 검색 타임아웃","tenantId":"t-001","duration":8500}
```

---

## 4. 메모리 누수 디버깅

### 4.1 메모리 누수 증상 파악

```mermaid
graph TD
  A([메모리 알림 수신\nPod 메모리 > 80%]) --> B{패턴 확인}

  B -->|"재시작 후 서서히 증가\n(수 시간~수 일)"| C["메모리 누수 의심\n힙 스냅샷 분석 필요"]
  B -->|"특정 요청 후 급증"| D["요청 처리 코드에\n대용량 객체 유지 의심"]
  B -->|"재시작 후 즉시 높음"| E["초기화 시 로드하는\n데이터 크기 확인"]

  C --> F["Node.js 힙 스냅샷 생성"]
  D --> G["해당 요청 처리 코드 리뷰\n(클로저, 전역 변수, 캐시)"]
  E --> H["시작 시 로드 데이터 확인\n(config, 모델, DB 커넥션)"]

  style A fill:#F44336,color:#fff
  style C fill:#FF9800,color:#fff
```

### 4.2 Node.js 힙 스냅샷 생성 및 분석

```bash
# 방법 1: 인스펙터 모드로 실행 후 Chrome DevTools에서 스냅샷
node --inspect platform/services/ai-service/src/index.ts

# Chrome 열기: chrome://inspect → inspect 클릭
# Memory 탭 → "Take heap snapshot" 클릭
# → 힙 스냅샷 파일(.heapsnapshot) 저장됨
```

```typescript
// 방법 2: 코드에서 자동 힙 스냅샷 생성 (의심 시점에)
import v8 from 'v8';
import fs from 'fs';
import path from 'path';

// 힙 스냅샷을 파일로 저장하는 유틸리티
function takeHeapSnapshot(label: string): void {
  const filename = `heap-snapshot-${label}-${Date.now()}.heapsnapshot`;
  const snapshotPath = path.join('/tmp', filename);

  const snapshotStream = v8.writeHeapSnapshot(snapshotPath);
  console.log(`힙 스냅샷 저장됨: ${snapshotStream}`);
}

// 메모리 사용량 주기적 모니터링
setInterval(() => {
  const memUsage = process.memoryUsage();
  const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);

  console.log(`메모리 현황: heap ${heapUsedMB}MB / ${heapTotalMB}MB`);

  // 힙이 500MB 초과 시 자동 스냅샷 (누수 감지용)
  if (heapUsedMB > 500) {
    takeHeapSnapshot(`high-memory-${heapUsedMB}mb`);
  }
}, 60_000);  // 1분마다
```

#### 힙 스냅샷 분석 방법 (Chrome DevTools)

```
Chrome DevTools → Memory 탭

1. "Load profile" → 스냅샷 파일 열기

2. 분석 뷰 선택:
   - Summary: 객체 유형별 크기 (일반적으로 여기서 시작)
   - Comparison: 두 스냅샷 비교 (누수 탐지에 최적)
   - Containment: 객체 참조 트리 (무엇이 무엇을 보유하는지)

3. Summary 뷰에서 주목할 컬럼:
   - Shallow Size: 객체 자체의 메모리
   - Retained Size: 이 객체가 사라지면 해제될 수 있는 전체 메모리
   (Retained Size가 큰 객체가 누수 원인인 경우 많음)

4. 누수 탐지 절차:
   a) 스냅샷 1 촬영 (서비스 시작 직후)
   b) 문제 요청 100번 반복
   c) GC 강제 실행 (DevTools 쓰레기통 아이콘)
   d) 스냅샷 2 촬영
   e) Comparison 뷰 → 스냅샷 1 대비 스냅샷 2 비교
   f) "# Delta" 컬럼에서 갑자기 늘어난 객체 유형 확인
```

#### 흔한 메모리 누수 패턴

```typescript
// 패턴 1: 클로저 누수 — 전역 핸들러에 요청 컨텍스트 캡처
// ❌ 나쁜 예: 요청마다 핸들러가 계속 추가됨
const globalEventEmitter = new EventEmitter();

app.addHook('onRequest', async (request) => {
  // 이 클로저가 request 객체를 계속 참조
  globalEventEmitter.on('data', (data) => {
    request.log.info(data);  // request가 GC되지 않음!
  });
});

// ✅ 좋은 예: 요청 완료 후 핸들러 제거
app.addHook('onRequest', async (request) => {
  const handler = (data: unknown) => {
    request.log.info(data);
  };
  globalEventEmitter.on('data', handler);

  request.raw.on('close', () => {
    globalEventEmitter.off('data', handler);  // 요청 종료 시 핸들러 제거
  });
});

// 패턴 2: 캐시 크기 제한 없음
// ❌ 나쁜 예
const cache = new Map<string, Buffer>();  // 크기 제한 없음 → 무한 증가
app.get('/api/data', async (req) => {
  if (!cache.has(req.query.id)) {
    cache.set(req.query.id, await loadLargeData(req.query.id));
  }
  return cache.get(req.query.id);
});

// ✅ 좋은 예: LRU 캐시 사용
import { LRUCache } from 'lru-cache';
const cache = new LRUCache<string, Buffer>({
  max: 100,           // 최대 100개
  maxSize: 50 * 1024 * 1024,  // 최대 50MB
  sizeCalculation: (value) => value.byteLength,
  ttl: 1000 * 60 * 5,  // 5분 TTL
});

// 패턴 3: 미완료 Promise 누수
// ❌ 나쁜 예: await 없이 배열에 쌓기
const pendingPromises: Promise<void>[] = [];
app.post('/api/log', async (req) => {
  // 완료를 기다리지 않고 계속 쌓임
  pendingPromises.push(writeToExternalStorage(req.body));
  return { ok: true };
});

// ✅ 좋은 예: 완료 처리 또는 크기 제한
const queue: Promise<void>[] = [];
const MAX_QUEUE = 100;

async function processLog(data: unknown) {
  if (queue.length >= MAX_QUEUE) {
    await Promise.race(queue);  // 하나 완료될 때까지 대기
  }
  const p = writeToExternalStorage(data).finally(() => {
    const idx = queue.indexOf(p);
    if (idx > -1) queue.splice(idx, 1);
  });
  queue.push(p);
}
```

### 4.3 Pyroscope 플레임 그래프로 메모리 핫스팟 찾기

Pyroscope는 연속적으로 Node.js 프로세스를 프로파일링하여 어떤 함수가 가장 많은 메모리/CPU를 사용하는지 보여줍니다.

```bash
# Grafana에서 Pyroscope 접속
# 메뉴: Explore → 데이터소스: Pyroscope

# 쿼리 예시:
# process_cpu:cpu:nanoseconds:cpu:nanoseconds{service_name="ai-service"}

# 플레임 그래프 읽는 법:
# - X축 = 전체 CPU 시간 중 비율
# - Y축 = 호출 스택 깊이 (아래가 최상위, 위로 갈수록 내부 함수)
# - 넓을수록 = 해당 함수가 더 많은 시간을 소비

# 가장 넓은 블록을 클릭 → 해당 함수의 전체 호출 스택 확인
```

```typescript
// 서비스에 Pyroscope 연동 추가
import Pyroscope from '@pyroscope/nodejs';

// 서비스 시작 시 프로파일러 시작
Pyroscope.init({
  serverAddress: process.env.PYROSCOPE_SERVER_ADDRESS ?? 'http://pyroscope:4040',
  appName: process.env.APP_NAME ?? 'ai-service',
  tags: {
    environment: process.env.NODE_ENV ?? 'development',
    version: process.env.APP_VERSION ?? 'unknown',
  },
});

Pyroscope.start();
```

---

## 5. DB 쿼리 디버깅

### 5.1 Prisma 쿼리 이벤트 활성화

Prisma의 실제 SQL을 보려면 이벤트 리스너를 등록해야 합니다. 프로덕션에서는 느린 쿼리만 로깅하도록 제한합니다.

```typescript
// platform/services/user-service/src/lib/prisma.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? [
        { emit: 'event', level: 'query' },   // 개발: 모든 쿼리
        { emit: 'event', level: 'warn' },
        { emit: 'event', level: 'error' },
      ]
    : [
        { emit: 'event', level: 'warn' },   // 프로덕션: 경고만
        { emit: 'event', level: 'error' },
      ],
});

// 쿼리 이벤트 핸들러 (개발 환경)
if (process.env.NODE_ENV === 'development') {
  prisma.$on('query', (event) => {
    const durationMs = event.duration;

    // 100ms 이상 걸린 쿼리만 상세 출력
    if (durationMs > 100) {
      console.warn(`[SLOW QUERY] ${durationMs}ms`);
      console.warn(`SQL: ${event.query}`);
      console.warn(`Params: ${event.params}`);
    } else {
      console.log(`[QUERY] ${durationMs}ms: ${event.query.substring(0, 100)}...`);
    }
  });
}

// 슬로우 쿼리 미들웨어 (프로덕션용 — 1초 초과 시 로그)
prisma.$use(async (params, next) => {
  const start = Date.now();
  const result = await next(params);
  const duration = Date.now() - start;

  if (duration > 1000) {
    // 구조화 로그로 Loki에 전송됨
    console.error(JSON.stringify({
      level: 'warn',
      msg: 'SLOW_PRISMA_QUERY',
      model: params.model,
      action: params.action,
      durationMs: duration,
    }));
  }

  return result;
});

export { prisma };
```

### 5.2 PostgreSQL pg_stat_statements로 슬로우 쿼리 분석

```sql
-- pg_stat_statements 확장 활성화 (최초 1회)
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- 가장 오래 걸린 상위 10개 쿼리
SELECT
  calls,                                          -- 호출 횟수
  ROUND((mean_exec_time)::numeric, 2) AS avg_ms,  -- 평균 실행시간 (ms)
  ROUND((total_exec_time)::numeric, 2) AS total_ms,
  rows / calls AS avg_rows,                       -- 평균 반환 행 수
  LEFT(query, 150) AS query_preview               -- 쿼리 미리보기
FROM pg_stat_statements
WHERE calls > 100  -- 100회 이상 호출된 쿼리만
ORDER BY mean_exec_time DESC
LIMIT 10;

-- 가장 자주 호출되는 쿼리 (I/O 부하)
SELECT
  calls,
  ROUND((mean_exec_time)::numeric, 2) AS avg_ms,
  LEFT(query, 150) AS query_preview
FROM pg_stat_statements
ORDER BY calls DESC
LIMIT 10;

-- 총 실행 시간이 가장 긴 쿼리 (서버 부하 원인)
SELECT
  calls,
  ROUND((total_exec_time / 1000)::numeric, 2) AS total_seconds,
  ROUND((mean_exec_time)::numeric, 2) AS avg_ms,
  LEFT(query, 150) AS query_preview
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 10;

-- 인덱스를 사용하지 않는 쿼리 찾기 (블록 히트율이 낮은 쿼리)
SELECT
  calls,
  ROUND((mean_exec_time)::numeric, 2) AS avg_ms,
  shared_blks_read,
  shared_blks_hit,
  ROUND(
    (shared_blks_hit::numeric / NULLIF(shared_blks_hit + shared_blks_read, 0)) * 100,
    1
  ) AS cache_hit_ratio,
  LEFT(query, 150) AS query_preview
FROM pg_stat_statements
WHERE calls > 50
  AND (shared_blks_hit + shared_blks_read) > 0
ORDER BY cache_hit_ratio ASC  -- 캐시 히트율이 낮을수록 인덱스 미사용 가능성
LIMIT 10;

-- 슬로우 쿼리 통계 초기화 (분석 후)
SELECT pg_stat_statements_reset();
```

### 5.3 EXPLAIN ANALYZE 결과 해석

슬로우 쿼리를 찾았다면 `EXPLAIN ANALYZE`로 실제 실행 계획을 확인합니다.

```sql
-- 실제 실행 계획 확인 (데이터를 실제로 읽음 — 신중하게 사용)
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT u.*, t.name AS tenant_name
FROM users u
JOIN tenants t ON t.id = u.tenant_id
WHERE u.email = 'user@example.com'
  AND u.deleted_at IS NULL;
```

EXPLAIN ANALYZE 출력 읽기:

```
Nested Loop  (cost=0.56..16.61 rows=1 width=256) (actual time=8500.123..8500.156 rows=1 loops=1)
  →  Index Scan using users_email_idx on users u  (cost=0.56..8.58 rows=1 width=200) (actual time=0.052..0.060 rows=1 loops=1)
       Index Cond: ((email)::text = 'user@example.com'::text)
       Filter: (deleted_at IS NULL)
  →  Seq Scan on tenants t  (cost=0.00..8.03 rows=1 width=64) (actual time=8500.060..8500.090 rows=1 loops=1)
       Filter: (id = u.tenant_id)
       Rows Removed by Filter: 9999   ← 10,000행을 순차 스캔!

Planning Time: 0.134 ms
Execution Time: 8500.201 ms          ← 8.5초 소요!
```

읽기 가이드:

| 키워드 | 의미 | 좋은가? |
|--------|------|---------|
| `Index Scan` | 인덱스를 사용한 검색 | 좋음 |
| `Index Only Scan` | 인덱스만으로 모든 데이터 조회 | 최상 |
| `Seq Scan` | 테이블 전체 순차 스캔 | 대부분 나쁨 (소규모 테이블 제외) |
| `Bitmap Heap Scan` | 인덱스 결과를 힙에서 가져옴 | 보통 |
| `Hash Join` | 해시 기반 조인 | 대용량 조인에서 좋음 |
| `Nested Loop` | 중첩 루프 조인 | 소규모 결과에서 좋음 |
| `actual time=X..Y` | 실제 소요 시간 (X: 첫 행, Y: 마지막 행) | 작을수록 좋음 |
| `rows=N loops=M` | 반환 행 수 × 루프 횟수 | 추정(cost) vs 실제(actual) 크게 다르면 통계 업데이트 필요 |

```sql
-- 위 예시 해결: tenants.id에 인덱스 추가
CREATE INDEX CONCURRENTLY idx_tenants_id ON tenants(id);
-- CONCURRENTLY: 테이블 잠금 없이 인덱스 생성 (프로덕션 안전)

-- 통계 업데이트 (추정 vs 실제가 많이 다를 때)
ANALYZE users;
ANALYZE tenants;
```

---

## 6. 실전 디버깅 시나리오 3가지

### 시나리오 1: API P99 레이턴시가 갑자기 5배 증가

```mermaid
flowchart LR
  A([알림: P99 > 5s]) --> B["Grafana 대시보드\n어떤 API가 느린지 확인"]
  B --> C["Tempo에서\n느린 Trace 조회"]
  C --> D["Trace 내 느린 Span\n특정 (DB 쿼리? 외부 API?)"]
  D --> E{병목 위치}
  E -->|DB| F["EXPLAIN ANALYZE\npg_stat_statements 확인"]
  E -->|외부 API| G["외부 API 레이턴시\n확인 (타임아웃 설정)"]
  E -->|코드 내부| H["Pyroscope 플레임 그래프\n확인"]
  F --> I["인덱스 추가\n또는 쿼리 최적화"]
  G --> J["Circuit Breaker 설정\n또는 캐싱 추가"]
  H --> K["알고리즘 개선\n또는 캐싱 추가"]
```

```bash
# Step 1: Grafana에서 알림 확인
# Alerting → Alert rules → "API Latency P99" 알림 클릭

# Step 2: 어떤 서비스/API가 느린지
# Metrics → saas-platform namespace → http_request_duration_seconds p99

# Step 3: Tempo에서 느린 Trace 찾기 (TraceQL)
# { duration > 5s && resource.service.name =~ ".*service" }

# Step 4: 특정 서비스의 느린 구간 식별
# → Trace 상세에서 가장 넓은 Span 클릭

# Step 5: DB 쿼리가 원인인 경우
kubectl exec -n saas -it $(kubectl get pod -n saas -l cnpg.io/cluster=saas-main-db -l role=primary -o name) \
  -- psql -U saas_user -d saas_db -c "
    SELECT calls, mean_exec_time::int, LEFT(query, 100)
    FROM pg_stat_statements
    WHERE mean_exec_time > 1000
    ORDER BY mean_exec_time DESC
    LIMIT 5;
  "

# Step 6: 문제 쿼리 EXPLAIN ANALYZE
kubectl exec -n saas -it $(kubectl get pod -n saas -l role=primary -o name) \
  -- psql -U saas_user -d saas_db -c "
    EXPLAIN (ANALYZE, BUFFERS)
    SELECT * FROM vector_embeddings
    WHERE tenant_id = 'abc'
    ORDER BY embedding <=> '[0.1, 0.2, ...]'::vector
    LIMIT 5;
  "
```

### 시나리오 2: Pod OOMKilled 발생

```bash
# Step 1: OOMKilled 확인
kubectl get pods -n saas-platform | grep -v Running

# Step 2: 상세 정보 확인
kubectl describe pod <pod-name> -n saas-platform
# 확인 포인트:
# - Last State: OOMKilled (확인됨)
# - Exit Code: 137 (OOM Kill 코드)
# - Restart Count: N회 반복

# Step 3: 이전 로그 확인 (종료 직전 무슨 일이 있었나)
kubectl logs <pod-name> -n saas-platform --previous --tail=200

# Step 4: 메모리 사용 추이 확인 (Grafana)
# → container_memory_working_set_bytes{pod=~"ai-service-.*"} 쿼리
# → 시계열 그래프에서 OOM 직전 급증 패턴 확인

# Step 5: 원인별 대응

# 대응 1: limits가 너무 낮은 경우 (즉시 대응)
kubectl set resources deployment/ai-service \
  -n saas-platform \
  --limits=memory=2Gi  # 기존 1Gi → 2Gi

# 대응 2: 메모리 누수인 경우 (4.2절의 힙 스냅샷 방법으로 분석)
# → 힙 스냅샷 생성 → Chrome DevTools에서 분석

# 대응 3: 특정 요청에서 대용량 객체 생성 의심
# → Loki에서 OOM 직전 처리된 요청 패턴 확인
# {app="ai-service"} | json | level="info"
# → 직전 요청의 content-length 또는 document 크기 확인

# Step 6: 힙 덤프 자동 생성 설정
# OOM 전에 힙 덤프를 생성하는 환경 변수 설정
kubectl set env deployment/ai-service \
  -n saas-platform \
  NODE_OPTIONS="--max-old-space-size=1536 --heapsnapshot-near-heap-limit=2"
```

### 시나리오 3: 특정 테넌트만 404 에러 발생

```bash
# Step 1: 특정 테넌트 에러 로그 확인 (Loki)
# LogQL:
# {namespace="saas-platform"} | json | tenantId="tenant-abc-001" | level="error"

# Step 2: 404 에러 패턴 확인
# 어떤 URL에서 404가 발생하는가?
# {namespace="saas-platform"} | json
#   | tenantId="tenant-abc-001"
#   | http_status="404"
#   | line_format "{{.http_method}} {{.http_url}} ({{.ts}})"

# Step 3: 해당 리소스 존재 여부 확인
kubectl exec -n saas -it $(kubectl get pod -n saas -l role=primary -o name) \
  -- psql -U saas_user -d saas_db -c "
    SELECT id, name, is_active, deleted_at
    FROM tenants
    WHERE id = 'tenant-abc-001';
  "

# Step 4: tenant-service에서 라우팅 확인
kubectl exec -n saas-platform -it \
  $(kubectl get pod -n saas-platform -l app=tenant-service -o name | head -1) \
  -- wget -qO- "http://localhost:3003/internal/tenants/tenant-abc-001" 2>&1

# Step 5: ConfigMap 또는 Feature Flag 확인
# 해당 테넌트에 특별한 설정이 있는지
kubectl get configmap tenant-abc-001-config -n saas-platform 2>/dev/null

# Step 6: 피처 플래그 상태 확인
# Unleash 콘솔에서 해당 테넌트의 플래그 상태 확인
curl -H "Authorization: ${UNLEASH_API_KEY}" \
  "http://unleash-edge:3063/api/client/features" | \
  jq '.features[] | select(.strategies[].parameters.tenantId == "tenant-abc-001")'

# Step 7: Trace로 정확한 실패 지점 확인 (Tempo)
# { resource.service.name = "api-gateway" && span.tenantId = "tenant-abc-001" && status = error }

# Step 8: 발견된 원인 예시들
# - 테넌트 DB 레코드의 deleted_at이 설정되어 있음 (소프트 삭제됨)
# - 해당 테넌트에만 특정 피처 플래그가 OFF 상태
# - tenant-service의 캐시에 잘못된 데이터
# → Redis에서 캐시 무효화:
kubectl exec -n saas-platform -it \
  $(kubectl get pod -n saas-platform -l app=redis -o name | head -1) \
  -- redis-cli DEL "tenant:cache:tenant-abc-001"
```

---

## 7. 디버깅 도구 치트시트

### 7.1 kubectl 심화 명령어

```bash
# ── Pod 상태 진단 ──────────────────────────────

# OOMKilled된 Pod만 보기
kubectl get pods -n saas-platform -o json | \
  jq '.items[] | select(.status.containerStatuses[].lastState.terminated.reason == "OOMKilled") | .metadata.name'

# 재시작 횟수 많은 Pod 정렬
kubectl get pods -n saas-platform --sort-by='.status.containerStatuses[0].restartCount'

# 특정 노드의 모든 Pod
kubectl get pods -n saas-platform --field-selector spec.nodeName=<node-name>

# Pod 내 모든 컨테이너 상태
kubectl get pods -n saas-platform -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{range .status.containerStatuses[*]}{.name}={.state}{"\n"}{end}{end}'

# ── 네트워크 디버깅 ────────────────────────────

# Service Endpoint 확인 (서비스가 Pod를 찾지 못하는 경우)
kubectl get endpoints -n saas-platform
kubectl describe endpoints <service-name> -n saas-platform

# NetworkPolicy 확인 (특정 서비스가 다른 서비스에 접근 못하는 경우)
kubectl get networkpolicies -n saas-platform
kubectl describe networkpolicy <policy-name> -n saas-platform

# DNS 해석 테스트 (Pod 내부에서)
kubectl run dns-debug --image=busybox --rm -it -n saas-platform -- \
  nslookup user-service.saas-platform.svc.cluster.local

# ── 리소스 및 쿼터 ─────────────────────────────

# 네임스페이스 리소스 쿼터 사용량
kubectl describe resourcequota -n saas-platform

# Pod 실제 리소스 사용량 vs limits
kubectl top pods -n saas-platform --containers

# Node별 할당된 리소스 vs capacity
kubectl describe node | grep -A 10 "Allocated resources"

# ── 로그 관련 ──────────────────────────────────

# 컨테이너 재시작 이전 로그
kubectl logs <pod> -n saas-platform --previous --timestamps

# 지정 시간 이후 로그 (ISO 8601 형식)
kubectl logs <pod> -n saas-platform --since-time="2026-04-12T14:00:00Z"

# JSON 로그를 jq로 파싱
kubectl logs <pod> -n saas-platform | jq 'select(.level == "error")'
```

### 7.2 k9s 단축키 완전 정리

```
── 탐색 ────────────────────────────────
:pods           Pod 목록
:deployments    Deployment 목록
:services       서비스 목록
:events         이벤트 (실시간)
:helmreleases   Flux HelmRelease
:nodes          노드 목록
:namespaces     네임스페이스 목록
/               리소스 필터링 (이름으로)

── Pod 선택 후 ──────────────────────────
l               로그 보기 (log)
p               이전 로그 (previous)
s               쉘 접속 (shell)
d               describe
e               edit (YAML 편집)
Ctrl+D          삭제 (delete)
Ctrl+K          강제 종료 (kill)

── 로그 보기 중 ─────────────────────────
f               필터 (정규식)
0               필터 초기화
w               줄 바꿈 토글
Ctrl+S          로그 파일 저장

── 일반 ─────────────────────────────────
?               도움말
Ctrl+A          모든 네임스페이스 토글
:               명령 입력 모드
q               이전 화면 / 종료
Esc             현재 작업 취소
```

### 7.3 stern 사용 패턴

```bash
# 기본 멀티 Pod 로그
stern . -n saas-platform

# 특정 서비스만 (레이블)
stern -l app=ai-service -n saas-platform

# 이름 패턴 (정규식)
stern "ai-service|auth-service" -n saas-platform

# JSON 로그 포맷 (읽기 쉽게)
stern . -n saas-platform --template \
  '{{.PodName}} | {{with .Message}}{{.}}{{end}}{{"\n"}}' \
  --output raw | jq -r '"\(.ts) [\(.level)] \(.service): \(.msg)"' 2>/dev/null

# 지난 30분 로그
stern . -n saas-platform --since 30m

# 특정 컨테이너만
stern . -n saas-platform -c main

# 파일로 저장
stern . -n saas-platform --output raw > /tmp/all-logs-$(date +%Y%m%d%H%M).log

# 에러 필터링 + 실시간 출력
stern . -n saas-platform | grep '"level":"error"'
```

### 7.4 psql 진단 명령어

```sql
-- ── 연결 현황 ────────────────────────────────

-- 현재 연결 수 및 상태
SELECT count(*), state, wait_event_type, wait_event
FROM pg_stat_activity
GROUP BY state, wait_event_type, wait_event
ORDER BY count DESC;

-- 오래 실행 중인 쿼리 (5분 이상)
SELECT
  pid,
  now() - pg_stat_activity.query_start AS duration,
  query,
  state
FROM pg_stat_activity
WHERE (now() - pg_stat_activity.query_start) > interval '5 minutes'
  AND state != 'idle';

-- 락 대기 상황
SELECT
  bl.pid AS blocked_pid,
  a.usename AS blocked_user,
  ka.query AS blocking_query,
  a.query AS blocked_query
FROM pg_catalog.pg_locks bl
JOIN pg_catalog.pg_stat_activity a ON a.pid = bl.pid
JOIN pg_catalog.pg_locks kl ON kl.transactionid = bl.transactionid
JOIN pg_catalog.pg_stat_activity ka ON ka.pid = kl.pid
WHERE NOT bl.granted;

-- ── 테이블 통계 ───────────────────────────────

-- 가장 많이 접근되는 테이블
SELECT schemaname, relname, seq_scan, idx_scan,
  n_live_tup AS live_rows
FROM pg_stat_user_tables
ORDER BY seq_scan DESC
LIMIT 10;

-- 인덱스 사용률 (0%에 가까우면 불필요한 인덱스)
SELECT
  schemaname, tablename, indexname,
  idx_scan AS times_used,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC
LIMIT 10;

-- ── 긴급 대응 ────────────────────────────────

-- 특정 pid의 쿼리 강제 종료
SELECT pg_terminate_backend(<pid>);

-- 모든 idle 연결 종료 (연결 풀 고갈 시)
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle'
  AND query_start < now() - interval '10 minutes';
```

### 7.5 redis-cli 진단 명령어

```bash
# Redis Pod 접속
kubectl exec -n saas-platform -it \
  $(kubectl get pod -n saas-platform -l app=redis -o name | head -1) \
  -- redis-cli

# ── 상태 확인 ────────────────────────────────

# 서버 정보 전체
INFO all

# 메모리 상태만
INFO memory

# 초당 명령 처리 수 실시간
INFO stats | grep instantaneous_ops_per_sec

# 연결 수
INFO clients

# ── 키 디버깅 ────────────────────────────────

# 특정 패턴의 키 수 (SCAN 사용 — KEYS는 프로덕션 사용 금지!)
redis-cli --scan --pattern "tenant:*" | wc -l

# 특정 키의 TTL 확인
TTL tenant:cache:tenant-001

# 특정 키의 메모리 사용량
MEMORY USAGE tenant:cache:tenant-001

# 가장 큰 키 찾기 (top 10)
redis-cli --memkeys 2>/dev/null | head -10

# ── 성능 디버깅 ─────────────────────────────

# 느린 명령어 로그 (slowlog)
SLOWLOG GET 10
SLOWLOG RESET

# 명령어별 통계
INFO commandstats | head -20

# 연결별 실행 중인 명령어 확인
CLIENT LIST

# ── 캐시 무효화 ─────────────────────────────

# 특정 테넌트 캐시 삭제
DEL "tenant:cache:tenant-001"

# 패턴 삭제 (주의: 대용량 시 느림)
redis-cli --scan --pattern "session:*" | xargs redis-cli DEL
```

---

## 8. 학습 체크리스트

이 문서를 읽고 다음 항목을 스스로 확인해 보세요.

### 마인드셋

- [ ] 분산 시스템에서 5-Why가 단일 서비스와 어떻게 다른지 설명할 수 있다
- [ ] 사후 분석(Postmortem) 문서의 목적과 "탓하지 않는" 접근법을 이해한다

### 로컬 디버깅

- [ ] VS Code의 launch.json을 설정하여 Fastify 서비스에 디버거를 연결할 수 있다
- [ ] 브레이크포인트에서 변수 값을 확인하고 단계별로 실행할 수 있다
- [ ] `node --inspect-brk` 명령으로 인스펙터를 활성화할 수 있다
- [ ] tsconfig.json에서 sourceMap 설정이 왜 필요한지 안다

### 분산 추적

- [ ] Tempo TraceQL 기본 문법으로 느린 Trace를 찾을 수 있다
- [ ] Trace 내 Span 구조를 읽고 병목 위치를 파악할 수 있다
- [ ] Loki LogQL로 특정 tenantId의 에러 로그를 필터링할 수 있다
- [ ] stern으로 여러 서비스 로그를 동시에 모니터링할 수 있다

### 메모리 디버깅

- [ ] Node.js 힙 스냅샷을 생성하는 두 가지 방법(인스펙터, v8 모듈)을 안다
- [ ] Chrome DevTools에서 힙 스냅샷의 Comparison 뷰로 누수를 탐지하는 순서를 안다
- [ ] 클로저 누수, 캐시 크기 제한 누락 패턴의 예시를 코드로 설명할 수 있다

### DB 디버깅

- [ ] Prisma 쿼리 이벤트를 활성화하여 실제 SQL을 로깅할 수 있다
- [ ] `pg_stat_statements`에서 슬로우 쿼리 상위 목록을 조회할 수 있다
- [ ] `EXPLAIN ANALYZE` 출력에서 Seq Scan과 Index Scan을 구분하고 의미를 안다

### 도구 활용

- [ ] k9s의 주요 단축키(l, s, d, f)를 사용하여 Pod를 탐색할 수 있다
- [ ] stern으로 에러 로그만 필터링하여 볼 수 있다
- [ ] redis-cli에서 SLOWLOG로 느린 명령어를 확인할 수 있다

---

## 9. 다음 단계

이 문서를 마쳤다면 다음 문서로 이동하세요.

- **실습 적용**: `09-troubleshooting/03-performance-guide.md` — 성능 최적화 실전
- **모니터링 심화**: `05-monitoring/tracing/01-tempo-otel.md` — OpenTelemetry 계측 추가
- **DB 심화**: `04-infrastructure/components/03-postgresql.md` — PostgreSQL 설정 최적화
- **연습 문제**: `10-exercises/04-k8s-debug.md` — 실제 장애 시나리오 재현 실습

> 💡 **팁**: 이 문서의 시나리오들은 실제 장애를 재현하기 어렵습니다. `10-exercises/04-k8s-debug.md`의 실습 환경에서 직접 장애를 만들어보고 디버깅 과정을 연습해 보세요. "만들어 보는 장애"가 실력을 가장 빠르게 키웁니다.

> ⚠️ **CSAP D-12**: 디버깅 중 조회한 개인정보(이메일, 전화번호 등)는 로컬 화면에만 표시하고 파일로 저장하지 마세요. 힙 스냅샷 파일에도 사용자 데이터가 포함될 수 있으므로 분석 후 즉시 삭제하세요.
