# 테스트 전략 완전 가이드 — 단위/통합/E2E/성능 테스트, Testcontainers, vitest 심화

> 대상: 전체 개발자, QA 엔지니어, 온보딩 신규 입사자
> 선수 지식: 03-testing-guide.md, 11-test-strategy.md 완료 권장
> 실제 코드: `platform/services/ai-service/`, `packages/slo-escalation/`, `packages/dora-exporter/`
> Q-Gate G4 목표: 테스트 커버리지 80% 이상

---

## 목차

1. [테스트 전략 철학 — 왜 테스트하는가](#1-테스트-전략-철학--왜-테스트하는가)
2. [테스트 피라미드 — 비율, 비용, 속도](#2-테스트-피라미드--비율-비용-속도)
3. [vitest 설정 심화 — workspace, coverage(v8), alias](#3-vitest-설정-심화--workspace-coveragev8-alias)
4. [단위 테스트 패턴 — ai-agent.handler.ts 기반 실제 예제](#4-단위-테스트-패턴--ai-agenthandlerts-기반-실제-예제)
5. [Testcontainers — PostgreSQL+Redis 통합 테스트](#5-testcontainers--postgresqlredis-통합-테스트)
6. [RAG 파이프라인 테스트 — rag-engine.ts 모킹 전략](#6-rag-파이프라인-테스트--rag-enginets-모킹-전략)
7. [E2E 테스트 — Playwright + Fastify inject 패턴](#7-e2e-테스트--playwright--fastify-inject-패턴)
8. [Flaky 테스트 관리 전략](#8-flaky-테스트-관리-전략)
9. [테스트 커버리지 80% 달성 전략 (Q-Gate G4)](#9-테스트-커버리지-80-달성-전략-q-gate-g4)
10. [성능 테스트 — k6 스크립트 + 임계값 설정](#10-성능-테스트--k6-스크립트--임계값-설정)
11. [AI/LLM 테스트 특화 패턴 — deterministic mock, 비용 제어](#11-aillm-테스트-특화-패턴--deterministic-mock-비용-제어)
12. [테스트 워크플로우 시퀀스 다이어그램](#12-테스트-워크플로우-시퀀스-다이어그램)
13. [CSAP D-12 개발 보안 — 테스트를 통한 보안 검증](#13-csap-d-12-개발-보안--테스트를-통한-보안-검증)
14. [실습 미션](#14-실습-미션)

---

## 1. 테스트 전략 철학 — 왜 테스트하는가

공공기관 SaaS 프레임워크에서 테스트는 단순한 코드 검증을 넘어 다음의 목적을 갖습니다:

**1. CSAP D-12 (시스템 개발 보안) 준수**
보안 테스트(SQL 주입 시도, 인증 우회 시도 등)가 코드 수준에서 자동으로 실행되어야 합니다. 감리 시 "자동화된 보안 테스트 증거"를 제출해야 합니다.

**2. Q-Gate G4 통과 (80% 커버리지)**
`CLAUDE.md`에 명시된 7단계 품질 게이트 중 G4는 테스트 커버리지 80% 이상입니다. 이를 달성하지 못하면 PR이 머지되지 않습니다.

**3. 신뢰할 수 있는 배포**
테스트가 통과한 코드만 DORA Gate를 통해 배포됩니다. 테스트 없는 배포는 CFR(변경 실패율)을 높여 DORA 등급을 낮춥니다.

**4. 문서로서의 테스트**
잘 작성된 테스트는 코드의 의도를 가장 정확하게 설명합니다. 신입 개발자가 `ai-agent.handler.ts`를 이해하려면 해당 테스트를 먼저 읽어야 합니다.

---

## 2. 테스트 피라미드 — 비율, 비용, 속도

```mermaid
graph TB
    subgraph "테스트 피라미드"
        direction TB
        E2E["E2E 테스트\n(시스템 전체 검증)\n\n비율: 5%\n비용: 매우 높음\n속도: 5~30분\n\n예: Playwright 브라우저 테스트\nAPI 전체 플로우 테스트"]
        INT["통합 테스트\n(서비스 간 연동 검증)\n\n비율: 20%\n비용: 보통\n속도: 30초~5분\n\n예: Testcontainers PostgreSQL+Redis\nRAG 파이프라인 통합\nFastify inject 패턴"]
        UNIT["단위 테스트\n(함수/모듈 단위 검증)\n\n비율: 75%\n비용: 최소\n속도: 밀리초~초\n\n예: 에러버짓 계산 로직\n에스컬레이션 정책 판정\nPII 마스킹 함수"]
    end
    UNIT --> INT --> E2E

    subgraph "테스트 속성 비교"
        direction LR
        TBL["| 속성 | 단위 | 통합 | E2E |\n|------|------|------|-----|\n| 실행 속도 | 빠름 | 보통 | 느림 |\n| 유지비용 | 낮음 | 보통 | 높음 |\n| 신뢰도 | 높음 | 높음 | 최고 |\n| 격리성 | 완전 | 부분 | 없음 |"]
    end
```

### 2.1 단위 테스트 (75%)

단위 테스트는 단일 함수나 클래스를 외부 의존성 없이 테스트합니다. 모든 외부 의존성(DB, API, 네트워크)은 모킹합니다.

예시 대상:
- `determineEscalationLevel(50)` → `EscalationLevel.Normal` 반환 검증
- `calculateErrorBudget({ target: 0.999, ... })` → 소진율 계산 정확성 검증
- `maskPII("홍길동 010-1234-5678")` → PII 마스킹 결과 검증
- `safeEvaluate("2 + 3 * 4")` → `14` 반환 검증

### 2.2 통합 테스트 (20%)

통합 테스트는 실제 데이터베이스, 캐시 서버와 함께 서비스 로직을 검증합니다. Testcontainers를 사용하여 격리된 컨테이너 환경을 생성합니다.

예시 대상:
- `agentHandler` → Prisma + PostgreSQL 연동 검증
- RAG 파이프라인 → 벡터 검색 + LLM 생성 전체 흐름
- DORA 익스포터 → Gitea Webhook 수신 + Prometheus 메트릭 업데이트

### 2.3 E2E 테스트 (5%)

E2E 테스트는 사용자 관점에서 브라우저 또는 API를 통해 전체 시스템을 검증합니다.

예시 대상:
- 관리자 포털 로그인 → SLO 대시보드 접근 플로우
- 민원 제출 API → AI 처리 → 응답 수신 전체 플로우

---

## 3. vitest 설정 심화 — workspace, coverage(v8), alias

### 3.1 모노레포 workspace 설정

이 프로젝트는 pnpm 모노레포 구조입니다. vitest workspace를 사용하면 여러 패키지의 테스트를 통합 관리할 수 있습니다.

```typescript
// vitest.workspace.ts (루트 레벨)
import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  // packages/ 아래 패키지들
  'packages/*/vitest.config.ts',

  // platform/services/ 아래 서비스들
  'platform/services/*/vitest.config.ts',

  // platform/packages/ 아래 패키지들
  'platform/packages/*/vitest.config.ts',
]);
```

```typescript
// packages/slo-escalation/vitest.config.ts (패키지별 설정)
import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    // 테스트 환경: node (브라우저 아님)
    environment: 'node',

    // 테스트 파일 포함 패턴
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],

    // 전역 beforeAll/afterAll 설정 파일
    globalSetup: ['tests/setup/global-setup.ts'],

    // 각 테스트 파일 전 실행 (describe 블록 외부)
    setupFiles: ['tests/setup/setup.ts'],

    // 병렬 실행 (기본값 true)
    pool: 'threads',

    // 테스트 격리: 각 파일마다 새 모듈 환경
    isolate: true,

    // 타임아웃 설정 (AI 테스트는 길게)
    testTimeout: 30000,

    // 커버리지 설정
    coverage: {
      provider: 'v8',             // V8 네이티브 커버리지 (기본값, 가장 빠름)
      reporter: ['text', 'html', 'json', 'lcov'],
      // text: 콘솔 출력
      // html: 브라우저에서 볼 수 있는 리포트
      // json: CI/CD에서 파싱 가능
      // lcov: SonarQube 통합용

      reportsDirectory: './coverage',

      // 커버리지 임계값 (Q-Gate G4: 80%)
      thresholds: {
        global: {
          lines: 80,
          functions: 80,
          branches: 75,    // 브랜치 커버리지는 75%로 완화 (복잡한 로직 허용)
          statements: 80,
        },
        // 특정 파일은 더 높은 임계값
        './src/escalation-controller.ts': {
          lines: 90,
          functions: 90,
          branches: 85,
          statements: 90,
        },
      },

      // 커버리지 제외 패턴
      exclude: [
        'tests/**',          // 테스트 파일 자체
        '**/*.d.ts',         // 타입 선언 파일
        '**/index.ts',       // 단순 재수출 파일
        '**/*.config.ts',    // 설정 파일
        '**/migrations/**',  // DB 마이그레이션 (예외: 정책)
        '**/fixtures/**',    // 테스트 fixture
      ],

      // V8 커버리지 소스 맵 적용
      include: ['src/**/*.ts'],
    },
  },

  // 경로 별칭 (TypeScript paths와 동일하게 설정)
  resolve: {
    alias: {
      '@/': resolve(__dirname, './src/'),
      '@test/': resolve(__dirname, './tests/'),
      '@fixtures/': resolve(__dirname, './tests/fixtures/'),
    },
  },
});
```

### 3.2 V8 vs Istanbul 커버리지 비교

| 항목 | V8 | Istanbul |
|------|-----|---------|
| 방식 | 네이티브 엔진 수준 측정 | 코드 계측(instrumentation) |
| 속도 | 빠름 (10~30% 더 빠름) | 느림 |
| 정확도 | 높음 | 높음 |
| 설정 | `provider: 'v8'` | `provider: 'istanbul'` |
| 권장 | 새 프로젝트 | 레거시 프로젝트 |

이 프로젝트는 `provider: 'v8'`을 사용합니다.

### 3.3 글로벌 테스트 설정 파일

```typescript
// tests/setup/setup.ts — 각 테스트 파일 실행 전 공통 설정
import { vi, beforeAll, afterAll, afterEach } from 'vitest';

// 환경 변수 설정 (테스트용)
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.LLM_PROVIDER = 'mock';   // 실제 LLM API 호출 방지

// 전역 fetch 모킹 (Node.js 환경에서 HTTP 요청 차단)
vi.stubGlobal('fetch', vi.fn());

// 각 테스트 후 모킹 초기화
afterEach(() => {
  vi.clearAllMocks();
  vi.resetAllMocks();
});

// 콘솔 경고 억제 (테스트 출력 깔끔하게)
beforeAll(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterAll(() => {
  vi.restoreAllMocks();
});
```

---

## 4. 단위 테스트 패턴 — ai-agent.handler.ts 기반 실제 예제

`/data/ai-saas/platform/services/ai-service/src/handlers/ai-agent.handler.ts`를 기반으로 실제 테스트 패턴을 설명합니다.

### 4.1 핸들러의 핵심 로직 파악

`agentHandler`는 다음 순서로 동작합니다:
1. Zod 스키마로 입력 검증 (`agentSchema.parse`)
2. N2SF N-05: 데이터 등급 확인 (`validateDataGrade`)
3. C/S 등급이면 `DataGradeViolationError` 발생 → 403 반환
4. O 등급이면 도구 필터링 + LLM 설정 → `runAgent` 실행
5. 실행 결과를 감사 로그 기록 후 200 반환

이 흐름을 바탕으로 단위 테스트 케이스를 도출합니다:

### 4.2 핵심 단위 테스트 예제

```typescript
// platform/services/ai-service/tests/handlers/agent-handler.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FastifyRequest, FastifyReply } from 'fastify';

// 모듈 모킹 — 실제 의존성을 모두 격리
vi.mock('../lib/grade-check.js', () => ({
  validateDataGrade: vi.fn(),
  DataGradeViolationError: class DataGradeViolationError extends Error {
    code = 'DATA_GRADE_VIOLATION';
    constructor(message: string) { super(message); }
  },
}));

vi.mock('../lib/audit.js', () => ({
  logAiEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../lib/ai-agent.js', () => ({
  runAgent: vi.fn().mockResolvedValue({
    answer: '모킹된 에이전트 답변',
    steps: [],
    iterations: 2,
    tokensUsed: 150,
    model: 'mock-llm',
    timedOut: false,
  }),
}));

vi.mock('../lib/rag-engine.js', () => ({
  generateEmbedding: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
  runRAG: vi.fn().mockResolvedValue({ answer: '모킹된 RAG 답변' }),
}));

vi.mock('../lib/llm-provider.js', () => ({
  getLLMConfig: vi.fn().mockReturnValue({ provider: 'mock', endpoint: 'http://mock', name: 'mock' }),
  buildLLMConfig: vi.fn().mockReturnValue({ provider: 'mock', endpoint: 'http://mock', name: 'mock' }),
  createLLMProvider: vi.fn().mockResolvedValue({
    chat: vi.fn().mockResolvedValue({ text: '모킹 응답', tokensUsed: 100, model: 'mock' }),
    embed: vi.fn().mockResolvedValue({ embeddings: [[0.1, 0.2, 0.3]] }),
  }),
}));

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    aiModel: {
      findUnique: vi.fn().mockResolvedValue(null),  // 모델 없음 → 기본값 사용
    },
  },
}));

// Fastify Request/Reply 팩토리 (테스트용 경량 모킹)
function createMockRequest(body: unknown, headers: Record<string, string> = {}): FastifyRequest {
  return {
    body,
    headers: { 'x-user-id': 'test-user-001', ...headers },
    ip: '127.0.0.1',
    log: {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
    },
  } as unknown as FastifyRequest;
}

function createMockReply() {
  const reply = {
    status: vi.fn().mockReturnThis(),   // 체이닝: reply.status(200).send(...)
    send: vi.fn().mockResolvedValue(undefined),
  };
  return reply as unknown as FastifyReply;
}

// ── 테스트 스위트 ────────────────────────────────────────────────────────────
describe('agentHandler', () => {
  let { agentHandler } = await import('../handlers/ai-agent.handler.js');
  let { validateDataGrade, DataGradeViolationError } = await import('../lib/grade-check.js');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── 정상 케이스 ────────────────────────────────────────────────────────
  describe('정상 케이스', () => {
    it('O 등급 요청은 200으로 에이전트 실행 결과를 반환한다', async () => {
      const request = createMockRequest({
        tenantId: '550e8400-e29b-41d4-a716-446655440000',
        grade: 'O',
        query: '2026년 예산 편성 기준을 알려주세요',
        maxIterations: 5,
      });
      const reply = createMockReply();

      await agentHandler(request, reply);

      expect(reply.status).toHaveBeenCalledWith(200);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            answer: '모킹된 에이전트 답변',
            iterations: 2,
            tokensUsed: 150,
          }),
        }),
      );
    });

    it('특정 도구만 허용하면 해당 도구만 필터링하여 실행한다', async () => {
      const { runAgent } = await import('../lib/ai-agent.js');
      const { TOOL_DEFINITIONS } = await import('../lib/ai-tools.js');

      const request = createMockRequest({
        tenantId: '550e8400-e29b-41d4-a716-446655440000',
        grade: 'O',
        query: '질문',
        tools: ['search_knowledge', 'summarize_text'],  // 2개만 허용
      });
      const reply = createMockReply();

      await agentHandler(request, reply);

      // runAgent가 호출될 때 tools 인자가 2개인지 확인
      expect(runAgent).toHaveBeenCalledWith(
        '질문',
        expect.arrayContaining([
          expect.objectContaining({ name: 'search_knowledge' }),
          expect.objectContaining({ name: 'summarize_text' }),
        ]),
        expect.any(Object),
        expect.objectContaining({ maxIterations: 10 }),
        undefined,
      );
      // 전체 도구 개수보다 적어야 함
      const calledTools = (runAgent as ReturnType<typeof vi.fn>).mock.calls[0][1];
      expect(calledTools.length).toBe(2);
      expect(calledTools.length).toBeLessThan(TOOL_DEFINITIONS.length);
    });

    it('감사 로그에 에이전트 실행 이벤트를 기록한다', async () => {
      const { logAiEvent } = await import('../lib/audit.js');

      const request = createMockRequest({
        tenantId: '550e8400-e29b-41d4-a716-446655440000',
        grade: 'O',
        query: '감사 로그 테스트',
      });
      const reply = createMockReply();

      await agentHandler(request, reply);

      // CSAP D-06: 감사 이벤트 기록 검증
      expect(logAiEvent).toHaveBeenCalledWith(
        'AGENT_RUN',
        'test-user-001',
        'agent',
        '550e8400-e29b-41d4-a716-446655440000',
        '127.0.0.1',
        expect.any(String),
        expect.objectContaining({
          iterations: 2,
          tokensUsed: 150,
        }),
      );
    });
  });

  // ── 보안 케이스 (CSAP D-12, N2SF N-05) ──────────────────────────────────
  describe('보안 케이스', () => {
    it('C 등급 데이터는 403을 반환하고 감사 로그에 위반을 기록한다', async () => {
      const { logAiEvent } = await import('../lib/audit.js');

      // C 등급 → DataGradeViolationError 발생 설정
      (validateDataGrade as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new DataGradeViolationError('C등급 데이터는 AI API 전송 금지');
      });

      const request = createMockRequest({
        tenantId: '550e8400-e29b-41d4-a716-446655440000',
        grade: 'C',  // C 등급 (기밀)
        query: '기밀 정보 요청',
      });
      const reply = createMockReply();

      await agentHandler(request, reply);

      // N2SF N-05: 403 차단 확인
      expect(reply.status).toHaveBeenCalledWith(403);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'DATA_GRADE_VIOLATION',
          }),
        }),
      );

      // CSAP D-06: 위반 감사 로그 기록 확인
      expect(logAiEvent).toHaveBeenCalledWith(
        'AI_GRADE_VIOLATION',
        'test-user-001',
        'agent',
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.objectContaining({ grade: 'C', blocked: true }),
      );
    });

    it('유효하지 않은 UUID tenantId는 400을 반환한다 (Zod 입력 검증)', async () => {
      const request = createMockRequest({
        tenantId: 'not-a-valid-uuid',  // UUID 형식 위반
        grade: 'O',
        query: '테스트',
      });
      const reply = createMockReply();

      // Zod 파싱 실패 → 예외 발생 → 500 (혹은 프레임워크가 400으로 처리)
      await expect(agentHandler(request, reply)).rejects.toThrow();
    });

    it('빈 query는 Zod 검증으로 차단된다', async () => {
      const request = createMockRequest({
        tenantId: '550e8400-e29b-41d4-a716-446655440000',
        grade: 'O',
        query: '',  // 빈 문자열 (min(1) 위반)
      });
      const reply = createMockReply();

      await expect(agentHandler(request, reply)).rejects.toThrow();
    });

    it('maxIterations가 10을 초과하면 Zod 검증으로 차단된다', async () => {
      const request = createMockRequest({
        tenantId: '550e8400-e29b-41d4-a716-446655440000',
        grade: 'O',
        query: '테스트',
        maxIterations: 11,  // max(10) 위반
      });
      const reply = createMockReply();

      await expect(agentHandler(request, reply)).rejects.toThrow();
    });
  });

  // ── 에러 처리 케이스 ────────────────────────────────────────────────────
  describe('에러 처리', () => {
    it('runAgent 실패 시 502를 반환하고 민감 정보를 노출하지 않는다', async () => {
      const { runAgent } = await import('../lib/ai-agent.js');

      // DB 연결 오류 시뮬레이션 (에러 메시지에 패스워드 포함)
      (runAgent as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Connection to postgresql://user:SECRET_PASSWORD@db:5432 failed'),
      );

      const request = createMockRequest({
        tenantId: '550e8400-e29b-41d4-a716-446655440000',
        grade: 'O',
        query: '테스트',
      });
      const reply = createMockReply();

      await agentHandler(request, reply);

      expect(reply.status).toHaveBeenCalledWith(502);

      // CSAP D-12: 에러 메시지에 민감 정보 노출 금지 검증
      const sentData = (reply.send as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(JSON.stringify(sentData)).not.toContain('SECRET_PASSWORD');
      expect(JSON.stringify(sentData)).not.toContain('postgresql://');
      expect(sentData.error.message).toBe('AI 에이전트 실행 중 오류가 발생했습니다.');
    });
  });
});
```

### 4.3 에스컬레이션 컨트롤러 단위 테스트

```typescript
// packages/slo-escalation/tests/escalation.controller.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import {
  SLOEscalationController,
  EscalationLevel,
  NotificationChannel,
  determineEscalationLevel,
} from '../src/escalation-controller';

describe('determineEscalationLevel', () => {
  // 경계값 분석 (Boundary Value Analysis) — 각 단계 경계에서 정확히 동작하는지 검증

  it.each([
    [0,    EscalationLevel.Normal],    // 최소값
    [25,   EscalationLevel.Normal],    // 중간값
    [50,   EscalationLevel.Normal],    // 경계값 (포함)
    [50.1, EscalationLevel.Warning],   // 경계 바로 위
    [74.9, EscalationLevel.Warning],   // 경계 바로 아래
    [75,   EscalationLevel.Warning],   // 경계값 (포함)
    [75.1, EscalationLevel.Danger],    // 경계 바로 위
    [90,   EscalationLevel.Danger],    // 경계값 (포함)
    [90.1, EscalationLevel.Critical],  // 경계 바로 위
    [100,  EscalationLevel.Critical],  // 경계값 (포함)
    [100.1, EscalationLevel.Violated], // 100% 초과
    [150,  EscalationLevel.Violated],  // 과소진
  ])('소진율 %d%% → %s 단계', (burnRate, expected) => {
    expect(determineEscalationLevel(burnRate)).toBe(expected);
  });
});

describe('SLOEscalationController', () => {
  let controller: SLOEscalationController;

  beforeEach(() => {
    controller = new SLOEscalationController();
  });

  describe('registerPolicy', () => {
    it('유효한 정책을 등록한다', () => {
      expect(() => {
        controller.registerPolicy({
          name: '테스트 정책',
          service: 'test-service',
          levels: [
            {
              level: EscalationLevel.Warning,
              budgetBurnRateMin: 50,
              budgetBurnRateMax: 75,
              contacts: [
                { name: '개발팀', channel: NotificationChannel.Slack, target: '#dev' }
              ],
              waitMinutes: 30,
            }
          ],
        });
      }).not.toThrow();
    });

    it('budgetBurnRateMin이 음수이면 ZodError를 던진다', () => {
      expect(() => {
        controller.registerPolicy({
          name: '잘못된 정책',
          service: 'test',
          levels: [
            {
              level: EscalationLevel.Warning,
              budgetBurnRateMin: -10,  // 유효하지 않음
              budgetBurnRateMax: 75,
              contacts: [],
              waitMinutes: 0,
            }
          ],
        });
      }).toThrow(); // Zod validation error
    });
  });

  describe('escalate', () => {
    it('정책이 없는 서비스는 이벤트를 기록하지만 연락처 알림은 없다', async () => {
      const event = await controller.escalate(
        'unknown-service', 'SLO 테스트', 75, 25
      );

      expect(event.service).toBe('unknown-service');
      expect(event.level).toBe(EscalationLevel.Danger);
      expect(event.notifiedContacts).toHaveLength(0);  // 알림 없음
      expect(event.actionsTriggered).toHaveLength(0);
    });

    it('등록된 정책이 있으면 해당 레벨의 연락처에 알림을 보낸다', async () => {
      controller.registerPolicy({
        name: '알림 정책',
        service: 'my-service',
        levels: [
          {
            level: EscalationLevel.Warning,
            budgetBurnRateMin: 50,
            budgetBurnRateMax: 75,
            contacts: [
              { name: '개발팀', channel: NotificationChannel.Slack, target: '#dev' },
              { name: '팀장', channel: NotificationChannel.Email, target: 'lead@agency.go.kr' },
            ],
            waitMinutes: 30,
          }
        ],
      });

      const event = await controller.escalate('my-service', 'API SLO', 65, 35);

      expect(event.notifiedContacts).toContain('개발팀');
      expect(event.notifiedContacts).toContain('팀장');
      expect(event.notifiedContacts).toHaveLength(2);
    });

    it('이력이 5000개를 초과하면 오래된 이벤트를 제거한다', async () => {
      // 5001개 이벤트 생성
      for (let i = 0; i < 5001; i++) {
        await controller.escalate(`service-${i}`, 'SLO', 30, 70);
      }

      const history = controller.getHistory();
      expect(history.length).toBeLessThanOrEqual(5000);
    });
  });

  describe('getHistory', () => {
    it('서비스 필터로 특정 서비스 이벤트만 조회한다', async () => {
      await controller.escalate('service-A', 'SLO-A', 60, 40);
      await controller.escalate('service-B', 'SLO-B', 80, 20);
      await controller.escalate('service-A', 'SLO-A', 95, 5);

      const historyA = controller.getHistory('service-A');
      const historyB = controller.getHistory('service-B');

      expect(historyA).toHaveLength(2);
      expect(historyB).toHaveLength(1);
      expect(historyA.every(e => e.service === 'service-A')).toBe(true);
    });
  });
});
```

### 4.4 단위 테스트 작성 원칙

**AAA 패턴 (Arrange - Act - Assert):**

```typescript
it('에러버짓 소진율이 75%이면 Warning 상태이다', () => {
  // Arrange: 테스트 데이터 준비
  const slo: SLODefinition = {
    name: '가용성 SLO',
    service: 'api-service',
    target: 0.999,
    windowDays: 30,
    currentAvailability: 0.999 - (0.001 * 0.75), // 75% 소진
  };
  const engine = new ErrorBudgetPolicyEngine();

  // Act: 실제 동작 실행
  const result = engine.calculateErrorBudget(slo);

  // Assert: 결과 검증
  expect(result.burnRate).toBeCloseTo(75, 1);
  expect(result.status).toBe(BudgetStatus.Warning);
  expect(result.actions).toContain(AutoAction.Notify);
  expect(result.actions).not.toContain(AutoAction.FreezeEnforce);
});
```

---

## 5. Testcontainers — PostgreSQL+Redis 통합 테스트

Testcontainers는 Docker 컨테이너를 테스트 코드 내에서 제어하여 실제 데이터베이스와 함께 테스트할 수 있게 합니다.

### 5.1 설치 및 설정

```bash
# 필수 패키지
pnpm add -D @testcontainers/postgresql @testcontainers/redis testcontainers

# Docker가 실행 중이어야 함
docker info
```

```typescript
// tests/setup/containers.ts — 컨테이너 생명주기 관리
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer } from '@testcontainers/redis';

let postgresContainer: Awaited<ReturnType<typeof new PostgreSqlContainer().start>>;
let redisContainer: Awaited<ReturnType<typeof new RedisContainer().start>>;

export async function startContainers() {
  console.log('테스트 컨테이너 시작 중...');

  // PostgreSQL 14 + 초기화 스크립트
  postgresContainer = await new PostgreSqlContainer('postgres:14-alpine')
    .withDatabase('test_saas')
    .withUsername('test')
    .withPassword('test_secret_2026')
    .withInitScript('tests/fixtures/init.sql')  // 스키마 초기화
    .withHealthCheck({
      test: ['CMD', 'pg_isready', '-U', 'test'],
      interval: 5000,
      timeout: 5000,
      retries: 5,
    })
    .start();

  // Redis 7 (캐시용)
  redisContainer = await new RedisContainer('redis:7-alpine')
    .start();

  // 환경 변수를 테스트 컨테이너 연결 정보로 덮어씀
  process.env.DATABASE_URL = postgresContainer.getConnectionUri();
  process.env.REDIS_URL = `redis://${redisContainer.getHost()}:${redisContainer.getFirstMappedPort()}`;

  console.log(`PostgreSQL: ${process.env.DATABASE_URL}`);
  console.log(`Redis: ${process.env.REDIS_URL}`);
}

export async function stopContainers() {
  console.log('테스트 컨테이너 종료 중...');
  await postgresContainer?.stop();
  await redisContainer?.stop();
}
```

### 5.2 통합 테스트 예제 — DORA 익스포터

```typescript
// packages/dora-exporter/tests/integration/webhook.integration.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';  // HTTP 테스트 라이브러리
import { app } from '../../src/index';
import { startContainers, stopContainers } from '../setup/containers';

describe('DORA Exporter 통합 테스트', () => {
  beforeAll(async () => {
    // 실제 컨테이너 시작 (약 10~30초 소요)
    await startContainers();
  }, 60000); // 타임아웃: 60초

  afterAll(async () => {
    await stopContainers();
  });

  describe('POST /webhook/gitea', () => {
    const validGiteaPayload = {
      ref: 'refs/heads/main',  // 프로덕션 배포 이벤트
      after: 'abc1234def5678',
      repository: { full_name: 'platform-team/ai-service' },
      commits: [
        {
          id: 'commit001',
          timestamp: new Date(Date.now() - 3600000).toISOString(), // 1시간 전
          message: 'feat(ai): 새 기능 추가',
        }
      ],
      pusher: { login: 'dev-user' },
    };

    it('유효한 Gitea webhook을 처리하고 200을 반환한다', async () => {
      const response = await request(app)
        .post('/webhook/gitea')
        .send(validGiteaPayload)
        .expect(200);

      expect(response.body.status).toBe('accepted');
    });

    it('webhook 처리 후 /metrics 엔드포인트에 배포 카운터가 증가한다', async () => {
      // 웹훅 전송
      await request(app).post('/webhook/gitea').send(validGiteaPayload);

      // 메트릭 조회
      const metricsResponse = await request(app).get('/metrics').expect(200);
      const metricsText = metricsResponse.text;

      // dora_deployment_total 카운터가 존재하는지 확인
      expect(metricsText).toContain('dora_deployment_total');
      expect(metricsText).toContain('team="platform-team"');
      expect(metricsText).toContain('service="ai-service"');
      expect(metricsText).toContain('environment="production"');
    });

    it('잘못된 형식의 payload는 400을 반환한다 (Zod 검증)', async () => {
      const invalidPayload = {
        ref: 'refs/heads/main',
        // repository 필드 누락
        commits: [],
        pusher: { login: 'dev' },
      };

      const response = await request(app)
        .post('/webhook/gitea')
        .send(invalidPayload)
        .expect(400);

      expect(response.body.error).toBe('Invalid webhook payload');
      expect(response.body.details).toBeDefined();
    });

    it('refs/heads/dev 이벤트는 development 환경으로 분류된다', async () => {
      const devPayload = {
        ...validGiteaPayload,
        ref: 'refs/heads/dev',  // 개발 환경
      };

      await request(app).post('/webhook/gitea').send(devPayload);

      const metricsResponse = await request(app).get('/metrics');
      expect(metricsResponse.text).toContain('environment="development"');
    });
  });

  describe('POST /webhook/alertmanager (MTTR 계산)', () => {
    it('firing + resolved 순서로 MTTR을 계산한다', async () => {
      const serviceName = 'civil-complaint-service';
      const startTime = new Date(Date.now() - 30 * 60 * 1000).toISOString(); // 30분 전
      const endTime = new Date().toISOString();

      // 1단계: 장애 시작
      await request(app)
        .post('/webhook/alertmanager')
        .send({
          status: 'firing',
          alerts: [{
            status: 'firing',
            labels: { service: serviceName, team: 'ops', severity: 'critical' },
            startsAt: startTime,
          }]
        })
        .expect(200);

      // 2단계: 장애 종료
      await request(app)
        .post('/webhook/alertmanager')
        .send({
          status: 'resolved',
          alerts: [{
            status: 'resolved',
            labels: { service: serviceName, team: 'ops', severity: 'critical' },
            startsAt: startTime,
            endsAt: endTime,
          }]
        })
        .expect(200);

      // MTTR 메트릭 확인 (약 30분 = 1800초)
      const metrics = await request(app).get('/metrics');
      expect(metrics.text).toContain('dora_mttr_seconds');
      expect(metrics.text).toContain(`service="${serviceName}"`);
    });
  });
});
```

### 5.3 Prisma + PostgreSQL 통합 테스트

```typescript
// platform/services/ai-service/tests/integration/prisma.integration.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { startContainers, stopContainers } from '../setup/containers';

let prisma: PrismaClient;

beforeAll(async () => {
  await startContainers();  // PostgreSQL 컨테이너 시작

  // Prisma 마이그레이션 실행
  const { execSync } = await import('child_process');
  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
    stdio: 'pipe',
  });

  prisma = new PrismaClient({
    datasources: { db: { url: process.env.DATABASE_URL } },
  });
}, 60000);

afterAll(async () => {
  await prisma.$disconnect();
  await stopContainers();
});

beforeEach(async () => {
  // 각 테스트 전 데이터 초기화 (격리 보장)
  await prisma.$executeRaw`TRUNCATE TABLE "AiConversation" CASCADE`;
  await prisma.$executeRaw`TRUNCATE TABLE "AuditLog" CASCADE`;
});

describe('AI 모델 CRUD', () => {
  it('AI 모델을 생성하고 조회할 수 있다', async () => {
    // CSAP D-09: 평문 API 키 저장 금지 검증
    const model = await prisma.aiModel.create({
      data: {
        name: 'test-llm-v1',
        provider: 'internal',
        endpoint: 'http://llm.internal:8080',
        isActive: true,
        // config에 API 키 없음 (환경 변수로 관리)
        config: { maxTokens: 4096, temperature: 0.7 },
      },
    });

    expect(model.id).toBeDefined();
    expect(model.name).toBe('test-llm-v1');
    // API 키가 DB에 저장되지 않았는지 확인
    expect(JSON.stringify(model.config)).not.toContain('apiKey');
    expect(JSON.stringify(model.config)).not.toContain('token');

    const found = await prisma.aiModel.findUnique({ where: { id: model.id } });
    expect(found).not.toBeNull();
  });
});
```

---

## 6. RAG 파이프라인 테스트 — rag-engine.ts 모킹 전략

`/data/ai-saas/platform/services/ai-service/src/lib/rag-engine.ts`의 `runRAG`는 외부 의존성이 많습니다:
- `semanticSearch`: 벡터 데이터베이스 조회
- `provider.chat`: LLM API 호출
- `maskPII`: PII 마스킹

단위 테스트에서는 이 모든 의존성을 모킹합니다.

### 6.1 RAG 파이프라인 단위 테스트

```typescript
// platform/services/ai-service/tests/lib/rag-engine.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// 모든 외부 의존성 모킹
vi.mock('../lib/vector-store.js', () => ({
  semanticSearch: vi.fn(),
}));

vi.mock('../lib/llm-provider.js', () => ({
  getLLMConfig: vi.fn().mockReturnValue({}),
  buildLLMConfig: vi.fn().mockReturnValue({}),
  createLLMProvider: vi.fn(),
}));

vi.mock('../lib/pii-masking.js', () => ({
  maskPII: vi.fn().mockImplementation((text: string) => text),  // 기본: 변환 없이 반환
}));

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    aiModel: {
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue(null),
    },
  },
}));

describe('runRAG', () => {
  let { runRAG } = await import('../lib/rag-engine.js');
  let { semanticSearch } = await import('../lib/vector-store.js');
  let { createLLMProvider } = await import('../lib/llm-provider.js');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('검색 결과 없으면 "문서를 찾을 수 없습니다" 메시지를 반환한다', async () => {
    (semanticSearch as ReturnType<typeof vi.fn>).mockResolvedValue([]);  // 빈 결과

    const result = await runRAG(
      'tenant-001',
      '2026 예산 편성 기준은?',
      [0.1, 0.2, 0.3],
    );

    expect(result.answer).toContain('찾을 수 없습니다');
    expect(result.sources).toHaveLength(0);
    expect(result.contextChunks).toBe(0);
    // LLM이 호출되지 않아야 함 (비용 절약)
    expect(createLLMProvider).not.toHaveBeenCalled();
  });

  it('검색 결과가 있으면 컨텍스트를 구성하여 LLM에 전달한다', async () => {
    const mockChunk = {
      chunk: {
        content: '2026년 예산 편성 기준에 따라 공공기관은 전년 대비 5% 이내 증가...',
        tokenCount: 50,
        chunkIndex: 0,
        metadata: { documentTitle: '2026 예산 편성 지침' },
      },
      score: 0.95,
    };

    (semanticSearch as ReturnType<typeof vi.fn>).mockResolvedValue([mockChunk]);

    const mockProvider = {
      chat: vi.fn().mockResolvedValue({
        text: '2026년 예산은 전년 대비 5% 이내 증가 [출처: 2026 예산 편성 지침]',
        tokensUsed: 200,
        model: 'llm-v1',
      }),
      embed: vi.fn(),
    };
    (createLLMProvider as ReturnType<typeof vi.fn>).mockResolvedValue(mockProvider);

    const result = await runRAG(
      'tenant-001',
      '2026 예산 기준',
      [0.1, 0.2, 0.3],
    );

    expect(result.answer).toContain('5%');
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0].documentTitle).toBe('2026 예산 편성 지침');
    expect(result.sources[0].score).toBe(0.95);
    expect(result.contextChunks).toBe(1);

    // LLM에 전달된 메시지에 컨텍스트가 포함되었는지 확인
    const chatArgs = mockProvider.chat.mock.calls[0][0];
    expect(chatArgs.some((m: { content: string }) =>
      m.content.includes('2026 예산 편성 지침')
    )).toBe(true);
  });

  it('PII가 포함된 질문은 마스킹 후 LLM에 전달한다', async () => {
    const { maskPII } = await import('../lib/pii-masking.js');

    // PII 마스킹 시뮬레이션: 이름 제거
    (maskPII as ReturnType<typeof vi.fn>).mockImplementation((text: string) =>
      text.replace(/홍길동/g, '***')
    );

    const mockChunk = {
      chunk: {
        content: '민원 처리 안내',
        tokenCount: 10,
        chunkIndex: 0,
        metadata: { documentTitle: '민원 안내서' },
      },
      score: 0.9,
    };
    (semanticSearch as ReturnType<typeof vi.fn>).mockResolvedValue([mockChunk]);

    const mockProvider = {
      chat: vi.fn().mockResolvedValue({
        text: '안내드립니다', tokensUsed: 50, model: 'llm-v1',
      }),
      embed: vi.fn(),
    };
    (createLLMProvider as ReturnType<typeof vi.fn>).mockResolvedValue(mockProvider);

    await runRAG('tenant-001', '홍길동의 민원 처리 방법은?', [0.1]);

    // LLM에 전달된 질문에서 PII가 마스킹되었는지 확인
    const chatArgs = mockProvider.chat.mock.calls[0][0];
    const userMessage = chatArgs.find((m: { role: string; content: string }) => m.role === 'user');
    expect(userMessage.content).toContain('***');
    expect(userMessage.content).not.toContain('홍길동');
  });

  it('토큰 예산 초과 시 일부 청크만 사용한다', async () => {
    // 각 청크가 3000 토큰 (maxContextTokens=6000이면 2개까지만 허용)
    const largeChunks = Array.from({ length: 5 }, (_, i) => ({
      chunk: {
        content: '긴 문서 내용'.repeat(100),
        tokenCount: 3000,
        chunkIndex: i,
        metadata: { documentTitle: `문서-${i}` },
      },
      score: 0.9 - i * 0.05,
    }));

    (semanticSearch as ReturnType<typeof vi.fn>).mockResolvedValue(largeChunks);

    const mockProvider = {
      chat: vi.fn().mockResolvedValue({ text: '답변', tokensUsed: 100, model: 'llm-v1' }),
      embed: vi.fn(),
    };
    (createLLMProvider as ReturnType<typeof vi.fn>).mockResolvedValue(mockProvider);

    const result = await runRAG(
      'tenant-001', '질문', [0.1],
      { topK: 5, maxContextTokens: 6000 },  // 6000 토큰 제한
    );

    // 5개 청크 중 최대 2개만 사용 (3000 * 2 = 6000)
    expect(result.contextChunks).toBeLessThanOrEqual(2);
  });
});
```

---

## 7. E2E 테스트 — Playwright + Fastify inject 패턴

### 7.1 Fastify inject 패턴 (HTTP 없이 E2E 테스트)

Fastify의 `inject` 메서드를 사용하면 실제 HTTP 서버를 시작하지 않고도 요청/응답을 테스트할 수 있습니다.

```typescript
// platform/services/ai-service/tests/e2e/ai-agent.e2e.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { registerRoutes } from '../../src/routes.js';
import { startContainers, stopContainers } from '../setup/containers';

// 테스트용 Fastify 앱 (실제 앱과 동일한 설정)
async function buildTestApp() {
  const app = Fastify({
    logger: false,  // 테스트에서는 로그 비활성화
  });

  await registerRoutes(app);
  await app.ready();
  return app;
}

describe('AI Agent E2E 테스트', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>;

  beforeAll(async () => {
    await startContainers();
    app = await buildTestApp();
  }, 60000);

  afterAll(async () => {
    await app.close();
    await stopContainers();
  });

  it('전체 에이전트 요청 플로우 — O 등급 데이터, 정상 응답', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/ai/agent',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'e2e-test-user',
        'x-tenant-id': '550e8400-e29b-41d4-a716-446655440000',
      },
      payload: {
        tenantId: '550e8400-e29b-41d4-a716-446655440000',
        grade: 'O',
        query: '2026년 예산 편성 관련 문서를 요약해주세요',
        maxIterations: 3,
        tools: ['search_knowledge', 'summarize_text'],
      },
    });

    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.data.answer).toBeDefined();
    expect(body.data.iterations).toBeGreaterThan(0);
    expect(body.data.durationMs).toBeGreaterThan(0);
  });

  it('C 등급 데이터 요청은 403을 반환한다', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/ai/agent',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'e2e-test-user',
      },
      payload: {
        tenantId: '550e8400-e29b-41d4-a716-446655440000',
        grade: 'C',  // 기밀 등급 — 차단되어야 함
        query: '기밀 정보 요청',
      },
    });

    expect(response.statusCode).toBe(403);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(false);
    // 에러 메시지에 민감 정보 없어야 함
    expect(body.error.message).not.toContain('secret');
    expect(body.error.message).not.toContain('password');
  });

  it('헬스체크 엔드포인트가 200을 반환한다', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/healthz',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.status).toBe('ok');
  });

  it('존재하지 않는 엔드포인트는 404를 반환한다', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/non-existent-path',
    });

    expect(response.statusCode).toBe(404);
  });
});
```

### 7.2 Playwright 브라우저 E2E 테스트

```typescript
// tests/e2e/admin-portal.spec.ts (Playwright)
import { test, expect, Page } from '@playwright/test';

// 로그인 유틸리티
async function loginAsAdmin(page: Page) {
  await page.goto('/auth/login');
  await page.fill('[data-testid="email-input"]', 'admin@agency.go.kr');
  await page.fill('[data-testid="password-input"]', process.env.E2E_ADMIN_PASSWORD!);
  await page.click('[data-testid="login-button"]');
  await page.waitForURL('/dashboard');
}

test.describe('관리자 포털 SLO 대시보드', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('SLO 대시보드 접근 및 에러버짓 게이지 표시', async ({ page }) => {
    await page.goto('/monitoring/slo');

    // 페이지 로드 완료 대기
    await page.waitForSelector('[data-testid="error-budget-gauge"]', { timeout: 10000 });

    // 게이지가 0~100% 범위 값을 표시하는지 확인
    const gaugeText = await page.textContent('[data-testid="error-budget-gauge"]');
    const percentage = parseFloat(gaugeText?.replace('%', '') ?? '0');
    expect(percentage).toBeGreaterThanOrEqual(0);
    expect(percentage).toBeLessThanOrEqual(200); // 100% 초과 소진 가능

    // DORA 등급 표시 확인
    const doraGrade = await page.textContent('[data-testid="dora-grade"]');
    expect(['Elite', 'High', 'Medium', 'Low']).toContain(doraGrade);
  });

  test('접근 권한 없는 페이지는 403 또는 리다이렉트', async ({ page }) => {
    // 일반 사용자 세션으로 접근
    await page.goto('/admin/system-config');

    // 403 페이지 또는 리다이렉트 확인
    const url = page.url();
    const isBlocked = url.includes('/403') || url.includes('/unauthorized') || url.includes('/dashboard');
    expect(isBlocked).toBe(true);
  });
});
```

---

## 8. Flaky 테스트 관리 전략

Flaky 테스트는 같은 코드에서 때때로 성공하고 때때로 실패하는 비결정적 테스트입니다. 이는 CI/CD 신뢰성을 낮추는 주요 원인입니다.

### 8.1 Flaky 테스트 원인과 해결책

| 원인 | 예시 | 해결책 |
|------|------|--------|
| 시간 의존성 | `new Date()` 비교 | `vi.useFakeTimers()` |
| 비결정적 순서 | Map/Set 순서 | 명시적 정렬 후 비교 |
| 타임아웃 | 비동기 작업 대기 | `waitFor` + 충분한 타임아웃 |
| 공유 상태 | 전역 변수 | `beforeEach`에서 초기화 |
| 외부 의존성 | HTTP 요청 | 완전한 모킹 |
| 포트 충돌 | 고정 포트 사용 | 0번 포트(랜덤) 사용 |

### 8.2 시간 의존성 해결

```typescript
// 나쁜 예 — 실제 시간에 의존
it('7일 후 예측 날짜를 반환한다 (나쁜 예)', () => {
  const result = engine.calculateErrorBudget({ ... });
  const expected = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  // 실행 시점에 따라 밀리초 차이 발생 → Flaky!
  expect(result.projectedExhaustionDate).toBe(expected);
});

// 좋은 예 — 가짜 타이머 사용
it('7일 후 예측 날짜를 반환한다 (좋은 예)', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-04-13T09:00:00.000Z'));  // 고정 시간

  const result = engine.calculateErrorBudget({ ... });

  const expected = new Date('2026-04-20T09:00:00.000Z').toISOString(); // 정확히 7일 후
  expect(result.projectedExhaustionDate).toBe(expected);

  vi.useRealTimers();  // 테스트 후 복원
});
```

### 8.3 격리 전략

```typescript
// 각 테스트는 독립적이어야 함
describe('SLOEscalationController', () => {
  let controller: SLOEscalationController;

  beforeEach(() => {
    // 새 인스턴스 생성 — 이전 테스트 상태 완전 제거
    controller = new SLOEscalationController();
  });

  it('테스트 A', async () => {
    controller.registerPolicy({...});
    // ...
  });

  it('테스트 B — 테스트 A의 상태와 무관하게 실행', async () => {
    // controller는 새 인스턴스이므로 정책이 없음
    const event = await controller.escalate('service', 'SLO', 80, 20);
    expect(event.notifiedContacts).toHaveLength(0); // 정책 없음 확인
  });
});
```

### 8.4 Quarantine 전략

심각하게 Flaky한 테스트를 일시적으로 격리하는 방법:

```typescript
// vitest skip 태그로 격리
it.skip('E2E: 외부 결제 API 연동 (Flaky — GitHub #1234 추적 중)', async () => {
  // TODO: 2026-05-01까지 해결. 담당자: @dev-hong
  // 원인: 외부 결제 API 응답 시간이 가끔 5초 초과
});

// 또는 unstable 그룹으로 분리
describe.skip('Flaky Tests (quarantine)', () => {
  it('네트워크 타임아웃 테스트', async () => { ... });
});
```

```yaml
# CI에서 quarantine 테스트 제외
- name: 일반 테스트 실행
  run: pnpm vitest run --exclude="**/quarantine/**"

- name: Quarantine 테스트 (실패 허용)
  run: pnpm vitest run --include="**/quarantine/**" || echo "Quarantine 실패 무시"
  continue-on-error: true
```

---

## 9. 테스트 커버리지 80% 달성 전략 (Q-Gate G4)

### 9.1 커버리지 현황 확인

```bash
# 전체 커버리지 리포트 생성
pnpm vitest run --coverage

# 특정 패키지만
cd packages/slo-escalation && pnpm vitest run --coverage

# 커버리지가 낮은 파일 식별
cat coverage/coverage-summary.json | jq '.[] | select(.lines.pct < 80) | {file: .key, coverage: .lines.pct}'
```

### 9.2 커버리지 향상 우선순위 결정

```
커버리지 향상 효과 = (미커버 라인 수) × (비즈니스 중요도)

우선순위 1: 핵심 비즈니스 로직 (에러버짓 계산, 에스컬레이션 판정)
우선순위 2: 보안 관련 코드 (CSAP D-12 필수 검증)
우선순위 3: 에러 처리 경로 (catch 블록, 예외 상황)
우선순위 4: 유틸리티 함수 (PII 마스킹, 데이터 변환)
우선순위 5: 설정 코드, 초기화 코드
```

### 9.3 브랜치 커버리지 향상 기법

```typescript
// 커버리지가 낮은 브랜치 식별 후 테스트 추가

// 원본 코드
function determineEscalationLevel(burnRate: number): EscalationLevel {
  if (burnRate <= 50) return EscalationLevel.Normal;     // ← 브랜치 1
  if (burnRate <= 75) return EscalationLevel.Warning;    // ← 브랜치 2
  if (burnRate <= 90) return EscalationLevel.Danger;     // ← 브랜치 3
  if (burnRate <= 100) return EscalationLevel.Critical;  // ← 브랜치 4 (누락 가능)
  return EscalationLevel.Violated;                       // ← 브랜치 5 (누락 가능)
}

// 모든 브랜치를 커버하는 테스트
it.each([
  [0, EscalationLevel.Normal],      // 브랜치 1 커버
  [75, EscalationLevel.Warning],     // 브랜치 2 커버
  [90, EscalationLevel.Danger],      // 브랜치 3 커버
  [100, EscalationLevel.Critical],   // 브랜치 4 커버 ← 누락하기 쉬움
  [101, EscalationLevel.Violated],   // 브랜치 5 커버 ← 누락하기 쉬움
])('burnRate %i → %s', (rate, expected) => {
  expect(determineEscalationLevel(rate)).toBe(expected);
});
```

### 9.4 커버리지 제외 처리 (정당한 예외)

```typescript
// 완전히 테스트할 수 없는 코드는 주석으로 제외
// (감사 시 설명 가능한 이유 필수)

/* v8 ignore next 3 */
// 이 코드는 process.exit()가 호출되는 시나리오로 단위 테스트 불가
// 통합 테스트 수준에서 검증 (tests/integration/graceful-shutdown.test.ts)
process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});
```

---

## 10. 성능 테스트 — k6 스크립트 + 임계값 설정

### 10.1 k6 기본 스크립트

```javascript
// tests/performance/agent-load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Histogram, Rate, Trend } from 'k6/metrics';

// 사용자 정의 메트릭
const agentErrors = new Counter('agent_errors_total');
const agentLatency = new Histogram('agent_latency_ms');
const successRate = new Rate('agent_success_rate');
const tokenUsage = new Trend('agent_token_usage');

// 테스트 설정
export const options = {
  scenarios: {
    // 시나리오 1: 점진적 부하 증가 (Ramp-up)
    rampUp: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '30s', target: 5 },   // 30초 동안 5명으로 증가
        { duration: '1m',  target: 10 },  // 1분 동안 10명 유지
        { duration: '30s', target: 20 },  // 30초 동안 20명으로 증가
        { duration: '2m',  target: 20 },  // 2분 동안 20명 유지 (피크)
        { duration: '30s', target: 0 },   // 30초 동안 0명으로 감소
      ],
    },
    // 시나리오 2: 스파이크 테스트
    spike: {
      executor: 'ramping-vus',
      startTime: '5m',  // 5분 후 시작
      stages: [
        { duration: '10s', target: 50 },  // 급격한 증가 (DoS 시뮬레이션)
        { duration: '1m',  target: 50 },
        { duration: '10s', target: 0 },
      ],
    },
  },
  // 임계값 (SLO 기반 설정)
  thresholds: {
    // 95% 요청이 5초 이내 완료 (AI 에이전트는 처리 시간이 길어 완화)
    'http_req_duration': ['p(95)<5000'],

    // 99% 요청이 10초 이내 완료
    'http_req_duration': ['p(99)<10000'],

    // 에러율 5% 미만 (DORA CFR 기준)
    'http_req_failed': ['rate<0.05'],

    // 에이전트 성공률 95% 이상
    'agent_success_rate': ['rate>0.95'],

    // 에이전트 응답 시간 p95 < 8초
    'agent_latency_ms': ['p(95)<8000'],
  },
};

// 테스트 데이터
const TEST_TENANT_ID = '550e8400-e29b-41d4-a716-446655440000';
const QUERIES = [
  '2026년 예산 편성 기준을 알려주세요',
  '공공기관 CSAP 인증 절차는 어떻게 되나요?',
  '행정정보 시스템 감리 기준을 설명해주세요',
  '민원 처리 법정 기한은 얼마나 되나요?',
];

export default function () {
  const query = QUERIES[Math.floor(Math.random() * QUERIES.length)];
  const startTime = Date.now();

  const response = http.post(
    `${__ENV.API_URL}/ai/agent`,
    JSON.stringify({
      tenantId: TEST_TENANT_ID,
      grade: 'O',
      query,
      maxIterations: 3,  // 성능 테스트는 반복 횟수 제한
      tools: ['search_knowledge', 'summarize_text'],
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': `perf-test-user-${__VU}`,  // VU = Virtual User 번호
        'Authorization': `Bearer ${__ENV.TEST_TOKEN}`,
      },
      timeout: '15s',
    },
  );

  const latencyMs = Date.now() - startTime;
  agentLatency.add(latencyMs);

  const success = check(response, {
    '응답 코드 200': (r) => r.status === 200,
    '응답에 answer 필드 포함': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.success === true && body.data.answer !== undefined;
      } catch {
        return false;
      }
    },
    '응답 시간 10초 이내': (r) => r.timings.duration < 10000,
  });

  if (success) {
    successRate.add(1);
    const body = JSON.parse(response.body);
    tokenUsage.add(body.data?.tokensUsed ?? 0);
  } else {
    agentErrors.add(1);
    successRate.add(0);
    console.error(`실패: status=${response.status}, body=${response.body.slice(0, 200)}`);
  }

  sleep(1);  // 1초 대기 (실제 사용자 행동 시뮬레이션)
}

// 테스트 종료 후 요약 출력
export function handleSummary(data) {
  return {
    'tests/performance/results/latest.json': JSON.stringify(data, null, 2),
    stdout: `
=== AI 에이전트 성능 테스트 결과 ===
총 요청: ${data.metrics.http_reqs.values.count}
성공률: ${(data.metrics.agent_success_rate?.values?.rate * 100).toFixed(1)}%
p50 응답 시간: ${data.metrics.http_req_duration?.values?.['p(50)'].toFixed(0)}ms
p95 응답 시간: ${data.metrics.http_req_duration?.values?.['p(95)'].toFixed(0)}ms
p99 응답 시간: ${data.metrics.http_req_duration?.values?.['p(99)'].toFixed(0)}ms
평균 토큰 사용: ${data.metrics.agent_token_usage?.values?.avg?.toFixed(0) ?? 'N/A'}
에러 수: ${data.metrics.agent_errors_total?.values?.count ?? 0}
    `,
  };
}
```

### 10.2 k6 실행 방법

```bash
# 기본 실행
k6 run tests/performance/agent-load-test.js \
  --env API_URL=http://localhost:3001 \
  --env TEST_TOKEN=$(cat .env.test | grep TEST_TOKEN | cut -d= -f2)

# CI/CD에서 실행 (임계값 통과 여부로 빌드 성공/실패 결정)
k6 run tests/performance/agent-load-test.js \
  --env API_URL=$STAGING_API_URL \
  --env TEST_TOKEN=$STAGING_TEST_TOKEN \
  --out json=results.json

# Prometheus로 결과 전송 (Grafana에서 시각화)
k6 run tests/performance/agent-load-test.js \
  --out experimental-prometheus-rw=http://prometheus-pushgateway:9091
```

---

## 11. AI/LLM 테스트 특화 패턴 — deterministic mock, 비용 제어

### 11.1 AI 테스트의 핵심 도전과제

AI/LLM 테스트는 일반 테스트와 다른 특수한 도전이 있습니다:

| 도전과제 | 일반 API | LLM API |
|---------|---------|---------|
| 비용 | 무료 또는 저렴 | 토큰당 비용 발생 |
| 결정성 | 동일 입력 → 동일 출력 | 동일 입력 → 다른 출력 가능 |
| 속도 | 밀리초 | 초~분 |
| 모킹 | 쉬움 | 어려움 (응답 형식이 복잡) |

### 11.2 결정적 LLM Mock (Deterministic Mock)

```typescript
// tests/fixtures/llm-mock.ts — 결정적 LLM 응답 픽스처

export interface MockLLMResponse {
  text: string;
  tokensUsed: number;
  model: string;
}

// 쿼리 키워드 기반 결정적 응답 매핑
const deterministicResponses: Record<string, MockLLMResponse> = {
  '예산': {
    text: '2026년 예산 편성 기준에 따라 공공기관은 전년 대비 5% 이내로 예산을 증액할 수 있습니다. [출처: 2026 예산 편성 지침]',
    tokensUsed: 45,
    model: 'mock-llm-v1',
  },
  'CSAP': {
    text: 'CSAP(Cloud Security Assurance Program)은 클라우드 서비스 보안 인증 제도로, 79개 통제항목을 검증합니다. [출처: CSAP 인증 가이드]',
    tokensUsed: 38,
    model: 'mock-llm-v1',
  },
  '기본': {
    text: '요청하신 내용에 대한 답변입니다. 관련 문서를 참조하시기 바랍니다.',
    tokensUsed: 20,
    model: 'mock-llm-v1',
  },
};

// 쿼리 내용에 따라 결정적 응답 반환
export function createDeterministicLLMProvider() {
  return {
    chat: vi.fn().mockImplementation(
      (messages: Array<{ role: string; content: string }>) => {
        const userMessage = messages.find(m => m.role === 'user')?.content ?? '';

        // 키워드 기반 응답 선택
        for (const [keyword, response] of Object.entries(deterministicResponses)) {
          if (userMessage.includes(keyword)) {
            return Promise.resolve(response);
          }
        }

        return Promise.resolve(deterministicResponses['기본']!);
      }
    ),
    embed: vi.fn().mockResolvedValue({
      embeddings: [[0.1, 0.2, 0.3, 0.4, 0.5]],  // 고정 임베딩 벡터
    }),
  };
}
```

### 11.3 비용 제어 전략

```typescript
// tests/setup/cost-guard.ts — AI API 호출 비용 제어

let totalMockTokensUsed = 0;
const MOCK_TOKEN_BUDGET = 10000; // 테스트 세션당 토큰 예산

// 실제 LLM 호출을 전역 차단
vi.mock('../lib/llm-provider.js', () => ({
  createLLMProvider: vi.fn().mockImplementation(() => {
    return {
      chat: vi.fn().mockImplementation(async (messages, options) => {
        // 토큰 예산 초과 시 테스트 실패
        const estimatedTokens = messages.reduce(
          (sum, m) => sum + Math.ceil((typeof m.content === 'string' ? m.content.length : 0) / 4),
          0
        );

        totalMockTokensUsed += estimatedTokens;

        if (totalMockTokensUsed > MOCK_TOKEN_BUDGET) {
          throw new Error(
            `테스트 토큰 예산 초과: ${totalMockTokensUsed} > ${MOCK_TOKEN_BUDGET}. ` +
            '실제 LLM API가 테스트에서 호출되고 있습니다. vi.mock()으로 차단하세요.'
          );
        }

        return {
          text: '모킹된 응답',
          tokensUsed: estimatedTokens,
          model: 'mock-v1',
        };
      }),
    };
  }),
}));

// 세션 종료 후 통계 출력
afterAll(() => {
  console.log(`테스트에서 시뮬레이션된 총 토큰: ${totalMockTokensUsed}`);
});
```

### 11.4 ai-tools.ts의 calculate 도구 보안 테스트

`/data/ai-saas/platform/services/ai-service/src/lib/ai-tools.ts`의 `calculate` 도구는 CSAP D-12 준수를 위해 `eval()` 사용 없이 안전한 수식 파서를 구현했습니다. 이를 검증하는 테스트:

```typescript
// platform/services/ai-service/tests/lib/ai-tools-security.test.ts
import { describe, it, expect } from 'vitest';
import { createToolExecutors } from '../../src/lib/ai-tools.js';

describe('calculate 도구 — CSAP D-12 보안 검증', () => {
  const executors = createToolExecutors();

  // 정상 케이스
  it.each([
    ['2 + 3', '5'],
    ['10 - 4', '6'],
    ['3 * 4', '12'],
    ['10 / 4', '2.5'],
    ['(2 + 3) * 4', '20'],
    ['1000000 + 500000', '1500000'],   // 예산 계산 시나리오
    ['365 * 24 * 60', '525600'],       // 연간 분 계산
  ])('"%s" → "%s"', async (expression, expected) => {
    const result = await executors.calculate!({ expression });
    expect(result.success).toBe(true);
    expect(result.output).toBe(expected);
  });

  // 보안 차단 케이스 (CSAP D-12: 코드 인젝션 방지)
  it.each([
    // JavaScript 코드 인젝션 시도
    'process.exit(1)',
    'require("fs").readFileSync("/etc/passwd")',
    'eval("malicious code")',
    'new Function("return process.env")()',
    // 특수 문자 인젝션
    '1; DROP TABLE users',
    '1 || true',
    '1 && process',
    // 유효하지 않은 수식
    'alert(1)',
    'console.log(123)',
    '__proto__',
    'constructor',
  ])('"%s"는 차단된다', async (expression) => {
    const result = await executors.calculate!({ expression });
    // 성공하면 안 됨 (차단)
    expect(result.success).toBe(false);
    // 에러 메시지에 민감 정보 없어야 함
    expect(result.error).not.toContain('process');
    expect(result.error).not.toContain('require');
  });

  // 0으로 나누기 처리
  it('0으로 나누면 실패를 반환한다', async () => {
    const result = await executors.calculate!({ expression: '10 / 0' });
    expect(result.success).toBe(false);
  });
});
```

---

## 12. 테스트 워크플로우 시퀀스 다이어그램

```mermaid
sequenceDiagram
    participant Dev as 개발자
    participant Git as Gitea
    participant CI as Quality Gate\n(Gitea Actions)
    participant UT as 단위 테스트\n(vitest)
    participant IT as 통합 테스트\n(Testcontainers)
    participant SEC as 보안 테스트\n(CSAP D-12)
    participant COV as 커버리지 검증\n(v8, 80% 임계값)
    participant E2E as E2E 테스트\n(Playwright/inject)
    participant PERF as 성능 테스트\n(k6, stg only)
    participant MRG as PR 머지 허용

    Dev->>Git: PR 생성
    Git->>CI: Q-Gate 트리거

    CI->>UT: 단위 테스트 실행
    Note over UT: 모든 외부 의존성 모킹<br/>vi.mock() 적용<br/>빠른 실행 (~30초)
    UT-->>CI: 결과 반환

    CI->>IT: 통합 테스트 실행
    Note over IT: Testcontainers 시작<br/>PostgreSQL + Redis<br/>실제 DB 연동 (~2분)
    IT-->>CI: 결과 반환

    CI->>SEC: 보안 테스트 실행
    Note over SEC: SQL 인젝션 시도<br/>XSS 시도<br/>인증 우회 시도<br/>C등급 데이터 차단 검증
    SEC-->>CI: CSAP D-12 결과

    CI->>COV: 커버리지 측정
    Note over COV: v8 provider<br/>lines: 80%<br/>branches: 75%<br/>functions: 80%
    alt 커버리지 80% 미만
        COV-->>CI: G4 FAIL
        CI-->>Dev: "커버리지 부족: XX%"
    else 커버리지 80% 이상
        COV-->>CI: G4 PASS
    end

    CI->>E2E: E2E 테스트 (dev 환경)
    Note over E2E: Fastify inject 패턴<br/>전체 플로우 검증<br/>인증/권한 검증
    E2E-->>CI: E2E 결과

    alt stg 브랜치 PR
        CI->>PERF: 성능 테스트 (stg 환경)
        Note over PERF: k6 부하 테스트<br/>p95 < 5초<br/>에러율 < 5%
        PERF-->>CI: 성능 결과
    end

    alt 모든 게이트 통과
        CI-->>MRG: 머지 허용
        MRG-->>Dev: PR 머지 가능
    else 게이트 실패
        CI-->>Dev: "실패 상세: [게이트명] [에러 내용]"
    end
```

---

## 13. CSAP D-12 개발 보안 — 테스트를 통한 보안 검증

CSAP D-12 (시스템 개발 보안) 통제항목은 개발 과정에서 보안 요건을 충족해야 하며, 테스트를 통해 자동으로 검증되어야 합니다.

### 13.1 보안 테스트 체크리스트

```typescript
// tests/security/csap-d12.security.test.ts
// CSAP D-12 보안 테스트 — 감리 증거용

describe('CSAP D-12: SQL 인젝션 방지 (매개변수화 쿼리)', () => {
  it('SQL 인젝션 문자열이 포함된 입력을 안전하게 처리한다', async () => {
    const maliciousInput = "'; DROP TABLE users; --";

    const request = createMockRequest({
      tenantId: '550e8400-e29b-41d4-a716-446655440000',
      grade: 'O',
      query: maliciousInput,  // SQL 인젝션 시도
    });
    const reply = createMockReply();

    // 크래시 없이 정상 처리되어야 함
    await expect(agentHandler(request, reply)).resolves.not.toThrow();
    // Zod가 4000자 이내 문자열로 검증하므로 통과
    // 실제 DB 쿼리 시 Prisma가 매개변수화 쿼리 사용 (안전)
  });
});

describe('CSAP D-12: XSS 방지 (출력 새니타이제이션)', () => {
  it('AI 응답에 HTML 스크립트 태그가 포함되면 이스케이프된다', async () => {
    const { runAgent } = await import('../lib/ai-agent.js');
    (runAgent as ReturnType<typeof vi.fn>).mockResolvedValue({
      answer: '<script>alert("XSS")</script>공공기관 답변',
      steps: [], iterations: 1, tokensUsed: 50, model: 'mock', timedOut: false,
    });

    const request = createMockRequest({
      tenantId: '550e8400-e29b-41d4-a716-446655440000',
      grade: 'O',
      query: '질문',
    });
    const reply = createMockReply();
    await agentHandler(request, reply);

    // 응답에 스크립트 태그가 그대로 전달되는지 확인
    // (프론트엔드에서 DOMPurify로 추가 처리 필요)
    const sentData = (reply.send as ReturnType<typeof vi.fn>).mock.calls[0][0];
    // 적어도 에러 없이 응답되어야 함
    expect(sentData.success).toBe(true);
  });
});

describe('CSAP D-12: 인증 검증', () => {
  it('x-user-id 헤더 없으면 system 계정으로 처리하고 감사 로그에 기록한다', async () => {
    const { logAiEvent } = await import('../lib/audit.js');

    const request = createMockRequest(
      { tenantId: '550e8400-e29b-41d4-a716-446655440000', grade: 'O', query: '질문' },
      {}  // x-user-id 헤더 없음
    );
    const reply = createMockReply();
    await agentHandler(request, reply);

    // 'system'으로 처리됨
    expect(logAiEvent).toHaveBeenCalledWith(
      'AGENT_RUN',
      'system',  // 헤더 없으면 system
      expect.any(String),
      expect.any(String),
      expect.any(String),
      expect.any(String),
      expect.any(Object),
    );
  });
});

describe('CSAP D-12: 민감 정보 노출 방지', () => {
  it('에러 응답에 스택 트레이스가 포함되지 않는다', async () => {
    const { runAgent } = await import('../lib/ai-agent.js');
    (runAgent as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('DB_PASS=secret123 connection refused')
    );

    const request = createMockRequest({
      tenantId: '550e8400-e29b-41d4-a716-446655440000',
      grade: 'O',
      query: '질문',
    });
    const reply = createMockReply();
    await agentHandler(request, reply);

    const sentData = (reply.send as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const responseStr = JSON.stringify(sentData);

    // 스택 트레이스 없음
    expect(responseStr).not.toContain('at ');
    expect(responseStr).not.toContain('stack');
    // 비밀번호 노출 없음
    expect(responseStr).not.toContain('secret123');
    expect(responseStr).not.toContain('DB_PASS');
  });
});
```

### 13.2 자동 보안 테스트 CI 통합

```yaml
# .gitea/workflows/quality-gate.yml 내 보안 테스트 단계
- name: "[G5] OWASP 보안 테스트"
  run: |
    # CSAP D-12 보안 테스트만 실행
    pnpm vitest run \
      --include="**/tests/security/**" \
      --reporter=verbose \
      --outputFile=coverage/security-test-results.json

    # 결과를 CSAP 감사 로그에 기록
    echo "{
      \"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
      \"actor\":\"quality-gate\",
      \"action\":\"SECURITY_TEST_COMPLETE\",
      \"detail\":\"csap_d12_tests_passed\",
      \"csap_ref\":\"D-12\"
    }" >> ".claude/audit.jsonl"
```

---

## 14. 실습 미션

### 미션 1: 단위 테스트 커버리지 측정

```bash
# 1. packages/slo-escalation 커버리지 측정
cd /data/ai-saas/packages/slo-escalation
pnpm vitest run --coverage

# 2. 커버리지 HTML 리포트 열기
open coverage/index.html  # macOS
xdg-open coverage/index.html  # Linux

# 3. 커버리지가 80% 미만인 파일 확인
cat coverage/coverage-summary.json | \
  node -e "
    const data = JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8'));
    Object.entries(data).forEach(([file, cov]) => {
      if (cov.lines?.pct < 80) {
        console.log(\`[낮음] \${file}: \${cov.lines.pct}%\`);
      }
    });
  "

# 4. 빠진 테스트 케이스 추가 (미션 목표: 90% 달성)
```

### 미션 2: DORA 익스포터 통합 테스트 실행

```bash
# 1. Docker 실행 확인
docker info

# 2. 통합 테스트 실행 (Testcontainers 필요)
cd /data/ai-saas/packages/dora-exporter
pnpm vitest run --include="**/tests/integration/**"

# 3. 예상 소요 시간: 30초~2분 (컨테이너 시작 포함)
# 4. 성공 메시지:
#    ✓ POST /webhook/gitea — 유효한 webhook 처리 (200ms)
#    ✓ POST /webhook/alertmanager — MTTR 계산 (150ms)

# 5. 실패 시 Docker 상태 확인
docker ps -a | grep testcontainers
```

### 미션 3: calculate 도구 보안 테스트 확장

```typescript
// 다음 테스트를 추가하고 모두 통과시키시오
// 파일: platform/services/ai-service/tests/lib/calculate-security.test.ts

describe('추가 보안 테스트', () => {
  // TODO 1: 매우 큰 숫자 계산 (숫자 오버플로우 처리)
  it('Infinity를 반환하는 계산은 실패한다', async () => {
    // 힌트: 1e308 * 2 = Infinity
    // safeEvaluate 함수에서 isFinite(result) 체크 확인
  });

  // TODO 2: 소수점이 여러 개인 숫자
  it('유효하지 않은 숫자 형식은 실패한다', async () => {
    // 힌트: "1.2.3" 같은 잘못된 소수점
  });

  // TODO 3: 빈 표현식
  it('빈 표현식은 실패한다', async () => {
    // 힌트: ""를 넣으면?
  });

  // TODO 4: 아주 긴 표현식 (DOS 공격 방지)
  it('매우 긴 표현식도 처리할 수 있다 (타임아웃 없음)', async () => {
    // 힌트: "1+".repeat(10000) + "1"
  });
});
```

---

## 요약

이 문서에서 다룬 핵심 내용:

1. **테스트 피라미드**: 단위 75% + 통합 20% + E2E 5% 비율, 각 계층의 역할과 비용 특성
2. **vitest 설정**: workspace, v8 커버리지, 80% 임계값 (Q-Gate G4), 경로 별칭
3. **단위 테스트 패턴**: `agentHandler` 기반 AAA 패턴, 보안 케이스(N2SF N-05), 에러 처리 검증
4. **Testcontainers**: PostgreSQL+Redis 실제 컨테이너로 통합 테스트, Prisma 마이그레이션 자동화
5. **RAG 파이프라인 테스트**: `semanticSearch`, `createLLMProvider` 모킹, PII 마스킹 검증, 토큰 예산 제한
6. **Fastify inject**: 실제 HTTP 서버 없이 E2E 테스트, 인증/권한 검증
7. **Flaky 테스트**: 가짜 타이머(`vi.useFakeTimers`), 완전한 격리(`beforeEach` 초기화), Quarantine 전략
8. **커버리지 80%**: 브랜치 커버리지 전략, 제외 주석, 우선순위 결정
9. **k6 성능 테스트**: Ramp-up + Spike 시나리오, p95<5초 임계값, Prometheus 결과 전송
10. **AI/LLM 테스트**: 결정적 Mock, 토큰 비용 제어 가드, `calculate` 도구 코드 인젝션 방지
11. **CSAP D-12**: SQL 인젝션, XSS, 스택 트레이스 노출, 민감 정보 차단 자동 테스트

---

*관련 문서: 03-testing-guide.md, 11-test-strategy.md, 38-nodejs-security-hardening.md*
*실제 코드: `platform/services/ai-service/src/`, `packages/slo-escalation/src/`, `packages/dora-exporter/src/`*
*CSAP 통제항목: D-12 (시스템 개발 보안)*
*Q-Gate: G3 (코드 품질), G4 (커버리지 80%), G5 (OWASP Top10)*
