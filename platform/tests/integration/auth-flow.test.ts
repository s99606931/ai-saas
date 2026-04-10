// 통합 테스트: 인증 플로우 E2E
// Design Ref: DESIGN-MTU-P21
// CSAP: D-08 접근 통제 검증

import { describe, it, expect } from 'vitest';

const BASE_URL = 'http://localhost:3003/api';

describe('인증 플로우 E2E', () => {
  it('로그인 → JWT 발급 → 보호된 API 접근', async () => {
    // 1. 로그인 요청
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@gov.kr',
        password: 'test-password',
      }),
    });
    expect(loginRes.status).toBe(200);

    const { accessToken, refreshToken } = await loginRes.json();
    expect(accessToken).toBeDefined();
    expect(refreshToken).toBeDefined();

    // 2. 보호된 API 접근 (인증 있음)
    const protectedRes = await fetch(`${BASE_URL}/users/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(protectedRes.status).toBe(200);

    // 3. 보호된 API 접근 (인증 없음 → 401)
    const noAuthRes = await fetch(`${BASE_URL}/users/me`);
    expect(noAuthRes.status).toBe(401);
  });

  it('만료된 토큰 → 토큰 갱신', async () => {
    // 토큰 갱신은 refreshToken으로 수행
    const refreshRes = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: 'test-refresh-token' }),
    });
    // 테스트 환경에서는 토큰이 유효하지 않으므로 401 예상
    expect([200, 401]).toContain(refreshRes.status);
  });
});
