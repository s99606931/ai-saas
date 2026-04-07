// Design Ref: MTU-ECO3 Design 2.1
// Plan SC: FR-ECO3.2, FR-ECO3.3

import { type DocumentStatus, transition } from './document-status';

/**
 * 결재자 정보
 */
interface Approver {
  userId: string;
  order: number;
  type: 'serial' | 'parallel';
  role: 'approver' | 'reviewer' | 'final-approver';
  status: 'pending' | 'approved' | 'rejected' | 'held';
  processedAt?: string;
  comment?: string;
}

/**
 * 결재 엔진
 * 직렬/병렬 결재를 지원하는 결재 처리 엔진
 */
export class ApprovalEngine {
  private approvers: Approver[];
  private documentStatus: DocumentStatus;

  constructor(approvers: Approver[], documentStatus: DocumentStatus) {
    // 방어적 깊은 복사: 외부 배열 변경이 엔진 내부 상태에 영향을 주지 않도록 함
    this.approvers = approvers.map(a => ({ ...a })).sort((a, b) => a.order - b.order);
    this.documentStatus = documentStatus;
  }

  /**
   * 현재 결재 차례인 결재자 목록 반환
   * - 직렬: 이전 순서 결재자가 모두 승인한 경우 다음 순서
   * - 병렬: 같은 순서의 결재자들은 동시 결재 가능
   */
  getCurrentApprovers(): Approver[] {
    const pendingApprovers = this.approvers.filter(a => a.status === 'pending');
    if (pendingApprovers.length === 0) return [];

    const minOrder = Math.min(...pendingApprovers.map(a => a.order));
    return pendingApprovers.filter(a => a.order === minOrder);
  }

  /**
   * 결재 처리 (승인)
   */
  approve(userId: string, comment?: string): DocumentStatus {
    const approver = this.findApprover(userId);
    this.validateCurrentTurn(approver);

    approver.status = 'approved';
    approver.processedAt = new Date().toISOString();
    approver.comment = comment;

    return this.evaluateOverallStatus();
  }

  /**
   * 결재 처리 (반려)
   */
  reject(userId: string, comment?: string): DocumentStatus {
    const approver = this.findApprover(userId);
    this.validateCurrentTurn(approver);

    approver.status = 'rejected';
    approver.processedAt = new Date().toISOString();
    approver.comment = comment;

    this.documentStatus = transition(this.documentStatus, 'rejected');
    return this.documentStatus;
  }

  /**
   * 결재 처리 (보류)
   */
  hold(userId: string, comment?: string): DocumentStatus {
    const approver = this.findApprover(userId);
    this.validateCurrentTurn(approver);

    approver.status = 'held';
    approver.processedAt = new Date().toISOString();
    approver.comment = comment;

    this.documentStatus = transition(this.documentStatus, 'held');
    return this.documentStatus;
  }

  /**
   * 전체 결재 상태 평가
   */
  private evaluateOverallStatus(): DocumentStatus {
    const allApproved = this.approvers.every(a => a.status === 'approved');
    if (allApproved) {
      this.documentStatus = transition(this.documentStatus, 'approved');
    }
    return this.documentStatus;
  }

  private findApprover(userId: string): Approver {
    const approver = this.approvers.find(a => a.userId === userId);
    if (!approver) {
      throw new Error(`결재자를 찾을 수 없습니다: ${userId}`);
    }
    return approver;
  }

  private validateCurrentTurn(approver: Approver): void {
    const currentApprovers = this.getCurrentApprovers();
    const isCurrent = currentApprovers.some(a => a.userId === approver.userId);
    if (!isCurrent) {
      throw new Error('현재 결재 차례가 아닙니다');
    }
  }

  getApprovers(): Approver[] {
    return [...this.approvers];
  }

  getStatus(): DocumentStatus {
    return this.documentStatus;
  }
}
