// URL 안전성 검증 (SSRF 방어)
// Plan SC: FR-IS.5, FR-IS.8
// CSAP: D-12, OWASP A10 SSRF

export interface SafeUrlOptions {
  /** 허용 scheme (default: ['http', 'https']) */
  allowedSchemes?: string[];
  /** 허용 호스트 화이트리스트 (지정 시 외 호스트 차단) */
  allowedHosts?: string[];
  /** 사설/루프백 IP 차단 (default: true) */
  blockPrivate?: boolean;
}

const DEFAULT_SCHEMES = ['http', 'https'];

/**
 * 외부 호출 전 URL이 안전한지 검증
 * Plan SC: FR-IS.5
 */
export function isSafeUrl(input: string, options: SafeUrlOptions = {}): boolean {
  if (typeof input !== 'string' || input.length === 0) return false;

  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    return false;
  }

  const allowedSchemes = (options.allowedSchemes ?? DEFAULT_SCHEMES).map((s) =>
    s.toLowerCase().replace(/:$/, ''),
  );
  const scheme = parsed.protocol.replace(/:$/, '').toLowerCase();
  if (!allowedSchemes.includes(scheme)) return false;

  const host = parsed.hostname.toLowerCase();
  if (host.length === 0) return false;

  if (options.allowedHosts && options.allowedHosts.length > 0) {
    const hosts = options.allowedHosts.map((h) => h.toLowerCase());
    if (!hosts.includes(host)) return false;
  }

  const blockPrivate = options.blockPrivate ?? true;
  if (blockPrivate && isPrivateIp(host)) return false;

  return true;
}

/**
 * 사설/루프백/링크로컬 IP 또는 localhost 탐지
 * Plan SC: FR-IS.8
 */
export function isPrivateIp(host: string): boolean {
  if (typeof host !== 'string' || host.length === 0) return false;
  const lower = host.toLowerCase().replace(/^\[|\]$/g, '');

  if (lower === 'localhost') return true;
  if (lower === '::1' || lower === '0:0:0:0:0:0:0:1') return true;
  if (lower === '::' || lower === '0.0.0.0') return true;

  // IPv4
  const v4 = lower.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const octets = v4.slice(1, 5).map((o) => parseInt(o, 10));
    if (octets.some((o) => Number.isNaN(o) || o < 0 || o > 255)) return false;
    const [a, b] = octets as [number, number, number, number];
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    return false;
  }

  // IPv6 사설/링크로컬: fc00::/7, fe80::/10
  if (/^f[cd][0-9a-f]{2}:/i.test(lower)) return true;
  if (/^fe[89ab][0-9a-f]:/i.test(lower)) return true;

  return false;
}
