// 비밀번호 재설정 핸들러
// Design Ref: DESIGN-MTU-Q3 §2 FR-P02.7
// Plan SC: FR-P02.7
// CSAP: D-08-07 비밀번호 재설정 정책

import type { FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { randomBytes, createHash } from 'node:crypto';
import { z } from 'zod';
import { AUTH_CONSTANTS } from '@public-saas/auth-sdk';
import { logUserEvent } from '../lib/audit.js';

const prisma = new PrismaClient();

/** 재설정 토큰 만료 시간: 30분 */
const TOKEN_EXPIRY_MS = 30 * 60 * 1000;

/** 인메모리 토큰 저장소 (단일 인스턴스) */
// NOTE: 분산 환경에서는 Redis로 교체 예정
interface ResetTokenEntry {
  hashedToken: string;
  userId: string;
  email: string;
  ip: string;
  expiresAt: Date;
}

const resetTokenStore: Map<string, ResetTokenEntry> = new Map();

/** SHA-256 해시 (토큰 저장용) */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** 만료된 토큰 정리 */
function cleanupExpiredTokens(): void {
  const now = new Date();
  for (const [key, entry] of resetTokenStore) {
    if (entry.expiresAt < now) {
      resetTokenStore.delete(key);
    }
  }
}

// Zod 검증 스키마
const requestResetSchema = z.object({
  email: z.string().email('유효한 이메일 주소를 입력하세요'),
  tenantId: z.string().min(1, '테넌트 ID는 필수입니다'),
});

const confirmResetSchema = z.object({
  token: z.string().min(1, '재설정 토큰은 필수입니다'),
  newPassword: z.string().min(8, '새 비밀번호는 8자 이상이어야 합니다'),
});

/**
 * 비밀번호 재설정 요청
 * CSAP D-08-07: 토큰 기반 재설정
 *
 * 보안: 사용자 존재 여부와 무관하게 동일 응답 (계정 열거 방지)
 */
export async function requestPasswordResetHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const parseResult = requestResetSchema.safeParse(request.body);
  if (!parseResult.success) {
    await reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parseResult.error.issues.map((i) => i.message).join(', ') },
    });
    return;
  }

  const { email, tenantId } = parseResult.data;

  // 만료 토큰 정리
  cleanupExpiredTokens();

  // 사용자 조회 (존재 여부와 무관하게 동일 응답 — 계정 열거 방지)
  const user = await prisma.user.findFirst({
    where: { email, tenantId },
    select: { id: true, email: true },
  });

  if (user) {
    // 기존 토큰 폐기
    for (const [key, entry] of resetTokenStore) {
      if (entry.userId === user.id) {
        resetTokenStore.delete(key);
      }
    }

    // 새 토큰 생성
    const rawToken = randomBytes(32).toString('hex');
    const hashedToken = hashToken(rawToken);

    resetTokenStore.set(hashedToken, {
      hashedToken,
      userId: user.id,
      email: user.email,
      ip: request.ip,
      expiresAt: new Date(Date.now() + TOKEN_EXPIRY_MS),
    });

    // 감사 로그 기록 (CSAP D-06)
    await logUserEvent(
      'PASSWORD_RESET_REQUESTED',
      'system',
      user.id,
      tenantId,
      request.ip,
      request.headers['user-agent'] ?? 'unknown',
    );

    // 실제 환경에서는 알림 서비스를 통해 이메일 발송
    // 개발 환경에서는 로그로 토큰 출력
    if (process.env['NODE_ENV'] !== 'production') {
      console.log(`[DEV] 비밀번호 재설정 토큰: ${rawToken} (사용자: ${email})`);
    }
  }

  // 항상 동일 응답 (계정 열거 방지)
  await reply.send({
    success: true,
    message: '비밀번호 재설정 안내가 이메일로 발송되었습니다',
  });
}

/**
 * 비밀번호 재설정 확인
 * CSAP D-08-07: 토큰 검증 + 비밀번호 정책 + 1회 사용 폐기
 */
export async function confirmPasswordResetHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const parseResult = confirmResetSchema.safeParse(request.body);
  if (!parseResult.success) {
    await reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parseResult.error.issues.map((i) => i.message).join(', ') },
    });
    return;
  }

  const { token, newPassword } = parseResult.data;
  const hashedToken = hashToken(token);

  // 토큰 검증
  const entry = resetTokenStore.get(hashedToken);
  if (!entry) {
    await reply.status(400).send({
      success: false,
      error: { code: 'INVALID_TOKEN', message: '유효하지 않거나 만료된 재설정 토큰입니다' },
    });
    return;
  }

  // 만료 확인
  if (entry.expiresAt < new Date()) {
    resetTokenStore.delete(hashedToken);
    await reply.status(400).send({
      success: false,
      error: { code: 'TOKEN_EXPIRED', message: '재설정 토큰이 만료되었습니다. 다시 요청해 주세요.' },
    });
    return;
  }

  // 비밀번호 정책 검증
  if (!AUTH_CONSTANTS.PASSWORD_REGEX.test(newPassword)) {
    await reply.status(400).send({
      success: false,
      error: { code: 'PASSWORD_POLICY', message: '비밀번호는 대문자, 소문자, 숫자, 특수문자를 포함해야 합니다' },
    });
    return;
  }

  // 비밀번호 변경
  const newHash = await bcrypt.hash(newPassword, AUTH_CONSTANTS.BCRYPT_SALT_ROUNDS);
  await prisma.user.update({
    where: { id: entry.userId },
    data: { passwordHash: newHash },
  });

  // 토큰 1회 사용 후 폐기
  resetTokenStore.delete(hashedToken);

  // 감사 로그 (CSAP D-06)
  // 비밀번호 재설정은 토큰 기반으로 비인증 상태에서 수행됨
  // actor: 재설정 대상 사용자 본인 (토큰 소유자)
  // tenantId: 사용자 소속 테넌트 조회
  const resetUser = await prisma.user.findUnique({
    where: { id: entry.userId },
    select: { tenantId: true },
  });
  await logUserEvent(
    'PASSWORD_RESET_COMPLETED',
    entry.userId,
    entry.userId,
    resetUser?.tenantId ?? 'unknown',
    request.ip,
    request.headers['user-agent'] ?? 'unknown',
  );

  await reply.send({
    success: true,
    message: '비밀번호가 성공적으로 재설정되었습니다',
  });
}
