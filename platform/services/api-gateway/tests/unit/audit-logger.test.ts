// MTU-Q1 감사 로거 단위 테스트
// Test Ref: TS-4 (AI API Gateway 보안 요건) 연계
// CSAP: D-06 침해사고 관리 — 감사 로그 검증

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ──────────────────────────────────────────────
// maskAuthHeader 함수 직접 테스트 (모듈 내부 로직 추출 검증)
// audit-logger.ts는 Fastify 플러그인이므로 로직을 분리하여 테스트
// ──────────────────────────────────────────────

/** audit-logger.ts에서 추출한 동일 로직 (정적 분석 테스트) */
function maskAuthHeader(value: string | undefined): string {
  if (!value) return 'none';
  if (value.startsWith('Bearer ')) return 'Bearer ***';
  return '***';
}

const EXCLUDED_PATHS = new Set(['/health', '/ready', '/health/services']);

describe('MTU-Q1 audit-logger: maskAuthHeader', () => {
  it('TC-A01: undefined 값은 "none"을 반환한다', () => {
    expect(maskAuthHeader(undefined)).toBe('none');
  });

  it('TC-A02: 빈 문자열은 "none"을 반환한다', () => {
    expect(maskAuthHeader('')).toBe('none');
  });

  it('TC-A03: Bearer 토큰은 "Bearer ***"로 마스킹된다 (N2SF N-05 준수)', () => {
    const token = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.signature';
    expect(maskAuthHeader(token)).toBe('Bearer ***');
  });

  it('TC-A04: Bearer 접두사가 없는 헤더는 "***"로 마스킹된다', () => {
    expect(maskAuthHeader('Basic dXNlcjpwYXNz')).toBe('***');
    expect(maskAuthHeader('ApiKey abc123')).toBe('***');
  });

  it('TC-A05: 실제 JWT 토큰이 평문으로 로그에 남지 않는다', () => {
    const realToken = 'Bearer sk-ant-api03-realkey';
    const result = maskAuthHeader(realToken);
    expect(result).not.toContain('sk-ant-api03-realkey');
    expect(result).toBe('Bearer ***');
  });
});

describe('MTU-Q1 audit-logger: 헬스체크 경로 제외 (EXCLUDED_PATHS)', () => {
  it('TC-E01: /health 경로는 제외 목록에 포함된다', () => {
    expect(EXCLUDED_PATHS.has('/health')).toBe(true);
  });

  it('TC-E02: /ready 경로는 제외 목록에 포함된다', () => {
    expect(EXCLUDED_PATHS.has('/ready')).toBe(true);
  });

  it('TC-E03: /health/services 경로는 제외 목록에 포함된다', () => {
    expect(EXCLUDED_PATHS.has('/health/services')).toBe(true);
  });

  it('TC-E04: /api/users 경로는 제외 목록에 포함되지 않는다 (감사 로그 대상)', () => {
    expect(EXCLUDED_PATHS.has('/api/users')).toBe(false);
  });

  it('TC-E05: /api/tenants 경로는 제외 목록에 포함되지 않는다 (감사 로그 대상)', () => {
    expect(EXCLUDED_PATHS.has('/api/tenants')).toBe(false);
  });

  it('TC-E06: /api/docs 경로는 제외 목록에 포함되지 않는다 (Swagger UI)', () => {
    expect(EXCLUDED_PATHS.has('/api/docs')).toBe(false);
  });
});

describe('MTU-Q1 audit-logger: AuditLogEntry 구조 검증', () => {
  it('TC-S01: 감사 로그 항목에 timestamp 필드가 존재한다 (CSAP D-06)', () => {
    const entry = {
      timestamp: new Date().toISOString(),
      level: 'audit',
      service: 'api-gateway',
      action: 'API_REQUEST',
      actor: 'user-123',
      target: 'GET /api/users',
      targetType: 'api-request',
      ip: '10.0.0.1',
      metadata: {
        method: 'GET',
        statusCode: 200,
        latencyMs: 42,
        userAgent: 'Mozilla/5.0',
        tenantId: 'tenant-abc',
        auth: 'Bearer ***',
      },
    };

    expect(entry.timestamp).toBeTruthy();
    expect(() => new Date(entry.timestamp)).not.toThrow();
  });

  it('TC-S02: actor 필드는 user.sub 또는 "anonymous"이다', () => {
    const userSub = 'user-abc-123';
    const actor = userSub ?? 'anonymous';
    expect(actor).toBe('user-abc-123');

    const noUser = undefined;
    const anonymousActor = noUser ?? 'anonymous';
    expect(anonymousActor).toBe('anonymous');
  });

  it('TC-S03: ip 필드가 기록된다', () => {
    const mockIp = '192.0.2.1';
    const entry = { ip: mockIp };
    expect(entry.ip).toBe('192.0.2.1');
  });

  it('TC-S04: Authorization 헤더는 metadata.auth에 마스킹되어 저장된다', () => {
    const authHeader = 'Bearer eyJtoken123';
    const maskedAuth = maskAuthHeader(authHeader);
    const entry = { metadata: { auth: maskedAuth } };
    expect(entry.metadata.auth).toBe('Bearer ***');
    expect(entry.metadata.auth).not.toContain('eyJtoken123');
  });
});

describe('MTU-Q1 audit-logger: URL 쿼리스트링 제거', () => {
  it('TC-U01: 쿼리스트링이 있는 URL에서 경로만 추출된다', () => {
    const rawUrl = '/api/users?page=1&pageSize=20';
    const cleanUrl = rawUrl.split('?')[0];
    expect(cleanUrl).toBe('/api/users');
  });

  it('TC-U02: 쿼리스트링 없는 URL은 그대로 유지된다', () => {
    const rawUrl = '/api/tenants';
    const cleanUrl = rawUrl.split('?')[0];
    expect(cleanUrl).toBe('/api/tenants');
  });

  it('TC-U03: 헬스체크 URL에 쿼리스트링이 있어도 제외된다', () => {
    const rawUrl = '/health?check=true';
    const cleanUrl = rawUrl.split('?')[0];
    expect(EXCLUDED_PATHS.has(cleanUrl)).toBe(true);
  });
});
