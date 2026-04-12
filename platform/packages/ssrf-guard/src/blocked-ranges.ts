// 기본 차단 CIDR 목록
// Design Ref: SVC-NOTIFR2-R56.design.md §3
// Plan SC: FR-SSRF.3

export const DEFAULT_BLOCKED_IPV4_CIDRS: readonly string[] = [
  '0.0.0.0/8', // 현재 네트워크
  '10.0.0.0/8', // 사설 A
  '100.64.0.0/10', // CGN
  '127.0.0.0/8', // 루프백
  '169.254.0.0/16', // 링크 로컬 / 클라우드 메타데이터
  '172.16.0.0/12', // 사설 B
  '192.0.0.0/24', // IETF 프로토콜 할당
  '192.168.0.0/16', // 사설 C
  '198.18.0.0/15', // 벤치마킹
];

export const DEFAULT_BLOCKED_IPV6_CIDRS: readonly string[] = [
  '::/128', // 미지정
  '::1/128', // 루프백
  'fc00::/7', // Unique Local
  'fe80::/10', // 링크 로컬
  'ff00::/8', // Multicast
];

export const DEFAULT_BLOCKED_CIDRS: readonly string[] = [
  ...DEFAULT_BLOCKED_IPV4_CIDRS,
  ...DEFAULT_BLOCKED_IPV6_CIDRS,
];
