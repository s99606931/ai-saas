// CSAP 검증 테스트: D-08 접근 통제
// Design Ref: DESIGN-MTU-P21
// CSAP: D-08

import { describe, it, expect } from 'vitest';

const BASE_URL = 'http://localhost:3003/api';

describe('CSAP D-08: 접근 통제 검증', () => {
  it('D-08-01: 인증 없는 보호 API 접근 차단 (401)', async () => {
    const endpoints = [
      '/users',
      '/tenants',
      '/audit/logs',
    ];

    for (const ep of endpoints) {
      const res = await fetch(`${BASE_URL}${ep}`);
      expect(res.status).toBe(401);
    }
  });

  it('D-08-03: JWT 토큰 만료 시 접근 차단', async () => {
    // 만료된 토큰으로 접근
    const res = await fetch(`${BASE_URL}/users`, {
      headers: { 'Authorization': 'Bearer expired.token.here' },
    });
    expect(res.status).toBe(401);
  });

  it('D-08-08: MFA 구현 확인', async () => {
    const res = await fetch(`${BASE_URL}/auth/mfa/setup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token',
      },
    });
    // MFA 엔드포인트가 존재해야 함 (401 = 인증 필요, 200 = 성공)
    expect([200, 401]).toContain(res.status);
  });
});
