// assertSafeUrl 통합 테스트
// Plan SC: FR-SSRF.2, FR-SSRF.4, FR-SSRF.5, FR-SSRF.6

import { describe, it, expect } from 'vitest';
import { assertSafeUrl } from '../src/guard.js';
import type { DnsResolver } from '../src/dns-resolver.js';

function mockResolver(map: Record<string, string[] | 'error' | 'hang'>): DnsResolver {
  return {
    async resolve(hostname) {
      const result = map[hostname];
      if (result === undefined) return [];
      if (result === 'error') throw new Error('ENOTFOUND');
      if (result === 'hang') return new Promise(() => {});
      return result;
    },
  };
}

describe('assertSafeUrl — URL 파싱', () => {
  it('잘못된 URL', async () => {
    const r = await assertSafeUrl('not a url');
    expect(r.safe).toBe(false);
    expect(r.reason).toBe('invalid-url');
  });

  it('ftp 프로토콜 차단', async () => {
    const r = await assertSafeUrl('ftp://example.com/');
    expect(r.safe).toBe(false);
    expect(r.reason).toBe('disallowed-protocol');
  });

  it('file:// 차단', async () => {
    const r = await assertSafeUrl('file:///etc/passwd');
    expect(r.safe).toBe(false);
    expect(r.reason).toBe('disallowed-protocol');
  });
});

describe('assertSafeUrl — hostname 차단', () => {
  it('localhost 차단', async () => {
    const r = await assertSafeUrl('http://localhost/');
    expect(r.safe).toBe(false);
    expect(r.reason).toBe('blocked-hostname');
  });

  it('foo.local 차단', async () => {
    const r = await assertSafeUrl('https://foo.local/');
    expect(r.safe).toBe(false);
    expect(r.reason).toBe('blocked-hostname');
  });

  it('metadata.google.internal 차단', async () => {
    const r = await assertSafeUrl('http://metadata.google.internal/');
    expect(r.safe).toBe(false);
    expect(r.reason).toBe('blocked-hostname');
  });
});

describe('assertSafeUrl — IP 리터럴', () => {
  it('127.0.0.1 차단', async () => {
    const r = await assertSafeUrl('http://127.0.0.1/');
    expect(r.safe).toBe(false);
    expect(r.reason).toBe('blocked-ip-literal');
  });

  it('169.254.169.254 차단 (AWS 메타)', async () => {
    const r = await assertSafeUrl('http://169.254.169.254/latest/meta-data/');
    expect(r.safe).toBe(false);
    expect(r.reason).toBe('blocked-ip-literal');
  });

  it('[::1] IPv6 차단', async () => {
    const r = await assertSafeUrl('http://[::1]/');
    expect(r.safe).toBe(false);
    expect(r.reason).toBe('blocked-ip-literal');
  });

  it('공인 IPv4 리터럴 통과', async () => {
    const r = await assertSafeUrl('http://8.8.8.8/');
    expect(r.safe).toBe(true);
    expect(r.resolvedIps).toEqual(['8.8.8.8']);
  });
});

describe('assertSafeUrl — DNS 해석', () => {
  it('정상 도메인 통과', async () => {
    const resolver = mockResolver({ 'example.com': ['93.184.216.34'] });
    const r = await assertSafeUrl('https://example.com/hook', { resolver });
    expect(r.safe).toBe(true);
    expect(r.resolvedIps).toEqual(['93.184.216.34']);
  });

  it('DNS 해석 결과 사설 IP → 차단', async () => {
    const resolver = mockResolver({ 'evil.example.com': ['10.0.0.1'] });
    const r = await assertSafeUrl('http://evil.example.com/', { resolver });
    expect(r.safe).toBe(false);
    expect(r.reason).toBe('blocked-resolved-ip');
  });

  it('혼합 DNS (공인+사설) → 차단 (fail-closed)', async () => {
    const resolver = mockResolver({ 'mixed.example.com': ['93.184.216.34', '127.0.0.1'] });
    const r = await assertSafeUrl('http://mixed.example.com/', { resolver });
    expect(r.safe).toBe(false);
    expect(r.reason).toBe('blocked-resolved-ip');
  });

  it('DNS 실패 → fail-closed', async () => {
    const resolver = mockResolver({ 'bad.example.com': 'error' });
    const r = await assertSafeUrl('http://bad.example.com/', { resolver });
    expect(r.safe).toBe(false);
    expect(r.reason).toBe('dns-failed');
  });

  it('DNS 레코드 없음 → fail-closed', async () => {
    const resolver = mockResolver({ 'empty.example.com': [] });
    const r = await assertSafeUrl('http://empty.example.com/', { resolver });
    expect(r.safe).toBe(false);
    expect(r.reason).toBe('no-dns-records');
  });

  it('DNS 타임아웃 → fail-closed', async () => {
    const resolver = mockResolver({ 'slow.example.com': 'hang' });
    const r = await assertSafeUrl('http://slow.example.com/', { resolver, timeoutMs: 20 });
    expect(r.safe).toBe(false);
    expect(r.reason).toBe('dns-timeout');
  });
});

describe('assertSafeUrl — 예외 허용', () => {
  it('allowedHostnames 에 등록된 호스트는 통과', async () => {
    const r = await assertSafeUrl('http://localhost/', { allowedHostnames: ['localhost'] });
    expect(r.safe).toBe(true);
  });
});

describe('assertSafeUrl — extraBlockedCidrs', () => {
  it('추가 차단 대역 반영', async () => {
    const resolver = mockResolver({ 'api.example.com': ['203.0.113.5'] });
    const r = await assertSafeUrl('https://api.example.com/', {
      resolver,
      extraBlockedCidrs: ['203.0.113.0/24'],
    });
    expect(r.safe).toBe(false);
    expect(r.reason).toBe('blocked-resolved-ip');
  });
});
