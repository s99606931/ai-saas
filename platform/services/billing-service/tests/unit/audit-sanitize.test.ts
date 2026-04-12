// audit.ts sanitize 함수 단위 테스트
// Plan SC: FR-BILLR2.4

import { describe, it, expect } from 'vitest';
import { sanitizeUserAgent, sanitizeIp } from '../../src/lib/audit.js';

describe('sanitizeUserAgent', () => {
  it('undefined → "unknown"', () => {
    expect(sanitizeUserAgent(undefined)).toBe('unknown');
  });

  it('null → "unknown"', () => {
    expect(sanitizeUserAgent(null)).toBe('unknown');
  });

  it('제어문자 제거', () => {
    const input = 'Mozilla\u0000/5.0\r\n injected';
    expect(sanitizeUserAgent(input)).toBe('Mozilla/5.0 injected');
  });

  it('DEL (0x7f) 제거', () => {
    expect(sanitizeUserAgent('agent\u007fX')).toBe('agentX');
  });

  it('500자 초과 절단', () => {
    const long = 'a'.repeat(600);
    const result = sanitizeUserAgent(long);
    expect(result.length).toBe(500);
  });

  it('500자 이하 유지', () => {
    const input = 'Mozilla/5.0';
    expect(sanitizeUserAgent(input)).toBe('Mozilla/5.0');
  });

  it('빈 문자열 (제어문자만) → "unknown"', () => {
    expect(sanitizeUserAgent('\u0000\u0001\u0002')).toBe('unknown');
  });
});

describe('sanitizeIp', () => {
  it('undefined → "unknown"', () => {
    expect(sanitizeIp(undefined)).toBe('unknown');
  });

  it('IPv4 유효', () => {
    expect(sanitizeIp('192.168.1.1')).toBe('192.168.1.1');
  });

  it('IPv6 유효', () => {
    expect(sanitizeIp('2001:db8::1')).toBe('2001:db8::1');
  });

  it('::1 유효', () => {
    expect(sanitizeIp('::1')).toBe('::1');
  });

  it('공백 포함 → "invalid"', () => {
    expect(sanitizeIp('192.168 .1.1')).toBe('invalid');
  });

  it('알파벳(비 hex) → "invalid"', () => {
    expect(sanitizeIp('10.0.0.xyz')).toBe('invalid');
  });

  it('매우 긴 문자열 → "invalid"', () => {
    expect(sanitizeIp('1'.repeat(100))).toBe('invalid');
  });

  it('빈 문자열 → "unknown"', () => {
    expect(sanitizeIp('')).toBe('unknown');
  });
});
