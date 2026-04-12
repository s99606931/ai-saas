# SVC-NOTIFR2-R56 Design — SSRF Guard

> **작성일**: 2026-04-11

## 1. 패키지 구조

```
platform/packages/ssrf-guard/
├── package.json
├── tsconfig.json
├── src/
│   ├── blocked-ranges.ts   # 기본 차단 CIDR 목록
│   ├── host-check.ts       # hostname 사전 판정
│   ├── dns-resolver.ts     # DNS lookup 인터페이스
│   ├── guard.ts            # assertSafeUrl 메인
│   └── index.ts
└── tests/
    ├── host-check.test.ts
    ├── guard.test.ts
    └── blocked-ranges.test.ts
```

## 2. 타입

```ts
export interface DnsResolver {
  resolve(hostname: string): Promise<string[]>;  // A + AAAA 합친 결과
}

export interface SsrfGuardOptions {
  resolver?: DnsResolver;
  extraBlockedCidrs?: readonly string[];
  allowedHostnames?: readonly string[];  // 예외: 특정 호스트 허용
  timeoutMs?: number;
}

export interface SsrfCheckResult {
  safe: boolean;
  reason?: string;
  resolvedIps?: readonly string[];
}
```

## 3. blocked-ranges.ts

```ts
export const DEFAULT_BLOCKED_IPV4_CIDRS = [
  '0.0.0.0/8', '10.0.0.0/8', '100.64.0.0/10', '127.0.0.0/8',
  '169.254.0.0/16', '172.16.0.0/12', '192.0.0.0/24',
  '192.168.0.0/16', '198.18.0.0/15',
] as const;

export const DEFAULT_BLOCKED_IPV6_CIDRS = [
  '::/128', '::1/128', 'fc00::/7', 'fe80::/10', 'ff00::/8',
] as const;

export const DEFAULT_BLOCKED_CIDRS = [
  ...DEFAULT_BLOCKED_IPV4_CIDRS,
  ...DEFAULT_BLOCKED_IPV6_CIDRS,
];
```

## 4. host-check.ts

```ts
const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'ip6-localhost',
  'ip6-loopback',
  'metadata.google.internal',
  'metadata',
]);

export function isBlockedHostname(hostname: string): boolean {
  const h = hostname.toLowerCase().trim();
  if (h.length === 0) return true;
  if (BLOCKED_HOSTNAMES.has(h)) return true;
  if (h.endsWith('.local')) return true;
  if (h.endsWith('.localhost')) return true;
  if (h.endsWith('.internal')) return true;
  return false;
}
```

## 5. dns-resolver.ts

```ts
import { promises as dns } from 'node:dns';

export const nodeDnsResolver: DnsResolver = {
  async resolve(hostname) {
    const [a, aaaa] = await Promise.allSettled([
      dns.resolve4(hostname),
      dns.resolve6(hostname),
    ]);
    const ips: string[] = [];
    if (a.status === 'fulfilled') ips.push(...a.value);
    if (aaaa.status === 'fulfilled') ips.push(...aaaa.value);
    return ips;
  },
};
```

## 6. guard.ts

```ts
import { IpRangeMatcher } from '@public-saas/cidr';
import { isBlockedHostname } from './host-check.js';
import { DEFAULT_BLOCKED_CIDRS } from './blocked-ranges.js';
import { nodeDnsResolver, type DnsResolver } from './dns-resolver.js';

const DEFAULT_TIMEOUT_MS = 1000;

export async function assertSafeUrl(
  urlString: string,
  options: SsrfGuardOptions = {},
): Promise<SsrfCheckResult> {
  // 1) URL 파싱
  let parsed: URL;
  try { parsed = new URL(urlString); }
  catch { return { safe: false, reason: 'invalid-url' }; }

  // 2) 프로토콜
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { safe: false, reason: 'disallowed-protocol' };
  }

  const hostname = parsed.hostname;

  // 3) 예외 허용
  if (options.allowedHostnames?.includes(hostname.toLowerCase())) {
    return { safe: true };
  }

  // 4) hostname 사전 차단
  if (isBlockedHostname(hostname)) {
    return { safe: false, reason: 'blocked-hostname' };
  }

  // 5) IP 리터럴이면 바로 검사
  const matcher = new IpRangeMatcher().addMany([
    ...DEFAULT_BLOCKED_CIDRS,
    ...(options.extraBlockedCidrs ?? []),
  ]);

  if (isIpLiteral(hostname)) {
    const literal = stripBrackets(hostname);
    if (matcher.contains(literal)) {
      return { safe: false, reason: 'blocked-ip-literal', resolvedIps: [literal] };
    }
    return { safe: true, resolvedIps: [literal] };
  }

  // 6) DNS 해석 (타임아웃)
  const resolver = options.resolver ?? nodeDnsResolver;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let ips: string[];
  try {
    ips = await withTimeout(resolver.resolve(hostname), timeoutMs);
  } catch {
    return { safe: false, reason: 'dns-failed' };
  }
  if (ips.length === 0) {
    return { safe: false, reason: 'no-dns-records' };
  }

  // 7) 모든 IP가 허용 범위여야 통과
  for (const ip of ips) {
    if (matcher.contains(ip)) {
      return { safe: false, reason: 'blocked-resolved-ip', resolvedIps: ips };
    }
  }
  return { safe: true, resolvedIps: ips };
}
```

## 7. notification webhook-sender 통합

`sendWebhook` 진입부를 다음으로 교체:

```ts
import { assertSafeUrl } from '@public-saas/ssrf-guard';

const check = await assertSafeUrl(webhookUrl);
if (!check.safe) {
  return { success: false, attempts: 0, error: `SSRF_BLOCKED: ${check.reason}` };
}
```

기존 `isInternalUrl` 함수 삭제 (dead code).

## 8. 테스트 계획 (20+)

- host-check: 7 (localhost, .local, .internal, 메타데이터, 빈 문자열, 대소문자, 일반 도메인)
- blocked-ranges: 3 (v4 목록 배열, v6 목록 배열, 포함 검증)
- guard: 14 (invalid url, ftp, allowed override, ip literal v4 block, ip literal v6 block, ip literal 정상, dns mock 차단, dns mock 통과, dns mock mixed, dns failure, dns timeout, no records, hostname localhost, hostname .internal)

## 변경 이력

| 버전 | 일자 | 내용 |
|------|------|------|
| 1.0.0 | 2026-04-11 | 최초 작성 |
