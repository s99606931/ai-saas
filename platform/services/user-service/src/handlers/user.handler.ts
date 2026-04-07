// 사용자 CRUD 핸들러
// Design Ref: DESIGN-MTU-P02
// Plan SC: FR-P02.1~FR-P02.4, FR-P02.9, FR-P02.10
// CSAP: D-08-05 접근 통제, D-12 입력 검증

import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { AUTH_CONSTANTS } from '@public-saas/auth-sdk';
import { logUserEvent } from '../lib/audit.js';
import { prisma } from '../lib/prisma.js';

// Zod 검증 스키마 (CSAP D-12: 모든 입력 검증)
const createUserSchema = z.object({
  email: z.string().email('유효한 이메일 주소를 입력하세요'),
  name: z.string().min(1, '이름은 필수입니다').max(100),
  password: z.string().min(8, '비밀번호는 8자 이상이어야 합니다'),
  role: z.enum(['TENANT_ADMIN', 'USER', 'VIEWER', 'AUDITOR']).default('USER'),
  tenantId: z.string().min(1),
});

const updateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  mfaEnabled: z.boolean().optional(),
});

/**
 * 사용자 목록 조회 (테넌트 격리)
 * CSAP D-08-05: JWT 클레임 기반 테넌트 강제 격리
 * SUPER_ADMIN만 tenantId 파라미터로 교차 테넌트 조회 가능
 */
export async function listUsersHandler(
  request: FastifyRequest<{ Querystring: { page?: string; pageSize?: string; tenantId?: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const page = parseInt(request.query.page ?? '1', 10);
  const pageSize = Math.min(parseInt(request.query.pageSize ?? '20', 10), 100);

  // 게이트웨이가 주입한 JWT 클레임 헤더에서 테넌트 ID 추출
  const jwtTenantId = request.headers['x-user-tenant-id'] as string | undefined;
  const jwtRole = request.headers['x-user-role'] as string | undefined;

  // SUPER_ADMIN은 쿼리 파라미터로 테넌트 지정 가능, 그 외는 JWT 테넌트로 강제
  const tenantId = jwtRole === 'SUPER_ADMIN'
    ? (request.query.tenantId ?? jwtTenantId)
    : jwtTenantId;

  if (!tenantId) {
    await reply.status(400).send({
      success: false,
      error: { code: 'TENANT_REQUIRED', message: '테넌트 ID가 필요합니다' },
    });
    return;
  }

  const where = { tenantId };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        mfaEnabled: true,
        lastLoginAt: true,
        createdAt: true,
        tenantId: true,
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.count({ where }),
  ]);

  await reply.send({
    success: true,
    data: users,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  });
}

/**
 * 사용자 상세 조회
 * CSAP D-08-05: 테넌트 격리 — SUPER_ADMIN 제외 타 테넌트 사용자 조회 금지
 */
export async function getUserHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const jwtTenantId = request.headers['x-user-tenant-id'] as string | undefined;
  const jwtRole = request.headers['x-user-role'] as string | undefined;

  const user = await prisma.user.findUnique({
    where: { id: request.params.id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      mfaEnabled: true,
      lastLoginAt: true,
      failedLogins: true,
      lockedUntil: true,
      createdAt: true,
      updatedAt: true,
      tenantId: true,
    },
  });

  if (!user) {
    await reply.status(404).send({
      success: false,
      error: { code: 'USER_NOT_FOUND', message: '사용자를 찾을 수 없습니다' },
    });
    return;
  }

  // 테넌트 격리: SUPER_ADMIN 제외 타 테넌트 사용자 조회 차단 (CSAP D-08-05)
  if (jwtRole !== 'SUPER_ADMIN' && jwtTenantId && user.tenantId !== jwtTenantId) {
    await reply.status(403).send({
      success: false,
      error: { code: 'FORBIDDEN', message: '접근 권한이 없습니다' },
    });
    return;
  }

  await reply.send({ success: true, data: user });
}

/**
 * 사용자 생성
 * CSAP D-08-07: 비밀번호 정책 적용
 * Plan SC: FR-P02.9: 테넌트 사용자 수 제한
 */
export async function createUserHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const parseResult = createUserSchema.safeParse(request.body);
  if (!parseResult.success) {
    await reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parseResult.error.issues.map((i) => i.message).join(', ') },
    });
    return;
  }

  const { email, name, password, role, tenantId } = parseResult.data;

  // 테넌트 사용자 수 제한 확인 (FR-P02.9)
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) {
    await reply.status(404).send({
      success: false,
      error: { code: 'TENANT_NOT_FOUND', message: '테넌트를 찾을 수 없습니다' },
    });
    return;
  }

  const userCount = await prisma.user.count({ where: { tenantId } });
  if (userCount >= tenant.maxUsers) {
    await reply.status(409).send({
      success: false,
      error: { code: 'TENANT_USER_LIMIT', message: `테넌트 사용자 수 제한 (${tenant.maxUsers}명)에 도달했습니다` },
    });
    return;
  }

  // 비밀번호 정책 검증 + 해시
  if (!AUTH_CONSTANTS.PASSWORD_REGEX.test(password)) {
    await reply.status(400).send({
      success: false,
      error: { code: 'PASSWORD_POLICY', message: '비밀번호는 대문자, 소문자, 숫자, 특수문자를 포함해야 합니다' },
    });
    return;
  }

  const passwordHash = await bcrypt.hash(password, AUTH_CONSTANTS.BCRYPT_SALT_ROUNDS);

  try {
    const user = await prisma.user.create({
      data: { email, name, passwordHash, role: role as 'TENANT_ADMIN' | 'USER' | 'VIEWER' | 'AUDITOR', tenantId },
      select: { id: true, email: true, name: true, role: true, tenantId: true, createdAt: true },
    });

    // 감사 로그 기록 (FR-P02.10, CSAP D-06)
    const actor = (request.headers['x-user-id'] as string) || 'system';
    await logUserEvent(
      'USER_CREATED',
      actor,
      user.id,
      tenantId,
      request.ip,
      request.headers['user-agent'] ?? 'unknown',
      { email, role },
    );

    await reply.status(201).send({ success: true, data: user });
  } catch (error: unknown) {
    const prismaError = error as { code?: string };
    if (prismaError.code === 'P2002') {
      await reply.status(409).send({
        success: false,
        error: { code: 'USER_EXISTS', message: '이미 등록된 이메일입니다' },
      });
      return;
    }
    throw error;
  }
}

/**
 * 사용자 수정
 * CSAP D-08-05: 테넌트 격리, D-06: 변경 감사 로그
 */
export async function updateUserHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const parseResult = updateUserSchema.safeParse(request.body);
  if (!parseResult.success) {
    await reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parseResult.error.issues.map((i) => i.message).join(', ') },
    });
    return;
  }

  const jwtUserId = request.headers['x-user-id'] as string | undefined;
  const jwtTenantId = request.headers['x-user-tenant-id'] as string | undefined;
  const jwtRole = request.headers['x-user-role'] as string | undefined;

  // RBAC 접근 통제: 본인 또는 관리자만 수정 가능 (CSAP D-08-05)
  const isSuperAdmin = jwtRole === 'SUPER_ADMIN';
  const isTenantAdmin = jwtRole === 'TENANT_ADMIN';
  const isSelf = jwtUserId === request.params.id;

  if (!isSuperAdmin && !isTenantAdmin && !isSelf) {
    await reply.status(403).send({
      success: false,
      error: { code: 'FORBIDDEN', message: '본인 프로필만 수정할 수 있습니다. 관리자에게 문의하세요.' },
    });
    return;
  }

  // 테넌트 격리 확인 (CSAP D-08-05)
  if (!isSuperAdmin && jwtTenantId) {
    const target = await prisma.user.findUnique({
      where: { id: request.params.id },
      select: { tenantId: true },
    });
    if (!target || target.tenantId !== jwtTenantId) {
      await reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: '접근 권한이 없습니다' },
      });
      return;
    }
  }

  const user = await prisma.user.update({
    where: { id: request.params.id },
    data: parseResult.data,
    select: { id: true, email: true, name: true, role: true, mfaEnabled: true, updatedAt: true, tenantId: true },
  });

  // 감사 로그 기록 (CSAP D-06)
  const updateActor = (request.headers['x-user-id'] as string) || 'system';
  await logUserEvent(
    'USER_UPDATED',
    updateActor,
    user.id,
    user.tenantId,
    request.ip,
    request.headers['user-agent'] ?? 'unknown',
    { fields: Object.keys(parseResult.data) },
  );

  await reply.send({ success: true, data: user });
}

/**
 * 사용자 비활성화 (소프트 삭제 개선)
 * Design Ref: DESIGN-MTU-Q3 §1
 * Plan SC: FR-P02.4
 * CSAP D-08-10: 계정 비활성화
 *
 * 개선: lockedUntil을 9999-12-31로 설정하여 영구 비활성화 표시
 * 기존 role 변경 방식에서 lockedUntil 기반으로 전환
 */
export async function deleteUserHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const existingUser = await prisma.user.findUnique({
    where: { id: request.params.id },
    select: { id: true, tenantId: true, lockedUntil: true },
  });

  if (!existingUser) {
    await reply.status(404).send({
      success: false,
      error: { code: 'USER_NOT_FOUND', message: '사용자를 찾을 수 없습니다' },
    });
    return;
  }

  // 테넌트 격리 (CSAP D-08-05): SUPER_ADMIN 제외 타 테넌트 사용자 비활성화 금지
  const deleteJwtTenantId = request.headers['x-user-tenant-id'] as string | undefined;
  const deleteJwtRole = request.headers['x-user-role'] as string | undefined;
  if (deleteJwtRole !== 'SUPER_ADMIN' && deleteJwtTenantId && existingUser.tenantId !== deleteJwtTenantId) {
    await reply.status(403).send({
      success: false,
      error: { code: 'FORBIDDEN', message: '접근 권한이 없습니다' },
    });
    return;
  }

  // 영구 비활성화: lockedUntil = 9999-12-31T23:59:59Z
  const PERMANENT_LOCK = new Date('9999-12-31T23:59:59.000Z');

  await prisma.user.update({
    where: { id: request.params.id },
    data: {
      lockedUntil: PERMANENT_LOCK,
      failedLogins: 0, // 잠금 카운터 초기화
    },
  });

  // 감사 로그 기록 (FR-P02.10, CSAP D-06)
  const deactivateActor = (request.headers['x-user-id'] as string) || 'system';
  await logUserEvent(
    'USER_DEACTIVATED',
    deactivateActor,
    request.params.id,
    existingUser.tenantId,
    request.ip,
    request.headers['user-agent'] ?? 'unknown',
    { reason: 'soft_delete', previousLockState: existingUser.lockedUntil?.toISOString() ?? null },
  );

  await reply.send({ success: true, message: '사용자가 비활성화되었습니다' });
}

/**
 * 사용자 복원 (소프트 삭제 복원)
 * Design Ref: DESIGN-MTU-Q3 §1
 * Plan SC: FR-P02.4
 */
export async function reactivateUserHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const existingUser = await prisma.user.findUnique({
    where: { id: request.params.id },
    select: { id: true, tenantId: true, lockedUntil: true },
  });

  if (!existingUser) {
    await reply.status(404).send({
      success: false,
      error: { code: 'USER_NOT_FOUND', message: '사용자를 찾을 수 없습니다' },
    });
    return;
  }

  // 테넌트 격리 (CSAP D-08-05): SUPER_ADMIN 제외 타 테넌트 사용자 복원 금지
  const reactivateJwtTenantId = request.headers['x-user-tenant-id'] as string | undefined;
  const reactivateJwtRole = request.headers['x-user-role'] as string | undefined;
  if (reactivateJwtRole !== 'SUPER_ADMIN' && reactivateJwtTenantId && existingUser.tenantId !== reactivateJwtTenantId) {
    await reply.status(403).send({
      success: false,
      error: { code: 'FORBIDDEN', message: '접근 권한이 없습니다' },
    });
    return;
  }

  await prisma.user.update({
    where: { id: request.params.id },
    data: {
      lockedUntil: null,
      failedLogins: 0,
    },
  });

  // 감사 로그 기록 (CSAP D-06)
  const reactivateActor = (request.headers['x-user-id'] as string) || 'system';
  await logUserEvent(
    'USER_REACTIVATED',
    reactivateActor,
    request.params.id,
    existingUser.tenantId,
    request.ip,
    request.headers['user-agent'] ?? 'unknown',
  );

  await reply.send({ success: true, message: '사용자가 복원되었습니다' });
}
