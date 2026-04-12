// SSRF Guard 메인 엔트리
// Design Ref: SVC-NOTIFR2-R56.design.md §6
// Plan SC: FR-SSRF.2, FR-SSRF.4, FR-SSRF.6

import { IpRangeMatcher } from '@public-saas/cidr';
import { DEFAULT_BLOCKED_CIDRS } from './blocked-ranges.js';
import { isBlockedHostname, isIpLiteral, stripBrackets } from './host-check.js';
import { nodeDnsResolver, type DnsResolver } from './dns-resolver.js';

const DEFAULT_TIMEOUT_MS = 1000;

export interface SsrfGuardOptions {
  resolver?: DnsResolver;
  extraBlockedCidrs?: readonly string[];
  allowedHostnames?: readonly string[];
  timeoutMs?: number;
}

export type SsrfReason =
  | 'invalid-url'
  | 'disallowed-protocol'
  | 'blocked-hostname'
  | 'blocked-ip-literal'
  | 'invalid-ip-literal'
  | 'dns-failed'
  | 'dns-timeout'
  | 'no-dns-records'
  | 'blocked-resolved-ip';

export interface SsrfCheckResult {
  safe: boolean;
  reason?: SsrfReason;
  resolvedIps?: readonly string[];
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

/**
 * URL이 SSRF 관점에서 안전한지 검증.
 * fail-closed: 모든 실패/타임아웃은 safe=false.
 * Plan SC: FR-SSRF.4
 */
export async function assertSafeUrl(
  urlString: string,
  options: SsrfGuardOptions = {},
): Promise<SsrfCheckResult> {
  // 1) URL 파싱
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    return { safe: false, reason: 'invalid-url' };
  }

  // 2) 프로토콜 제한
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { safe: false, reason: 'disallowed-protocol' };
  }

  const rawHost = parsed.hostname;

  // 3) 예외 허용 (완전 일치)
  if (options.allowedHostnames && options.allowedHostnames.includes(rawHost.toLowerCase())) {
    return { safe: true };
  }

  // 4) hostname 사전 차단
  if (isBlockedHostname(rawHost)) {
    return { safe: false, reason: 'blocked-hostname' };
  }

  // 5) 차단 매처 구성
  const matcher = new IpRangeMatcher().addMany([
    ...DEFAULT_BLOCKED_CIDRS,
    ...(options.extraBlockedCidrs ?? []),
  ]);

  // 6) IP 리터럴이면 바로 판정
  if (isIpLiteral(rawHost)) {
    const literal = stripBrackets(rawHost);
    try {
      if (matcher.contains(literal)) {
        return { safe: false, reason: 'blocked-ip-literal', resolvedIps: [literal] };
      }
      return { safe: true, resolvedIps: [literal] };
    } catch {
      return { safe: false, reason: 'invalid-ip-literal' };
    }
  }

  // 7) DNS 해석 (타임아웃 + fail-closed)
  const resolver = options.resolver ?? nodeDnsResolver;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  let ips: string[];
  try {
    ips = await withTimeout(resolver.resolve(rawHost), timeoutMs);
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === 'timeout') {
      return { safe: false, reason: 'dns-timeout' };
    }
    return { safe: false, reason: 'dns-failed' };
  }

  if (ips.length === 0) {
    return { safe: false, reason: 'no-dns-records' };
  }

  // 8) 모든 IP 가 차단 범위에 있으면 안 됨
  for (const ip of ips) {
    try {
      if (matcher.contains(ip)) {
        return { safe: false, reason: 'blocked-resolved-ip', resolvedIps: ips };
      }
    } catch {
      return { safe: false, reason: 'blocked-resolved-ip', resolvedIps: ips };
    }
  }

  return { safe: true, resolvedIps: ips };
}
