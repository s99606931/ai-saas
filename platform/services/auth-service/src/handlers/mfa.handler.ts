// MFA TOTP 핸들러 (스켈레톤)
// Design Ref: DESIGN-MTU-P01 Section 2 — POST /auth/mfa/setup, /auth/mfa/verify
// Plan SC: FR-P01.10
// CSAP: D-08-08 다중 인증

import type { FastifyRequest, FastifyReply } from 'fastify';
import { mfaSetupSchema, mfaVerifySchema, mfaDisableSchema } from '../schemas/mfa.schema.js';
import { verifyPassword } from '../lib/password.js';
import { logAuthEvent } from '../lib/audit.js';
import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/session.js';
import { encryptMfaSecret, decryptMfaSecret } from '../lib/mfa-crypto.js';
import crypto from 'node:crypto';
import { base32Encode, verifyTotp } from '../lib/totp.js';

// Redis 임시 시크릿 저장 키 (MFA setup 후 verify 전까지 유효)
// CSAP D-08-08: MFA 시크릿은 서버 측에서 관리, 클라이언트 변조 방지
const MFA_PENDING_KEY = (userId: string): string => `mfa:pending:${userId}`;
const MFA_PENDING_TTL_SECONDS = 600; // 10분 (setup 후 verify까지 허용 시간)

/**
 * MFA 등록 시작 — TOTP 시크릿 생성 + otpauth URI 반환
 *
 * POST /auth/mfa/setup
 * 인증 필요 (request.user 존재)
 */
export async function mfaSetupHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!request.user) {
    await reply.status(401).send({
      success: false,
      error: { code: 'AUTH_REQUIRED', message: '인증이 필요합니다' },
    });
    return;
  }
  const user = request.user;

  const parseResult = mfaSetupSchema.safeParse(request.body);
  if (!parseResult.success) {
    await reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parseResult.error.issues.map((i) => i.message).join(', ') },
    });
    return;
  }

  // 비밀번호 확인
  const dbUser = await prisma.user.findUnique({
    where: { id: user.sub },
    select: { id: true, email: true, passwordHash: true, mfaEnabled: true, tenantId: true },
  });

  if (!dbUser) {
    await reply.status(404).send({
      success: false,
      error: { code: 'USER_NOT_FOUND', message: '사용자를 찾을 수 없습니다' },
    });
    return;
  }

  if (dbUser.mfaEnabled) {
    await reply.status(409).send({
      success: false,
      error: { code: 'MFA_ALREADY_ENABLED', message: 'MFA가 이미 활성화되어 있습니다' },
    });
    return;
  }

  const isValid = await verifyPassword(parseResult.data.password, dbUser.passwordHash);
  if (!isValid) {
    await reply.status(401).send({
      success: false,
      error: { code: 'WRONG_PASSWORD', message: '비밀번호가 올바르지 않습니다' },
    });
    return;
  }

  // TOTP 시크릿 생성 (Base32 인코딩)
  const secretBytes = crypto.randomBytes(20);
  const secret = base32Encode(secretBytes);

  // CSAP D-08-08: Redis에 임시 시크릿 저장 (verify 전까지 서버 측 관리)
  // 클라이언트가 시크릿을 변조하여 verify하는 것을 방지
  await redis.set(MFA_PENDING_KEY(user.sub), secret, 'EX', MFA_PENDING_TTL_SECONDS);

  // otpauth URI 생성
  const issuer = 'PublicSaaS';
  const otpauthUri = `otpauth://totp/${issuer}:${dbUser.email}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;

  await logAuthEvent(
    'MFA_SETUP_STARTED',
    user.sub,
    dbUser.tenantId,
    request.ip,
    request.headers['user-agent'] ?? 'unknown',
  );

  await reply.status(200).send({
    success: true,
    data: {
      otpauthUri,
      message: 'MFA 인증 앱에서 QR 코드를 스캔하고 6자리 코드로 검증하세요',
    },
  });
}

/**
 * MFA 등록 검증 — TOTP 코드 확인 후 활성화
 *
 * POST /auth/mfa/verify
 */
export async function mfaVerifyHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!request.user) {
    await reply.status(401).send({
      success: false,
      error: { code: 'AUTH_REQUIRED', message: '인증이 필요합니다' },
    });
    return;
  }
  const user = request.user;

  const parseResult = mfaVerifySchema.safeParse(request.body);
  if (!parseResult.success) {
    await reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parseResult.error.issues.map((i) => i.message).join(', ') },
    });
    return;
  }

  const { code } = parseResult.data;

  // CSAP D-08-08: Redis에서 임시 시크릿 조회 (서버 측 관리, 클라이언트 변조 방지)
  const pendingSecret = await redis.get(MFA_PENDING_KEY(user.sub));
  if (!pendingSecret) {
    await reply.status(400).send({
      success: false,
      error: { code: 'MFA_SETUP_EXPIRED', message: 'MFA 등록이 만료되었습니다. 다시 setup을 진행하세요' },
    });
    return;
  }

  // TOTP 코드 검증 (Redis에서 조회한 시크릿 사용)
  const isValidCode = verifyTotp(pendingSecret, code);
  if (!isValidCode) {
    await reply.status(401).send({
      success: false,
      error: { code: 'MFA_INVALID_CODE', message: 'MFA 코드가 올바르지 않습니다' },
    });
    return;
  }

  // MFA 활성화: 시크릿 AES-256-GCM 암호화 저장 (CSAP D-09)
  const encryptedSecret = encryptMfaSecret(pendingSecret);

  // Redis 임시 시크릿 삭제 (verify 성공 후 불필요)
  await redis.del(MFA_PENDING_KEY(user.sub));
  await prisma.user.update({
    where: { id: user.sub },
    data: {
      mfaEnabled: true,
      mfaSecret: encryptedSecret,
    },
  });

  await logAuthEvent('MFA_ENABLED', user.sub, user.tenantId, request.ip, request.headers['user-agent'] ?? 'unknown');

  await reply.status(200).send({
    success: true,
    message: 'MFA가 활성화되었습니다',
  });
}

/**
 * MFA 비활성화
 *
 * DELETE /auth/mfa
 */
export async function mfaDisableHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!request.user) {
    await reply.status(401).send({
      success: false,
      error: { code: 'AUTH_REQUIRED', message: '인증이 필요합니다' },
    });
    return;
  }
  const user = request.user;

  const parseResult = mfaDisableSchema.safeParse(request.body);
  if (!parseResult.success) {
    await reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parseResult.error.issues.map((i) => i.message).join(', ') },
    });
    return;
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.sub },
    select: { id: true, passwordHash: true, mfaEnabled: true, mfaSecret: true, tenantId: true },
  });

  if (!dbUser || !dbUser.mfaEnabled || !dbUser.mfaSecret) {
    await reply.status(400).send({
      success: false,
      error: { code: 'MFA_NOT_ENABLED', message: 'MFA가 활성화되어 있지 않습니다' },
    });
    return;
  }

  const isValidPassword = await verifyPassword(parseResult.data.password, dbUser.passwordHash);
  if (!isValidPassword) {
    await reply.status(401).send({
      success: false,
      error: { code: 'WRONG_PASSWORD', message: '비밀번호가 올바르지 않습니다' },
    });
    return;
  }

  // CSAP D-09: 저장된 암호화 시크릿 복호화 후 TOTP 검증
  const decryptedSecret = decryptMfaSecret(dbUser.mfaSecret);
  const isValidCode = verifyTotp(decryptedSecret, parseResult.data.code);
  if (!isValidCode) {
    await reply.status(401).send({
      success: false,
      error: { code: 'MFA_INVALID_CODE', message: 'MFA 코드가 올바르지 않습니다' },
    });
    return;
  }

  await prisma.user.update({
    where: { id: user.sub },
    data: {
      mfaEnabled: false,
      mfaSecret: null,
    },
  });

  await logAuthEvent('MFA_DISABLED', user.sub, dbUser.tenantId, request.ip, request.headers['user-agent'] ?? 'unknown');

  await reply.status(200).send({
    success: true,
    message: 'MFA가 비활성화되었습니다',
  });
}
