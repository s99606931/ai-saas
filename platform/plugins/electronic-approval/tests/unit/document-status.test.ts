// 전자결재 플러그인 문서 상태 머신 테스트
// Design Ref: MTU-ECO3 Design 2.1
// Plan SC: FR-ECO3.3
// CSAP: D-12 시스템 개발 보안 -- 상태 전이 무결성

import { describe, it, expect } from 'vitest';
import { canTransition, transition, statusLabels, type DocumentStatus } from '../../src/lib/document-status';

describe('canTransition (상태 전이 가능 여부)', () => {
  // 유효한 전이
  it('draft -> pending 전이를 허용한다', () => {
    expect(canTransition('draft', 'pending')).toBe(true);
  });

  it('pending -> approved 전이를 허용한다', () => {
    expect(canTransition('pending', 'approved')).toBe(true);
  });

  it('pending -> rejected 전이를 허용한다', () => {
    expect(canTransition('pending', 'rejected')).toBe(true);
  });

  it('pending -> held 전이를 허용한다', () => {
    expect(canTransition('pending', 'held')).toBe(true);
  });

  it('rejected -> draft 전이를 허용한다 (수정 후 재기안)', () => {
    expect(canTransition('rejected', 'draft')).toBe(true);
  });

  it('held -> pending 전이를 허용한다 (보류 해제)', () => {
    expect(canTransition('held', 'pending')).toBe(true);
  });

  // 무효한 전이
  it('approved -> 어디로든 전이를 불허한다 (최종 상태)', () => {
    const allStatuses: DocumentStatus[] = ['draft', 'pending', 'approved', 'rejected', 'held'];
    for (const target of allStatuses) {
      expect(canTransition('approved', target)).toBe(false);
    }
  });

  it('draft -> approved 직접 전이를 불허한다 (pending 거쳐야 함)', () => {
    expect(canTransition('draft', 'approved')).toBe(false);
  });

  it('draft -> rejected 직접 전이를 불허한다', () => {
    expect(canTransition('draft', 'rejected')).toBe(false);
  });

  it('rejected -> approved 직접 전이를 불허한다', () => {
    expect(canTransition('rejected', 'approved')).toBe(false);
  });

  it('held -> approved 직접 전이를 불허한다', () => {
    expect(canTransition('held', 'approved')).toBe(false);
  });

  it('pending -> draft 역방향 전이를 불허한다', () => {
    expect(canTransition('pending', 'draft')).toBe(false);
  });
});

describe('transition (상태 전이 실행)', () => {
  it('유효한 전이 시 새 상태를 반환한다', () => {
    expect(transition('draft', 'pending')).toBe('pending');
    expect(transition('pending', 'approved')).toBe('approved');
    expect(transition('pending', 'rejected')).toBe('rejected');
    expect(transition('pending', 'held')).toBe('held');
    expect(transition('rejected', 'draft')).toBe('draft');
    expect(transition('held', 'pending')).toBe('pending');
  });

  it('무효한 전이 시 에러를 발생시킨다', () => {
    expect(() => transition('draft', 'approved')).toThrow('상태 전이 불가');
  });

  it('에러 메시지에 현재 상태와 대상 상태를 포함한다', () => {
    expect(() => transition('approved', 'draft')).toThrow('approved -> draft');
  });

  it('에러 메시지에 가능한 전이 목록을 포함한다', () => {
    expect(() => transition('draft', 'rejected')).toThrow('가능한 전이: pending');
  });

  it('최종 상태에서 전이 시 "없음"을 표시한다', () => {
    expect(() => transition('approved', 'pending')).toThrow('가능한 전이: 없음');
  });
});

describe('statusLabels (한국어 상태 표시)', () => {
  it('모든 상태에 대한 한국어 레이블이 정의되어 있다', () => {
    const allStatuses: DocumentStatus[] = ['draft', 'pending', 'approved', 'rejected', 'held'];
    for (const status of allStatuses) {
      expect(statusLabels[status]).toBeDefined();
      expect(typeof statusLabels[status]).toBe('string');
      expect(statusLabels[status].length).toBeGreaterThan(0);
    }
  });

  it('정확한 한국어 레이블을 반환한다', () => {
    expect(statusLabels.draft).toBe('기안');
    expect(statusLabels.pending).toBe('결재 진행중');
    expect(statusLabels.approved).toBe('승인');
    expect(statusLabels.rejected).toBe('반려');
    expect(statusLabels.held).toBe('보류');
  });
});

describe('전체 결재 흐름 시나리오', () => {
  it('정상 흐름: draft -> pending -> approved', () => {
    let status: DocumentStatus = 'draft';
    status = transition(status, 'pending');
    expect(status).toBe('pending');
    status = transition(status, 'approved');
    expect(status).toBe('approved');
  });

  it('반려 후 재기안: draft -> pending -> rejected -> draft -> pending -> approved', () => {
    let status: DocumentStatus = 'draft';
    status = transition(status, 'pending');
    status = transition(status, 'rejected');
    status = transition(status, 'draft');
    status = transition(status, 'pending');
    status = transition(status, 'approved');
    expect(status).toBe('approved');
  });

  it('보류 후 재개: draft -> pending -> held -> pending -> approved', () => {
    let status: DocumentStatus = 'draft';
    status = transition(status, 'pending');
    status = transition(status, 'held');
    status = transition(status, 'pending');
    status = transition(status, 'approved');
    expect(status).toBe('approved');
  });
});
