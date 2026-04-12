// MTU-N336 접근 권한 검토 자동화 테스트
import { describe, it, expect } from 'vitest';
import { AccessReviewAutomationService } from '../access-review-automation.js';

describe('MTU-N336 AccessReviewAutomation', () => {
  const svc = new AccessReviewAutomationService('tenant-n336');

  it('FR-N336.1: 접근 권한 검토', () => {
    const campaign = svc.review('2026-Q2', [
      { userId: 'u1', userName: 'Alice', roles: ['admin'], lastLogin: '2026-04-01', department: 'IT', createdAt: '2023-01-01' },
      { userId: 'u2', userName: 'Bob', roles: ['user'], lastLogin: null, department: 'HR', createdAt: '2020-01-01' },
    ]);
    expect(campaign).toBeDefined();
    expect(campaign.totalUsers).toBe(2);
  });

  it('FR-N336.6: 감사 로그', () => {
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
