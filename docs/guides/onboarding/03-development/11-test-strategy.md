# 테스트 전략 심화 가이드

> **문서 ID**: ONBOARD-03-11
> **버전**: 1.0.0 | **작성일**: 2026-04-12 | **작성자**: Implementer (Sonnet)
> **학습 대상**: 신규 개발자 — 코딩 경험이 있지만 이 프로젝트 테스트 방식을 처음 배우는 팀원
> **예상 학습 시간**: 4~5시간
> **선행 문서**: `03-testing-guide.md` (기본 테스트 도구 안내)
> **CSAP 연관**: D-12 (시스템 개발 보안 — 테스트 검증)

---

## 목차

1. [이 프로젝트의 테스트 피라미드](#1-이-프로젝트의-테스트-피라미드)
2. [단위 테스트 — 빠르고 정밀하게](#2-단위-테스트--빠르고-정밀하게)
3. [외부 의존성 모킹 전략](#3-외부-의존성-모킹-전략)
4. [통합 테스트 — API 엔드포인트 검증](#4-통합-테스트--api-엔드포인트-검증)
5. [E2E 테스트 원칙](#5-e2e-테스트-원칙)
6. [CSAP 필수 테스트 항목](#6-csap-필수-테스트-항목)
7. [TDD 적용법 — Red-Green-Refactor](#7-tdd-적용법--red-green-refactor)
8. [커버리지 80% 달성 전략](#8-커버리지-80-달성-전략)
9. [CI 테스트 실패 대처법](#9-ci-테스트-실패-대처법)
10. [실제 테스트 파일 해설](#10-실제-테스트-파일-해설)
11. [학습 체크리스트](#11-학습-체크리스트)
12. [다음 단계](#12-다음-단계)

---

## 1. 이 프로젝트의 테스트 피라미드

### 1.1 왜 테스트 피라미드가 중요한가

테스트가 "많다"고 좋은 것이 아닙니다. 어떤 종류의 테스트를 얼마나 작성하느냐가 중요합니다. 잘못된 비율로 테스트를 작성하면 다음 문제가 발생합니다.

- E2E 테스트만 가득하면: 느린 CI, 불안정한 테스트, 실패 원인 파악 어려움
- 단위 테스트만 가득하면: 서비스 간 연동 버그를 잡지 못함

이 프로젝트는 다음 비율의 테스트 피라미드를 목표로 합니다.

```
                    /\
                   /  \
                  /    \
                 / E2E  \     5~10%
                / (소수) \    전체 흐름 검증
               /----------\
              /            \
             /    통합 테스트  \   20~30%
            /    (일부)       \  API 엔드포인트, DB 연동
           /--------------------\
          /                      \
         /      단위 테스트        \   60~70%
        /    (다수 — 가장 중요!)    \  함수, 클래스, 스키마
       /________________________________\
```

```mermaid
graph TB
    subgraph "테스트 피라미드 — 이 프로젝트 기준"
        E2E["E2E 테스트 (5~10%)\n전체 시스템 흐름\nplatform/tests/e2e/\n느림 | 비용 높음 | 실제 네트워크 필요"]
        INT["통합 테스트 (20~30%)\nAPI 엔드포인트\ntests/integration/*.test.ts\n중간 속도 | 실제 DB 또는 목"]
        UNIT["단위 테스트 (60~70%)\n함수·클래스·스키마\ntests/unit/*.test.ts\n빠름 | 비용 낮음 | 외부 의존성 없음"]
    end

    UNIT --> INT --> E2E

    style UNIT fill:#4caf50,color:#fff,font-size:14px
    style INT fill:#ff9800,color:#fff,font-size:14px
    style E2E fill:#f44336,color:#fff,font-size:14px
```

### 1.2 각 테스트 계층 특성

| 계층 | 무엇을 검증 | 외부 의존성 | 속도 | Q-Gate 기여 |
|------|------------|------------|------|-----------|
| **단위** | 순수 함수, 스키마, 비즈니스 로직 | 없음 (모킹) | ms 단위 | 가장 높음 |
| **통합** | API 라우트, DB 쿼리, Redis 연동 | 실제 또는 목 | 초 단위 | 중간 |
| **E2E** | 사용자 시나리오 전체 흐름 | 실제 시스템 전체 | 분 단위 | 낮음 |

### 1.3 Q-Gate G4 요건

이 프로젝트의 Q-Gate G4를 통과하려면 테스트 커버리지가 80% 이상이어야 합니다.

```
Q-Gate G4: 테스트 커버리지 80% 이상 (필수 통과 조건)

측정 도구: Vitest + v8 coverage provider
측정 항목: 라인 커버리지(line) 80%+, 브랜치 커버리지(branch) 80%+
측정 명령: pnpm vitest run --coverage

실패 시 결과: Tester 에이전트가 누락 케이스를 보완하고 재검증 요청
```

---

## 2. 단위 테스트 — 빠르고 정밀하게

### 2.1 Vitest 기초

이 프로젝트는 Vitest를 테스트 프레임워크로 사용합니다. Jest와 API가 거의 동일하므로 Jest 경험이 있다면 바로 적용할 수 있습니다.

```typescript
// 기본 import 패턴 (모든 단위 테스트에서 동일)
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// describe: 테스트 그룹 묶음
describe('calculateBurnRate (SLO 에러버짓 소진율 계산)', () => {

  // it/test: 개별 테스트 케이스
  it('에러율이 SLO를 초과하면 burnRate > 1.0 을 반환한다', () => {

    // Given (준비) — 테스트 입력값 설정
    const errorRate = 0.05   // 5% 에러
    const sloTarget = 0.001  // 0.1% SLO

    // When (실행) — 검증 대상 함수 호출
    const result = calculateBurnRate(errorRate, sloTarget)

    // Then (검증) — 기대 결과 확인
    expect(result).toBeGreaterThan(1.0)
    expect(result).toBeCloseTo(50.0, 1)  // 5% / 0.1% = 50배 소진
  })

  it('에러율이 SLO 이내이면 burnRate <= 1.0 을 반환한다', () => {
    const result = calculateBurnRate(0.0005, 0.001)  // 0.05% 에러
    expect(result).toBeLessThanOrEqual(1.0)
  })
})
```

### 2.2 순수 함수 테스트 — 가장 쉬운 유형

외부 의존성이 없는 순수 함수는 가장 작성하기 쉬운 단위 테스트입니다.

```typescript
// Plan SC: FR-SLO.2
// Design Ref: §3 — 에러버짓 소진율 계산
// CSAP: D-06 (SLO 위반 감지 → 감사 로그 연동)

import { describe, it, expect } from 'vitest'
import { maskPII, classifyDataGrade } from '../lib/data-utils.js'

describe('maskPII — N2SF AI API 전송 전 PII 마스킹', () => {

  it('주민번호를 마스킹한다', () => {
    const input = '사용자 ID: 900101-1234567 입니다'
    const result = maskPII(input)
    // 주민번호 패턴이 마스킹되었는지 확인
    expect(result).not.toContain('1234567')
    expect(result).toContain('***')
  })

  it('전화번호를 마스킹한다', () => {
    const input = '연락처: 010-1234-5678'
    const result = maskPII(input)
    expect(result).not.toContain('1234-5678')
  })

  it('마스킹할 PII가 없으면 원본 반환', () => {
    const input = '안녕하세요, 서울시 마포구 공항로 입니다'
    const result = maskPII(input)
    expect(result).toBe(input)
  })

  it('빈 문자열 입력 처리', () => {
    expect(maskPII('')).toBe('')
    expect(maskPII(null as unknown as string)).toBe('')
  })
})

describe('classifyDataGrade — N2SF 데이터 등급 분류', () => {

  it('개인정보 포함 데이터는 S 등급으로 분류', () => {
    const data = { name: '홍길동', ssn: '900101-1234567' }
    expect(classifyDataGrade(data)).toBe('S')
  })

  it('공개 정보만 포함하면 O 등급으로 분류', () => {
    const data = { content: '서울시 공공데이터 현황', category: 'public' }
    expect(classifyDataGrade(data)).toBe('O')
  })
})
```

### 2.3 Zod 스키마 테스트 — CSAP D-12 입력 검증 확인

Zod 스키마 검증 테스트는 외부 의존성이 없어 단위 테스트의 가장 빠른 시작점입니다.

```typescript
// tests/unit/schemas.test.ts
// Plan SC: FR-AUTH.1, FR-AUTH.2
// Design Ref: §2 — 로그인 입력 검증 스키마
// CSAP: D-12 입력 검증

import { describe, it, expect } from 'vitest'
import { z } from 'zod'

// 이 스키마는 실제 auth-service에서 사용하는 스키마와 동일합니다
const loginSchema = z.object({
  email: z.string().email({ message: '올바른 이메일 주소를 입력하세요' }).max(255),
  password: z.string()
    .min(1, { message: '비밀번호를 입력하세요' })
    .max(128, { message: '비밀번호는 128자 이하여야 합니다' }),
  tenantSlug: z.string().min(1).max(100),
  mfaCode: z.string().length(6).regex(/^\d+$/).optional(),
})

describe('CSAP D-12: 로그인 입력 검증 스키마', () => {

  it('정상 입력을 허용한다', () => {
    const result = loginSchema.safeParse({
      email: 'admin@gov.kr',
      password: 'Secure!P@ss123',
      tenantSlug: 'seoul-city',
    })
    expect(result.success).toBe(true)
  })

  it('잘못된 이메일 형식을 거부한다', () => {
    const result = loginSchema.safeParse({
      email: 'not-an-email',
      password: 'password',
      tenantSlug: 'test',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('이메일')
    }
  })

  it('빈 비밀번호를 거부한다', () => {
    const result = loginSchema.safeParse({
      email: 'admin@gov.kr',
      password: '',
      tenantSlug: 'test',
    })
    expect(result.success).toBe(false)
  })

  it('MFA 코드는 6자리 숫자만 허용한다', () => {
    // 유효한 MFA 코드
    expect(loginSchema.safeParse({
      email: 'a@b.kr', password: 'pw', tenantSlug: 't', mfaCode: '123456'
    }).success).toBe(true)

    // 숫자 아닌 문자 포함 — 거부
    expect(loginSchema.safeParse({
      email: 'a@b.kr', password: 'pw', tenantSlug: 't', mfaCode: '12345a'
    }).success).toBe(false)

    // 6자리 미만 — 거부
    expect(loginSchema.safeParse({
      email: 'a@b.kr', password: 'pw', tenantSlug: 't', mfaCode: '12345'
    }).success).toBe(false)
  })

  // SQL 인젝션 패턴 입력도 Zod 타입 검증으로 거부됨
  it('이메일 필드에 SQL 인젝션 패턴을 거부한다', () => {
    const result = loginSchema.safeParse({
      email: "'; DROP TABLE users; --",
      password: 'pw', tenantSlug: 't',
    })
    expect(result.success).toBe(false)
  })
})
```

### 2.4 비즈니스 로직 테스트 — AAA 패턴

AAA(Arrange-Act-Assert) 패턴으로 테스트를 구조화하면 읽기 쉽고 유지보수가 편합니다.

```typescript
// tests/unit/session.test.ts
// Plan SC: FR-AUTH.5, FR-AUTH.6
// Design Ref: §4 — 세션 관리 (동시 세션 3개 제한)
// CSAP: D-08-04 동시 세션 제한

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SessionManager } from '../lib/session.js'

describe('SessionManager (CSAP D-08-04 동시 세션 제한)', () => {

  let sessionManager: SessionManager
  let mockRedis: { llen: ReturnType<typeof vi.fn>, lpush: ReturnType<typeof vi.fn>, lrange: ReturnType<typeof vi.fn>, lrem: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    // Arrange: 각 테스트 전에 새로운 인스턴스와 목 생성
    mockRedis = {
      llen: vi.fn(),
      lpush: vi.fn(),
      lrange: vi.fn(),
      lrem: vi.fn(),
    }
    sessionManager = new SessionManager(mockRedis as unknown as RedisClient, { maxSessions: 3 })
  })

  it('동시 세션이 3개 미만이면 새 세션 생성을 허용한다', async () => {
    // Arrange
    mockRedis.llen.mockResolvedValue(2)  // 현재 2개 세션
    mockRedis.lpush.mockResolvedValue(3)

    // Act
    const result = await sessionManager.createSession('user-1', 'tenant-a', 'token-new')

    // Assert
    expect(result.success).toBe(true)
    expect(mockRedis.lpush).toHaveBeenCalledWith(
      'sessions:user-1:tenant-a',
      expect.stringContaining('token-new')
    )
  })

  it('동시 세션이 3개이면 가장 오래된 세션을 제거하고 새 세션을 생성한다', async () => {
    // Arrange
    mockRedis.llen.mockResolvedValue(3)  // 이미 3개 세션
    mockRedis.lrange.mockResolvedValue(['token-old-1', 'token-old-2', 'token-old-3'])
    mockRedis.lrem.mockResolvedValue(1)
    mockRedis.lpush.mockResolvedValue(3)

    // Act
    const result = await sessionManager.createSession('user-1', 'tenant-a', 'token-new')

    // Assert
    expect(result.success).toBe(true)
    // 가장 오래된 세션(리스트 끝의 token-old-3)이 제거되어야 함
    expect(mockRedis.lrem).toHaveBeenCalled()
  })
})
```

---

## 3. 외부 의존성 모킹 전략

### 3.1 왜 모킹이 필요한가

단위 테스트는 테스트 대상 코드만을 검증해야 합니다. Prisma, Redis, 외부 API 같은 의존성이 실제로 연결되면 다음 문제가 생깁니다.

- 테스트가 느려짐 (DB 쿼리마다 실제 네트워크 왕복)
- 테스트 환경에 인프라가 필요함 (CI에서 DB가 없으면 실패)
- 외부 서비스 상태에 따라 테스트 결과가 바뀜 (비결정적 테스트)

```mermaid
flowchart LR
    subgraph "단위 테스트 — 모킹 사용"
        UT["테스트 코드"]
        MOCK["모킹된 의존성\n(vi.mock)"]
        SUT["테스트 대상 함수"]
        UT --> SUT
        SUT --> MOCK
        MOCK -->|"가짜 응답 반환"| SUT
    end

    subgraph "통합 테스트 — 실제 연결"
        IT["테스트 코드"]
        REAL_DB["실제 Test DB\n(PostgreSQL)"]
        SUT2["테스트 대상 API"]
        IT --> SUT2
        SUT2 --> REAL_DB
    end
```

### 3.2 Prisma 모킹 — DB 없이 DB 쿼리 테스트

```typescript
// tests/unit/user-service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// 방법 1: vi.mock으로 prisma 모듈 전체 모킹
vi.mock('../lib/prisma.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    tenant: {
      findUnique: vi.fn(),
    },
  },
}))

import { prisma } from '../lib/prisma.js'
import { getUserById, createUser } from '../lib/user.service.js'

describe('UserService', () => {

  beforeEach(() => {
    vi.clearAllMocks()  // 각 테스트 전 mock 상태 초기화 (중요!)
  })

  it('존재하는 사용자를 올바르게 반환한다', async () => {
    // Arrange: Prisma가 반환할 가짜 데이터 설정
    const mockUser = {
      id: 'user-1',
      email: 'admin@gov.kr',
      name: '홍길동',
      tenantId: 'tenant-a',
      role: 'ADMIN',
    }
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser)

    // Act
    const result = await getUserById('user-1', 'tenant-a')

    // Assert
    expect(result).toEqual(mockUser)
    // tenantId 격리 확인: findUnique가 tenantId를 where에 포함했는지 검증
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-1', tenantId: 'tenant-a' },
    })
  })

  it('존재하지 않는 사용자는 null을 반환한다', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

    const result = await getUserById('not-exist', 'tenant-a')

    expect(result).toBeNull()
  })

  it('다른 테넌트 사용자 조회 시 결과를 반환하지 않는다', async () => {
    // 다른 테넌트 사용자는 null 반환 (RLS 효과를 단위 테스트에서 시뮬레이션)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

    const result = await getUserById('user-1', 'tenant-b')  // 다른 테넌트

    expect(result).toBeNull()
    // where 조건에 tenant-b가 포함되었는지 확인
    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: 'tenant-b' }) })
    )
  })
})
```

### 3.3 Redis 모킹 — 캐시·세션 없이 테스트

```typescript
// vi.mock을 사용하거나 ioredis-mock 라이브러리 활용
import { createClient } from 'ioredis'
vi.mock('ioredis', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      get: vi.fn(),
      set: vi.fn(),
      del: vi.fn(),
      expire: vi.fn(),
      sadd: vi.fn(),
      sismember: vi.fn(),
    })),
  }
})
```

### 3.4 AI API 모킹 — N2SF 게이트웨이 테스트

```typescript
// tests/unit/ai-gateway.test.ts
// Plan SC: AI-REQ-1, AI-REQ-2
// Design Ref: §6 — N2SF AI Gateway 패턴
// N2SF: N-05 AI 연동 데이터 등급 제한

import { describe, it, expect, vi } from 'vitest'
import { processAIRequest } from '../lib/ai-gateway.js'

// AI API 모킹 — 실제 API 호출 없이 게이트웨이 로직만 테스트
vi.mock('@anthropic-ai/sdk', () => ({
  Anthropic: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: '분석 결과입니다.' }],
      }),
    },
  })),
}))

describe('AI Gateway — N2SF N-05 준수', () => {

  it('C등급 데이터는 AI API 전송을 거부한다', async () => {
    const request = {
      data: '기밀 문서 내용: 국방 예산 세부 내역',
      grade: 'C' as const,
    }

    await expect(processAIRequest(request)).rejects.toThrow(
      'BLOCKED: C등급 데이터는 AI API 전송 금지 (N2SF N-05)'
    )
  })

  it('S등급 데이터는 AI API 전송을 거부한다', async () => {
    const request = {
      data: '민감 정보: 주민등록번호 포함 문서',
      grade: 'S' as const,
    }

    await expect(processAIRequest(request)).rejects.toThrow(/N2SF N-05/)
  })

  it('O등급 데이터는 PII 마스킹 후 AI API를 호출한다', async () => {
    const request = {
      data: '공개 데이터: 서울시 버스 노선 현황',
      grade: 'O' as const,
    }

    const result = await processAIRequest(request)

    // API가 호출되었는지 확인
    expect(result.response).toBeDefined()
    // 원본 민감 정보가 응답에 노출되지 않았는지 확인
    expect(result.response).not.toContain('주민등록번호')
  })

  it('O등급이라도 PII 포함 시 마스킹 후 전송한다', async () => {
    const request = {
      data: '담당자: 홍길동 (010-1234-5678) 연락처 포함 공개 문서',
      grade: 'O' as const,
    }

    const result = await processAIRequest(request)
    expect(result.maskedPII).toBe(true)  // PII 마스킹 여부 플래그
  })
})
```

---

## 4. 통합 테스트 — API 엔드포인트 검증

### 4.1 Fastify supertest로 API 테스트

통합 테스트는 실제 HTTP 요청을 시뮬레이션하여 API 엔드포인트의 전체 흐름을 검증합니다.

```typescript
// tests/integration/auth-flow.test.ts
// Plan SC: FR-AUTH.1, FR-AUTH.3, FR-AUTH.7
// Design Ref: §5 — 로그인 API 통합 테스트
// CSAP: D-08 접근통제 통합 검증

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../src/app.js'
import type { FastifyInstance } from 'fastify'

// 이 테스트는 실제 테스트 DB에 연결합니다
// 환경변수: DATABASE_URL=postgresql://test:test@localhost:5432/testdb

describe('인증 API 통합 테스트', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    // 테스트용 Fastify 앱 인스턴스 생성
    app = await buildApp({ testing: true })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  describe('POST /auth/login', () => {

    it('올바른 자격증명으로 로그인하면 JWT 토큰을 반환한다', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {
          email: 'test-admin@gov.kr',
          password: 'Test!Pass123',
          tenantSlug: 'test-tenant',
        },
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('accessToken')
      expect(body).toHaveProperty('refreshToken')
      // JWT 구조 확인 (header.payload.signature)
      expect(body.accessToken.split('.')).toHaveLength(3)
    })

    it('잘못된 비밀번호로 로그인하면 401을 반환한다', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {
          email: 'test-admin@gov.kr',
          password: 'wrong-password',
          tenantSlug: 'test-tenant',
        },
      })

      expect(response.statusCode).toBe(401)
      const body = JSON.parse(response.body)
      // 에러 메시지에 민감 정보 포함 여부 확인 (CSAP D-12)
      expect(body.message).not.toContain('password')
      expect(body.message).not.toContain('hash')
    })

    it('잘못된 형식의 이메일로 요청하면 400을 반환한다', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {
          email: 'not-an-email',
          password: 'password',
          tenantSlug: 'test',
        },
      })

      expect(response.statusCode).toBe(400)
    })

    it('Rate Limit 초과 시 429를 반환한다', async () => {
      // Rate Limit: 10회/분/IP
      const requests = Array.from({ length: 11 }, () =>
        app.inject({
          method: 'POST',
          url: '/auth/login',
          payload: { email: 'a@b.kr', password: 'pw', tenantSlug: 't' },
          headers: { 'x-forwarded-for': '192.168.1.100' },  // 동일 IP 시뮬레이션
        })
      )
      const responses = await Promise.all(requests)
      // 마지막 요청은 Rate Limit 초과로 429 반환 확인
      const lastResponse = responses[responses.length - 1]
      expect(lastResponse.statusCode).toBe(429)
    })
  })

  describe('GET /users/me (인증 필요)', () => {

    it('유효한 JWT로 내 정보를 조회한다', async () => {
      // 먼저 로그인하여 토큰 획득
      const loginResponse = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: 'test-admin@gov.kr', password: 'Test!Pass123', tenantSlug: 'test-tenant' },
      })
      const { accessToken } = JSON.parse(loginResponse.body)

      // 획득한 토큰으로 내 정보 조회
      const response = await app.inject({
        method: 'GET',
        url: '/users/me',
        headers: { authorization: `Bearer ${accessToken}` },
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('id')
      expect(body.email).toBe('test-admin@gov.kr')
    })

    it('JWT 없이 보호된 엔드포인트 접근 시 401을 반환한다', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/users/me',
        // Authorization 헤더 없음
      })

      expect(response.statusCode).toBe(401)
    })

    it('만료된 JWT로 접근 시 401을 반환한다', async () => {
      // 만료된 테스트용 JWT (실제 사용 시 만료된 토큰 생성 유틸 사용)
      const expiredToken = 'eyJhbGciOiJSUzI1NiJ9.eyJleHAiOjE2MDAwMDAwMDB9.invalid'

      const response = await app.inject({
        method: 'GET',
        url: '/users/me',
        headers: { authorization: `Bearer ${expiredToken}` },
      })

      expect(response.statusCode).toBe(401)
    })
  })
})
```

### 4.2 RBAC 권한 검증 통합 테스트

```typescript
// tests/integration/rbac.test.ts
// Plan SC: FR-RBAC.1, FR-RBAC.3
// CSAP: D-08 RBAC 접근 통제

describe('RBAC 권한 통합 테스트 (CSAP D-08)', () => {

  it('VIEWER 역할은 admin 전용 엔드포인트에 403을 받는다', async () => {
    const viewerToken = await getTestToken('viewer@gov.kr', 'VIEWER')

    const response = await app.inject({
      method: 'GET',
      url: '/admin/users',  // admin 전용 엔드포인트
      headers: { authorization: `Bearer ${viewerToken}` },
    })

    expect(response.statusCode).toBe(403)
    const body = JSON.parse(response.body)
    expect(body.error).toBe('Forbidden')
    // 에러 메시지에 권한 정보가 구체적으로 노출되지 않아야 함 (정보 노출 최소화)
    expect(body.message).not.toContain('admin')
  })

  it('ADMIN 역할은 admin 전용 엔드포인트에 접근할 수 있다', async () => {
    const adminToken = await getTestToken('admin@gov.kr', 'ADMIN')

    const response = await app.inject({
      method: 'GET',
      url: '/admin/users',
      headers: { authorization: `Bearer ${adminToken}` },
    })

    expect(response.statusCode).toBe(200)
  })
})
```

---

## 5. E2E 테스트 원칙

### 5.1 이 프로젝트에서 E2E 테스트 범위

E2E 테스트는 실제 사용자 시나리오를 전체 시스템 흐름으로 검증합니다. 느리고 불안정하기 때문에 꼭 필요한 핵심 사용자 흐름에만 작성합니다.

```mermaid
graph LR
    subgraph "E2E 테스트 포함 — 핵심 사용자 흐름"
        F1["로그인 → 대시보드 접근"]
        F2["테넌트 온보딩 전체 프로세스"]
        F3["AI 문서 분석 요청 전체 흐름"]
    end

    subgraph "E2E 테스트 불필요 — 단위/통합으로 충분"
        N1["개별 API 응답 형식"]
        N2["입력 검증 로직"]
        N3["RBAC 권한 체크"]
        N4["데이터 암호화 검증"]
    end

    style F1 fill:#4caf50,color:#fff
    style F2 fill:#4caf50,color:#fff
    style F3 fill:#4caf50,color:#fff
    style N1 fill:#e0e0e0
    style N2 fill:#e0e0e0
```

### 5.2 E2E 테스트 언제 필요한가

다음 기준을 모두 만족할 때 E2E 테스트를 작성합니다.

1. 여러 서비스가 연동된 사용자 시나리오
2. 실제 사용자가 반드시 성공해야 하는 핵심 흐름
3. 통합 테스트로 커버하기 어려운 UI-API 연동 시나리오

```typescript
// platform/tests/e2e/scenarios/login-flow.e2e.test.ts
// E2E 테스트는 실제 실행 중인 서비스에 대해 실행됩니다
// 테스트 환경: k3s test 네임스페이스 또는 docker-compose

import { describe, it, expect, beforeAll } from 'vitest'

describe('[E2E] 로그인 → 대시보드 접근 시나리오', () => {

  const baseUrl = process.env.E2E_BASE_URL || 'http://localhost:3000'

  it('사용자가 로그인 후 대시보드에 접근할 수 있다', async () => {
    // 1. 로그인
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'e2e-test@gov.kr', password: 'E2E!Test123', tenantSlug: 'test' }),
    })
    expect(loginRes.status).toBe(200)
    const { accessToken } = await loginRes.json()

    // 2. 보호된 대시보드 데이터 접근
    const dashRes = await fetch(`${baseUrl}/api/dashboard/summary`, {
      headers: { authorization: `Bearer ${accessToken}` },
    })
    expect(dashRes.status).toBe(200)

    // 3. 데이터 구조 확인
    const data = await dashRes.json()
    expect(data).toHaveProperty('tenantId')
    expect(data).toHaveProperty('userCount')
  }, 30000)  // E2E는 타임아웃을 넉넉하게 설정
})
```

---

## 6. CSAP 필수 테스트 항목

CSAP 인증을 위해 다음 테스트들은 반드시 작성해야 합니다. 누락 시 감리에서 지적됩니다.

```mermaid
graph TD
    CSAP["CSAP 감리 필수 테스트"]
    CSAP --> D06["D-06: 감사 로그"]
    CSAP --> D08["D-08: 접근 통제"]
    CSAP --> D09["D-09: 암호화"]
    CSAP --> D12["D-12: 개발 보안"]

    D06 --> D06T1["감사 로그 기록 검증\n(로그인 성공/실패 로그)"]
    D06 --> D06T2["감사 로그 변조 탐지\n(체인 해시 무결성)"]
    D08 --> D08T1["권한 없는 접근 403 반환\n(RBAC 강제 적용)"]
    D08 --> D08T2["만료된 JWT 401 반환\n(세션 만료 정책)"]
    D09 --> D09T1["민감 데이터 평문 저장 금지\n(암호화 검증)"]
    D12 --> D12T1["SQL 인젝션 방지\n(매개변수화 쿼리)"]
    D12 --> D12T2["XSS 방지\n(HTML 새니타이제이션)"]
```

### 6.1 감사 로그 기록 검증 테스트 (CSAP D-06)

```typescript
// tests/unit/audit-trail.test.ts
// Plan SC: NFR-3, CSAP D-06
// Design Ref: §7 — 감사 로그 불변성 보장
// 실제 구현 참조: platform/services/ai-service/src/lib/agent-audit-trail.ts

import { describe, it, expect } from 'vitest'
import { AgentAuditTrail } from '../lib/agent-audit-trail.js'

describe('AgentAuditTrail — CSAP D-06 감사 로그 무결성', () => {

  it('감사 이벤트 추가 후 무결성 검증이 성공한다', () => {
    const trail = new AgentAuditTrail()

    trail.append({
      agentId: 'agent-1',
      actorId: 'user-admin',
      action: 'USER_DELETE',
      resource: 'users/user-123',
      details: { reason: '계정 만료' },
    })

    const integrity = trail.verifyIntegrity()
    expect(integrity.valid).toBe(true)
  })

  it('체인 해시가 올바르게 연결된다', () => {
    const trail = new AgentAuditTrail()

    const entry1 = trail.append({ agentId: 'a1', actorId: 'u1', action: 'LOGIN', resource: '/auth', details: {} })
    const entry2 = trail.append({ agentId: 'a1', actorId: 'u1', action: 'READ', resource: '/users', details: {} })

    // 두 번째 엔트리의 prevHash는 첫 번째 엔트리의 hash와 동일해야 함
    expect(entry2.prevHash).toBe(entry1.hash)
  })

  it('감사 로그 변조 시 무결성 검증이 실패한다', () => {
    const trail = new AgentAuditTrail()

    trail.append({ agentId: 'a1', actorId: 'u1', action: 'read', resource: '/', details: {} })
    trail.append({ agentId: 'a1', actorId: 'u1', action: 'write', resource: '/', details: {} })

    // 강제로 내부 데이터 변조 (공격 시뮬레이션)
    const internal = (trail as unknown as { entries: Array<{ details: Record<string, unknown> }> }).entries
    if (internal[0]) {
      internal[0].details = { hacked: true }  // 해시 불일치 유발
    }

    const integrity = trail.verifyIntegrity()
    expect(integrity.valid).toBe(false)
  })

  it('보존 기간 초과된 로그를 아카이브한다 (1년 보존 정책)', () => {
    const retentionDays = 365
    const trail = new AgentAuditTrail(retentionDays)

    trail.append({ agentId: 'a1', actorId: 'u1', action: 'read', resource: '/', details: {} })

    // 366일 후 아카이브 실행
    const future = new Date(Date.now() + 366 * 86400000)
    const archived = trail.archiveExpired(future)

    expect(archived.length).toBe(1)     // 1개 아카이브됨
    expect(trail.size()).toBe(0)         // 현재 로그는 비워짐
  })
})
```

### 6.2 권한 거부 테스트 — 403 응답 확인 (CSAP D-08)

```typescript
// tests/unit/rbac.test.ts
// CSAP: D-08 RBAC 역할 기반 접근 통제
// 실제 구현: platform/services/ai-service/src/lib/agent-rbac.ts

import { describe, it, expect, beforeEach } from 'vitest'
import { AgentRbacEngine, type AccessContext } from '../lib/agent-rbac.js'

describe('AgentRbacEngine — CSAP D-08 접근 통제', () => {
  let rbac: AgentRbacEngine

  beforeEach(() => {
    rbac = new AgentRbacEngine()
    rbac.defineRole({
      id: 'role-reader',
      name: '문서 읽기 전용',
      rules: [{
        id: 'r1',
        effect: 'allow',
        actions: ['doc:read'],
        resources: ['docs/tenant-a/*'],
        condition: { tenantId: 'tenant-a', maxDailyCalls: 100 },
      }],
    })
  })

  it('역할이 할당되지 않은 에이전트는 모든 접근을 거부한다', () => {
    const ctx: AccessContext = {
      agentId: 'agent-unauthorized',
      action: 'doc:read',
      resource: 'docs/tenant-a/report.pdf',
      tenantId: 'tenant-a',
      ipAddress: '10.0.0.1',
      hourOfDay: 10,
      callsToday: 0,
    }

    const result = rbac.evaluate(ctx)
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('NO_ROLE_BOUND')
  })

  it('다른 테넌트 리소스 접근을 거부한다', () => {
    rbac.bind('agent-1', 'role-reader')
    const ctx: AccessContext = {
      agentId: 'agent-1',
      action: 'doc:read',
      resource: 'docs/tenant-b/secret.pdf',  // 다른 테넌트
      tenantId: 'tenant-b',
      ipAddress: '10.0.0.1',
      hourOfDay: 10,
      callsToday: 0,
    }

    const result = rbac.evaluate(ctx)
    expect(result.allowed).toBe(false)  // 403 상당
  })

  it('일일 호출 한도 초과 시 접근을 거부한다', () => {
    rbac.bind('agent-1', 'role-reader')
    const ctx: AccessContext = {
      agentId: 'agent-1',
      action: 'doc:read',
      resource: 'docs/tenant-a/plan.pdf',
      tenantId: 'tenant-a',
      ipAddress: '10.0.0.1',
      hourOfDay: 10,
      callsToday: 100,  // 한도 초과 (maxDailyCalls: 100)
    }

    const result = rbac.evaluate(ctx)
    expect(result.allowed).toBe(false)
  })

  it('deny 규칙이 allow 규칙보다 우선 적용된다', () => {
    rbac.defineRole({
      id: 'role-deny-delete',
      name: '삭제 금지',
      rules: [{ id: 'd1', effect: 'deny', actions: ['doc:delete'], resources: ['*'] }],
    })
    rbac.bind('agent-1', 'role-reader')
    rbac.bind('agent-1', 'role-deny-delete')

    const ctx: AccessContext = {
      agentId: 'agent-1',
      action: 'doc:delete',  // deny 대상 액션
      resource: 'docs/tenant-a/plan.pdf',
      tenantId: 'tenant-a',
      ipAddress: '10.0.0.1',
      hourOfDay: 10,
      callsToday: 0,
    }

    const result = rbac.evaluate(ctx)
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('DENY_RULE')
  })
})
```

### 6.3 데이터 암호화 검증 테스트 (CSAP D-09)

```typescript
// tests/unit/encryption.test.ts
// Plan SC: NFR-2
// CSAP: D-09 데이터 암호화 (AES-256)

import { describe, it, expect } from 'vitest'
import { encrypt, decrypt, hashPassword, verifyPassword } from '../lib/crypto.js'

describe('암호화 유틸리티 (CSAP D-09)', () => {

  describe('AES-256 대칭 암호화', () => {
    const testKey = 'a'.repeat(32)  // 256비트 키 (테스트용)

    it('암호화된 데이터는 원본과 다르다', async () => {
      const original = '민감한 행정 데이터'
      const encrypted = await encrypt(original, testKey)

      expect(encrypted).not.toBe(original)
      expect(encrypted).toBeDefined()
    })

    it('암호화 후 복호화하면 원본 데이터를 얻는다', async () => {
      const original = '주민번호: 900101-1234567'
      const encrypted = await encrypt(original, testKey)
      const decrypted = await decrypt(encrypted, testKey)

      expect(decrypted).toBe(original)
    })

    it('잘못된 키로 복호화하면 오류가 발생한다', async () => {
      const encrypted = await encrypt('secret data', testKey)
      const wrongKey = 'b'.repeat(32)

      await expect(decrypt(encrypted, wrongKey)).rejects.toThrow()
    })
  })

  describe('비밀번호 해시 (bcrypt)', () => {

    it('비밀번호 해시는 평문과 다르다', async () => {
      const password = 'MySecureP@ss123!'
      const hash = await hashPassword(password)

      expect(hash).not.toBe(password)
      // bcrypt 해시는 항상 $2b$로 시작
      expect(hash).toMatch(/^\$2b\$/)
    })

    it('올바른 비밀번호 검증이 성공한다', async () => {
      const password = 'MySecureP@ss123!'
      const hash = await hashPassword(password)

      const isValid = await verifyPassword(password, hash)
      expect(isValid).toBe(true)
    })

    it('잘못된 비밀번호 검증이 실패한다', async () => {
      const password = 'MySecureP@ss123!'
      const hash = await hashPassword(password)

      const isValid = await verifyPassword('wrong-password', hash)
      expect(isValid).toBe(false)
    })
  })
})
```

---

## 7. TDD 적용법 — Red-Green-Refactor

### 7.1 TDD 사이클 이해

TDD(Test-Driven Development, 테스트 주도 개발)는 코드를 먼저 작성하는 대신, 테스트를 먼저 작성하고 그 테스트를 통과하는 코드를 작성하는 방법론입니다.

```mermaid
graph LR
    RED["1. RED\n실패하는 테스트 작성\n아직 구현 코드 없음"]
    GREEN["2. GREEN\n테스트를 통과하는\n최소한의 코드 작성"]
    REFACTOR["3. REFACTOR\n코드 정리·최적화\n테스트는 여전히 통과"]

    RED -->|"테스트 실행 → 실패"| GREEN
    GREEN -->|"테스트 실행 → 성공"| REFACTOR
    REFACTOR -->|"다음 기능 테스트 작성"| RED

    style RED fill:#f44336,color:#fff
    style GREEN fill:#4caf50,color:#fff
    style REFACTOR fill:#2196f3,color:#fff
```

### 7.2 새 API 추가 시 TDD 적용 예시

새로운 기능 "테넌트별 API 사용량 집계"를 TDD로 구현하는 과정을 단계별로 설명합니다.

**1단계: RED — 실패하는 테스트 먼저 작성**

```typescript
// tests/unit/usage-stats.test.ts
// 아직 UsageStatsService 클래스가 없습니다 → 컴파일 오류 발생 (RED 상태)

import { describe, it, expect } from 'vitest'
import { UsageStatsService } from '../lib/usage-stats.service.js'  // 아직 없음

describe('UsageStatsService — 테넌트 API 사용량 집계', () => {

  it('테넌트의 오늘 API 호출 횟수를 반환한다', async () => {
    const service = new UsageStatsService()  // 아직 없음 → 오류

    const count = await service.getDailyCallCount('tenant-a', new Date('2026-04-12'))

    expect(count).toBe(0)  // 초기값은 0
  })

  it('API 호출 기록 후 카운트가 증가한다', async () => {
    const service = new UsageStatsService()

    await service.recordCall('tenant-a', '/api/users')
    await service.recordCall('tenant-a', '/api/users')

    const count = await service.getDailyCallCount('tenant-a', new Date())
    expect(count).toBe(2)
  })

  it('다른 테넌트의 호출은 집계하지 않는다', async () => {
    const service = new UsageStatsService()

    await service.recordCall('tenant-a', '/api/users')
    await service.recordCall('tenant-b', '/api/users')  // 다른 테넌트

    const countA = await service.getDailyCallCount('tenant-a', new Date())
    expect(countA).toBe(1)  // tenant-a의 호출만 집계
  })
})
```

**2단계: GREEN — 테스트를 통과하는 최소 구현**

```typescript
// src/lib/usage-stats.service.ts (새로 생성)
// 테스트를 통과하는 가장 단순한 구현

export class UsageStatsService {
  private calls: Map<string, number> = new Map()

  async recordCall(tenantId: string, endpoint: string): Promise<void> {
    const today = new Date().toDateString()
    const key = `${tenantId}:${today}`
    this.calls.set(key, (this.calls.get(key) ?? 0) + 1)
  }

  async getDailyCallCount(tenantId: string, date: Date): Promise<number> {
    const key = `${tenantId}:${date.toDateString()}`
    return this.calls.get(key) ?? 0
  }
}
// 테스트 실행 → 모두 통과 (GREEN 상태)
```

**3단계: REFACTOR — 코드 개선 (Redis 영속성 추가)**

```typescript
// src/lib/usage-stats.service.ts (리팩토링)
// 인메모리 Map → Redis로 교체 (테스트는 여전히 통과)

export class UsageStatsService {
  constructor(private readonly redis: RedisClient) {}

  async recordCall(tenantId: string, endpoint: string): Promise<void> {
    const key = `usage:${tenantId}:${new Date().toDateString()}`
    await this.redis.incr(key)
    await this.redis.expire(key, 86400 * 7)  // 7일 TTL
  }

  async getDailyCallCount(tenantId: string, date: Date): Promise<number> {
    const key = `usage:${tenantId}:${date.toDateString()}`
    const count = await this.redis.get(key)
    return count ? parseInt(count, 10) : 0
  }
}
// 테스트 실행 → 여전히 모두 통과 (REFACTOR 완료)
```

---

## 8. 커버리지 80% 달성 전략

### 8.1 커버리지 보고서 읽는 법

```bash
# 커버리지 보고서 생성 명령
pnpm vitest run --coverage

# 출력 예시:
# ----------------------------|---------|----------|---------|---------|
# File                        | % Stmts | % Branch | % Funcs | % Lines |
# ----------------------------|---------|----------|---------|---------|
# src/lib/session.ts          |   92.31 |    85.71 |   90.00 |   92.31 |
# src/lib/user.service.ts     |   61.54 |    42.86 |   66.67 |   61.54 | ← 낮음!
# src/handlers/login.ts       |   88.46 |    78.57 |   80.00 |   88.46 |
# ----------------------------|---------|----------|---------|---------|
```

커버리지 보고서에서 가장 먼저 봐야 할 것은 **낮은 Branch 커버리지** 파일입니다. Branch 커버리지는 if/else, switch, 삼항연산자 같은 분기 조건이 모두 테스트되었는지 측정합니다.

### 8.2 빠르게 커버리지를 올리는 전략

```mermaid
graph TD
    START["커버리지 80% 미달"] --> ANALYZE["커버리지 보고서 분석\n어떤 파일이 낮은가?"]
    ANALYZE --> TYPE{낮은 이유?}
    TYPE --> NOTEST["테스트 파일 자체가 없음\n→ 최우선 작성 대상"]
    TYPE --> BRANCH["Branch 커버리지 낮음\n→ 경계값, 예외 케이스 추가"]
    TYPE --> COMPLEX["복잡한 로직 미커버\n→ AAA 패턴으로 각 경로 테스트"]

    NOTEST --> SCHEMA["1순위: Zod 스키마 테스트\n(외부 의존성 없음, 빠른 작성)"]
    NOTEST --> PURE["2순위: 순수 함수 테스트\n(비즈니스 로직, 계산 함수)"]
    BRANCH --> BOUNDARY["경계값 테스트 추가\n(0, 1, max, max+1)"]
    COMPLEX --> MOCK["의존성 모킹 후\n각 분기 조건 개별 테스트"]
```

**단계별 커버리지 올리기**:

```typescript
// 1단계: 스키마 테스트 (가장 빠른 커버리지 향상)
// 외부 의존성 없음, 작성 시간 10분, 커버리지 기여도 높음
describe('LoginSchema 검증', () => {
  const validInputs = [/* 정상 케이스들 */]
  const invalidInputs = [/* 비정상 케이스들 */]
  
  it.each(validInputs)('정상 입력 허용: %s', (input) => {
    expect(loginSchema.safeParse(input).success).toBe(true)
  })
  
  it.each(invalidInputs)('비정상 입력 거부: %s', (input) => {
    expect(loginSchema.safeParse(input).success).toBe(false)
  })
})

// 2단계: 경계값 테스트 (Branch 커버리지 향상)
it.each([
  [0, '0개 세션'],
  [1, '1개 세션'],
  [2, '2개 세션 (한도 미만)'],
  [3, '3개 세션 (한도)'],
  [4, '4개 세션 (한도 초과)'],
])('동시 세션 %i개: %s', async (sessionCount, _desc) => {
  // 경계값마다 다른 기대 동작 정의
})
```

### 8.3 커버리지를 위한 테스트 vs 의미 있는 테스트

⚠️ 커버리지 수치만을 위해 의미 없는 테스트를 작성하지 마세요.

```typescript
// ❌ 커버리지만 높이는 의미 없는 테스트
it('함수가 실행된다', () => {
  const result = doSomething()
  expect(result).toBeDefined()  // 어떤 값이든 통과 — 아무것도 검증하지 않음
})

// ✅ 의미 있는 테스트 — 실제 비즈니스 규칙 검증
it('일일 API 한도 1000회를 초과하면 429 에러를 반환한다', async () => {
  vi.mocked(redis.incr).mockResolvedValue(1001)  // 한도 초과 시뮬레이션
  
  const result = await rateLimiter.check('tenant-a')
  
  expect(result.allowed).toBe(false)
  expect(result.retryAfter).toBeGreaterThan(0)  // 재시도 시간도 반환
})
```

---

## 9. CI 테스트 실패 대처법

### 9.1 테스트 실패 유형별 대처

```mermaid
flowchart TD
    FAIL["CI 테스트 실패"] --> TYPE{실패 유형?}
    
    TYPE --> LOGIC["비즈니스 로직 오류\n항상 같은 조건에서 실패"]
    TYPE --> ENV["환경 의존성 오류\n일부 실행에서만 실패"]
    TYPE --> RACE["경쟁 조건(Race Condition)\n간헐적 실패"]
    TYPE --> TIMEOUT["타임아웃\n느린 테스트"]
    
    LOGIC --> FIX_CODE["코드 수정 후 재실행\n(근본 원인 해결)"]
    ENV --> CHECK_ENV["환경변수 확인\nDB 연결 확인\nCI 설정 확인"]
    RACE --> ASYNC_FIX["async/await 패턴 수정\nvi.useFakeTimers() 활용\n비동기 처리 안정화"]
    TIMEOUT --> TUNE["타임아웃 시간 조정\n또는 느린 테스트를 별도 suite로 분리"]
```

### 9.2 Flaky(불안정한) 테스트 다루기

Flaky 테스트는 코드 변경 없이 실행할 때마다 결과가 다른 테스트입니다. 실제 버그보다 더 위험합니다 — 테스트를 신뢰하지 못하게 되기 때문입니다.

```typescript
// ❌ Flaky 테스트 — 시간에 의존 (CI 서버 속도에 따라 다름)
it('토큰이 만료되면 Redis에서 제거된다', async () => {
  await createToken('test-token', { ttl: 100 })  // 100ms TTL
  await new Promise(r => setTimeout(r, 150))      // 150ms 대기
  const exists = await redis.exists('test-token')
  expect(exists).toBe(0)  // 느린 CI에서 실패할 수 있음!
})

// ✅ 안정적인 테스트 — 시간을 직접 제어
import { vi } from 'vitest'

it('토큰이 만료되면 Redis에서 제거된다', async () => {
  vi.useFakeTimers()
  await createToken('test-token', { ttl: 100 })
  
  vi.advanceTimersByTime(200)  // 시간을 직접 앞당김 (CI 속도와 무관)
  
  const exists = await redis.exists('test-token')
  expect(exists).toBe(0)
  vi.useRealTimers()
})
```

### 9.3 테스트 병렬화로 CI 속도 높이기

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // 각 파일을 독립된 워커에서 병렬 실행
    pool: 'threads',
    poolOptions: {
      threads: {
        maxThreads: 4,  // CI 서버 CPU 코어 수에 맞게 조정
        minThreads: 2,
      },
    },
    // 단위 테스트만 빠르게 실행 (CI 기본)
    include: ['tests/unit/**/*.test.ts'],
    // 통합 테스트는 별도 suite로 분리
    // include: ['tests/integration/**/*.test.ts'],
  },
})
```

---

## 10. 실제 테스트 파일 해설

이 프로젝트에 실제로 있는 테스트 파일 두 개를 분석하여 작성 패턴을 이해합니다.

### 10.1 `agent-rbac.test.ts` 분석

실제 파일 위치: `platform/services/ai-service/src/lib/__tests__/agent-rbac.test.ts`

```typescript
// 이 테스트 파일이 보여주는 좋은 패턴들:

// 1. beforeEach로 테스트 격리
beforeEach(() => {
  rbac = new AgentRbacEngine()       // 각 테스트마다 새 인스턴스
  rbac.defineRole({ id: 'role-reader', ... })  // 기본 역할 정의
})

// 2. 한국어 테스트 설명 (공공기관 프로젝트 기준)
it('역할 미바인딩 시 거부', () => { ... })
it('다른 테넌트는 거부', () => { ... })

// 3. 테넌트 격리 테스트 (멀티테넌시 핵심 검증)
it('다른 테넌트는 거부', () => {
  rbac.bind('agent-1', 'role-reader')
  const r = rbac.evaluate({ ...baseCtx, tenantId: 'tenant-b' })  // 다른 테넌트
  expect(r.allowed).toBe(false)
})

// 4. deny 규칙 우선순위 검증
it('deny 규칙 우선', () => {
  // allow + deny 모두 바인딩 → deny가 이겨야 함
  rbac.bind('agent-1', 'role-reader')
  rbac.bind('agent-1', 'role-deny')
  const r = rbac.evaluate({ ...baseCtx, action: 'doc:delete' })
  expect(r.allowed).toBe(false)
  expect(r.reason).toBe('DENY_RULE')
})
```

### 10.2 `agent-audit-trail.test.ts` 분석

실제 파일 위치: `platform/services/ai-service/src/lib/__tests__/agent-audit-trail.test.ts`

이 파일이 보여주는 핵심 패턴은 **불변 감사 로그 검증**입니다.

```typescript
// CSAP D-06 핵심 요건: 감사 로그는 변조 불가능해야 함
it('변조 탐지', () => {
  const trail = new AgentAuditTrail()
  trail.append({ ... })
  trail.append({ ... })
  
  // 내부 데이터를 직접 수정 (공격자가 DB를 직접 수정하는 시나리오)
  const internal = (trail as unknown as { entries: Array<...> }).entries
  if (internal[0]) internal[0].details = { hacked: true }
  
  // 무결성 검증이 변조를 탐지해야 함
  const result = trail.verifyIntegrity()
  expect(result.valid).toBe(false)  // 변조 탐지 성공
})
```

이 테스트는 실제 공격 시나리오를 시뮬레이션합니다. 감사 로그 시스템의 가장 중요한 보안 속성(불변성)을 검증합니다.

---

## 11. 학습 체크리스트

이 문서를 완료한 후 다음 항목을 확인하세요.

- ✅ 테스트 피라미드에서 단위/통합/E2E 비율(60-70/20-30/5-10)을 이해했다
- ✅ Vitest의 `describe`, `it`, `expect`, `vi.mock` 기본 사용법을 익혔다
- ✅ AAA (Arrange-Act-Assert) 패턴으로 테스트를 작성할 수 있다
- ✅ Prisma와 Redis를 `vi.mock`으로 모킹하는 방법을 이해했다
- ✅ N2SF AI Gateway 테스트에서 C/S 등급 데이터 차단을 검증하는 방법을 안다
- ✅ 감사 로그 무결성 테스트(CSAP D-06)를 작성하는 이유를 설명할 수 있다
- ✅ RBAC 권한 거부(403) 테스트를 작성할 수 있다 (CSAP D-08)
- ✅ TDD의 Red-Green-Refactor 사이클을 실제 예시와 함께 설명할 수 있다
- ✅ 커버리지 보고서에서 가장 먼저 확인해야 할 항목이 무엇인지 안다
- ✅ Flaky 테스트와 안정적인 테스트의 차이를 `vi.useFakeTimers()` 예시로 설명할 수 있다
- ✅ Q-Gate G4 (커버리지 80%) 실패 시 어떻게 대처하는지 알고 있다

---

## 12. 다음 단계

테스트 전략 심화 학습을 완료했습니다. 다음 문서를 이어서 학습하세요.

- **[참고: 03-development/03-testing-guide.md]** — 테스트 도구 기초 및 명령어 참조
- **[참고: 03-development/04-advanced-patterns.md]** — 고급 패턴 (Saga, CQRS)의 테스트 전략
- **[참고: 02-architecture/06-adr-deep-dive.md]** — 기술 결정의 배경 이해

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|------|
| 1.0.0 | 2026-04-12 | 최초 작성 — 실제 테스트 파일 기반 테스트 전략 심화 | Implementer (Sonnet) |
