// Plan SC: FR-R84.1~5
import { describe, it, expect } from 'vitest';
import {
  TenantIsolationViolation,
  createTenantIsolationVerifier,
  type AccessContext,
} from '../tenant-isolation-verifier';

function ctx(
  actorTenantId: string,
  resourceId: string,
  action: 'read' | 'write' | 'delete' = 'read',
): AccessContext {
  return { actorId: 'u1', actorTenantId, resourceId, action };
}

describe('TenantIsolationVerifier', () => {
  it('FR-R84.1: registers resources', () => {
    const v = createTenantIsolationVerifier();
    v.register({ resourceId: 'r1', ownerTenantId: 't1', kind: 'document' });
    expect(v.getAuditLog()[0]?.action).toBe('REGISTER');
  });

  it('FR-R84.2: owner access allowed', () => {
    const v = createTenantIsolationVerifier();
    v.register({ resourceId: 'r1', ownerTenantId: 't1', kind: 'document' });
    expect(() => v.verify(ctx('t1', 'r1', 'read'))).not.toThrow();
    expect(() => v.verify(ctx('t1', 'r1', 'write'))).not.toThrow();
  });

  it('FR-R84.3: cross-tenant access denied', () => {
    const v = createTenantIsolationVerifier();
    v.register({ resourceId: 'r1', ownerTenantId: 't1', kind: 'document' });
    expect(() => v.verify(ctx('t2', 'r1', 'read'))).toThrow(TenantIsolationViolation);
  });

  it('FR-R84.3: unknown resource denied', () => {
    const v = createTenantIsolationVerifier();
    expect(() => v.verify(ctx('t1', 'unknown'))).toThrow(TenantIsolationViolation);
  });

  it('FR-R84.4: shared read allowed, write denied', () => {
    const v = createTenantIsolationVerifier();
    v.register({
      resourceId: 'r1',
      ownerTenantId: 't1',
      kind: 'dataset',
      sharedWith: ['t2'],
    });
    expect(() => v.verify(ctx('t2', 'r1', 'read'))).not.toThrow();
    expect(() => v.verify(ctx('t2', 'r1', 'write'))).toThrow(TenantIsolationViolation);
  });

  it('FR-R84.4: share() grants read access dynamically', () => {
    const v = createTenantIsolationVerifier();
    v.register({ resourceId: 'r1', ownerTenantId: 't1', kind: 'agent' });
    expect(v.canAccess(ctx('t2', 'r1'))).toBe(false);
    v.share('r1', 't2');
    expect(v.canAccess(ctx('t2', 'r1'))).toBe(true);
  });

  it('FR-R84.5: audit log contains ALLOW and DENY', () => {
    const v = createTenantIsolationVerifier();
    v.register({ resourceId: 'r1', ownerTenantId: 't1', kind: 'document' });
    v.canAccess(ctx('t1', 'r1'));
    v.canAccess(ctx('tX', 'r1'));
    const log = v.getAuditLog();
    expect(log.some((e) => e.action === 'ALLOW')).toBe(true);
    expect(log.some((e) => e.action === 'DENY')).toBe(true);
  });

  it('canAccess returns false on violation without throwing', () => {
    const v = createTenantIsolationVerifier();
    v.register({ resourceId: 'r1', ownerTenantId: 't1', kind: 'session' });
    expect(v.canAccess(ctx('t2', 'r1'))).toBe(false);
  });

  it('unregister removes resource', () => {
    const v = createTenantIsolationVerifier();
    v.register({ resourceId: 'r1', ownerTenantId: 't1', kind: 'embedding' });
    v.unregister('r1');
    expect(v.canAccess(ctx('t1', 'r1'))).toBe(false);
  });
});
