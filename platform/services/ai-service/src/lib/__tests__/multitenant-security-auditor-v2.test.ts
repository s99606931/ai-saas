import { describe, it, expect, beforeEach } from 'vitest';
import { MultitenantSecurityAuditorV2, type AccessLog } from '../multitenant-security-auditor-v2';

describe('MultitenantSecurityAuditorV2', () => {
  let auditor: MultitenantSecurityAuditorV2;

  beforeEach(() => {
    auditor = new MultitenantSecurityAuditorV2();
  });

  it('detects CROSS_TENANT_ACCESS as CRITICAL violation', () => {
    const logs: AccessLog[] = [
      { logId: 'L1', tenantId: 'T1', userId: 'user0001', resource: 'data', action: 'READ', targetTenantId: 'T2' },
    ];
    const report = auditor.audit(logs);
    expect(report.findings[0]!.violation).toBe('CROSS_TENANT_ACCESS');
    expect(report.findings[0]!.severity).toBe('CRITICAL');
  });

  it('detects UNAUTHORIZED_ACTION for DELETE as HIGH', () => {
    const logs: AccessLog[] = [
      { logId: 'L2', tenantId: 'T1', userId: 'user0002', resource: 'record', action: 'DELETE' },
    ];
    const report = auditor.audit(logs);
    expect(report.findings[0]!.violation).toBe('UNAUTHORIZED_ACTION');
    expect(report.findings[0]!.severity).toBe('HIGH');
  });

  it('excludes normal READ action from findings', () => {
    const logs: AccessLog[] = [
      { logId: 'L3', tenantId: 'T1', userId: 'user0003', resource: 'public', action: 'READ' },
    ];
    const report = auditor.audit(logs);
    expect(report.findings).toHaveLength(0);
    expect(report.violations).toBe(0);
  });

  it('masks userId in findings', () => {
    const logs: AccessLog[] = [
      { logId: 'L4', tenantId: 'T1', userId: 'user1234', resource: 'data', action: 'ADMIN' },
    ];
    const report = auditor.audit(logs);
    // 'user1234' len=8: 'us' + '****' + '34'
    expect(report.findings[0]!.maskedUserId).toBe('us****34');
  });

  it('counts total and violations correctly', () => {
    const logs: AccessLog[] = [
      { logId: 'L5', tenantId: 'T1', userId: 'userAAAA', resource: 'd', action: 'READ' },
      { logId: 'L6', tenantId: 'T1', userId: 'userBBBB', resource: 'd', action: 'DELETE' },
    ];
    const report = auditor.audit(logs);
    expect(report.total).toBe(2);
    expect(report.violations).toBe(1);
  });

  it('records audit log', () => {
    auditor.audit([
      { logId: 'L7', tenantId: 'T2', userId: 'userCCCC', resource: 'x', action: 'READ' },
    ]);
    const log = auditor.getAuditLog();
    expect(log[0]!.action).toBe('security.audit');
  });
});
