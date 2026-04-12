// HTTP Security Headers 테스트
// Plan SC: FR-HS.1~FR-HS.6

import { describe, it, expect } from 'vitest';
import {
  evaluateCors,
  buildCspHeader,
  buildHstsHeader,
  buildSecurityHeaders,
  defaultSecurityHeaders,
  type CorsOptions,
} from '../src/http-security.js';

describe('FR-HS.1: CORS 정책 평가', () => {
  const options: CorsOptions = {
    allowedOrigins: ['https://trusted.gov.kr'],
    allowedMethods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  };

  it('Origin 헤더 없으면 same-origin 통과', () => {
    const result = evaluateCors(
      { method: 'GET', headers: {} },
      options,
    );
    expect(result.allowed).toBe(true);
    expect(result.reason).toBe('same-origin');
  });

  it('허용된 origin 통과', () => {
    const result = evaluateCors(
      { method: 'GET', headers: { origin: 'https://trusted.gov.kr' } },
      options,
    );
    expect(result.allowed).toBe(true);
    expect(result.headers['Access-Control-Allow-Origin']).toBe('https://trusted.gov.kr');
    expect(result.headers['Access-Control-Allow-Credentials']).toBe('true');
    expect(result.headers['Vary']).toBe('Origin');
  });

  it('허용되지 않은 origin 거부', () => {
    const result = evaluateCors(
      { method: 'GET', headers: { origin: 'https://evil.com' } },
      options,
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('origin-not-allowed');
  });

  it('credentials + wildcard 조합 거부', () => {
    const result = evaluateCors(
      { method: 'GET', headers: { origin: 'https://any.com' } },
      { allowedOrigins: '*', credentials: true },
    );
    expect(result.allowed).toBe(false);
  });

  it('wildcard origin 허용 (credentials=false)', () => {
    const result = evaluateCors(
      { method: 'GET', headers: { origin: 'https://any.com' } },
      { allowedOrigins: '*' },
    );
    expect(result.allowed).toBe(true);
    expect(result.headers['Access-Control-Allow-Origin']).toBe('*');
  });

  it('함수 기반 origin 검증', () => {
    const result = evaluateCors(
      { method: 'GET', headers: { origin: 'https://sub.gov.kr' } },
      { allowedOrigins: (o) => o.endsWith('.gov.kr') },
    );
    expect(result.allowed).toBe(true);
  });
});

describe('FR-HS.5: Preflight OPTIONS', () => {
  const options: CorsOptions = {
    allowedOrigins: ['https://app.gov.kr'],
    allowedMethods: ['GET', 'POST', 'DELETE'],
    allowedHeaders: ['Content-Type', 'X-Token'],
    maxAge: 3600,
  };

  it('preflight 성공', () => {
    const result = evaluateCors(
      {
        method: 'OPTIONS',
        headers: {
          origin: 'https://app.gov.kr',
          'access-control-request-method': 'POST',
        },
      },
      options,
    );
    expect(result.isPreflight).toBe(true);
    expect(result.allowed).toBe(true);
    expect(result.headers['Access-Control-Allow-Methods']).toContain('POST');
    expect(result.headers['Access-Control-Allow-Headers']).toContain('X-Token');
    expect(result.headers['Access-Control-Max-Age']).toBe('3600');
  });

  it('허용되지 않은 메서드 preflight 거부', () => {
    const result = evaluateCors(
      {
        method: 'OPTIONS',
        headers: {
          origin: 'https://app.gov.kr',
          'access-control-request-method': 'TRACE',
        },
      },
      options,
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/method-not-allowed/);
  });
});

describe('FR-HS.2: CSP 헤더', () => {
  it('기본 지시자 빌드', () => {
    const csp = buildCspHeader({
      "default-src": ["'self'"],
      "script-src": ["'self'", 'https://cdn.example.com'],
    });
    expect(csp).toBe("default-src 'self'; script-src 'self' https://cdn.example.com");
  });

  it('플래그 지시자 (값 없음)', () => {
    const csp = buildCspHeader({
      "upgrade-insecure-requests": true,
      "block-all-mixed-content": true,
    });
    expect(csp).toContain('upgrade-insecure-requests');
    expect(csp).toContain('block-all-mixed-content');
  });
});

describe('FR-HS.3: HSTS 헤더', () => {
  it('기본 HSTS', () => {
    expect(buildHstsHeader({ maxAge: 31536000 })).toBe('max-age=31536000');
  });

  it('includeSubDomains + preload', () => {
    const hsts = buildHstsHeader({
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    });
    expect(hsts).toBe('max-age=31536000; includeSubDomains; preload');
  });

  it('음수 maxAge 거부', () => {
    expect(() => buildHstsHeader({ maxAge: -1 })).toThrow();
  });
});

describe('FR-HS.4: 통합 보안 헤더', () => {
  it('buildSecurityHeaders 기본 동작', () => {
    const headers = buildSecurityHeaders({
      frameOptions: 'DENY',
      hsts: { maxAge: 31536000, includeSubDomains: true },
    });
    expect(headers['X-Frame-Options']).toBe('DENY');
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['Strict-Transport-Security']).toContain('max-age=31536000');
  });

  it('contentTypeOptions=false면 nosniff 제외', () => {
    const headers = buildSecurityHeaders({ contentTypeOptions: false });
    expect(headers['X-Content-Type-Options']).toBeUndefined();
  });
});

describe('FR-HS.6: 기본 프리셋', () => {
  it('defaultSecurityHeaders는 공공기관 권장값', () => {
    const headers = defaultSecurityHeaders();
    expect(headers['Content-Security-Policy']).toContain("default-src 'self'");
    expect(headers['X-Frame-Options']).toBe('DENY');
    expect(headers['Strict-Transport-Security']).toContain('preload');
  });
});
