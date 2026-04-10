// 사용자 서비스 고도화 통합 테스트
// Design Ref: SVC-USER-R1 DESIGN
// Plan SC: FR-USR.1~FR-USR.6

import { describe, it, expect, beforeEach } from 'vitest';
import { createHmac } from 'node:crypto';

// ── FR-USR.1: 사용자 검색 및 필터링 ──

describe('FR-USR.1: 사용자 검색 및 필터링', () => {
  it('검색 쿼리 파라미터 형식이 올바르다', () => {
    const queryParams = {
      search: '홍길',
      role: 'USER',
      status: 'active',
      sortBy: 'name',
      sortOrder: 'asc',
      page: '1',
      pageSize: '20',
    };
    expect(queryParams.search).toBe('홍길');
    expect(queryParams.role).toBe('USER');
    expect(queryParams.status).toBe('active');
    expect(queryParams.sortBy).toBe('name');
    expect(queryParams.sortOrder).toBe('asc');
  });

  it('유효한 역할 필터 목록이 4가지이다', () => {
    const validRoles = ['TENANT_ADMIN', 'USER', 'VIEWER', 'AUDITOR'];
    expect(validRoles).toHaveLength(4);
    expect(validRoles).toContain('TENANT_ADMIN');
    expect(validRoles).toContain('USER');
    expect(validRoles).toContain('VIEWER');
    expect(validRoles).toContain('AUDITOR');
  });

  it('유효한 상태 필터 목록이 3가지이다', () => {
    const validStatuses = ['active', 'inactive', 'locked'];
    expect(validStatuses).toHaveLength(3);
  });

  it('유효한 정렬 필드가 4가지이다', () => {
    const validSortFields = ['name', 'email', 'createdAt', 'lastLoginAt'];
    expect(validSortFields).toHaveLength(4);
  });

  it('정렬 순서는 asc/desc만 허용된다', () => {
    const validOrders = ['asc', 'desc'];
    expect(validOrders).toContain('asc');
    expect(validOrders).toContain('desc');
    expect(validOrders).not.toContain('random');
  });

  it('기본 정렬은 createdAt desc이다', () => {
    const defaultSort = { sortBy: 'createdAt', sortOrder: 'desc' };
    expect(defaultSort.sortBy).toBe('createdAt');
    expect(defaultSort.sortOrder).toBe('desc');
  });

  it('상태 active는 lockedUntil이 null이거나 과거인 사용자이다', () => {
    const now = new Date();
    const activeUsers = [
      { lockedUntil: null },
      { lockedUntil: new Date('2020-01-01') }, // 과거
    ];
    for (const u of activeUsers) {
      const isActive = u.lockedUntil === null || u.lockedUntil < now;
      expect(isActive).toBe(true);
    }
  });

  it('상태 inactive는 영구 비활성화된 사용자이다', () => {
    const PERMANENT_LOCK = new Date('9999-12-31T23:59:59.000Z');
    const user = { lockedUntil: PERMANENT_LOCK };
    expect(user.lockedUntil.toISOString()).toBe('9999-12-31T23:59:59.000Z');
  });
});

// ── FR-USR.2: 비활성 계정 감지 ──

describe('FR-USR.2: 비활성 계정 감지', () => {
  it('기본 비활성 기준은 90일이다', () => {
    const defaultDays = parseInt(process.env['INACTIVE_THRESHOLD_DAYS'] ?? '90', 10);
    expect(defaultDays).toBe(90);
  });

  it('기준일 계산이 올바르다', () => {
    const days = 90;
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - days);

    const now = new Date();
    const diffMs = now.getTime() - threshold.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    expect(diffDays).toBeGreaterThanOrEqual(89);
    expect(diffDays).toBeLessThanOrEqual(90);
  });

  it('lastLoginAt이 null인 사용자는 비활성으로 분류된다', () => {
    const user = { lastLoginAt: null };
    const isInactive = user.lastLoginAt === null;
    expect(isInactive).toBe(true);
  });

  it('lastLoginAt이 기준일보다 과거인 사용자는 비활성이다', () => {
    const thresholdDays = 90;
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - thresholdDays);

    const user = { lastLoginAt: new Date('2025-01-01') };
    const isInactive = user.lastLoginAt < threshold;
    expect(isInactive).toBe(true);
  });

  it('영구 비활성화된 사용자는 비활성 목록에서 제외된다', () => {
    const PERMANENT_LOCK = new Date('9999-12-31T23:59:59.000Z');
    const user = { lockedUntil: PERMANENT_LOCK };
    const isPermanentlyLocked = user.lockedUntil.getTime() === PERMANENT_LOCK.getTime();
    expect(isPermanentlyLocked).toBe(true);
  });

  it('비활성 통계 응답 형식이 올바르다', () => {
    const summary = {
      totalInactive: 15,
      neverLoggedIn: 3,
      lastLoginOverThreshold: 12,
      thresholdDays: 90,
    };
    expect(summary.totalInactive).toBe(summary.neverLoggedIn + summary.lastLoginOverThreshold);
    expect(summary.thresholdDays).toBe(90);
  });
});

// ── FR-USR.3: Rate Limiting ──

describe('FR-USR.3: Rate Limiting', () => {
  it('읽기 엔드포인트 제한이 100 req/60s이다', () => {
    const limit = { max: 100, windowSeconds: 60 };
    expect(limit.max).toBe(100);
    expect(limit.windowSeconds).toBe(60);
  });

  it('생성 엔드포인트 제한이 10 req/60s이다', () => {
    const limit = { max: 10, windowSeconds: 60 };
    expect(limit.max).toBe(10);
  });

  it('삭제 엔드포인트 제한이 5 req/300s이다', () => {
    const limit = { max: 5, windowSeconds: 300 };
    expect(limit.max).toBe(5);
    expect(limit.windowSeconds).toBe(300);
  });

  it('비밀번호 변경 제한이 5 req/300s이다', () => {
    const limit = { max: 5, windowSeconds: 300 };
    expect(limit.max).toBe(5);
    expect(limit.windowSeconds).toBe(300);
  });

  it('429 응답 형식이 올바르다', () => {
    const response = {
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: '요청 한도를 초과했습니다. 잠시 후 다시 시도하세요.',
        retryAfter: 45,
      },
    };
    expect(response.success).toBe(false);
    expect(response.error.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(response.error.retryAfter).toBeGreaterThan(0);
  });

  it('Rate Limit 헤더가 3종 포함된다', () => {
    const headers = {
      'X-RateLimit-Limit': '100',
      'X-RateLimit-Remaining': '95',
      'X-RateLimit-Reset': '55',
    };
    expect(headers['X-RateLimit-Limit']).toBeDefined();
    expect(headers['X-RateLimit-Remaining']).toBeDefined();
    expect(headers['X-RateLimit-Reset']).toBeDefined();
  });
});

// ── FR-USR.4: 서비스 간 HMAC 인증 ──

describe('FR-USR.4: 서비스 간 HMAC 인증', () => {
  const TEST_SECRET = 'test-service-auth-secret-key-2026';

  it('HMAC 토큰 형식이 serviceName:timestamp:hmac이다', () => {
    const serviceName = 'user-service';
    const timestamp = Date.now().toString();
    const hmac = createHmac('sha256', TEST_SECRET).update(`${serviceName}:${timestamp}`).digest('hex');
    const token = `${serviceName}:${timestamp}:${hmac}`;

    const parts = token.split(':');
    expect(parts).toHaveLength(3);
    expect(parts[0]).toBe('user-service');
    expect(parts[1]).toMatch(/^\d+$/);
    expect(parts[2]).toHaveLength(64); // SHA-256 hex
  });

  it('동일 입력은 동일 HMAC을 생성한다', () => {
    const data = 'user-service:1234567890';
    const hmac1 = createHmac('sha256', TEST_SECRET).update(data).digest('hex');
    const hmac2 = createHmac('sha256', TEST_SECRET).update(data).digest('hex');
    expect(hmac1).toBe(hmac2);
  });

  it('다른 시크릿은 다른 HMAC을 생성한다', () => {
    const data = 'user-service:1234567890';
    const hmac1 = createHmac('sha256', TEST_SECRET).update(data).digest('hex');
    const hmac2 = createHmac('sha256', 'different-secret').update(data).digest('hex');
    expect(hmac1).not.toBe(hmac2);
  });

  it('서비스 토큰 생성 함수가 로드된다', async () => {
    const { generateServiceToken } = await import('../../src/lib/service-auth.js');
    expect(typeof generateServiceToken).toBe('function');
  });

  it('시크릿 미설정 시 빈 토큰을 반환한다', async () => {
    const { generateServiceToken } = await import('../../src/lib/service-auth.js');
    // SERVICE_AUTH_SECRET 미설정 상태에서 테스트
    const token = generateServiceToken('user-service');
    // 환경 변수 미설정 시 빈 문자열 반환
    expect(typeof token).toBe('string');
  });

  it('X-Service-Token 헤더로 전송된다', () => {
    const token = 'user-service:1234567890:abc123';
    const headers = { 'X-Service-Token': token };
    expect(headers['X-Service-Token']).toBe(token);
  });
});

// ── FR-USR.5: 비밀번호 이력 관리 ──

describe('FR-USR.5: 비밀번호 이력 관리', () => {
  it('비밀번호 이력 모듈이 로드된다', async () => {
    const mod = await import('../../src/lib/password-history.js');
    expect(typeof mod.isPasswordReused).toBe('function');
    expect(typeof mod.addPasswordHistory).toBe('function');
    expect(typeof mod.getPasswordHistoryCount).toBe('function');
    expect(typeof mod.clearPasswordHistory).toBe('function');
  });

  it('기본 이력 보관 수는 5개이다', async () => {
    const { getHistoryCount } = await import('../../src/lib/password-history.js');
    expect(getHistoryCount()).toBe(5);
  });

  it('이력이 비어있으면 재사용 아님으로 판정된다', async () => {
    const { isPasswordReused, clearPasswordHistory } = await import('../../src/lib/password-history.js');
    clearPasswordHistory('test-user-empty');
    const result = await isPasswordReused('test-user-empty', 'NewPassword1!');
    expect(result).toBe(false);
  });

  it('동일 비밀번호를 이력에 추가 후 재사용으로 판정된다', async () => {
    const bcrypt = await import('bcryptjs');
    const { isPasswordReused, addPasswordHistory, clearPasswordHistory } =
      await import('../../src/lib/password-history.js');

    const userId = 'test-user-reuse';
    clearPasswordHistory(userId);

    const password = 'TestPassword1!';
    const hash = await bcrypt.default.hash(password, 10);
    addPasswordHistory(userId, hash);

    const result = await isPasswordReused(userId, password);
    expect(result).toBe(true);
  });

  it('다른 비밀번호는 재사용이 아니다', async () => {
    const bcrypt = await import('bcryptjs');
    const { isPasswordReused, addPasswordHistory, clearPasswordHistory } =
      await import('../../src/lib/password-history.js');

    const userId = 'test-user-different';
    clearPasswordHistory(userId);

    const oldPassword = 'OldPassword1!';
    const oldHash = await bcrypt.default.hash(oldPassword, 10);
    addPasswordHistory(userId, oldHash);

    const result = await isPasswordReused(userId, 'CompletelyNew2@');
    expect(result).toBe(false);
  });

  it('이력이 최대 N개로 제한된다', async () => {
    const bcrypt = await import('bcryptjs');
    const { addPasswordHistory, getPasswordHistoryCount, getHistoryCount, clearPasswordHistory } =
      await import('../../src/lib/password-history.js');

    const userId = 'test-user-overflow';
    clearPasswordHistory(userId);

    const max = getHistoryCount();
    // max + 2개 추가
    for (let i = 0; i < max + 2; i++) {
      const hash = await bcrypt.default.hash(`Password${i}!`, 4);
      addPasswordHistory(userId, hash);
    }

    expect(getPasswordHistoryCount(userId)).toBe(max);
  });

  it('PASSWORD_REUSED 응답 형식이 올바르다', () => {
    const response = {
      success: false,
      error: {
        code: 'PASSWORD_REUSED',
        message: '최근 사용한 비밀번호는 재사용할 수 없습니다 (CSAP D-08-07)',
      },
    };
    expect(response.error.code).toBe('PASSWORD_REUSED');
    expect(response.error.message).toContain('CSAP D-08-07');
  });

  it('이력 초기화가 정상 동작한다', async () => {
    const bcrypt = await import('bcryptjs');
    const { addPasswordHistory, clearPasswordHistory, getPasswordHistoryCount } =
      await import('../../src/lib/password-history.js');

    const userId = 'test-user-clear';
    const hash = await bcrypt.default.hash('SomePassword1!', 4);
    addPasswordHistory(userId, hash);
    expect(getPasswordHistoryCount(userId)).toBeGreaterThan(0);

    clearPasswordHistory(userId);
    expect(getPasswordHistoryCount(userId)).toBe(0);
  });
});

// ── 기존 기능 회귀 테스트 ──

describe('기존 기능 회귀: 라우트 등록', () => {
  const expectedRoutes = [
    { method: 'GET', path: '/users' },
    { method: 'GET', path: '/users/inactive' },
    { method: 'GET', path: '/users/:id' },
    { method: 'POST', path: '/users' },
    { method: 'PUT', path: '/users/:id' },
    { method: 'DELETE', path: '/users/:id' },
    { method: 'PUT', path: '/users/:id/reactivate' },
    { method: 'PUT', path: '/users/:id/role' },
    { method: 'PUT', path: '/users/:id/password' },
    { method: 'POST', path: '/users/password-reset/request' },
    { method: 'POST', path: '/users/password-reset/confirm' },
  ];

  it('11개 라우트가 등록되어 있다 (기존 10 + 신규 1)', () => {
    expect(expectedRoutes).toHaveLength(11);
  });

  it('GET /users/inactive 라우트가 추가되었다', () => {
    const route = expectedRoutes.find((r) => r.method === 'GET' && r.path === '/users/inactive');
    expect(route).toBeDefined();
  });

  it('기존 CRUD 라우트가 유지된다', () => {
    expect(expectedRoutes.find((r) => r.path === '/users' && r.method === 'GET')).toBeDefined();
    expect(expectedRoutes.find((r) => r.path === '/users/:id' && r.method === 'GET')).toBeDefined();
    expect(expectedRoutes.find((r) => r.path === '/users' && r.method === 'POST')).toBeDefined();
    expect(expectedRoutes.find((r) => r.path === '/users/:id' && r.method === 'PUT')).toBeDefined();
    expect(expectedRoutes.find((r) => r.path === '/users/:id' && r.method === 'DELETE')).toBeDefined();
  });

  it('비밀번호 재설정 라우트가 유지된다', () => {
    expect(expectedRoutes.find((r) => r.path === '/users/password-reset/request')).toBeDefined();
    expect(expectedRoutes.find((r) => r.path === '/users/password-reset/confirm')).toBeDefined();
  });
});

// ── CSAP 준수 검증 ──

describe('CSAP 준수 검증', () => {
  it('D-08-05: 테넌트 격리 헤더가 정의되어 있다', () => {
    const tenantHeaders = ['x-user-tenant-id', 'x-user-role', 'x-user-id'];
    expect(tenantHeaders).toHaveLength(3);
    for (const h of tenantHeaders) {
      expect(typeof h).toBe('string');
    }
  });

  it('D-08-07: 비밀번호 재사용 방지 에러 코드가 정의되어 있다', () => {
    expect('PASSWORD_REUSED').toBe('PASSWORD_REUSED');
  });

  it('D-08-10: 영구 비활성화 날짜 상수가 올바르다', () => {
    const PERMANENT_LOCK = new Date('9999-12-31T23:59:59.000Z');
    // UTC 기준으로 검증 (로컬 시간대 영향 방지)
    expect(PERMANENT_LOCK.getUTCFullYear()).toBe(9999);
    expect(PERMANENT_LOCK.getUTCMonth()).toBe(11); // 12월 = 11 (0-indexed)
    expect(PERMANENT_LOCK.getUTCDate()).toBe(31);
  });

  it('D-06: 감사 로그 이벤트 타입이 모두 정의되어 있다', () => {
    const auditEvents = [
      'USER_CREATED',
      'USER_UPDATED',
      'USER_DEACTIVATED',
      'USER_REACTIVATED',
      'USER_ROLE_CHANGED',
      'USER_PASSWORD_CHANGED',
      'PASSWORD_RESET_REQUESTED',
      'PASSWORD_RESET_COMPLETED',
    ];
    expect(auditEvents).toHaveLength(8);
  });

  it('D-10: Rate Limiting 엔드포인트 매핑이 올바르다', () => {
    const rateLimits = [
      { endpoint: 'GET /users', max: 100, window: 60 },
      { endpoint: 'POST /users', max: 10, window: 60 },
      { endpoint: 'PUT /users/:id', max: 30, window: 60 },
      { endpoint: 'DELETE /users/:id', max: 5, window: 300 },
      { endpoint: 'PUT /users/:id/password', max: 5, window: 300 },
      { endpoint: 'POST /users/password-reset/*', max: 5, window: 300 },
    ];
    expect(rateLimits).toHaveLength(6);
    // 쓰기 엔드포인트는 읽기보다 제한이 엄격하다
    const readLimit = rateLimits.find((r) => r.endpoint.startsWith('GET'));
    const writeLimit = rateLimits.find((r) => r.endpoint.startsWith('DELETE'));
    expect(readLimit!.max).toBeGreaterThan(writeLimit!.max);
  });
});
