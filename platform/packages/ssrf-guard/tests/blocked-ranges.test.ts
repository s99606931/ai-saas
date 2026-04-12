// blocked-ranges 단위 테스트
// Plan SC: FR-SSRF.3

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_BLOCKED_IPV4_CIDRS,
  DEFAULT_BLOCKED_IPV6_CIDRS,
  DEFAULT_BLOCKED_CIDRS,
} from '../src/blocked-ranges.js';
import { isIpInRange } from '@public-saas/cidr';

describe('DEFAULT_BLOCKED_*', () => {
  it('IPv4 목록 최소 9개', () => {
    expect(DEFAULT_BLOCKED_IPV4_CIDRS.length).toBeGreaterThanOrEqual(9);
  });

  it('IPv6 목록 최소 5개', () => {
    expect(DEFAULT_BLOCKED_IPV6_CIDRS.length).toBeGreaterThanOrEqual(5);
  });

  it('통합 목록은 v4+v6 합산', () => {
    expect(DEFAULT_BLOCKED_CIDRS.length).toBe(
      DEFAULT_BLOCKED_IPV4_CIDRS.length + DEFAULT_BLOCKED_IPV6_CIDRS.length,
    );
  });

  it('169.254.169.254 (AWS 메타데이터) 차단', () => {
    expect(isIpInRange('169.254.169.254', DEFAULT_BLOCKED_CIDRS)).toBe(true);
  });

  it('127.0.0.1 차단', () => {
    expect(isIpInRange('127.0.0.1', DEFAULT_BLOCKED_CIDRS)).toBe(true);
  });

  it('10.0.0.1 차단', () => {
    expect(isIpInRange('10.0.0.1', DEFAULT_BLOCKED_CIDRS)).toBe(true);
  });

  it('::1 차단', () => {
    expect(isIpInRange('::1', DEFAULT_BLOCKED_CIDRS)).toBe(true);
  });

  it('공인 IP 8.8.8.8 통과', () => {
    expect(isIpInRange('8.8.8.8', DEFAULT_BLOCKED_CIDRS)).toBe(false);
  });

  it('100.64.5.5 (CGN) 차단', () => {
    expect(isIpInRange('100.64.5.5', DEFAULT_BLOCKED_CIDRS)).toBe(true);
  });
});
