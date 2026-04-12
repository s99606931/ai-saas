// Hostname 사전 차단 판정
// Design Ref: SVC-NOTIFR2-R56.design.md §4
// Plan SC: FR-SSRF.1

const BLOCKED_HOSTNAMES = new Set<string>([
  'localhost',
  'ip6-localhost',
  'ip6-loopback',
  'metadata.google.internal',
  'metadata',
]);

/**
 * hostname 으로만 결정 가능한 차단 여부.
 * DNS 해석 없이 빠른 사전 필터.
 */
export function isBlockedHostname(hostname: string): boolean {
  if (typeof hostname !== 'string') return true;
  const h = hostname.toLowerCase().trim();
  if (h.length === 0) return true;
  if (BLOCKED_HOSTNAMES.has(h)) return true;
  if (h.endsWith('.local')) return true;
  if (h.endsWith('.localhost')) return true;
  if (h.endsWith('.internal')) return true;
  return false;
}

/**
 * hostname 이 IP 리터럴(숫자/hex 만으로 구성)인지 판별.
 */
export function isIpLiteral(hostname: string): boolean {
  // IPv6 브래킷
  if (hostname.startsWith('[') && hostname.endsWith(']')) return true;
  // IPv4 — 숫자와 '.'만
  if (/^[0-9.]+$/.test(hostname)) return true;
  // IPv6 — hex 와 ':' 포함
  if (/^[0-9a-fA-F:]+$/.test(hostname) && hostname.includes(':')) return true;
  return false;
}

/**
 * 브래킷 제거 (IPv6 URL 표기용)
 */
export function stripBrackets(hostname: string): string {
  if (hostname.startsWith('[') && hostname.endsWith(']')) {
    return hostname.slice(1, -1);
  }
  return hostname;
}
