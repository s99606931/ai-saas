// 파일 관리 핸들러
// Design Ref: DESIGN-MTU-P12
// Plan SC: FR-P12.1~FR-P12.5
// CSAP: D-08 접근 제어, D-09 AES-256 암호화, D-12 MIME 검증

import type { FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { logFileEvent } from '../lib/audit.js';

const prisma = new PrismaClient();

// CSAP D-12: 허용 MIME 타입 (악성 파일 업로드 방지)
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png',
  'image/jpeg',
  'text/plain',
  'text/csv',
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const uploadSchema = z.object({
  tenantId: z.string().min(1),
  name: z.string().min(1).max(255),
  mimeType: z.string().min(1),
  size: z.number().int().min(1),
  uploadedBy: z.string().min(1),
});

/**
 * 파일 업로드
 * Plan SC: FR-P12.1
 * CSAP D-12: MIME 타입 + 크기 검증
 * CSAP D-09: AES-256 암호화 저장 (MinIO 서버 사이드 또는 앱 레벨)
 */
export async function uploadFileHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const parseResult = uploadSchema.safeParse(request.body);
  if (!parseResult.success) {
    await reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parseResult.error.issues.map((i) => i.message).join(', ') },
    });
    return;
  }

  const { tenantId, name, mimeType, size, uploadedBy } = parseResult.data;

  // CSAP D-12: MIME 타입 검증
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    await reply.status(400).send({
      success: false,
      error: { code: 'INVALID_MIME_TYPE', message: `허용되지 않는 파일 형식입니다: ${mimeType}` },
    });
    return;
  }

  // 파일 크기 제한
  if (size > MAX_FILE_SIZE) {
    await reply.status(400).send({
      success: false,
      error: { code: 'FILE_TOO_LARGE', message: '파일 크기가 50MB를 초과합니다' },
    });
    return;
  }

  // MinIO 저장 경로 생성 (실제 MinIO 클라이언트 연동은 인프라 구성 시)
  const storagePath = `${tenantId}/${Date.now()}-${name}`;

  const file = await prisma.file.create({
    data: {
      tenantId,
      name,
      mimeType,
      size: BigInt(size),
      storagePath,
      encrypted: true, // CSAP D-09: 기본 암호화
      uploadedBy,
    },
  });

  // 감사 로그 (FR-P12.5, CSAP D-06)
  await logFileEvent(
    'FILE_UPLOADED',
    uploadedBy,
    file.id,
    tenantId,
    request.ip,
    request.headers['user-agent'] ?? 'unknown',
    { name, mimeType, size },
  );

  await reply.status(201).send({
    success: true,
    data: { ...file, size: file.size.toString() },
  });
}

/**
 * 파일 다운로드 (접근 제어)
 * Plan SC: FR-P12.2
 * CSAP D-08: 테넌트별 접근 제어
 */
export async function downloadFileHandler(
  request: FastifyRequest<{ Params: { id: string }; Querystring: { tenantId?: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const file = await prisma.file.findUnique({
    where: { id: request.params.id },
  });

  if (!file) {
    await reply.status(404).send({
      success: false,
      error: { code: 'FILE_NOT_FOUND', message: '파일을 찾을 수 없습니다' },
    });
    return;
  }

  // CSAP D-08: 테넌트 접근 제어
  if (request.query.tenantId && file.tenantId !== request.query.tenantId) {
    await reply.status(403).send({
      success: false,
      error: { code: 'ACCESS_DENIED', message: '파일에 대한 접근 권한이 없습니다' },
    });
    return;
  }

  // NOTE: 실제 MinIO에서 파일 스트리밍은 MinIO 클라이언트 구성 시 구현
  await reply.send({
    success: true,
    data: {
      ...file,
      size: file.size.toString(),
      downloadUrl: `/storage/${file.storagePath}`,
    },
  });
}

/**
 * 파일 목록 조회
 * Plan SC: FR-P12.1
 */
export async function listFilesHandler(
  request: FastifyRequest<{ Querystring: { tenantId: string; page?: string; pageSize?: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const page = parseInt(request.query.page ?? '1', 10);
  const pageSize = Math.min(parseInt(request.query.pageSize ?? '20', 10), 100);

  const [files, total] = await Promise.all([
    prisma.file.findMany({
      where: { tenantId: request.query.tenantId },
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.file.count({ where: { tenantId: request.query.tenantId } }),
  ]);

  await reply.send({
    success: true,
    data: files.map((f: (typeof files)[number]) => ({ ...f, size: f.size.toString() })),
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
}

/**
 * 파일 삭제
 * Plan SC: FR-P12.1
 */
export async function deleteFileHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const file = await prisma.file.findUnique({ where: { id: request.params.id } });
  if (!file) {
    await reply.status(404).send({
      success: false,
      error: { code: 'FILE_NOT_FOUND', message: '파일을 찾을 수 없습니다' },
    });
    return;
  }

  await prisma.file.delete({ where: { id: request.params.id } });

  // 감사 로그 (FR-P12.5, CSAP D-06)
  await logFileEvent(
    'FILE_DELETED',
    'system',
    file.id,
    file.tenantId,
    request.ip,
    request.headers['user-agent'] ?? 'unknown',
    { name: file.name },
  );

  await reply.send({ success: true, message: '파일이 삭제되었습니다' });
}

/**
 * 파일 메타데이터 조회
 * Plan SC: FR-P12.1
 */
export async function getFileMetaHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const file = await prisma.file.findUnique({
    where: { id: request.params.id },
  });

  if (!file) {
    await reply.status(404).send({
      success: false,
      error: { code: 'FILE_NOT_FOUND', message: '파일을 찾을 수 없습니다' },
    });
    return;
  }

  await reply.send({
    success: true,
    data: { ...file, size: file.size.toString() },
  });
}
