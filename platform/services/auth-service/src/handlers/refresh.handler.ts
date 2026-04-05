// 토큰 갱신 핸들러
// Design Ref: DESIGN-MTU-P01 Section 2 — POST /auth/refresh
// Plan SC: FR-P01.3
// CSAP: D-08-02 세션 관리 — Refresh Token Rotation

import type { FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { refreshSchema } from '../schemas/login.schema.js';
import { verifyToken, signAccessToken, signRefreshToken } from '../lib/jwt.js';
import { isTokenBlacklisted, blacklistToken, createSession } from '../lib/session.js';
import { logAuthEvent } from '../lib/audit.js';
import { AUTH_CONSTANTS } from '@public-saas/auth-sdk';

const prisma = new PrismaClient();

/**
 * 토큰 갱신 핸들러
 *
 * Refresh Token Rotation:
 * - 기존 갱신 토큰 무효화
 * - 새 접근 토큰 + 새 갱신 토큰 발급
 * - 탈취된 토큰 재사용 방지
 */
export async function refreshHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const parseResult = refreshSchema.safeParse(request.body);
  if (!parseResult.success) {
    await reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: '갱신 토큰을 제공하세요' },
    });
    return;
  }

  const { refreshToken } = parseResult.data;

  try {
    // 블랙리스트 확인 (이미 무효화된 토큰)
    if (await isTokenBlacklisted(refreshToken)) {
      await reply.status(401).send({
        success: false,
        error: { code: 'AUTH_TOKEN_REVOKED', message: '토큰이 무효화되었습니다' },
      });
      return;
    }

    // 갱신 토큰 검증
    const payload = await verifyToken(refreshToken);

    // 사용자 조회
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      await reply.status(401).send({
        success: false,
        error: { code: 'AUTH_USER_NOT_FOUND', message: '사용자를 찾을 수 없습니다' },
      });
      return;
    }

    // 기존 갱신 토큰 무효화 (Rotation)
    await blacklistToken(refreshToken);

    // 새 토큰 발급
    const permissions = await getUserPermissions(user.role);

    const newAccessToken = await signAccessToken({
      sub: user.id,
      tenantId: user.tenantId,
      role: user.role.toLowerCase() as 'super_admin' | 'tenant_admin' | 'user' | 'viewer' | 'auditor',
      permissions,
    });

    const newRefreshToken = await signRefreshToken(user.id, user.tenantId);

    // 새 세션 등록
    await createSession(user.id, {
      token: newAccessToken,
      refreshToken: newRefreshToken,
      ip: request.ip,
      userAgent: request.headers['user-agent'] ?? 'unknown',
      createdAt: new Date().toISOString(),
    });

    // 감사 로그
    await logAuthEvent(
      'TOKEN_REFRESH',
      user.id,
      user.tenantId,
      request.ip,
      request.headers['user-agent'] ?? 'unknown',
    );

    await reply.status(200).send({
      success: true,
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresIn: AUTH_CONSTANTS.ACCESS_TOKEN_EXPIRES_SECONDS,
      },
    });
  } catch {
    await reply.status(401).send({
      success: false,
      error: { code: 'AUTH_TOKEN_EXPIRED', message: '갱신 토큰이 만료되었습니다' },
    });
  }
}

async function getUserPermissions(role: string): Promise<string[]> {
  const rolePermissions = await prisma.rolePermission.findMany({
    where: { role: role as 'SUPER_ADMIN' | 'TENANT_ADMIN' | 'USER' | 'VIEWER' | 'AUDITOR' },
    include: { permission: true },
  });
  return rolePermissions.map((rp) => rp.permission.name);
}
