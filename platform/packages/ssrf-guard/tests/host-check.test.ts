// host-check 단위 테스트
// Plan SC: FR-SSRF.1

import { describe, it, expect } from 'vitest';
import { isBlockedHostname, isIpLiteral, stripBrackets } from '../src/host-check.js';

describe('isBlockedHostname', () => {
  it('localhost 차단', () => {
    expect(isBlockedHostname('localhost')).toBe(true);
    expect(isBlockedHostname('LOCALHOST')).toBe(true);
  });

  it('.local 차단 (mDNS)', () => {
    expect(isBlockedHostname('server.local')).toBe(true);
  });

  it('.internal 차단 (GCE 레거시)', () => {
    expect(isBlockedHostname('metadata.google.internal')).toBe(true);
    expect(isBlockedHostname('foo.internal')).toBe(true);
  });

  it('.localhost 차단', () => {
    expect(isBlockedHostname('foo.localhost')).toBe(true);
  });

  it('빈 문자열 차단', () => {
    expect(isBlockedHostname('')).toBe(true);
    expect(isBlockedHostname('   ')).toBe(true);
  });

  it('일반 도메인 통과', () => {
    expect(isBlockedHostname('example.com')).toBe(false);
    expect(isBlockedHostname('api.public-saas.kr')).toBe(false);
  });

  it('metadata 단축 이름 차단', () => {
    expect(isBlockedHostname('metadata')).toBe(true);
  });
});

describe('isIpLiteral', () => {
  it('IPv4 리터럴', () => {
    expect(isIpLiteral('127.0.0.1')).toBe(true);
    expect(isIpLiteral('10.0.0.1')).toBe(true);
  });

  it('IPv6 브래킷', () => {
    expect(isIpLiteral('[::1]')).toBe(true);
  });

  it('IPv6 논브래킷', () => {
    expect(isIpLiteral('::1')).toBe(true);
    expect(isIpLiteral('2001:db8::1')).toBe(true);
  });

  it('도메인은 리터럴 아님', () => {
    expect(isIpLiteral('example.com')).toBe(false);
  });
});

describe('stripBrackets', () => {
  it('브래킷 제거', () => {
    expect(stripBrackets('[::1]')).toBe('::1');
  });

  it('브래킷 없으면 그대로', () => {
    expect(stripBrackets('example.com')).toBe('example.com');
  });
});
