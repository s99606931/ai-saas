// IP 접근 제어 미들웨어
// Design Ref: SVC-GATEWAY-R1 DESIGN §1
// Plan SC: FR-GW.1
// CSAP: D-10 네트워크 보안

import type { FastifyRequest, FastifyReply } from 'fastify';

/** IP 블랙리스트 (쉼표 구분, 환경 변수) */
const IP_BLACKLIST: Set<string> = new Set(
  (process.env['IP_BLACKLIST'] ?? '').split(',').map((ip) => ip.trim()).filter(Boolean),
);

/** IP 화이트리스트 (쉼표 구분, 환경 변수) — 화이트리스트 우선 */
const IP_WHITELIST: Set<string> = new Set(
  (process.env['IP_WHITELIST'] ?? '').split(',').map((ip) => ip.trim()).filter(Boolean),
);

/**
 * IP 접근 제어 미들웨어
 *
 * CSAP D-10: 네트워크 보안 — 허용/차단 IP 관리
 *
 * 우선순위:
 * 1. 화이트리스트에 있으면 항상 허용
 * 2. 블랙리스트에 있으면 차단 (403)
 * 3. 목록에 없으면 허용 (기본 허용 정책)
 *
 * @param request - Fastify 요청 객체
 * @param reply - Fastify 응답 객체
 */
export async function ipFilterMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const clientIp = request.ip;

  // 화이트리스트 우선
  if (IP_WHITELIST.size > 0 && IP_WHITELIST.has(clientIp)) {
    return;
  }

  // 블랙리스트 확인
  if (IP_BLACKLIST.has(clientIp)) {
    request.log.warn(
      { ip: clientIp, action: 'IP_BLOCKED' },
      `차단된 IP 접근 시도: ${clientIp}`,
    );
    await reply.status(403).send({
      success: false,
      error: {
        code: 'IP_BLOCKED',
        message: '접근이 차단된 IP 주소입니다',
      },
    });
    return;
  }
}

/**
 * 런타임 블랙리스트 추가 (보안 모니터링 서비스 연동용)
 */
export function addToBlacklist(ip: string): void {
  IP_BLACKLIST.add(ip);
}

/**
 * 런타임 블랙리스트 제거
 */
export function removeFromBlacklist(ip: string): void {
  IP_BLACKLIST.delete(ip);
}

/**
 * 현재 블랙리스트 조회
 */
export function getBlacklist(): string[] {
  return Array.from(IP_BLACKLIST);
}
