// CSAP 검증 테스트: D-06 감사 로그
// Design Ref: DESIGN-MTU-P21
// CSAP: D-06 침해사고 관리

import { describe, it, expect } from 'vitest';

const AUDIT_URL = 'http://localhost:3012';

describe('CSAP D-06: 감사 로그 검증', () => {
  it('D-06-01: 감사 로그 기록 (append-only)', async () => {
    const res = await fetch(`${AUDIT_URL}/audit/logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'CSAP_TEST_LOG',
        target: 'test',
        targetType: 'csap-verification',
      }),
    });
    expect(res.status).toBe(201);
  });

  it('D-06-03: 감사 로그 조회 (필터)', async () => {
    const res = await fetch(`${AUDIT_URL}/audit/logs?action=CSAP_TEST_LOG`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toBeDefined();
    expect(body.pagination).toBeDefined();
  });

  it('D-06-05: SHA-256 체인 무결성 검증', async () => {
    const res = await fetch(`${AUDIT_URL}/audit/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.valid).toBe(true);
  });

  it('D-06-04: 감사 로그 보존 (365일)', async () => {
    const res = await fetch(`${AUDIT_URL}/audit/stats`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.retentionDays).toBe(365);
  });
});
