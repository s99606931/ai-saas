// MTU-N347 테넌트 데이터 내보내기 테스트
import { describe, it, expect } from 'vitest';
import { TenantDataExportService } from '../tenant-data-export.js';

describe('MTU-N347 TenantDataExport', () => {
  const svc = new TenantDataExportService('tenant-n347');

  it('FR-N347.1: 내보내기 작업 생성', () => {
    const job = svc.create('json', ['users', 'orders'], true);
    expect(job).toBeDefined();
  });

  it('FR-N347.2: 내보내기 실행', () => {
    const job = svc.create('csv', ['logs'], false);
    const result = svc.execute(job, [
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
    ]);
    expect(result).toBeDefined();
  });

  it('FR-N347.6: 감사 로그', () => {
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
