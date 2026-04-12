// MTU-N300 정보공개 청구 자동 심사 테스트
import { describe, it, expect } from 'vitest';
import { InfoDisclosureReviewerService } from '../info-disclosure-reviewer.js';

describe('MTU-N300 InfoDisclosureReviewer', () => {
  const svc = new InfoDisclosureReviewerService('tenant-n300');

  const request = {
    requestId: 'req-1',
    tenantId: 'tenant-n300',
    applicant: '홍길동',
    requestDate: '2026-04-11',
    subject: '공공조달 계약 내역 공개 요청',
    description: '2025년 조달청 계약 내역 공개 요청합니다',
    targetInfo: '조달계약서',
    purpose: '학술연구',
  };

  it('FR-N300.1: 주제 분류', () => {
    const topic = svc.classify(request);
    expect(typeof topic).toBe('string');
  });

  it('FR-N300.2/3: 심사 결정', () => {
    const decision = svc.review(request);
    expect(decision).toBeDefined();
  });

  it('FR-N300.5: 리포트 생성', () => {
    const decision = svc.review(request);
    const report = svc.generateReport(request, decision);
    expect(report).toBeDefined();
  });

  it('FR-N300.6: 감사 로그', () => {
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
