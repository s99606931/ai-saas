// 전자결재 플러그인 결재 엔진 테스트
// Design Ref: MTU-ECO3 Design 2.1
// Plan SC: FR-ECO3.2, FR-ECO3.3
// CSAP: D-06 감사 로그, D-08 접근 통제

import { describe, it, expect } from 'vitest';
import { ApprovalEngine } from '../../src/lib/approval-engine';
import type { DocumentStatus } from '../../src/lib/document-status';

function createApprovers(count: number, type: 'serial' | 'parallel' = 'serial') {
  return Array.from({ length: count }, (_, i) => ({
    userId: `user-${i + 1}`,
    order: type === 'parallel' ? 1 : i + 1,
    type,
    role: i === count - 1 ? ('final-approver' as const) : ('approver' as const),
    status: 'pending' as const,
  }));
}

describe('ApprovalEngine (FR-ECO3.2 결재 엔진)', () => {
  describe('생성 및 초기 상태', () => {
    it('결재자 목록을 order 순서로 정렬한다', () => {
      const approvers = [
        {
          userId: 'u3',
          order: 3,
          type: 'serial' as const,
          role: 'final-approver' as const,
          status: 'pending' as const,
        },
        { userId: 'u1', order: 1, type: 'serial' as const, role: 'approver' as const, status: 'pending' as const },
        { userId: 'u2', order: 2, type: 'serial' as const, role: 'approver' as const, status: 'pending' as const },
      ];
      const engine = new ApprovalEngine(approvers, 'pending');
      const sorted = engine.getApprovers();
      expect(sorted[0].userId).toBe('u1');
      expect(sorted[1].userId).toBe('u2');
      expect(sorted[2].userId).toBe('u3');
    });

    it('초기 상태를 반환한다', () => {
      const engine = new ApprovalEngine(createApprovers(3), 'pending');
      expect(engine.getStatus()).toBe('pending');
    });

    it('원본 결재자 배열을 변경하지 않는다 (방어적 복사)', () => {
      const original = createApprovers(2);
      const engine = new ApprovalEngine(original, 'pending');
      engine.approve('user-1');
      expect(original[0].status).toBe('pending');
    });
  });

  describe('getCurrentApprovers (직렬 결재)', () => {
    it('직렬 결재 시 order=1인 결재자만 반환한다', () => {
      const engine = new ApprovalEngine(createApprovers(3), 'pending');
      const current = engine.getCurrentApprovers();
      expect(current).toHaveLength(1);
      expect(current[0].userId).toBe('user-1');
    });

    it('첫 번째 결재자 승인 후 다음 순서 결재자를 반환한다', () => {
      const engine = new ApprovalEngine(createApprovers(3), 'pending');
      engine.approve('user-1');
      const current = engine.getCurrentApprovers();
      expect(current).toHaveLength(1);
      expect(current[0].userId).toBe('user-2');
    });

    it('모든 결재자가 승인하면 빈 배열을 반환한다', () => {
      const engine = new ApprovalEngine(createApprovers(2), 'pending');
      engine.approve('user-1');
      engine.approve('user-2');
      const current = engine.getCurrentApprovers();
      expect(current).toHaveLength(0);
    });
  });

  describe('getCurrentApprovers (병렬 결재)', () => {
    it('병렬 결재 시 같은 order의 결재자 전부 반환한다', () => {
      const engine = new ApprovalEngine(createApprovers(3, 'parallel'), 'pending');
      const current = engine.getCurrentApprovers();
      expect(current).toHaveLength(3);
    });
  });

  describe('approve (승인)', () => {
    it('결재자를 승인 상태로 변경한다', () => {
      const engine = new ApprovalEngine(createApprovers(2), 'pending');
      engine.approve('user-1');
      const approvers = engine.getApprovers();
      expect(approvers[0].status).toBe('approved');
    });

    it('승인 시 processedAt 타임스탬프를 기록한다', () => {
      const engine = new ApprovalEngine(createApprovers(2), 'pending');
      engine.approve('user-1');
      const approvers = engine.getApprovers();
      expect(approvers[0].processedAt).toBeDefined();
      expect(new Date(approvers[0].processedAt!).getTime()).toBeLessThanOrEqual(Date.now());
    });

    it('코멘트와 함께 승인한다', () => {
      const engine = new ApprovalEngine(createApprovers(2), 'pending');
      engine.approve('user-1', '승인합니다');
      const approvers = engine.getApprovers();
      expect(approvers[0].comment).toBe('승인합니다');
    });

    it('모든 결재자 승인 시 문서 상태를 approved로 전환한다', () => {
      const engine = new ApprovalEngine(createApprovers(2), 'pending');
      engine.approve('user-1');
      const status = engine.approve('user-2');
      expect(status).toBe('approved');
      expect(engine.getStatus()).toBe('approved');
    });

    it('일부만 승인한 경우 문서 상태를 pending으로 유지한다', () => {
      const engine = new ApprovalEngine(createApprovers(3), 'pending');
      const status = engine.approve('user-1');
      expect(status).toBe('pending');
    });
  });

  describe('reject (반려)', () => {
    it('결재자를 rejected 상태로 변경한다', () => {
      const engine = new ApprovalEngine(createApprovers(2), 'pending');
      engine.reject('user-1', '반려합니다');
      const approvers = engine.getApprovers();
      expect(approvers[0].status).toBe('rejected');
      expect(approvers[0].comment).toBe('반려합니다');
    });

    it('반려 시 문서 상태를 rejected로 전환한다', () => {
      const engine = new ApprovalEngine(createApprovers(3), 'pending');
      const status = engine.reject('user-1');
      expect(status).toBe('rejected');
      expect(engine.getStatus()).toBe('rejected');
    });

    it('반려 시 processedAt을 기록한다', () => {
      const engine = new ApprovalEngine(createApprovers(2), 'pending');
      engine.reject('user-1');
      expect(engine.getApprovers()[0].processedAt).toBeDefined();
    });
  });

  describe('hold (보류)', () => {
    it('결재자를 held 상태로 변경한다', () => {
      const engine = new ApprovalEngine(createApprovers(2), 'pending');
      engine.hold('user-1', '검토 필요');
      const approvers = engine.getApprovers();
      expect(approvers[0].status).toBe('held');
      expect(approvers[0].comment).toBe('검토 필요');
    });

    it('보류 시 문서 상태를 held로 전환한다', () => {
      const engine = new ApprovalEngine(createApprovers(2), 'pending');
      const status = engine.hold('user-1');
      expect(status).toBe('held');
    });
  });

  describe('오류 처리', () => {
    it('존재하지 않는 결재자 ID로 승인 시 에러를 발생시킨다', () => {
      const engine = new ApprovalEngine(createApprovers(2), 'pending');
      expect(() => engine.approve('nonexistent')).toThrow('결재자를 찾을 수 없습니다');
    });

    it('현재 차례가 아닌 결재자가 승인 시 에러를 발생시킨다', () => {
      const engine = new ApprovalEngine(createApprovers(3), 'pending');
      expect(() => engine.approve('user-2')).toThrow('현재 결재 차례가 아닙니다');
    });

    it('현재 차례가 아닌 결재자가 반려 시 에러를 발생시킨다', () => {
      const engine = new ApprovalEngine(createApprovers(3), 'pending');
      expect(() => engine.reject('user-3')).toThrow('현재 결재 차례가 아닙니다');
    });

    it('현재 차례가 아닌 결재자가 보류 시 에러를 발생시킨다', () => {
      const engine = new ApprovalEngine(createApprovers(3), 'pending');
      expect(() => engine.hold('user-2')).toThrow('현재 결재 차례가 아닙니다');
    });
  });
});
