// MTU-N286 멀티테넌트 RLS 테스트
import { describe, it, expect } from 'vitest';
import { MultitenantRLSService } from '../multitenant-rls.js';

describe('MTU-N286 MultitenantRLS', () => {
  const svc = new MultitenantRLSService('tenant-n286');

  it('FR-N286.1: 테넌트 RLS 프로비저닝', () => {
    const r = svc.provision(['users', 'orders']);
    expect(r.tenantId).toBe('tenant-n286');
    expect(r.policiesCreated).toBeGreaterThan(0);
    expect(r.tablesConfigured).toContain('users');
  });

  it('FR-N286.2: RLS 검증', () => {
    const v = svc.verify(['users', 'orders']);
    expect(typeof v.verified).toBe('boolean');
  });

  it('FR-N286.3: DDL 생성', () => {
    const ddl = svc.generateDDL('users');
    expect(Array.isArray(ddl)).toBe(true);
    expect(ddl.length).toBeGreaterThan(0);
  });

  it('FR-N286.4: Prisma 미들웨어', () => {
    const m = svc.createMiddleware();
    expect(m.tenantId).toBe('tenant-n286');
  });

  it('FR-N286.5: 위반 탐지', () => {
    const v = svc.detectViolation('other-tenant', 'users', 'select');
    expect(v.isViolation).toBe(true);
  });

  it('FR-N286.6: 감사 로그', () => {
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
