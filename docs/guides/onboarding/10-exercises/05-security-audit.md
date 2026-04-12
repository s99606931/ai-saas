# 실습 5: 보안 감사 체험

> **문서 ID**: ONBOARD-10-EX05
> **버전**: 1.0.0 | **작성일**: 2026-04-12 | **작성자**: Implementer (Sonnet)
> **예상 소요 시간**: 60~90분
> **난이도**: 중급
> **선행 조건**: 가이드북 7장(보안·컴플라이언스) 학습 완료

---

## 목차

1. [실습 목표](#1-실습-목표)
2. [실습 방법 안내](#2-실습-방법-안내)
3. [취약점 A: SQL 인젝션](#3-취약점-a-sql-인젝션)
4. [취약점 B: 하드코딩된 시크릿](#4-취약점-b-하드코딩된-시크릿)
5. [취약점 C: RBAC 누락](#5-취약점-c-rbac-누락)
6. [취약점 D: 에러 메시지 정보 노출](#6-취약점-d-에러-메시지-정보-노출)
7. [취약점 E: 입력 검증 누락](#7-취약점-e-입력-검증-누락)
8. [Claude Code로 보안 리뷰](#8-claude-code로-보안-리뷰)
9. [CSAP 체크리스트 자가 검증](#9-csap-체크리스트-자가-검증)
10. [정답 및 해설](#10-정답-및-해설)
11. [변경 이력](#11-변경-이력)

---

## 1. 실습 목표

**과제**: 의도적으로 취약점을 심어 둔 코드에서 보안 문제를 찾고 수정하십시오.

이 실습은 "찾기 → 이해하기 → 수정하기" 세 단계로 진행됩니다.

**완료 기준**:
- 5개 취약점을 모두 식별하고 수정함
- Claude Code 보안 리뷰를 통과함
- CSAP D-08, D-09, D-12 체크리스트 자가 검증 완료

**주의**: 아래 코드는 **교육 목적으로만** 작성된 취약한 코드입니다. 실제 프로덕션 코드에는 이런 패턴을 절대 사용하지 마십시오.

---

## 2. 실습 방법 안내

1. 각 취약점 섹션에서 "취약한 코드"를 읽습니다.
2. 어떤 점이 문제인지 직접 생각해 봅니다.
3. "힌트"를 읽고 취약점 유형을 파악합니다.
4. "올바른 코드"로 수정합니다.
5. Claude Code에게 검토를 요청합니다.

실습용 파일을 만들어 직접 타이핑하고 수정하는 것을 권장합니다.

```bash
mkdir -p /tmp/security-exercise
```

---

## 3. 취약점 A: SQL 인젝션

### 3.1 취약한 코드

아래 코드를 읽고 문제점을 찾으십시오.

```typescript
// 파일: /tmp/security-exercise/user-search.ts
// 경고: 이 코드는 의도적으로 취약하게 작성된 교육용 코드입니다

import { db } from './db';

async function searchUsers(searchTerm: string) {
  // 사용자 검색
  const query = `SELECT id, email, name FROM users WHERE name LIKE '%${searchTerm}%'`;
  const users = await db.execute(query);
  return users;
}

export { searchUsers };
```

**문제가 무엇인가요?** 직접 생각해 보십시오.

---

**힌트**: `searchTerm`이 사용자로부터 입력받은 값이라면 어떤 일이 벌어질까요?

만약 공격자가 `searchTerm`에 다음 값을 입력하면:
```
'; DROP TABLE users; --
```

쿼리가 다음과 같이 됩니다:
```sql
SELECT id, email, name FROM users WHERE name LIKE '%'; DROP TABLE users; --%'
```

이것이 SQL 인젝션(SQL Injection)입니다. CSAP D-12 위반입니다.

### 3.2 올바른 코드

```typescript
// 파일: /tmp/security-exercise/user-search-fixed.ts

import { db } from './db';
import { z } from 'zod';

// 입력 검증 스키마 (CSAP D-12)
const searchSchema = z.object({
  searchTerm: z.string().min(1).max(100).regex(/^[a-zA-Z0-9가-힣\s]+$/, '허용되지 않은 문자가 포함되어 있습니다'),
});

async function searchUsers(rawInput: unknown) {
  // 1. 입력 검증 (Zod)
  const validated = searchSchema.parse(rawInput);

  // 2. 매개변수화 쿼리 사용 (SQL 인젝션 방지, CSAP D-12)
  const users = await db.execute(
    'SELECT id, email, name FROM users WHERE name LIKE $1',
    [`%${validated.searchTerm}%`]  // 별도 매개변수로 전달
  );

  return users;
}

export { searchUsers };
```

**핵심 원칙**:
- 사용자 입력을 SQL 문자열에 직접 결합하지 않습니다.
- 매개변수화 쿼리(Prepared Statement)를 항상 사용합니다.
- Zod로 입력 형식을 먼저 검증합니다.

---

## 4. 취약점 B: 하드코딩된 시크릿

### 4.1 취약한 코드

```typescript
// 파일: /tmp/security-exercise/payment-api.ts
// 경고: 이 코드는 의도적으로 취약하게 작성된 교육용 코드입니다

const PAYMENT_API_KEY = 'pk_live_abcdefghijklmnop1234567890';
const DATABASE_PASSWORD = 'admin1234!@#$';
const JWT_SECRET = 'my-super-secret-jwt-key-do-not-share';

async function processPayment(amount: number, cardToken: string) {
  const response = await fetch('https://payment.example.com/charge', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${PAYMENT_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ amount, cardToken }),
  });
  return response.json();
}
```

**문제가 무엇인가요?**

---

**힌트**: 이 파일이 git 저장소에 커밋되면 어떻게 될까요?

하드코딩된 시크릿은 git 히스토리에 영구히 남습니다. 누군가 저장소에 접근하면 모든 시크릿을 알게 됩니다. CSAP D-09 위반이며, 이 프로젝트의 절대 제약(`CLAUDE.md §1`) 위반입니다.

### 4.2 올바른 코드

```typescript
// 파일: /tmp/security-exercise/payment-api-fixed.ts

// 환경 변수에서 시크릿 읽기 (CSAP D-09)
const PAYMENT_API_KEY = process.env['PAYMENT_API_KEY'];
const JWT_SECRET = process.env['JWT_SECRET'];

// 시작 시 필수 환경 변수 검증
if (!PAYMENT_API_KEY) {
  throw new Error('PAYMENT_API_KEY 환경 변수가 설정되지 않았습니다');
}

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET 환경 변수가 설정되지 않았습니다');
}

async function processPayment(amount: number, cardToken: string) {
  const response = await fetch('https://payment.example.com/charge', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${PAYMENT_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ amount, cardToken }),
  });
  return response.json();
}
```

**핵심 원칙**:
- 모든 시크릿은 환경 변수로 관리합니다.
- 로컬 개발: `.env.local` (`.gitignore`에 포함)
- 운영 환경: Vault에서 주입
- 시작 시 환경 변수 존재 여부를 검증합니다.

**절대 금지 목록**:
```
API 키, 비밀번호, JWT 시크릿, DB 접속 정보, 인증서 개인키
```

---

## 5. 취약점 C: RBAC 누락

### 5.1 취약한 코드

```typescript
// 파일: /tmp/security-exercise/admin-api.ts
// 경고: 이 코드는 의도적으로 취약하게 작성된 교육용 코드입니다

import type { FastifyRequest, FastifyReply } from 'fastify';
import { db } from './db';

// 관리자 전용 — 전체 사용자 목록 조회
export async function getAllUsersHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // 인증/인가 확인 없이 바로 DB 조회
  const users = await db.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      passwordHash: true,  // 패스워드 해시도 반환
    },
  });

  await reply.status(200).send({ success: true, data: users });
}
```

**문제가 무엇인가요?**

---

**힌트**: 이 엔드포인트에 누구나 접근할 수 있다면 어떤 일이 벌어질까요?

인증(Authentication)과 인가(Authorization) 없이 관리자 전용 데이터가 누구에게나 노출됩니다. 특히 `passwordHash`까지 반환하는 것은 심각한 보안 결함입니다. CSAP D-08 위반입니다.

### 5.2 올바른 코드

```typescript
// 파일: /tmp/security-exercise/admin-api-fixed.ts

import type { FastifyRequest, FastifyReply } from 'fastify';
import { verifyToken } from './auth';
import { hasPermission } from './rbac';
import { db } from './db';
import { auditLog } from './audit';

// 관리자 전용 — 전체 사용자 목록 조회
export async function getAllUsersHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // 1. 인증 확인 (CSAP D-08-01)
  const tokenResult = await verifyToken(request.headers['authorization']);
  if (!tokenResult.success) {
    await reply.status(401).send({
      success: false,
      error: { code: 'AUTH_TOKEN_INVALID', message: '인증이 필요합니다' },
    });
    return;
  }

  const user = tokenResult.user;

  // 2. 인가 확인 — admin 권한 필요 (CSAP D-08-02)
  if (!hasPermission(user, 'users:read:all')) {
    await reply.status(403).send({
      success: false,
      error: { code: 'FORBIDDEN', message: '권한이 없습니다' },
    });
    return;
  }

  // 3. 감사 로그 (CSAP D-06)
  await auditLog({
    actor: user.id,
    action: 'ADMIN_USER_LIST_READ',
    timestamp: new Date().toISOString(),
    ip: request.ip,
  });

  // 4. 민감 필드 제외하고 조회 (CSAP D-09)
  const users = await db.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      // passwordHash: false  ← 절대 반환하지 않음
    },
  });

  await reply.status(200).send({ success: true, data: users });
}
```

**핵심 원칙**:
- 모든 API 엔드포인트에 `verifyToken()` + `hasPermission()` 적용
- 관리자 전용 작업에는 감사 로그 기록
- `passwordHash` 등 민감 필드는 응답에서 제외

---

## 6. 취약점 D: 에러 메시지 정보 노출

### 6.1 취약한 코드

```typescript
// 파일: /tmp/security-exercise/error-handler.ts
// 경고: 이 코드는 의도적으로 취약하게 작성된 교육용 코드입니다

import type { FastifyRequest, FastifyReply } from 'fastify';

export async function createOrderHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    // 주문 처리 로직
    const order = await processOrder(request.body);
    await reply.status(201).send({ success: true, data: order });
  } catch (error) {
    // 오류 상세 정보를 그대로 반환
    await reply.status(500).send({
      success: false,
      error: {
        message: (error as Error).message,
        stack: (error as Error).stack,            // ← 스택 트레이스 노출
        dbQuery: (error as any).query,            // ← DB 쿼리 노출
        dbPassword: process.env['DB_PASSWORD'],   // ← DB 비밀번호 노출!
      },
    });
  }
}
```

**문제가 무엇인가요?**

---

**힌트**: 스택 트레이스에는 어떤 정보가 담겨 있을까요?

스택 트레이스에는 서버의 내부 파일 구조, DB 쿼리, 내부 변수값 등이 포함될 수 있습니다. 공격자에게 시스템 구조를 노출하는 것은 심각한 보안 위험입니다.

### 6.2 올바른 코드

```typescript
// 파일: /tmp/security-exercise/error-handler-fixed.ts

import type { FastifyRequest, FastifyReply } from 'fastify';
import { v4 as uuid } from 'uuid';
import { logger } from './logger';

export async function createOrderHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const order = await processOrder(request.body);
    await reply.status(201).send({ success: true, data: order });
  } catch (error) {
    // 내부 오류는 서버 로그에만 기록 (민감 정보 포함 가능)
    const errorId = uuid();
    logger.error({
      errorId,
      message: (error as Error).message,
      stack: (error as Error).stack,
    }, '주문 처리 중 오류 발생');

    // 클라이언트에는 최소한의 정보만 반환 (CSAP D-12)
    await reply.status(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '서버 내부 오류가 발생했습니다.',
        errorId,  // 로그 추적용 ID만 제공
      },
    });
  }
}
```

**핵심 원칙**:
- 클라이언트에는 최소한의 정보만 반환 (오류 코드, 추적 ID)
- 스택 트레이스, DB 쿼리, 환경 변수값은 절대 반환하지 않음
- 상세 오류는 서버 로그에만 기록

---

## 7. 취약점 E: 입력 검증 누락

### 7.1 취약한 코드

```typescript
// 파일: /tmp/security-exercise/user-create.ts
// 경고: 이 코드는 의도적으로 취약하게 작성된 교육용 코드입니다

import type { FastifyRequest, FastifyReply } from 'fastify';
import { db } from './db';
import bcrypt from 'bcrypt';

export async function createUserHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // 입력 검증 없이 바로 사용
  const { email, password, role } = request.body as any;

  // 어떤 역할이든 사용자가 직접 지정 가능
  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await db.user.create({
    data: {
      email,
      password: hashedPassword,
      role,  // ← 'admin'도 가능!
    },
  });

  await reply.status(201).send({ success: true, data: user });
}
```

**문제가 무엇인가요?**

---

**힌트**: 공격자가 `role: "admin"`으로 요청을 보내면 어떻게 될까요?

입력 검증이 없으면:
1. 이메일 형식이 잘못된 값이 저장될 수 있습니다.
2. 빈 비밀번호가 저장될 수 있습니다.
3. 공격자가 `role: "admin"`으로 요청하여 관리자 계정을 만들 수 있습니다.

### 7.2 올바른 코드

```typescript
// 파일: /tmp/security-exercise/user-create-fixed.ts

import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { db } from './db';
import bcrypt from 'bcrypt';

// 입력 검증 스키마 (CSAP D-12)
const createUserSchema = z.object({
  email: z.string().email('유효한 이메일 형식이어야 합니다'),
  password: z
    .string()
    .min(8, '비밀번호는 8자 이상이어야 합니다')
    .max(128, '비밀번호는 128자 이하여야 합니다')
    .regex(/[A-Z]/, '대문자를 포함해야 합니다')
    .regex(/[0-9]/, '숫자를 포함해야 합니다'),
  name: z.string().min(1).max(100),
  // role은 사용자가 지정할 수 없음 — 항상 'user'로 고정
});

export async function createUserHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // 1. 입력 검증
  const parseResult = createUserSchema.safeParse(request.body);
  if (!parseResult.success) {
    await reply.status(400).send({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: parseResult.error.issues.map((i) => i.message).join(', '),
      },
    });
    return;
  }

  const { email, password, name } = parseResult.data;

  // 2. 비밀번호 해시 (bcrypt, CSAP D-09)
  const hashedPassword = await bcrypt.hash(password, 12);

  // 3. role은 항상 'user'로 고정 (권한 상승 방지, CSAP D-08)
  const user = await db.user.create({
    data: {
      email,
      password: hashedPassword,
      name,
      role: 'user',  // ← 외부 입력 사용 금지
    },
  });

  // 4. 응답에 비밀번호 제외 (CSAP D-09)
  const { password: _, ...userWithoutPassword } = user;

  await reply.status(201).send({ success: true, data: userWithoutPassword });
}
```

**핵심 원칙**:
- 모든 입력은 Zod 스키마로 검증
- 권한(role)은 서버가 결정, 클라이언트 입력 불가
- bcrypt rounds는 10 이상 (12 권장)
- 응답에서 비밀번호 해시 제거

---

## 8. Claude Code로 보안 리뷰

5개 취약점을 모두 수정했으면 Claude Code에게 종합 리뷰를 요청합니다.

```bash
cd /data/ai-saas
claude
```

```
/tmp/security-exercise/ 디렉터리의 -fixed.ts 파일들을
CSAP D-08, D-09, D-12 기준으로 종합 보안 리뷰해 줘.
각 파일별로 통과/실패 여부와 이유를 알려줘.
추가로 개선이 필요한 부분이 있으면 알려줘.
```

**리뷰 결과 예시**:

```
=== 종합 보안 리뷰 결과 ===

user-search-fixed.ts: 통과
  - CSAP D-12: 매개변수화 쿼리 사용 ✓
  - CSAP D-12: Zod 입력 검증 ✓

payment-api-fixed.ts: 통과
  - CSAP D-09: 환경 변수로 시크릿 관리 ✓
  - 시작 시 환경 변수 검증 ✓

admin-api-fixed.ts: 통과
  - CSAP D-08-01: 인증 확인 ✓
  - CSAP D-08-02: 인가 확인 ✓
  - CSAP D-06: 감사 로그 ✓

error-handler-fixed.ts: 통과
  - CSAP D-12: 최소 정보 반환 ✓
  - 추적 ID 제공 ✓

user-create-fixed.ts: 통과
  - CSAP D-12: Zod 검증 ✓
  - CSAP D-08: role 서버 고정 ✓
  - CSAP D-09: bcrypt 12 rounds ✓
```

---

## 9. CSAP 체크리스트 자가 검증

수정한 코드가 CSAP 기준을 충족하는지 체크리스트로 확인합니다.

### CSAP D-08: 접근 통제

```
[ ] 모든 API 엔드포인트에 verifyToken() 적용
[ ] 권한이 필요한 작업에 hasPermission() 적용
[ ] 인증 실패 시 401 반환
[ ] 인가 실패 시 403 반환
[ ] 관리자 전용 API가 일반 사용자에게 노출되지 않음
```

### CSAP D-09: 암호화

```
[ ] 비밀번호는 bcrypt로 해시 (rounds ≥ 10)
[ ] 응답에 비밀번호 해시 미포함
[ ] 시크릿은 환경 변수로 관리
[ ] 하드코딩된 키/비밀번호 없음
```

### CSAP D-12: 개발 보안

```
[ ] 모든 사용자 입력은 Zod로 검증
[ ] SQL 쿼리는 매개변수화 쿼리 사용
[ ] 오류 응답에 내부 정보 미포함
[ ] 스택 트레이스 클라이언트 미노출
[ ] role 등 권한 관련 값은 클라이언트 입력 불허
```

---

## 10. 정답 및 해설

| 취약점 | CSAP 위반 항목 | 핵심 수정 사항 |
|--------|--------------|--------------|
| A: SQL 인젝션 | D-12 (개발 보안) | 매개변수화 쿼리 + Zod 검증 |
| B: 하드코딩 시크릿 | D-09 (암호화) | 환경 변수로 이전 |
| C: RBAC 누락 | D-08 (접근 통제) | verifyToken + hasPermission |
| D: 에러 정보 노출 | D-12 (개발 보안) | 최소 정보 반환 + 로그만 상세 기록 |
| E: 입력 검증 누락 | D-12 (개발 보안) | Zod 스키마 + role 서버 고정 |

### 보안의 3원칙 (이 실습의 핵심 교훈)

**1. 신뢰하지 않고 검증하라 (Zero Trust Validation)**

사용자 입력은 모두 악의적일 수 있다고 가정하고 검증합니다. 이것이 취약점 A, E의 해결 원칙입니다.

**2. 최소 권한 원칙 (Principle of Least Privilege)**

사용자는 필요한 최소한의 권한만 가져야 합니다. 이것이 취약점 C의 해결 원칙입니다.

**3. 최소 노출 원칙 (Principle of Least Exposure)**

클라이언트에는 최소한의 정보만 반환합니다. 내부 구조, 시크릿, 스택 트레이스를 절대 노출하지 않습니다. 이것이 취약점 B, D의 해결 원칙입니다.

---

## 11. 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-12 | 초안 작성 (5개 취약점 실습) | Implementer (Sonnet) |
