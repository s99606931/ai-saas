// HTTP Security Headers -- CORS, CSP, HSTS, X-Frame-Options
// Design Ref: SVC-HTTPSEC-R38 DESIGN
// Plan SC: FR-HS.1~FR-HS.6
// CSAP: D-12 개발보안

export type OriginPredicate = (origin: string) => boolean;

export interface CorsOptions {
  /** 허용할 origin 목록. '*' 또는 string[] 또는 함수 */
  allowedOrigins: '*' | string[] | OriginPredicate;
  /** 허용할 HTTP 메서드 */
  allowedMethods?: string[];
  /** 허용할 요청 헤더 */
  allowedHeaders?: string[];
  /** 노출할 응답 헤더 */
  exposedHeaders?: string[];
  /** credentials 포함 허용 */
  credentials?: boolean;
  /** preflight 캐시 시간 (초) */
  maxAge?: number;
}

export interface CorsRequest {
  method: string;
  headers: Record<string, string | undefined>;
}

export interface CorsResult {
  allowed: boolean;
  isPreflight: boolean;
  headers: Record<string, string>;
  reason?: string;
}

const DEFAULT_METHODS = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];

/**
 * CORS 정책 평가
 * Plan SC: FR-HS.1, FR-HS.5
 */
export function evaluateCors(request: CorsRequest, options: CorsOptions): CorsResult {
  const origin = request.headers['origin'] ?? request.headers['Origin'];
  const method = request.method.toUpperCase();
  const isPreflight =
    method === 'OPTIONS' &&
    !!(request.headers['access-control-request-method'] ?? request.headers['Access-Control-Request-Method']);

  if (!origin) {
    return { allowed: true, isPreflight, headers: {}, reason: 'same-origin' };
  }

  // credentials + wildcard 동시 사용 금지
  if (options.credentials && options.allowedOrigins === '*') {
    return {
      allowed: false,
      isPreflight,
      headers: {},
      reason: 'credentials는 wildcard origin과 함께 사용할 수 없습니다',
    };
  }

  // origin 허용 여부
  let originAllowed = false;
  if (options.allowedOrigins === '*') {
    originAllowed = true;
  } else if (Array.isArray(options.allowedOrigins)) {
    originAllowed = options.allowedOrigins.includes(origin);
  } else if (typeof options.allowedOrigins === 'function') {
    originAllowed = options.allowedOrigins(origin);
  }

  if (!originAllowed) {
    return { allowed: false, isPreflight, headers: {}, reason: 'origin-not-allowed' };
  }

  const allowedMethods = options.allowedMethods ?? DEFAULT_METHODS;
  const headers: Record<string, string> = {
    'Access-Control-Allow-Origin': options.allowedOrigins === '*' ? '*' : origin,
  };

  if (options.credentials) {
    headers['Access-Control-Allow-Credentials'] = 'true';
    headers['Vary'] = 'Origin';
  } else if (options.allowedOrigins !== '*') {
    headers['Vary'] = 'Origin';
  }

  if (options.exposedHeaders && options.exposedHeaders.length > 0) {
    headers['Access-Control-Expose-Headers'] = options.exposedHeaders.join(', ');
  }

  if (isPreflight) {
    const reqMethod = (
      request.headers['access-control-request-method'] ??
      request.headers['Access-Control-Request-Method'] ??
      ''
    ).toUpperCase();

    if (!allowedMethods.map((m) => m.toUpperCase()).includes(reqMethod)) {
      return {
        allowed: false,
        isPreflight: true,
        headers: {},
        reason: `method-not-allowed: ${reqMethod}`,
      };
    }

    headers['Access-Control-Allow-Methods'] = allowedMethods.join(', ');
    if (options.allowedHeaders && options.allowedHeaders.length > 0) {
      headers['Access-Control-Allow-Headers'] = options.allowedHeaders.join(', ');
    }
    if (typeof options.maxAge === 'number') {
      headers['Access-Control-Max-Age'] = String(options.maxAge);
    }
  }

  return { allowed: true, isPreflight, headers };
}

/**
 * Content Security Policy 헤더 생성
 * Plan SC: FR-HS.2
 */
export type CspDirectives = Record<string, string[] | true>;

export function buildCspHeader(directives: CspDirectives): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(directives)) {
    if (value === true) {
      parts.push(key);
    } else if (Array.isArray(value)) {
      parts.push(`${key} ${value.join(' ')}`);
    }
  }
  return parts.join('; ');
}

/**
 * HSTS 헤더 생성
 * Plan SC: FR-HS.3
 */
export interface HstsOptions {
  maxAge: number;
  includeSubDomains?: boolean;
  preload?: boolean;
}

export function buildHstsHeader(options: HstsOptions): string {
  if (options.maxAge < 0 || !Number.isFinite(options.maxAge)) {
    throw new Error('maxAge는 0 이상의 유한 숫자여야 합니다.');
  }
  const parts = [`max-age=${Math.floor(options.maxAge)}`];
  if (options.includeSubDomains) parts.push('includeSubDomains');
  if (options.preload) parts.push('preload');
  return parts.join('; ');
}

/**
 * 통합 보안 헤더 빌더
 * Plan SC: FR-HS.4, FR-HS.6
 */
export interface SecurityHeadersOptions {
  csp?: CspDirectives;
  hsts?: HstsOptions;
  frameOptions?: 'DENY' | 'SAMEORIGIN';
  contentTypeOptions?: boolean;
  referrerPolicy?: string;
  permissionsPolicy?: string;
}

export function buildSecurityHeaders(options: SecurityHeadersOptions = {}): Record<string, string> {
  const headers: Record<string, string> = {};

  if (options.csp) {
    headers['Content-Security-Policy'] = buildCspHeader(options.csp);
  }
  if (options.hsts) {
    headers['Strict-Transport-Security'] = buildHstsHeader(options.hsts);
  }
  if (options.frameOptions) {
    headers['X-Frame-Options'] = options.frameOptions;
  }
  if (options.contentTypeOptions !== false) {
    headers['X-Content-Type-Options'] = 'nosniff';
  }
  if (options.referrerPolicy) {
    headers['Referrer-Policy'] = options.referrerPolicy;
  } else {
    headers['Referrer-Policy'] = 'strict-origin-when-cross-origin';
  }
  if (options.permissionsPolicy) {
    headers['Permissions-Policy'] = options.permissionsPolicy;
  }

  return headers;
}

/**
 * 기본 보안 헤더 프리셋 (공공기관 권장)
 */
export function defaultSecurityHeaders(): Record<string, string> {
  return buildSecurityHeaders({
    csp: {
      "default-src": ["'self'"],
      "script-src": ["'self'"],
      "style-src": ["'self'", "'unsafe-inline'"],
      "img-src": ["'self'", 'data:'],
      "connect-src": ["'self'"],
      "frame-ancestors": ["'none'"],
    },
    hsts: { maxAge: 31_536_000, includeSubDomains: true, preload: true },
    frameOptions: 'DENY',
    contentTypeOptions: true,
    referrerPolicy: 'strict-origin-when-cross-origin',
  });
}
