// cidr.ts 단위 테스트
// Plan SC: FR-CIDR.1, FR-CIDR.2, FR-CIDR.3, FR-CIDR.7

import { describe, it, expect } from 'vitest';
import {
  parseCidr,
  matchCidr,
  IpRangeMatcher,
  isIpInRange,
} from '../src/cidr.js';

describe('parseCidr', () => {
  it('IPv4 /24 파싱', () => {
    const p = parseCidr('192.168.1.0/24');
    expect(p.family).toBe('v4');
    expect(p.prefixLength).toBe(24);
  });

  it('IPv4 /0 허용', () => {
    expect(parseCidr('0.0.0.0/0').prefixLength).toBe(0);
  });

  it('IPv4 /32 허용', () => {
    expect(parseCidr('10.0.0.1/32').prefixLength).toBe(32);
  });

  it('IPv6 /64 파싱', () => {
    const p = parseCidr('2001:db8::/64');
    expect(p.family).toBe('v6');
    expect(p.prefixLength).toBe(64);
  });

  it('IPv4 prefix 범위 초과 거부', () => {
    expect(() => parseCidr('10.0.0.0/33')).toThrow(RangeError);
  });

  it('IPv6 prefix 범위 초과 거부', () => {
    expect(() => parseCidr('::/129')).toThrow(RangeError);
  });

  it('"/" 없는 입력 거부', () => {
    expect(() => parseCidr('10.0.0.0')).toThrow(RangeError);
  });

  it('빈 prefix 거부', () => {
    expect(() => parseCidr('10.0.0.0/')).toThrow(RangeError);
  });
});

describe('matchCidr — IPv4', () => {
  it('10.0.0.0/8 은 10.1.2.3 을 포함', () => {
    expect(matchCidr('10.1.2.3', '10.0.0.0/8')).toBe(true);
  });

  it('10.0.0.0/8 은 11.0.0.1 을 포함하지 않음', () => {
    expect(matchCidr('11.0.0.1', '10.0.0.0/8')).toBe(false);
  });

  it('192.168.1.0/24 경계 상단', () => {
    expect(matchCidr('192.168.1.255', '192.168.1.0/24')).toBe(true);
  });

  it('192.168.1.0/24 경계 초과', () => {
    expect(matchCidr('192.168.2.0', '192.168.1.0/24')).toBe(false);
  });

  it('/32 정확히 한 주소만', () => {
    expect(matchCidr('10.0.0.1', '10.0.0.1/32')).toBe(true);
    expect(matchCidr('10.0.0.2', '10.0.0.1/32')).toBe(false);
  });

  it('/0 은 모든 IPv4 허용', () => {
    expect(matchCidr('1.2.3.4', '0.0.0.0/0')).toBe(true);
    expect(matchCidr('255.255.255.255', '0.0.0.0/0')).toBe(true);
  });

  it('v4 IP를 v6 CIDR로 검사 → false', () => {
    expect(matchCidr('10.0.0.1', '2001:db8::/32')).toBe(false);
  });
});

describe('matchCidr — IPv6', () => {
  it('2001:db8::/32 는 2001:db8:1::1 포함', () => {
    expect(matchCidr('2001:db8:1::1', '2001:db8::/32')).toBe(true);
  });

  it('2001:db8::/32 는 2001:db9::1 불포함', () => {
    expect(matchCidr('2001:db9::1', '2001:db8::/32')).toBe(false);
  });

  it('/128 정확히 한 주소', () => {
    expect(matchCidr('::1', '::1/128')).toBe(true);
    expect(matchCidr('::2', '::1/128')).toBe(false);
  });

  it('::/0 은 모든 IPv6 허용', () => {
    expect(matchCidr('2001:db8::1', '::/0')).toBe(true);
    expect(matchCidr('::', '::/0')).toBe(true);
  });

  it('v6 IP를 v4 CIDR로 검사 → false', () => {
    expect(matchCidr('::1', '10.0.0.0/8')).toBe(false);
  });
});

describe('IpRangeMatcher', () => {
  it('add / contains 동작', () => {
    const m = new IpRangeMatcher();
    m.add('10.0.0.0/8').add('192.168.0.0/16');
    expect(m.contains('10.1.2.3')).toBe(true);
    expect(m.contains('192.168.1.1')).toBe(true);
    expect(m.contains('172.16.0.1')).toBe(false);
  });

  it('addMany 동작', () => {
    const m = new IpRangeMatcher().addMany(['10.0.0.0/8', '::1/128']);
    expect(m.size()).toBe(2);
    expect(m.contains('10.0.0.1')).toBe(true);
    expect(m.contains('::1')).toBe(true);
  });

  it('빈 매처는 항상 false', () => {
    expect(new IpRangeMatcher().contains('10.0.0.1')).toBe(false);
  });

  it('빈 IP 문자열 → false', () => {
    const m = new IpRangeMatcher().add('0.0.0.0/0');
    expect(m.contains('')).toBe(false);
  });
});

describe('isIpInRange', () => {
  it('목록 중 하나라도 매칭되면 true', () => {
    expect(isIpInRange('10.0.0.1', ['192.168.0.0/16', '10.0.0.0/8'])).toBe(true);
  });

  it('매칭 없으면 false', () => {
    expect(isIpInRange('172.16.0.1', ['10.0.0.0/8', '192.168.0.0/16'])).toBe(false);
  });

  it('빈 목록 → false', () => {
    expect(isIpInRange('10.0.0.1', [])).toBe(false);
  });
});
