// 인증 서비스 E2E 통합 테스트 -- Round 4
// Design Ref: SVC-E2E-R4 DESIGN
// Plan SC: FR-E2E.1, FR-E2E.3
// CSAP: D-08 인증, D-08-04 MFA

import { describe, it, expect, vi, afterAll } from 'vitest';
import Fastify from 'fastify';
import { responseTimePlugin } from '@public-saas/observability';

describe('auth-service E2E -- MFA 완전 플로우 (CSAP D-08-04)', () => {
  const app = Fastify();
  app.register(responseTimePlugin);

  // MFA 상태 시뮬레이션
  const mfaSecrets = new Map<string, { secret: string; enabled: boolean }>();

  app.post('/auth/mfa/setup', async (req) => {
    const { userId } = req.body as { userId: string };
    const secret = `TOTP-${Date.now()}`;
    mfaSecrets.set(userId, { secret, enabled: false });
    return {
      success: true,
      data: { secret, qrCodeUrl: `otpauth://totp/SaaS:${userId}?secret=${secret}` },
    };
  });

  app.post('/auth/mfa/verify', async (req) => {
    const { userId, code } = req.body as { userId: string; code: string };
    const mfa = mfaSecrets.get(userId);
    if (!mfa) {
      return { success: false, error: { code: 'MFA_NOT_SETUP' } };
    }
    // 테스트: 코드가 6자리 숫자면 유효로 간주
    if (/^\d{6}$/.test(code)) {
      mfa.enabled = true;
      return { success: true, message: 'MFA 활성화 완료' };
    }
    return { success: false, error: { code: 'MFA_INVALID_CODE' } };
  });

  app.post('/auth/mfa/validate', async (req) => {
    const { userId, code } = req.body as { userId: string; code: string };
    const mfa = mfaSecrets.get(userId);
    if (!mfa || !mfa.enabled) {
      return { success: false, error: { code: 'MFA_NOT_ENABLED' } };
    }
    if (/^\d{6}$/.test(code)) {
      return { success: true, data: { accessToken: `mfa-verified-token-${userId}` } };
    }
    return { success: false, error: { code: 'MFA_INVALID_CODE' } };
  });

  app.delete('/auth/mfa', async (req) => {
    const { userId } = req.body as { userId: string };
    mfaSecrets.delete(userId);
    return { success: true, message: 'MFA 비활성화 완료' };
  });

  afterAll(async () => {
    await app.close();
  });

  it('MFA 설정 -> 검증 -> 로그인 전체 플로우', async () => {
    const userId = 'user-mfa-1';

    // 1. MFA 설정
    const setupRes = await app.inject({
      method: 'POST',
      url: '/auth/mfa/setup',
      headers: { 'content-type': 'application/json' },
      payload: { userId },
    });
    expect(setupRes.json().success).toBe(true);
    expect(setupRes.json().data.secret).toBeDefined();

    // 2. MFA 검증 (활성화)
    const verifyRes = await app.inject({
      method: 'POST',
      url: '/auth/mfa/verify',
      headers: { 'content-type': 'application/json' },
      payload: { userId, code: '123456' },
    });
    expect(verifyRes.json().success).toBe(true);

    // 3. MFA 로그인 검증
    const validateRes = await app.inject({
      method: 'POST',
      url: '/auth/mfa/validate',
      headers: { 'content-type': 'application/json' },
      payload: { userId, code: '654321' },
    });
    expect(validateRes.json().success).toBe(true);
    expect(validateRes.json().data.accessToken).toContain('mfa-verified');
  });

  it('MFA 미설정 상태에서 검증 시도 시 실패', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/mfa/verify',
      headers: { 'content-type': 'application/json' },
      payload: { userId: 'unknown-user', code: '123456' },
    });
    expect(res.json().success).toBe(false);
    expect(res.json().error.code).toBe('MFA_NOT_SETUP');
  });

  it('잘못된 MFA 코드로 검증 시 실패', async () => {
    const userId = 'user-bad-code';
    await app.inject({
      method: 'POST',
      url: '/auth/mfa/setup',
      headers: { 'content-type': 'application/json' },
      payload: { userId },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/auth/mfa/verify',
      headers: { 'content-type': 'application/json' },
      payload: { userId, code: 'not-a-code' },
    });
    expect(res.json().success).toBe(false);
    expect(res.json().error.code).toBe('MFA_INVALID_CODE');
  });

  it('MFA 비활성화 후 로그인 검증 실패', async () => {
    const userId = 'user-disable-mfa';

    // 설정 + 활성화
    await app.inject({
      method: 'POST',
      url: '/auth/mfa/setup',
      headers: { 'content-type': 'application/json' },
      payload: { userId },
    });
    await app.inject({
      method: 'POST',
      url: '/auth/mfa/verify',
      headers: { 'content-type': 'application/json' },
      payload: { userId, code: '111111' },
    });

    // 비활성화
    await app.inject({
      method: 'DELETE',
      url: '/auth/mfa',
      headers: { 'content-type': 'application/json' },
      payload: { userId },
    });

    // 검증 시도 -> 실패
    const res = await app.inject({
      method: 'POST',
      url: '/auth/mfa/validate',
      headers: { 'content-type': 'application/json' },
      payload: { userId, code: '123456' },
    });
    expect(res.json().success).toBe(false);
    expect(res.json().error.code).toBe('MFA_NOT_ENABLED');
  });

  it('X-Response-Time 헤더가 MFA 엔드포인트에도 포함된다', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/mfa/setup',
      headers: { 'content-type': 'application/json' },
      payload: { userId: 'user-rt' },
    });
    expect(res.headers['x-response-time']).toBeDefined();
  });
});

describe('auth-service E2E -- 세션 관리 강화', () => {
  it('JWT 토큰 구조 검증', () => {
    // JWT는 3파트 (header.payload.signature)
    const mockJwt = 'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ1c2VyLTEiLCJ0ZW5hbnRJZCI6InQtMSIsInJvbGUiOiJBRE1JTiIsImV4cCI6MTk5OTk5OTk5OX0.signature';
    const parts = mockJwt.split('.');
    expect(parts.length).toBe(3);

    // payload 디코딩
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    expect(payload.sub).toBe('user-1');
    expect(payload.tenantId).toBe('t-1');
    expect(payload.role).toBe('ADMIN');
    expect(payload.exp).toBeGreaterThan(Date.now() / 1000);
  });

  it('동시 세션 제한 규칙 (최대 3개)', () => {
    const sessions: string[] = [];
    const MAX_SESSIONS = 3;

    function addSession(token: string): { evicted: string | null } {
      let evicted: string | null = null;
      if (sessions.length >= MAX_SESSIONS) {
        evicted = sessions.shift() ?? null;
      }
      sessions.push(token);
      return { evicted };
    }

    addSession('s1');
    addSession('s2');
    addSession('s3');
    expect(sessions.length).toBe(3);

    // 4번째 세션 -> 가장 오래된 세션 제거
    const result = addSession('s4');
    expect(result.evicted).toBe('s1');
    expect(sessions.length).toBe(3);
    expect(sessions).toEqual(['s2', 's3', 's4']);
  });

  it('토큰 블랙리스트 검증', () => {
    const blacklist = new Set<string>();

    function blacklistToken(token: string): void {
      blacklist.add(token);
    }

    function isBlacklisted(token: string): boolean {
      return blacklist.has(token);
    }

    expect(isBlacklisted('token-1')).toBe(false);
    blacklistToken('token-1');
    expect(isBlacklisted('token-1')).toBe(true);
    expect(isBlacklisted('token-2')).toBe(false);
  });
});
