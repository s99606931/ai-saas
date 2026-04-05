// MFA TOTP 핸들러 (스켈레톤)
// Design Ref: DESIGN-MTU-P01 Section 2 — POST /auth/mfa/setup, /auth/mfa/verify
// Plan SC: FR-P01.10
// CSAP: D-08-08 다중 인증

import type { FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { mfaSetupSchema, mfaVerifySchema, mfaDisableSchema } from '../schemas/mfa.schema.js';
import { verifyPassword } from '../lib/password.js';
import { logAuthEvent } from '../lib/audit.js';
import crypto from 'node:crypto';

const prisma = new PrismaClient();

/**
 * MFA 등록 시작 — TOTP 시크릿 생성 + otpauth URI 반환
 *
 * POST /auth/mfa/setup
 * 인증 필요 (request.user 존재)
 */
export async function mfaSetupHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const user = (request as FastifyRequest & { user?: { sub: string; tenantId: string } }).user;
  if (!user) {
    await reply.status(401).send({
      success: false,
      error: { code: 'AUTH_REQUIRED', message: '인증이 필요합니다' },
    });
    return;
  }

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

  // otpauth URI 생성
  const issuer = 'PublicSaaS';
  const otpauthUri = `otpauth://totp/${issuer}:${dbUser.email}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;

  await logAuthEvent('MFA_SETUP_STARTED', user.sub, dbUser.tenantId, request.ip, request.headers['user-agent'] ?? 'unknown');

  await reply.status(200).send({
    success: true,
    data: {
      secret,
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
export async function mfaVerifyHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const user = (request as FastifyRequest & { user?: { sub: string; tenantId: string } }).user;
  if (!user) {
    await reply.status(401).send({
      success: false,
      error: { code: 'AUTH_REQUIRED', message: '인증이 필요합니다' },
    });
    return;
  }

  const parseResult = mfaVerifySchema.safeParse(request.body);
  if (!parseResult.success) {
    await reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parseResult.error.issues.map((i) => i.message).join(', ') },
    });
    return;
  }

  const { code, secret } = parseResult.data;

  // TOTP 코드 검증
  const isValidCode = verifyTotp(secret, code);
  if (!isValidCode) {
    await reply.status(401).send({
      success: false,
      error: { code: 'MFA_INVALID_CODE', message: 'MFA 코드가 올바르지 않습니다' },
    });
    return;
  }

  // MFA 활성화: 시크릿 저장 (AES-256 암호화 권장 — CSAP D-09)
  // NOTE: 실제 운영 시 mfaSecret은 AES-256-GCM으로 암호화하여 저장해야 함
  await prisma.user.update({
    where: { id: user.sub },
    data: {
      mfaEnabled: true,
      mfaSecret: secret,
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
export async function mfaDisableHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const user = (request as FastifyRequest & { user?: { sub: string; tenantId: string } }).user;
  if (!user) {
    await reply.status(401).send({
      success: false,
      error: { code: 'AUTH_REQUIRED', message: '인증이 필요합니다' },
    });
    return;
  }

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

  const isValidCode = verifyTotp(dbUser.mfaSecret, parseResult.data.code);
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

// ── TOTP 유틸리티 ──────────────────────────────────────────────

/**
 * Base32 인코딩 (RFC 4648)
 */
function base32Encode(buffer: Buffer): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  let result = '';

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      result += alphabet[(value >>> bits) & 0x1f];
    }
  }

  if (bits > 0) {
    result += alphabet[(value << (5 - bits)) & 0x1f];
  }

  return result;
}

/**
 * TOTP 코드 검증 (RFC 6238)
 *
 * @param secret - Base32 인코딩된 시크릿
 * @param code - 6자리 TOTP 코드
 * @param window - 허용 시간 윈도우 (기본 1 = 전후 30초)
 * @returns 코드 유효 여부
 */
function verifyTotp(secret: string, code: string, window = 1): boolean {
  const time = Math.floor(Date.now() / 1000 / 30);
  const secretBuffer = base32Decode(secret);

  for (let i = -window; i <= window; i++) {
    const counter = time + i;
    const generated = generateTotp(secretBuffer, counter);
    if (generated === code) {
      return true;
    }
  }

  return false;
}

/**
 * TOTP 코드 생성 (HMAC-SHA1)
 */
function generateTotp(secret: Buffer, counter: number): string {
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));

  const hmac = crypto.createHmac('sha1', secret).update(counterBuffer).digest();

  const offset = hmac[hmac.length - 1]! & 0x0f;
  const code =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff);

  return (code % 1_000_000).toString().padStart(6, '0');
}

/**
 * Base32 디코딩
 */
function base32Decode(input: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const cleanInput = input.replace(/=+$/, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const output: number[] = [];

  for (const char of cleanInput) {
    const idx = alphabet.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      output.push((value >>> bits) & 0xff);
    }
  }

  return Buffer.from(output);
}
