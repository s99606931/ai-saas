// 감사 로그 입력 검증 스키마
// Design Ref: DESIGN-MTU-P13 §2.1
// CSAP: D-06

import { z } from 'zod';

/** POST /audit/logs 요청 본문 */
export const createAuditLogSchema = z.object({
  tenantId: z.string().uuid().optional(),
  actorId: z.string().uuid().optional(),
  action: z.string().min(1).max(100),
  target: z.string().max(255).optional(),
  targetType: z.string().max(50).optional(),
  ip: z.string().max(45).optional(),
  userAgent: z.string().max(500).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type CreateAuditLogInput = z.infer<typeof createAuditLogSchema>;

/** GET /audit/logs 쿼리 파라미터 */
export const queryAuditLogSchema = z.object({
  tenantId: z.string().uuid().optional(),
  actorId: z.string().uuid().optional(),
  action: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type QueryAuditLogInput = z.infer<typeof queryAuditLogSchema>;

/** GET /audit/export 쿼리 파라미터 */
export const exportAuditLogSchema = z.object({
  tenantId: z.string().uuid().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  format: z.enum(['csv', 'json']).default('json'),
});

export type ExportAuditLogInput = z.infer<typeof exportAuditLogSchema>;

/** POST /audit/verify 요청 본문 */
export const verifyIntegritySchema = z.object({
  tenantId: z.string().uuid().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
});

export type VerifyIntegrityInput = z.infer<typeof verifyIntegritySchema>;
