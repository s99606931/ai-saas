// DNS 해석 추상화 (테스트 mock 주입 가능)
// Design Ref: SVC-NOTIFR2-R56.design.md §5
// Plan SC: FR-SSRF.5

import { promises as dns } from 'node:dns';

export interface DnsResolver {
  /** A + AAAA 레코드를 합친 IP 문자열 배열을 반환 */
  resolve(hostname: string): Promise<string[]>;
}

export const nodeDnsResolver: DnsResolver = {
  async resolve(hostname: string): Promise<string[]> {
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
