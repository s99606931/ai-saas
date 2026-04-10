// Design Ref: MTU-ECO3 Design 2.1
// Plan SC: FR-ECO3.3

/**
 * 전자결재 문서 상태 머신
 *
 * 상태 흐름:
 * draft -> pending -> approved | rejected | held
 * held -> pending (재기안)
 * rejected -> draft (수정 후 재기안)
 */

export type DocumentStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'held';

const validTransitions: Record<DocumentStatus, DocumentStatus[]> = {
  draft: ['pending'],
  pending: ['approved', 'rejected', 'held'],
  approved: [],
  rejected: ['draft'],
  held: ['pending'],
};

/**
 * 상태 전이 가능 여부 확인
 */
export function canTransition(from: DocumentStatus, to: DocumentStatus): boolean {
  return validTransitions[from]?.includes(to) ?? false;
}

/**
 * 상태 전이 실행 (유효성 검사 포함)
 */
export function transition(from: DocumentStatus, to: DocumentStatus): DocumentStatus {
  if (!canTransition(from, to)) {
    throw new Error(`상태 전이 불가: ${from} -> ${to}. 가능한 전이: ${validTransitions[from].join(', ') || '없음'}`);
  }
  return to;
}

/**
 * 상태별 표시명 (한국어)
 */
export const statusLabels: Record<DocumentStatus, string> = {
  draft: '기안',
  pending: '결재 진행중',
  approved: '승인',
  rejected: '반려',
  held: '보류',
};
