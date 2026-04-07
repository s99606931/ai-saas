// 전자결재 플러그인 Zod 스키마 테스트
// Design Ref: MTU-ECO3 Design 2.1
// Plan SC: FR-ECO3.1~FR-ECO3.4
// CSAP: D-08 접근 통제, D-06 감사 로그, D-12 입력 검증

import { describe, it, expect } from 'vitest';
import {
  createDraftSchema,
  updateDraftSchema,
  approvalLineSchema,
  approvalActionSchema,
  documentFilterSchema,
} from '../../src/schemas/draft.schema';

describe('createDraftSchema (CSAP D-12 입력 검증)', () => {
  it('유효한 기안서 생성을 허용한다', () => {
    const result = createDraftSchema.safeParse({
      title: '출장 품의서',
      content: '부산 출장 건에 대한 품의입니다.',
      category: 'general',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.urgency).toBe('normal'); // 기본값
    }
  });

  it('빈 제목을 거부한다', () => {
    expect(createDraftSchema.safeParse({
      title: '', content: '본문', category: 'general',
    }).success).toBe(false);
  });

  it('제목 200자 초과를 거부한다', () => {
    expect(createDraftSchema.safeParse({
      title: 'a'.repeat(201), content: '본문', category: 'general',
    }).success).toBe(false);
  });

  it('빈 본문을 거부한다', () => {
    expect(createDraftSchema.safeParse({
      title: '제목', content: '', category: 'general',
    }).success).toBe(false);
  });

  it('본문 10000자 초과를 거부한다', () => {
    expect(createDraftSchema.safeParse({
      title: '제목', content: 'a'.repeat(10001), category: 'general',
    }).success).toBe(false);
  });

  it('유효한 카테고리만 허용한다', () => {
    for (const cat of ['general', 'expense', 'leave', 'purchase', 'contract']) {
      expect(createDraftSchema.safeParse({
        title: 'T', content: 'C', category: cat,
      }).success).toBe(true);
    }
  });

  it('잘못된 카테고리를 거부한다', () => {
    expect(createDraftSchema.safeParse({
      title: 'T', content: 'C', category: 'invalid',
    }).success).toBe(false);
  });

  it('유효한 긴급도만 허용한다', () => {
    for (const urg of ['normal', 'urgent', 'emergency']) {
      expect(createDraftSchema.safeParse({
        title: 'T', content: 'C', category: 'general', urgency: urg,
      }).success).toBe(true);
    }
  });

  it('첨부파일 UUID 배열을 허용한다', () => {
    const result = createDraftSchema.safeParse({
      title: 'T', content: 'C', category: 'general',
      attachments: ['550e8400-e29b-41d4-a716-446655440000'],
    });
    expect(result.success).toBe(true);
  });

  it('잘못된 UUID 형식의 첨부파일을 거부한다', () => {
    expect(createDraftSchema.safeParse({
      title: 'T', content: 'C', category: 'general',
      attachments: ['not-a-uuid'],
    }).success).toBe(false);
  });
});

describe('updateDraftSchema (CSAP D-12)', () => {
  it('모든 필드가 선택적이다 (partial)', () => {
    expect(updateDraftSchema.safeParse({}).success).toBe(true);
  });

  it('제목만 수정을 허용한다', () => {
    expect(updateDraftSchema.safeParse({ title: '수정된 제목' }).success).toBe(true);
  });

  it('빈 제목을 거부한다', () => {
    expect(updateDraftSchema.safeParse({ title: '' }).success).toBe(false);
  });
});

describe('approvalLineSchema (FR-ECO3.2 결재선 설정)', () => {
  it('유효한 결재선을 허용한다', () => {
    const result = approvalLineSchema.safeParse({
      approvers: [
        { userId: '550e8400-e29b-41d4-a716-446655440000', order: 1, type: 'serial', role: 'approver' },
        { userId: '550e8400-e29b-41d4-a716-446655440001', order: 2, type: 'serial', role: 'final-approver' },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('빈 결재자 배열을 거부한다', () => {
    expect(approvalLineSchema.safeParse({ approvers: [] }).success).toBe(false);
  });

  it('잘못된 결재 유형을 거부한다', () => {
    expect(approvalLineSchema.safeParse({
      approvers: [{
        userId: '550e8400-e29b-41d4-a716-446655440000',
        order: 1, type: 'concurrent', role: 'approver',
      }],
    }).success).toBe(false);
  });

  it('잘못된 역할을 거부한다', () => {
    expect(approvalLineSchema.safeParse({
      approvers: [{
        userId: '550e8400-e29b-41d4-a716-446655440000',
        order: 1, type: 'serial', role: 'manager',
      }],
    }).success).toBe(false);
  });

  it('order가 0 이하이면 거부한다', () => {
    expect(approvalLineSchema.safeParse({
      approvers: [{
        userId: '550e8400-e29b-41d4-a716-446655440000',
        order: 0, type: 'serial', role: 'approver',
      }],
    }).success).toBe(false);
  });
});

describe('approvalActionSchema (FR-ECO3.3 결재 처리)', () => {
  it('코멘트 없이 승인을 허용한다', () => {
    expect(approvalActionSchema.safeParse({}).success).toBe(true);
  });

  it('코멘트를 허용한다', () => {
    expect(approvalActionSchema.safeParse({ comment: '승인합니다' }).success).toBe(true);
  });

  it('코멘트 500자 초과를 거부한다', () => {
    expect(approvalActionSchema.safeParse({ comment: 'a'.repeat(501) }).success).toBe(false);
  });
});

describe('documentFilterSchema (FR-ECO3.4 문서 조회)', () => {
  it('빈 필터를 허용한다 (기본값 적용)', () => {
    const result = documentFilterSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(20);
    }
  });

  it('유효한 상태 필터를 허용한다', () => {
    for (const status of ['draft', 'pending', 'approved', 'rejected', 'held']) {
      expect(documentFilterSchema.safeParse({ status }).success).toBe(true);
    }
  });

  it('잘못된 상태를 거부한다', () => {
    expect(documentFilterSchema.safeParse({ status: 'deleted' }).success).toBe(false);
  });

  it('limit 100 초과를 거부한다', () => {
    expect(documentFilterSchema.safeParse({ limit: '101' }).success).toBe(false);
  });

  it('page 0 이하를 거부한다', () => {
    expect(documentFilterSchema.safeParse({ page: '0' }).success).toBe(false);
  });
});
