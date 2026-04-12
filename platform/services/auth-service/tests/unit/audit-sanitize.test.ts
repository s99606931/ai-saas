// 감사 로그 입력 위생화 유닛 테스트
// Design Ref: SVC-AUTHR2-R50.design.md §3.2
// Plan SC: FR-AUTHR2.4

import { describe, it, expect } from 'vitest';
import { sanitizeIp, sanitizeUserAgent } from '../../src/lib/audit.js';

// ---------- sanitizeUserAgent ----------

describe('sanitizeUserAgent (FR-AUTHR2.4)', () => {
  it('undefined 또는 빈 값은 unknown을 반환한다', () => {
    expect(sanitizeUserAgent(undefined)).toBe('unknown');
    expect(sanitizeUserAgent('')).toBe('unknown');
  });

  it('일반 UA 문자열은 그대로 반환한다', () => {
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
    expect(sanitizeUserAgent(ua)).toBe(ua);
  });

  it('제어문자를 제거한다 (로그 인젝션 방어)', () => {
    // 0x1b = ESC, 0x07 = BEL, 0x0a = LF
    const ua = 'Mozilla/5.0\x1b[31mFAKE\x07\nNewline';
    const result = sanitizeUserAgent(ua);
    expect(result).not.toContain('\x1b');
    expect(result).not.toContain('\x07');
    expect(result).not.toContain('\n');
    expect(result).toContain('Mozilla/5.0');
  });

  it('500자 초과 시 truncate한다', () => {
    const long = 'A'.repeat(600);
    const result = sanitizeUserAgent(long);
    expect(result.length).toBe(500);
  });

  it('제어문자만 있는 입력은 unknown을 반환한다', () => {
    expect(sanitizeUserAgent('\x00\x01\x02')).toBe('unknown');
  });
});

// ---------- sanitizeIp ----------

describe('sanitizeIp (FR-AUTHR2.4)', () => {
  it('유효한 IPv4 주소를 반환한다', () => {
    expect(sanitizeIp('203.0.113.42')).toBe('203.0.113.42');
  });

  it('유효한 IPv6 주소를 반환한다', () => {
    expect(sanitizeIp('2001:db8::1')).toBe('2001:db8::1');
  });

  it('허용 문자 외 입력은 unknown을 반환한다', () => {
    expect(sanitizeIp('invalid<script>')).toBe('unknown');
    expect(sanitizeIp('1.2.3.4; DROP TABLE')).toBe('unknown');
  });

  it('undefined/빈 문자열은 unknown을 반환한다', () => {
    expect(sanitizeIp(undefined)).toBe('unknown');
    expect(sanitizeIp('')).toBe('unknown');
  });

  it('길이가 3자 미만이거나 45자 초과면 unknown을 반환한다', () => {
    expect(sanitizeIp('1')).toBe('unknown');
    expect(sanitizeIp('1'.repeat(46))).toBe('unknown');
  });
});
