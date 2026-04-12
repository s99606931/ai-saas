// parse.ts 단위 테스트
// Plan SC: FR-CIDR.4, FR-CIDR.5, FR-CIDR.6

import { describe, it, expect } from 'vitest';
import { parseIpv4, parseIpv6, detectFamily } from '../src/parse.js';

describe('parseIpv4', () => {
  it('0.0.0.0 → 0', () => {
    expect(parseIpv4('0.0.0.0')).toBe(0);
  });

  it('255.255.255.255 → 0xFFFFFFFF (unsigned)', () => {
    expect(parseIpv4('255.255.255.255')).toBe(0xffffffff);
  });

  it('10.0.0.1 → 정확한 비트값', () => {
    // 10 * 256^3 + 0 + 0 + 1
    expect(parseIpv4('10.0.0.1')).toBe(10 * 256 * 256 * 256 + 1);
  });

  it('192.168.1.100 파싱', () => {
    const n = parseIpv4('192.168.1.100');
    expect(n).toBe(((192 << 24) >>> 0) + (168 << 16) + (1 << 8) + 100);
  });

  it('잘못된 형식: 옥텟 부족', () => {
    expect(() => parseIpv4('1.2.3')).toThrow(RangeError);
  });

  it('잘못된 형식: 범위 초과', () => {
    expect(() => parseIpv4('256.0.0.0')).toThrow(RangeError);
  });

  it('잘못된 형식: 비숫자', () => {
    expect(() => parseIpv4('1.2.3.a')).toThrow(RangeError);
  });

  it('null 입력 거부', () => {
    expect(() => parseIpv4(null as unknown as string)).toThrow(TypeError);
  });
});

describe('parseIpv6', () => {
  it('::1 → 1n', () => {
    expect(parseIpv6('::1')).toBe(1n);
  });

  it(':: → 0n', () => {
    expect(parseIpv6('::')).toBe(0n);
  });

  it('2001:db8::1 파싱', () => {
    const n = parseIpv6('2001:db8::1');
    // 2001:0db8:0000:0000:0000:0000:0000:0001
    const expected = (0x2001n << 112n) | (0x0db8n << 96n) | 1n;
    expect(n).toBe(expected);
  });

  it('완전 표기 지원', () => {
    const n = parseIpv6('0000:0000:0000:0000:0000:0000:0000:0001');
    expect(n).toBe(1n);
  });

  it('대문자 정규화', () => {
    expect(parseIpv6('2001:DB8::1')).toBe(parseIpv6('2001:db8::1'));
  });

  it('브래킷 표기 [::1]', () => {
    expect(parseIpv6('[::1]')).toBe(1n);
  });

  it('복수 :: 거부', () => {
    expect(() => parseIpv6('1::2::3')).toThrow(RangeError);
  });

  it('그룹 수 초과 거부', () => {
    expect(() => parseIpv6('1:2:3:4:5:6:7:8:9')).toThrow(RangeError);
  });

  it('잘못된 hex 그룹', () => {
    expect(() => parseIpv6('zzzz::1')).toThrow(RangeError);
  });

  it('ffff:... 최댓값', () => {
    const full = 'ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff';
    expect(parseIpv6(full)).toBe((1n << 128n) - 1n);
  });
});

describe('detectFamily', () => {
  it('v4 감지', () => {
    expect(detectFamily('1.2.3.4')).toBe('v4');
  });

  it('v6 감지', () => {
    expect(detectFamily('::1')).toBe('v6');
  });
});
