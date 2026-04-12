// IPv4/IPv6 파싱 유틸리티
// Design Ref: SVC-CIDR-R54.design.md §2.1
// Plan SC: FR-CIDR.4, FR-CIDR.5, FR-CIDR.6

export type IpFamily = 'v4' | 'v6';

/**
 * IPv4 주소를 32비트 unsigned number로 파싱한다.
 * Plan SC: FR-CIDR.4
 */
export function parseIpv4(input: string): number {
  if (typeof input !== 'string') {
    throw new TypeError('parseIpv4: expected string');
  }
  const parts = input.split('.');
  if (parts.length !== 4) {
    throw new RangeError(`parseIpv4: invalid IPv4 "${input}"`);
  }
  let n = 0;
  for (const p of parts) {
    if (p.length === 0 || !/^\d{1,3}$/.test(p)) {
      throw new RangeError(`parseIpv4: invalid octet "${p}" in "${input}"`);
    }
    const octet = Number(p);
    if (octet < 0 || octet > 255) {
      throw new RangeError(`parseIpv4: octet out of range "${p}" in "${input}"`);
    }
    n = n * 256 + octet;
  }
  return n >>> 0;
}

/**
 * IPv6 주소를 128비트 bigint로 파싱한다.
 * 압축 표기(::)와 IPv4-in-IPv6는 압축만 지원.
 * Plan SC: FR-CIDR.5
 */
export function parseIpv6(input: string): bigint {
  if (typeof input !== 'string') {
    throw new TypeError('parseIpv6: expected string');
  }
  let s = input.toLowerCase().trim();
  if (s.startsWith('[') && s.endsWith(']')) {
    s = s.slice(1, -1);
  }

  let expanded: string[];
  if (s.includes('::')) {
    // '::' 는 한 번만 등장 가능
    if (s.indexOf('::') !== s.lastIndexOf('::')) {
      throw new RangeError(`parseIpv6: multiple "::" in "${input}"`);
    }
    const [leftStr, rightStr] = s.split('::');
    const left = leftStr ? leftStr.split(':') : [];
    const right = rightStr ? rightStr.split(':') : [];
    const missing = 8 - left.length - right.length;
    if (missing < 0) {
      throw new RangeError(`parseIpv6: too many groups in "${input}"`);
    }
    expanded = [...left, ...Array.from({ length: missing }, () => '0'), ...right];
  } else {
    expanded = s.split(':');
  }

  if (expanded.length !== 8) {
    throw new RangeError(`parseIpv6: expected 8 groups, got ${expanded.length} in "${input}"`);
  }

  let result = 0n;
  for (const part of expanded) {
    if (!/^[0-9a-f]{1,4}$/.test(part)) {
      throw new RangeError(`parseIpv6: invalid group "${part}" in "${input}"`);
    }
    result = (result << 16n) | BigInt(parseInt(part, 16));
  }
  return result;
}

/**
 * 입력 문자열이 IPv4/IPv6 중 무엇인지 판별
 */
export function detectFamily(input: string): IpFamily {
  return input.includes(':') ? 'v6' : 'v4';
}
