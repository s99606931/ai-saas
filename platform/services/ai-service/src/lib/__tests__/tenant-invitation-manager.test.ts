// MTU-N360 테넌트 초대/온보딩 테스트
import { describe, it, expect } from 'vitest';
import { TenantInvitationManagerService, completeStep } from '../tenant-invitation-manager.js';

describe('MTU-N360 TenantInvitationManager', () => {
  const svc = new TenantInvitationManagerService('tenant-n360');

  it('FR-N360.1: 초대 생성', () => {
    const inv = svc.invite('admin@gov.kr', 'admin');
    expect(inv.status).toBe('pending');
    expect(inv.token.length).toBeGreaterThan(10);
  });

  it('FR-N360.2: 초대 수락', () => {
    const inv = svc.invite('user@gov.kr', 'user');
    const accepted = svc.accept(inv.token);
    expect(accepted?.status).toBe('accepted');
  });

  it('FR-N360.3: 온보딩 체크리스트', () => {
    const cl = svc.onboard('user-1');
    expect(cl.steps.length).toBeGreaterThan(0);
    const updated = completeStep(cl, cl.steps[0]!.stepId);
    expect(updated.completionRate).toBeGreaterThan(0);
  });

  it('FR-N360.4: 감사 로그', () => {
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
