# SVC-CIDR-R54 Design — CIDR / IP Range

> **작성일**: 2026-04-11

## 1. 아키텍처

| 옵션 | 선정 |
|------|------|
| ip-address npm | 의존성 증가 → 탈락 |
| **BigInt 기반 IPv4/IPv6 통합 비트 연산** | **선정** |

IPv4: 32비트 → number
IPv6: 128비트 → bigint

## 2. 설계

### 2.1 parseIpv4 / parseIpv6

```ts
function parseIpv4(s: string): number {
  const parts = s.split('.');
  if (parts.length !== 4) throw new RangeError(...);
  let n = 0;
  for (const p of parts) {
    const o = Number(p);
    if (!Number.isInteger(o) || o < 0 || o > 255) throw new RangeError(...);
    n = (n * 256) + o;
  }
  return n >>> 0;  // unsigned
}

function parseIpv6(s: string): bigint {
  // '::' 압축 확장
  let expanded: string[];
  if (s.includes('::')) {
    const [l, r] = s.split('::');
    const left = l ? l.split(':') : [];
    const right = r ? r.split(':') : [];
    const missing = 8 - left.length - right.length;
    if (missing < 0) throw new RangeError(...);
    expanded = [...left, ...Array(missing).fill('0'), ...right];
  } else {
    expanded = s.split(':');
  }
  if (expanded.length !== 8) throw new RangeError(...);
  let n = 0n;
  for (const part of expanded) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(part)) throw new RangeError(...);
    n = (n << 16n) | BigInt(parseInt(part, 16));
  }
  return n;
}
```

### 2.2 parseCidr

```ts
export type IpFamily = 'v4' | 'v6';

export interface ParsedCidr {
  family: IpFamily;
  /** v4: 32비트 number, v6: 128비트 bigint */
  address: number | bigint;
  prefixLength: number;
}

export function parseCidr(cidr: string): ParsedCidr {
  const [addr, prefixStr] = cidr.split('/');
  if (!addr || !prefixStr) throw new RangeError(...);
  const prefix = parseInt(prefixStr, 10);
  const isV6 = addr.includes(':');
  if (isV6) {
    if (prefix < 0 || prefix > 128) throw new RangeError(...);
    return { family: 'v6', address: parseIpv6(addr), prefixLength: prefix };
  } else {
    if (prefix < 0 || prefix > 32) throw new RangeError(...);
    return { family: 'v4', address: parseIpv4(addr), prefixLength: prefix };
  }
}
```

### 2.3 matchCidr

```ts
export function matchCidr(ip: string, cidr: string): boolean {
  const parsed = parseCidr(cidr);
  if (parsed.family === 'v4') {
    if (ip.includes(':')) return false;
    const ipNum = parseIpv4(ip);
    const mask = parsed.prefixLength === 0 ? 0 : ((~0 << (32 - parsed.prefixLength)) >>> 0);
    return (ipNum & mask) === ((parsed.address as number) & mask);
  } else {
    if (!ip.includes(':')) return false;
    const ipNum = parseIpv6(ip);
    const mask = parsed.prefixLength === 0 ? 0n : ((2n ** 128n - 1n) << BigInt(128 - parsed.prefixLength)) & (2n ** 128n - 1n);
    return (ipNum & mask) === ((parsed.address as bigint) & mask);
  }
}
```

### 2.4 IpRangeMatcher

```ts
export class IpRangeMatcher {
  private readonly cidrs: ParsedCidr[] = [];
  add(cidr: string): this {
    this.cidrs.push(parseCidr(cidr));
    return this;
  }
  contains(ip: string): boolean { ... }
}

export function isIpInRange(ip: string, cidrs: string[]): boolean { ... }
```

## 3. 테스트 (30+)

- parseIpv4 성공/실패 (5)
- parseIpv6 압축/완전/실패 (6)
- parseCidr v4/v6 (4)
- matchCidr v4 positive/negative/edge (6)
- matchCidr v6 (4)
- IpRangeMatcher (3)
- isIpInRange (3)

## 변경 이력

| 버전 | 일자 | 내용 |
|------|------|------|
| 1.0.0 | 2026-04-11 | 최초 작성 |
