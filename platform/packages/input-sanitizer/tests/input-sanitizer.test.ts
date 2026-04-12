// input-sanitizer 테스트
// Plan SC: FR-IS.1~FR-IS.8
// OWASP A03/A10 페이로드 검증

import { describe, it, expect } from 'vitest';
import {
  escapeHtml,
  escapeAttribute,
  safeFilename,
  containPath,
  isSafeUrl,
  isPrivateIp,
  stripControlChars,
  truncate,
} from '../src/index.js';

describe('FR-IS.1: escapeHtml', () => {
  it('6종 메타문자 변환', () => {
    expect(escapeHtml('&<>"\'/')).toBe(
      '&amp;&lt;&gt;&quot;&#39;&#x2F;',
    );
  });

  it('XSS 페이로드 차단', () => {
    const out = escapeHtml('<script>alert("x")</script>');
    expect(out).not.toContain('<script>');
    expect(out).toContain('&lt;script&gt;');
  });

  it('빈 문자열 처리', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('일반 텍스트는 변경 없음', () => {
    expect(escapeHtml('hello world')).toBe('hello world');
  });
});

describe('FR-IS.2: escapeAttribute', () => {
  it('= 변환', () => {
    expect(escapeAttribute('a=b')).toBe('a&#x3D;b');
  });

  it('백틱 변환', () => {
    expect(escapeAttribute('a`b')).toBe('a&#x60;b');
  });
});

describe('FR-IS.3: safeFilename', () => {
  it('Path Traversal 페이로드 → 안전', () => {
    const result = safeFilename('../../etc/passwd');
    expect(result).not.toContain('/');
    expect(result).not.toContain('..');
  });

  it('NUL 바이트 제거', () => {
    expect(safeFilename('file\u0000.txt')).toBe('file.txt');
  });

  it('Windows CON 예약어 회피', () => {
    const result = safeFilename('CON.txt');
    expect(result).not.toBe('CON.txt');
    expect(result.toUpperCase()).toContain('CON_');
  });

  it('255자 길이 제한', () => {
    const long = 'a'.repeat(300) + '.txt';
    const result = safeFilename(long);
    expect(result.length).toBeLessThanOrEqual(255);
    expect(result).toMatch(/\.txt$/);
  });

  it('빈 결과는 unnamed로 대체', () => {
    expect(safeFilename('\u0001\u0002\u0003')).toBe('unnamed');
  });

  it('다중 점 시퀀스는 _로 치환', () => {
    expect(safeFilename('...')).toBe('_');
  });

  it('숨김 파일 방지', () => {
    const result = safeFilename('.bashrc');
    expect(result.startsWith('.')).toBe(false);
  });
});

describe('FR-IS.4: containPath', () => {
  it('base 하위 경로 → true', () => {
    expect(containPath('/var/data', 'sub/file.txt')).toBe(true);
  });

  it('../ 탈출 시도 → false', () => {
    expect(containPath('/var/data', '../etc/passwd')).toBe(false);
  });

  it('절대경로 탈출 → false', () => {
    expect(containPath('/var/data', '/etc/passwd')).toBe(false);
  });

  it('base와 동일 경로 → true', () => {
    expect(containPath('/var/data', '.')).toBe(true);
  });

  it('빈 base → false', () => {
    expect(containPath('', 'x')).toBe(false);
  });
});

describe('FR-IS.5: isSafeUrl', () => {
  it('https URL → true', () => {
    expect(isSafeUrl('https://example.com/api')).toBe(true);
  });

  it('javascript: → false', () => {
    expect(isSafeUrl('javascript:alert(1)')).toBe(false);
  });

  it('file:/// → false', () => {
    expect(isSafeUrl('file:///etc/passwd')).toBe(false);
  });

  it('잘못된 URL → false', () => {
    expect(isSafeUrl('not a url')).toBe(false);
  });

  it('로컬 IP 차단 (default)', () => {
    expect(isSafeUrl('http://127.0.0.1/')).toBe(false);
    expect(isSafeUrl('http://192.168.1.1/')).toBe(false);
  });

  it('blockPrivate=false면 로컬 IP 허용', () => {
    expect(
      isSafeUrl('http://127.0.0.1/', { blockPrivate: false }),
    ).toBe(true);
  });

  it('allowedHosts 화이트리스트', () => {
    expect(
      isSafeUrl('https://api.example.com/', {
        allowedHosts: ['api.example.com'],
      }),
    ).toBe(true);
    expect(
      isSafeUrl('https://evil.com/', {
        allowedHosts: ['api.example.com'],
      }),
    ).toBe(false);
  });
});

describe('FR-IS.8: isPrivateIp', () => {
  it('192.168.x → true', () => {
    expect(isPrivateIp('192.168.1.1')).toBe(true);
  });

  it('10.x → true', () => {
    expect(isPrivateIp('10.0.0.1')).toBe(true);
  });

  it('172.16-31.x → true', () => {
    expect(isPrivateIp('172.16.0.1')).toBe(true);
    expect(isPrivateIp('172.31.255.255')).toBe(true);
  });

  it('172.32.x → false', () => {
    expect(isPrivateIp('172.32.0.1')).toBe(false);
  });

  it('169.254.x (link-local) → true', () => {
    expect(isPrivateIp('169.254.169.254')).toBe(true);
  });

  it('public IP → false', () => {
    expect(isPrivateIp('8.8.8.8')).toBe(false);
    expect(isPrivateIp('1.1.1.1')).toBe(false);
  });

  it('localhost → true', () => {
    expect(isPrivateIp('localhost')).toBe(true);
  });

  it('::1 → true', () => {
    expect(isPrivateIp('::1')).toBe(true);
  });

  it('IPv6 fc00::/7 → true', () => {
    expect(isPrivateIp('fc00::1')).toBe(true);
    expect(isPrivateIp('fd12:3456::1')).toBe(true);
  });
});

describe('FR-IS.6: stripControlChars', () => {
  it('NUL 제거', () => {
    expect(stripControlChars('a\u0000b')).toBe('ab');
  });

  it('CRLF 기본 제거', () => {
    expect(stripControlChars('a\r\nb')).toBe('ab');
  });

  it('keepNewline 옵션 보존', () => {
    expect(stripControlChars('a\nb', { keepNewline: true })).toBe('a\nb');
  });

  it('keepTab 옵션 보존', () => {
    expect(stripControlChars('a\tb', { keepTab: true })).toBe('a\tb');
  });

  it('일반 문자 보존', () => {
    expect(stripControlChars('hello한글')).toBe('hello한글');
  });

  it('DEL(0x7F) 제거', () => {
    expect(stripControlChars('a\u007fb')).toBe('ab');
  });
});

describe('FR-IS.7: truncate', () => {
  it('한글 안전 절단', () => {
    expect(truncate('가나다라마바', 3)).toBe('가나다');
  });

  it('이모지(서로게이트 페어) 안전', () => {
    const emoji = '😀😁😂';
    expect(truncate(emoji, 2)).toBe('😀😁');
  });

  it('max보다 짧으면 그대로', () => {
    expect(truncate('abc', 10)).toBe('abc');
  });

  it('max=0 → 빈 문자열', () => {
    expect(truncate('abc', 0)).toBe('');
  });

  it('음수 max → RangeError', () => {
    expect(() => truncate('a', -1)).toThrow(RangeError);
  });
});
