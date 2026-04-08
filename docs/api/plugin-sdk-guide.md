# 비즈니스 플러그인 SDK 사용 가이드

| 항목 | 내용 |
|------|------|
| 버전 | 1.0.0 |
| 작성일 | 2026-04-08 |
| 대상 | 비즈니스 플러그인 개발자, SI 업체 |
| Design Ref | DESIGN-DOC-1 |
| Plan SC | FR-N17.5 |

---

## 1. 개요

비즈니스 플러그인 SDK(`@public-saas/business-plugin-sdk`)는 공공기관 SaaS 프레임워크에 신규 비즈니스 서비스를 추가하기 위한 도구입니다.

### 핵심 기능

- **서비스 등록** (`registerService`): API 게이트웨이에 자동 라우트 등록
- **CSAP 보안 가드** (`csapGuard`): D-08 접근 통제, D-12 입력 검증 자동 적용
- **감사 로그** (`auditHook`): D-06 침해사고 관리 준수 자동 기록

### 아키텍처

```
플러그인 서비스
    |
    v
registerService() -> API 게이트웨이 라우트 등록
    |                    |
    |                    v
    |               csapGuard (RBAC + 데이터등급 검사)
    |                    |
    |                    v
    |               auditHook (감사 로그 자동 기록)
    v
비즈니스 로직
```

---

## 2. 빠른 시작 (5분)

### 설치

```bash
cd platform/plugins/my-service
npm install @public-saas/business-plugin-sdk
```

### 기본 플러그인 구조

```
platform/plugins/my-service/
  src/
    index.ts           # 진입점
    manifest.ts        # 서비스 매니페스트
    handlers/
      my.handler.ts    # API 핸들러
    schemas/
      my.schema.ts     # Zod 입력 검증 스키마
  tests/
    unit/
      my.test.ts       # 단위 테스트
  package.json
  tsconfig.json
```

### manifest.ts 작성

```typescript
// Design Ref: 서비스 매니페스트 표준 형식
export const manifest = {
  id: 'my-hr-service',
  name: '인사관리 서비스',
  version: '1.0.0',
  description: '직원 관리, 근태 관리 등 인사 업무 서비스',
  category: '업무관리',
  port: 3020,
  routes: [
    { path: '/employees', methods: ['GET', 'POST'] },
    { path: '/employees/:id', methods: ['GET', 'PUT', 'DELETE'] },
    { path: '/attendance', methods: ['GET', 'POST'] },
  ],
  menuItems: [
    { label: '직원 관리', path: '/employees', icon: 'users', order: 1 },
    { label: '근태 관리', path: '/attendance', icon: 'clock', order: 2 },
  ],
  csapGuards: {
    dataGrade: 'S',        // N2SF 데이터 등급 (C/S/O)
    auditLevel: 'HIGH',   // 감사 로그 수준
  },
};
```

### index.ts 작성

```typescript
import { Hono } from 'hono';
import { manifest } from './manifest';
import employeeHandler from './handlers/employee.handler';

const app = new Hono();

// 헬스체크 (필수)
app.get('/health', (c) =>
  c.json({ status: 'ok', service: manifest.id, version: manifest.version }),
);

// API 라우트 등록
app.route('/api/v1', employeeHandler);

export default app;
export { manifest };
```

---

## 3. 서비스 등록 (`registerService`)

```typescript
import { registerService } from '@public-saas/business-plugin-sdk';
import { manifest } from './manifest';

// 서비스 등록 (앱 기동 시 1회 실행)
const registration = await registerService(manifest);

console.log(`서비스 등록 완료: ${registration.basePath}`);
// 출력: 서비스 등록 완료: /api/v1/my-hr-service
```

### `registerService` 반환값

```typescript
interface ServiceRegistration {
  success: boolean;         // 등록 성공 여부
  serviceId: string;        // 서비스 ID
  basePath: string;         // API 기본 경로
  registeredAt: string;     // 등록 시각 (ISO 8601)
}
```

---

## 4. CSAP 보안 가드

### 인증 + 테넌트 격리 (CSAP D-08)

모든 API 핸들러에서 인증 컨텍스트를 확인해야 합니다.

```typescript
// CSAP D-08: 접근 통제 패턴
interface AuthContext {
  userId: string;
  tenantId: string;
}

function getAuthContext(c: Context): AuthContext | null {
  const userId = c.req.header('x-user-id');
  const tenantId = c.req.header('x-tenant-id');
  if (!userId || !tenantId) return null;
  return { userId, tenantId };
}

// 모든 핸들러에서 인증 검사 필수
app.get('/employees', async (c) => {
  const auth = getAuthContext(c);
  if (!auth) {
    return c.json({ error: '인증 및 테넌트 정보가 필요합니다' }, 401);
  }

  // 테넌트 격리 필터 적용 필수
  const employees = await db.employees.findMany({
    where: { tenantId: auth.tenantId },
  });

  return c.json({ items: employees });
});
```

### 입력 검증 (CSAP D-12)

모든 API 입력은 Zod 스키마로 검증합니다.

```typescript
import { z } from 'zod';

// 스키마 정의
const createEmployeeSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  department: z.string().min(1).max(50),
  position: z.enum(['사원', '대리', '과장', '차장', '부장']),
});

// 핸들러에서 검증
app.post('/employees', async (c) => {
  const auth = getAuthContext(c);
  if (!auth) return c.json({ error: '인증 필요' }, 401);

  const body = await c.req.json();
  const parsed = createEmployeeSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: '입력 검증 실패', details: parsed.error.issues }, 400);
  }

  // 검증된 데이터만 사용
  const employee = await db.employees.create({
    data: { ...parsed.data, tenantId: auth.tenantId },
  });

  return c.json(employee, 201);
});
```

---

## 5. 감사 로그 (`auditHook`)

### CSAP D-06 감사 로그 기록

모든 데이터 변경 작업에 감사 로그를 기록합니다.

```typescript
const AUDIT_SERVICE_URL = process.env['AUDIT_SERVICE_URL'] ?? 'http://localhost:3012';

async function logEvent(
  action: string,
  actor: string,
  tenantId: string,
  target: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    await fetch(`${AUDIT_SERVICE_URL}/audit/logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        actor,
        action,
        target,
        targetType: 'my-service-resource',
        tenantId,
        ip: '127.0.0.1',
        userAgent: 'my-hr-service/1.0',
        metadata,
      }),
    });
  } catch {
    // 감사 로그 전송 실패 시 서비스 가용성 우선 (CSAP D-07)
    process.stderr.write(`[my-service] 감사 로그 전송 실패: ${action}\n`);
  }
}

// 사용 예시
app.post('/employees', async (c) => {
  const auth = getAuthContext(c);
  if (!auth) return c.json({ error: '인증 필요' }, 401);

  // ... 직원 생성 로직

  // 감사 로그 기록 (CSAP D-06)
  await logEvent('EMPLOYEE_CREATED', auth.userId, auth.tenantId, employee.id, {
    department: parsed.data.department,
  });

  return c.json(employee, 201);
});
```

### 감사 로그 필수 기록 작업

| 작업 유형 | action 값 | 설명 |
|---------|----------|------|
| 생성 | `{RESOURCE}_CREATED` | 신규 리소스 생성 |
| 수정 | `{RESOURCE}_UPDATED` | 리소스 수정 |
| 삭제 | `{RESOURCE}_DELETED` | 리소스 삭제 (소프트 삭제 포함) |
| 조회 (민감) | `{RESOURCE}_ACCESSED` | 민감 데이터 조회 시 |

---

## 6. 레퍼런스 플러그인

### 전자결재 플러그인 (`electronic-approval`)

- 경로: `platform/plugins/electronic-approval/`
- 기능: 기안 CRUD, 결재선 설정, 승인/반려/보류
- 테스트: 6개 파일 (스키마, 엔진, 상태머신, 핸들러)
- CSAP: D-06 감사 로그, D-08 접근 통제, D-12 입력 검증

### 공공데이터 연동 플러그인 (`public-data-integration`)

- 경로: `platform/plugins/public-data-integration/`
- 기능: 데이터셋 검색, 상세 조회, 데이터 변환 (CSV/XML -> JSON)
- 테스트: 4개 파일 (스키마, 변환, 캐시, 핸들러)
- CSAP: D-06 감사 로그, D-08 접근 통제, D-12 입력 검증

---

## 7. 테스트 작성 가이드

```typescript
// Hono app.request()를 사용한 핸들러 통합 테스트
import { describe, it, expect } from 'vitest';
import handler from '../src/handlers/my.handler';

const AUTH_HEADERS = {
  'x-user-id': 'test-user-001',
  'x-tenant-id': 'test-tenant-001',
  'Content-Type': 'application/json',
};

describe('POST /my-resource (생성)', () => {
  it('유효한 요청은 201을 반환한다', async () => {
    const res = await handler.request('/my-resource', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify({ name: '테스트' }),
    });
    expect(res.status).toBe(201);
  });

  // CSAP D-08: 인증 없는 접근 거부 테스트 (필수)
  it('인증 없이 접근하면 401을 반환한다', async () => {
    const res = await handler.request('/my-resource', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '테스트' }),
    });
    expect(res.status).toBe(401);
  });
});
```

테스트 실행:

```bash
# 단일 플러그인 테스트
cd platform/plugins/my-service
npx vitest run

# 전체 테스트
cd /data/ai-saas
npx vitest run
```

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-08 | 초안 작성 | PM Lead Agent |
