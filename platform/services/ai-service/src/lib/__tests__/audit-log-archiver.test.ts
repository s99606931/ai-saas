// MTU-N352 감사 로그 아카이버 테스트
import { describe, it, expect } from 'vitest';
import { AuditLogArchiverService } from '../audit-log-archiver.js';

describe('MTU-N352 AuditLogArchiver', () => {
  const svc = new AuditLogArchiverService('tenant-n352');

  it('FR-N352.1: 레코드 수집', () => {
    const r = svc.ingest('admin', 'USER_DELETE', 'user-1', '관리자 요청');
    expect(r).toBeDefined();
  });

  it('FR-N352.2: 아카이브', () => {
    svc.ingest('system', 'LOGIN', 'user-2', 'success');
    const batch = svc.archive('2099-01-01');
    expect(batch).toBeDefined();
  });

  it('FR-N352.3: 검색', () => {
    svc.ingest('admin', 'EXPORT', 'data', 'test');
    const result = svc.search('EXPORT');
    expect(result).toBeDefined();
  });

  it('FR-N352.6: 감사 로그', () => {
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
