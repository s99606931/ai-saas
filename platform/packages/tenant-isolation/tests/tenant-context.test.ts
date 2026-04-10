// TenantContext 단위 테스트
// Design Ref: SVC-TENANT-R14 Plan
// Plan SC: FR-TENANT.2

import { describe, it, expect, beforeEach } from 'vitest';
import { TenantContext, TenantContextError } from '../src/tenant-context.js';

describe('TenantContext', () => {
  let ctx: TenantContext;

  beforeEach(() => {
    ctx = new TenantContext();
  });

  it('컨텍스트 외부에서 getCurrentTenant가 null을 반환한다', () => {
    expect(ctx.getCurrentTenant()).toBeNull();
  });

  it('run() 내부에서 테넌트 정보에 접근한다', () => {
    const result = ctx.run({ tenantId: 'tenant-001' }, () => {
      return ctx.getCurrentTenant();
    });

    expect(result).not.toBeNull();
    expect(result!.tenantId).toBe('tenant-001');
  });

  it('run() 종료 후 컨텍스트가 정리된다', () => {
    ctx.run({ tenantId: 'tenant-001' }, () => {
      // 내부에서는 접근 가능
      expect(ctx.getCurrentTenant()?.tenantId).toBe('tenant-001');
    });

    // 외부에서는 null
    expect(ctx.getCurrentTenant()).toBeNull();
  });

  it('중첩 run()이 각각 독립 컨텍스트를 유지한다', () => {
    ctx.run({ tenantId: 'outer' }, () => {
      expect(ctx.getCurrentTenant()?.tenantId).toBe('outer');

      ctx.run({ tenantId: 'inner' }, () => {
        expect(ctx.getCurrentTenant()?.tenantId).toBe('inner');
      });

      // 외부 컨텍스트 복원
      expect(ctx.getCurrentTenant()?.tenantId).toBe('outer');
    });
  });

  it('requireTenantId()가 컨텍스트 없이 에러를 발생한다', () => {
    expect(() => ctx.requireTenantId()).toThrow(TenantContextError);
    expect(() => ctx.requireTenantId()).toThrow('테넌트 컨텍스트가 설정되지 않았습니다');
  });

  it('requireTenantId()가 컨텍스트 내에서 ID를 반환한다', () => {
    const result = ctx.run({ tenantId: 'tenant-abc' }, () => {
      return ctx.requireTenantId();
    });

    expect(result).toBe('tenant-abc');
  });

  it('extractTenantId()가 X-Tenant-Id 헤더에서 추출한다', () => {
    const result = ctx.extractTenantId({
      'x-tenant-id': 'tenant-from-header',
    });

    expect(result).toBe('tenant-from-header');
  });

  it('extractTenantId()가 빈 헤더에서 null을 반환한다', () => {
    expect(ctx.extractTenantId({})).toBeNull();
    expect(ctx.extractTenantId({ 'x-tenant-id': '' })).toBeNull();
  });

  it('validateTenantSwitch()가 SUPER_ADMIN만 허용한다', () => {
    const superAdmin = { tenantId: 'admin-tenant', isSuperAdmin: true };
    const normalUser = { tenantId: 'user-tenant', isSuperAdmin: false };

    expect(ctx.validateTenantSwitch(superAdmin, 'target-tenant')).toBe(true);
    expect(ctx.validateTenantSwitch(normalUser, 'target-tenant')).toBe(false);
  });

  it('validateTenantSwitch()가 빈 대상 테넌트를 거부한다', () => {
    const superAdmin = { tenantId: 'admin-tenant', isSuperAdmin: true };

    expect(ctx.validateTenantSwitch(superAdmin, '')).toBe(false);
  });

  it('run()이 반환값을 전달한다', () => {
    const result = ctx.run({ tenantId: 'test' }, () => {
      return 42;
    });

    expect(result).toBe(42);
  });
});
