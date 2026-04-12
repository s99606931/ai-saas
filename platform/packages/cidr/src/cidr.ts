// CIDR 파싱 및 매칭
// Design Ref: SVC-CIDR-R54.design.md §2.2, §2.3, §2.4
// Plan SC: FR-CIDR.1, FR-CIDR.2, FR-CIDR.3, FR-CIDR.7

import { parseIpv4, parseIpv6, detectFamily, type IpFamily } from './parse.js';

export interface ParsedCidr {
  family: IpFamily;
  /** v4: 32비트 number, v6: 128비트 bigint */
  address: number | bigint;
  prefixLength: number;
}

const V6_FULL_MASK = (1n << 128n) - 1n;

/**
 * CIDR 표기법을 파싱한다.
 * Plan SC: FR-CIDR.1
 */
export function parseCidr(cidr: string): ParsedCidr {
  if (typeof cidr !== 'string') {
    throw new TypeError('parseCidr: expected string');
  }
  const slashIdx = cidr.indexOf('/');
  if (slashIdx < 0) {
    throw new RangeError(`parseCidr: missing prefix "/" in "${cidr}"`);
  }
  const addr = cidr.slice(0, slashIdx);
  const prefixStr = cidr.slice(slashIdx + 1);
  if (addr.length === 0 || prefixStr.length === 0) {
    throw new RangeError(`parseCidr: invalid CIDR "${cidr}"`);
  }
  if (!/^\d+$/.test(prefixStr)) {
    throw new RangeError(`parseCidr: invalid prefix "${prefixStr}"`);
  }
  const prefix = parseInt(prefixStr, 10);

  const family = detectFamily(addr);
  if (family === 'v6') {
    if (prefix < 0 || prefix > 128) {
      throw new RangeError(`parseCidr: IPv6 prefix out of range 0..128: ${prefix}`);
    }
    return { family: 'v6', address: parseIpv6(addr), prefixLength: prefix };
  } else {
    if (prefix < 0 || prefix > 32) {
      throw new RangeError(`parseCidr: IPv4 prefix out of range 0..32: ${prefix}`);
    }
    return { family: 'v4', address: parseIpv4(addr), prefixLength: prefix };
  }
}

/**
 * IPv4 prefix 길이 → 32비트 마스크
 */
function ipv4Mask(prefix: number): number {
  if (prefix <= 0) return 0;
  if (prefix >= 32) return 0xffffffff;
  return (0xffffffff << (32 - prefix)) >>> 0;
}

/**
 * IPv6 prefix 길이 → 128비트 bigint 마스크
 */
function ipv6Mask(prefix: number): bigint {
  if (prefix <= 0) return 0n;
  if (prefix >= 128) return V6_FULL_MASK;
  return (V6_FULL_MASK << BigInt(128 - prefix)) & V6_FULL_MASK;
}

/**
 * 특정 IP가 CIDR 범위 내에 있는지 검사.
 * 패밀리(v4/v6)가 다르면 false.
 * Plan SC: FR-CIDR.2
 */
export function matchCidr(ip: string, cidr: string): boolean {
  if (typeof ip !== 'string') {
    throw new TypeError('matchCidr: expected ip string');
  }
  const parsed = parseCidr(cidr);
  return matchParsedCidr(ip, parsed);
}

function matchParsedCidr(ip: string, parsed: ParsedCidr): boolean {
  const ipFamily = detectFamily(ip);
  if (ipFamily !== parsed.family) {
    return false;
  }
  if (parsed.family === 'v4') {
    const ipNum = parseIpv4(ip);
    const mask = ipv4Mask(parsed.prefixLength);
    return ((ipNum & mask) >>> 0) === (((parsed.address as number) & mask) >>> 0);
  } else {
    const ipNum = parseIpv6(ip);
    const mask = ipv6Mask(parsed.prefixLength);
    return (ipNum & mask) === ((parsed.address as bigint) & mask);
  }
}

/**
 * 다수의 CIDR을 등록해 선형 스캔 매칭을 제공.
 * Plan SC: FR-CIDR.3, NFR-CIDR.2
 */
export class IpRangeMatcher {
  private readonly cidrs: ParsedCidr[] = [];

  add(cidr: string): this {
    this.cidrs.push(parseCidr(cidr));
    return this;
  }

  addMany(cidrs: readonly string[]): this {
    for (const c of cidrs) {
      this.add(c);
    }
    return this;
  }

  contains(ip: string): boolean {
    if (typeof ip !== 'string' || ip.length === 0) {
      return false;
    }
    for (const parsed of this.cidrs) {
      if (matchParsedCidr(ip, parsed)) {
        return true;
      }
    }
    return false;
  }

  size(): number {
    return this.cidrs.length;
  }
}

/**
 * 편의 함수: IP가 CIDR 목록 중 하나라도 포함되면 true.
 * Plan SC: FR-CIDR.7
 */
export function isIpInRange(ip: string, cidrs: readonly string[]): boolean {
  const matcher = new IpRangeMatcher();
  matcher.addMany(cidrs);
  return matcher.contains(ip);
}
