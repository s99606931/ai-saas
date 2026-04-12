// MTU-N303 테넌트 백업/복원 테스트
import { describe, it, expect } from 'vitest';
import { TenantBackupRestoreService } from '../tenant-backup-restore.js';

describe('MTU-N303 TenantBackupRestore', () => {
  const svc = new TenantBackupRestoreService('tenant-n303');

  it('FR-N303.1: 백업 정책 생성', () => {
    const p = svc.createPolicy('full', 'daily', 7);
    expect(p).toBeDefined();
    expect(svc.getPolicies().length).toBeGreaterThan(0);
  });

  it('FR-N303.2: 백업 실행', () => {
    const p = svc.createPolicy('incremental', 'hourly');
    const rec = svc.backup(p.policyId);
    expect(rec).toBeDefined();
    expect(svc.getBackups().length).toBeGreaterThan(0);
  });

  it('FR-N303.3: 복원 요청', () => {
    const p = svc.createPolicy('full', 'weekly');
    const rec = svc.backup(p.policyId);
    const restore = svc.restore(rec.backupId);
    expect(restore).toBeDefined();
  });

  it('FR-N303.4: 무결성 검증', () => {
    const p = svc.createPolicy('full', 'daily');
    const rec = svc.backup(p.policyId);
    const check = svc.verify(rec.backupId);
    expect(check).toBeDefined();
  });

  it('FR-N303.6: 감사 로그', () => {
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
