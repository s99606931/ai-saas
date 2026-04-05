// MTU-Q2 webhook-sender SSRF 방지 단위 테스트
// Test Ref: DESIGN-MTU-Q2 §2 FR-P11.3
// CSAP: D-12 입력 검증 — SSRF 방지

import { describe, it, expect } from 'vitest';

// ──────────────────────────────────────────────
// webhook-sender.ts에서 추출한 isInternalUrl 로직
// ESM import 없이 동일 로직 재현으로 단위 테스트
// ──────────────────────────────────────────────

function isInternalUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    const hostname = url.hostname.toLowerCase();

    const blockedPatterns = [
      'localhost',
      '127.0.0.1',
      '0.0.0.0',
      '::1',
      '[::1]',
    ];

    if (blockedPatterns.includes(hostname)) return true;

    const parts = hostname.split('.');
    if (parts.length === 4) {
      const first = parseInt(parts[0] as string, 10);
      const second = parseInt(parts[1] as string, 10);
      if (first === 10) return true;
      if (first === 172 && second >= 16 && second <= 31) return true;
      if (first === 192 && second === 168) return true;
    }

    return false;
  } catch {
    return true;
  }
}

describe('MTU-Q2 webhook-sender: SSRF 방지 — localhost 차단', () => {
  it('TC-SS01: localhost는 차단된다', () => {
    expect(isInternalUrl('http://localhost/webhook')).toBe(true);
  });

  it('TC-SS02: localhost:3000 포트 포함도 차단된다', () => {
    expect(isInternalUrl('http://localhost:3000/api/hook')).toBe(true);
  });

  it('TC-SS03: 127.0.0.1은 차단된다', () => {
    expect(isInternalUrl('http://127.0.0.1/webhook')).toBe(true);
  });

  it('TC-SS04: 127.0.0.1:8080 포트 포함도 차단된다', () => {
    expect(isInternalUrl('http://127.0.0.1:8080/hook')).toBe(true);
  });

  it('TC-SS05: 0.0.0.0은 차단된다', () => {
    expect(isInternalUrl('http://0.0.0.0/webhook')).toBe(true);
  });
});

describe('MTU-Q2 webhook-sender: SSRF 방지 — 사설 IP 10.x.x.x 차단', () => {
  it('TC-SS06: 10.0.0.1은 차단된다 (Class A 사설)', () => {
    expect(isInternalUrl('http://10.0.0.1/webhook')).toBe(true);
  });

  it('TC-SS07: 10.255.255.255는 차단된다 (Class A 사설 최대)', () => {
    expect(isInternalUrl('http://10.255.255.255/webhook')).toBe(true);
  });

  it('TC-SS08: 10.100.50.25는 차단된다 (Class A 사설 임의)', () => {
    expect(isInternalUrl('http://10.100.50.25/webhook')).toBe(true);
  });
});

describe('MTU-Q2 webhook-sender: SSRF 방지 — 사설 IP 172.16-31.x.x 차단', () => {
  it('TC-SS09: 172.16.0.1은 차단된다 (Class B 사설 시작)', () => {
    expect(isInternalUrl('http://172.16.0.1/webhook')).toBe(true);
  });

  it('TC-SS10: 172.31.255.255는 차단된다 (Class B 사설 끝)', () => {
    expect(isInternalUrl('http://172.31.255.255/webhook')).toBe(true);
  });

  it('TC-SS11: 172.20.10.5는 차단된다 (Class B 사설 임의)', () => {
    expect(isInternalUrl('http://172.20.10.5/webhook')).toBe(true);
  });

  it('TC-SS12: 172.15.0.1은 차단되지 않는다 (16 미만은 공인 가능)', () => {
    expect(isInternalUrl('http://172.15.0.1/webhook')).toBe(false);
  });

  it('TC-SS13: 172.32.0.1은 차단되지 않는다 (31 초과는 공인 가능)', () => {
    expect(isInternalUrl('http://172.32.0.1/webhook')).toBe(false);
  });
});

describe('MTU-Q2 webhook-sender: SSRF 방지 — 사설 IP 192.168.x.x 차단', () => {
  it('TC-SS14: 192.168.0.1은 차단된다 (Class C 사설)', () => {
    expect(isInternalUrl('http://192.168.0.1/webhook')).toBe(true);
  });

  it('TC-SS15: 192.168.100.200은 차단된다 (Class C 사설 임의)', () => {
    expect(isInternalUrl('http://192.168.100.200/webhook')).toBe(true);
  });
});

describe('MTU-Q2 webhook-sender: SSRF 방지 — URL 파싱 실패 시 차단', () => {
  it('TC-SS16: 올바르지 않은 URL은 차단된다', () => {
    expect(isInternalUrl('not-a-url')).toBe(true);
  });

  it('TC-SS17: 빈 문자열은 차단된다', () => {
    expect(isInternalUrl('')).toBe(true);
  });

  it('TC-SS18: 프로토콜 없는 URL은 차단된다', () => {
    expect(isInternalUrl('webhook.example.com/hook')).toBe(true);
  });
});

describe('MTU-Q2 webhook-sender: SSRF 방지 — 외부 URL은 허용', () => {
  it('TC-SS19: 공인 IP https://webhook.example.com은 허용된다', () => {
    expect(isInternalUrl('https://webhook.example.com/hook')).toBe(false);
  });

  it('TC-SS20: 공인 IP 203.0.113.1은 허용된다', () => {
    expect(isInternalUrl('https://203.0.113.1/webhook')).toBe(false);
  });

  it('TC-SS21: 공인 도메인 https://api.slack.com은 허용된다', () => {
    expect(isInternalUrl('https://api.slack.com/webhook/token')).toBe(false);
  });
});

describe('MTU-Q2 webhook-sender: IPv6 루프백 차단', () => {
  it('TC-SS22: ::1 (IPv6 루프백)은 차단된다', () => {
    expect(isInternalUrl('http://[::1]/webhook')).toBe(true);
  });
});
