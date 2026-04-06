// Design Ref: MTU-ECO3 Design 2.1
// Plan SC: FR-ECO3.1
import { z } from 'zod';

/**
 * 기안서 생성 스키마
 * CSAP D-12: 모든 입력은 Zod 스키마 검증 필수
 */
export const createDraftSchema = z.object({
  title: z.string().min(1, '제목은 필수입니다').max(200, '제목은 200자 이하'),
  content: z.string().min(1, '본문은 필수입니다').max(10000),
  category: z.enum(['general', 'expense', 'leave', 'purchase', 'contract']),
  urgency: z.enum(['normal', 'urgent', 'emergency']).default('normal'),
  attachments: z.array(z.string().uuid()).optional(),
});

export const updateDraftSchema = createDraftSchema.partial();

/**
 * 결재선 설정 스키마
 */
export const approvalLineSchema = z.object({
  approvers: z.array(z.object({
    userId: z.string().uuid(),
    order: z.number().int().positive(),
    type: z.enum(['serial', 'parallel']),
    role: z.enum(['approver', 'reviewer', 'final-approver']),
  })).min(1, '결재자는 1명 이상 필요합니다'),
});

/**
 * 결재 처리 스키마
 */
export const approvalActionSchema = z.object({
  comment: z.string().max(500).optional(),
});

/**
 * 문서 조회 필터 스키마
 */
export const documentFilterSchema = z.object({
  status: z.enum(['draft', 'pending', 'approved', 'rejected', 'held']).optional(),
  category: z.enum(['general', 'expense', 'leave', 'purchase', 'contract']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type CreateDraft = z.infer<typeof createDraftSchema>;
export type UpdateDraft = z.infer<typeof updateDraftSchema>;
export type ApprovalLine = z.infer<typeof approvalLineSchema>;
export type ApprovalAction = z.infer<typeof approvalActionSchema>;
export type DocumentFilter = z.infer<typeof documentFilterSchema>;
