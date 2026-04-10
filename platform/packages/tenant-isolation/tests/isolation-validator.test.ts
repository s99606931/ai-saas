// IsolationValidator 단위 테스트
// Design Ref: SVC-TENANT-R14 Plan
// Plan SC: FR-TENANT.5

import { describe, it, expect, beforeEach } from 'vitest';
import { TenantContext } from '../src/tenant-context.js';
import { RowLevelSecurity } from '../src/row-level-security.js';
import { IsolationValidator } from '../src/isolation-validator.js';

describe('IsolationValidator', () => {
  let ctx: TenantContext;
  let rls: RowLevelSecurity;
  let validator: IsolationValidator;

  beforeEach(() => {
    ctx = new TenantContext();
    rls = new RowLevelSecurity(ctx);
    validator = new IsolationValidator(ctx, rls);
  });

  it('테넌트 컨텍스트 내에서 모든 검증을 통과한다', () => {
    const report = ctx.run({ tenantId: 'test-tenant-a' }, () => {
      return validator.validate();
    });

    expect(report.allPassed).toBe(true);
    expect(report.tenantId).toBe('test-tenant-a');
    expect(report.checks).toHaveLength(4);
    expect(report.summary).toBe('4/4 통과');
  });

  it('테넌트 컨텍스트 없이 모든 검증이 실패한다', () => {
    const report = validator.validate();

    expect(report.allPassed).toBe(false);
    expect(report.tenantId).toBeNull();
    expect(report.checks.every((c) => !c.passed)).toBe(true);
  });

  it('개별 검증 항목을 확인한다', () => {
    const report = ctx.run({ tenantId: 'test-tenant-a' }, () => {
      return validator.validate();
    });

    const checkNames = report.checks.map((c) => c.check);
    expect(checkNames).toContain('tenant_context');
    expect(checkNames).toContain('rls_select');
    expect(checkNames).toContain('rls_insert');
    expect(checkNames).toContain('cross_tenant_block');
  });

  it('교차 테넌트 접근 차단을 검증한다', () => {
    const report = ctx.run({ tenantId: 'test-tenant-a' }, () => {
      return validator.validate();
    });

    const crossCheck = report.checks.find((c) => c.check === 'cross_tenant_block');
    expect(crossCheck).toBeDefined();
    expect(crossCheck!.passed).toBe(true);
    expect(crossCheck!.message).toContain('test-tenant-b');
  });

  it('SUPER_ADMIN 컨텍스트에서도 검증이 수행된다', () => {
    const report = ctx.run({ tenantId: 'admin', isSuperAdmin: true }, () => {
      return validator.validate();
    });

    // SUPER_ADMIN은 교차 테넌트 차단이 안 됨 (의도적)
    const crossCheck = report.checks.find((c) => c.check === 'cross_tenant_block');
    expect(crossCheck).toBeDefined();
    // SUPER_ADMIN은 접근이 허용되므로 차단 검증은 실패
    expect(crossCheck!.passed).toBe(false);
  });

  it('보고서에 타임스탬프가 포함된다', () => {
    const report = ctx.run({ tenantId: 'ts-test' }, () => {
      return validator.validate();
    });

    expect(report.timestamp).toBeDefined();
    expect(new Date(report.timestamp).getTime()).toBeGreaterThan(0);
  });
});
