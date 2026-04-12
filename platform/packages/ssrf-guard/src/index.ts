// @public-saas/ssrf-guard — DNS 해석 + CIDR 기반 SSRF 방어
// Design Ref: SVC-NOTIFR2-R56.design.md
// Plan: SVC-NOTIFR2-R56.plan.md

export {
  DEFAULT_BLOCKED_CIDRS,
  DEFAULT_BLOCKED_IPV4_CIDRS,
  DEFAULT_BLOCKED_IPV6_CIDRS,
} from './blocked-ranges.js';
export { isBlockedHostname, isIpLiteral, stripBrackets } from './host-check.js';
export { nodeDnsResolver, type DnsResolver } from './dns-resolver.js';
export {
  assertSafeUrl,
  type SsrfGuardOptions,
  type SsrfCheckResult,
  type SsrfReason,
} from './guard.js';
