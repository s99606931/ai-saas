// 보안 응답 헤더 플러그인
// Design Ref: SVC-GATEWAY-R1 DESIGN §4
// Plan SC: FR-GW.4
// CSAP: D-10 네트워크 보안 — 응답 헤더 보안 강화

import type { FastifyInstance, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';

/**
 * Fastify 플러그인: 보안 응답 헤더 자동 추가
 *
 * OWASP 보안 헤더 권장사항 + CSAP D-10 준수:
 * - X-Content-Type-Options: MIME 스니핑 방지
 * - X-Frame-Options: 클릭재킹 방지
 * - Strict-Transport-Security: HTTPS 강제
 * - Content-Security-Policy: XSS 방지
 * - Referrer-Policy: 리퍼러 정보 제한
 * - Permissions-Policy: 브라우저 기능 제한
 */
async function securityHeadersPlugin(app: FastifyInstance): Promise<void> {
  app.addHook('onSend', async (_request, reply: FastifyReply) => {
    // MIME 스니핑 방지
    void reply.header('X-Content-Type-Options', 'nosniff');

    // 클릭재킹 방지
    void reply.header('X-Frame-Options', 'DENY');

    // HTTPS 강제 (1년, 하위 도메인 포함)
    void reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

    // XSS 방지 (현대 브라우저는 CSP 사용, 레거시 호환용 비활성화)
    void reply.header('X-XSS-Protection', '0');

    // Content Security Policy
    void reply.header('Content-Security-Policy', "default-src 'self'; frame-ancestors 'none'");

    // 리퍼러 정보 제한
    void reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');

    // 브라우저 기능 제한 (카메라, 마이크, 지오로케이션)
    void reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  });
}

export default fp(securityHeadersPlugin, {
  name: 'security-headers',
  fastify: '5.x',
});
