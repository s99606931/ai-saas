// RowLevelSecurity 단위 테스트
// Design Ref: SVC-TENANT-R14 Plan
// Plan SC: FR-TENANT.3

import { describe, it, expect, beforeEach } from 'vitest';
import { TenantContext } from '../src/tenant-context.js';
import { RowLevelSecurity } from '../src/row-level-security.js';

describe('RowLevelSecurity', () => {
  let ctx: TenantContext;
  let rls: RowLevelSecurity;

  beforeEach(() => {
    ctx = new TenantContext();
    rls = new RowLevelSecurity(ctx);
  });

  describe('wrapSelect', () => {
    it('SELECT에 tenant_id 조건을 추가한다', () => {
      const result = ctx.run({ tenantId: 'tenant-001' }, () => {
        return rls.wrapSelect('SELECT * FROM users');
      });

      expect(result.type).toBe('SELECT');
      expect(result.tenantCondition).toBe("tenant_id = 'tenant-001'");
      expect(result.tenantId).toBe('tenant-001');
      expect(result.originalQuery).toBe('SELECT * FROM users');
    });

    it('테넌트 컨텍스트 없이 에러를 발생한다', () => {
      expect(() => rls.wrapSelect('SELECT * FROM users')).toThrow(
        '테넌트 컨텍스트가 설정되지 않았습니다',
      );
    });
  });

  describe('wrapInsert', () => {
    it('INSERT 데이터에 tenant_id를 주입한다', () => {
      const result = ctx.run({ tenantId: 'tenant-002' }, () => {
        return rls.wrapInsert({ name: 'John', email: 'john@example.com' });
      });

      expect(result).toEqual({
        name: 'John',
        email: 'john@example.com',
        tenant_id: 'tenant-002',
      });
    });

    it('기존 tenant_id를 덮어쓴다', () => {
      const result = ctx.run({ tenantId: 'correct-tenant' }, () => {
        return rls.wrapInsert({ name: 'Test', tenant_id: 'wrong-tenant' });
      });

      expect(result['tenant_id']).toBe('correct-tenant');
    });
  });

  describe('wrapUpdate', () => {
    it('UPDATE에 tenant_id 조건을 추가한다', () => {
      const result = ctx.run({ tenantId: 'tenant-003' }, () => {
        return rls.wrapUpdate('UPDATE users SET name = ?');
      });

      expect(result.type).toBe('UPDATE');
      expect(result.tenantCondition).toBe("tenant_id = 'tenant-003'");
    });
  });

  describe('wrapDelete', () => {
    it('DELETE에 tenant_id 조건을 추가한다', () => {
      const result = ctx.run({ tenantId: 'tenant-004' }, () => {
        return rls.wrapDelete('DELETE FROM users WHERE id = ?');
      });

      expect(result.type).toBe('DELETE');
      expect(result.tenantCondition).toBe("tenant_id = 'tenant-004'");
    });
  });

  describe('validateAccess', () => {
    it('동일 테넌트 데이터 접근을 허용한다', () => {
      const result = ctx.run({ tenantId: 'tenant-A' }, () => {
        return rls.validateAccess('tenant-A');
      });

      expect(result).toBe(true);
    });

    it('다른 테넌트 데이터 접근을 차단한다', () => {
      const result = ctx.run({ tenantId: 'tenant-A' }, () => {
        return rls.validateAccess('tenant-B');
      });

      expect(result).toBe(false);
    });

    it('SUPER_ADMIN은 모든 테넌트 데이터에 접근 가능하다', () => {
      const result = ctx.run({ tenantId: 'admin', isSuperAdmin: true }, () => {
        return rls.validateAccess('any-tenant');
      });

      expect(result).toBe(true);
    });

    it('컨텍스트 없이 접근을 차단한다', () => {
      const result = rls.validateAccess('some-tenant');

      expect(result).toBe(false);
    });
  });

  describe('감사 로그', () => {
    it('RLS 적용 시 감사 이벤트를 기록한다', () => {
      ctx.run({ tenantId: 'audit-test' }, () => {
        rls.wrapSelect('SELECT * FROM orders');
      });

      const log = rls.getAuditLog();
      expect(log).toHaveLength(1);
      expect(log[0]!.action).toBe('RLS_APPLIED');
      expect(log[0]!.tenantId).toBe('audit-test');
      expect(log[0]!.queryType).toBe('SELECT');
    });

    it('교차 테넌트 접근 시도를 기록한다', () => {
      ctx.run({ tenantId: 'tenant-X' }, () => {
        rls.validateAccess('tenant-Y');
      });

      const log = rls.getAuditLog();
      const bypassAttempt = log.find((e) => e.action === 'RLS_BYPASS_ATTEMPT');
      expect(bypassAttempt).toBeDefined();
      expect(bypassAttempt!.tenantId).toBe('tenant-X');
    });

    it('컨텍스트 누락 시 감사 이벤트를 기록한다', () => {
      try {
        rls.wrapSelect('SELECT * FROM users');
      } catch {
        // 에러 무시
      }

      const log = rls.getAuditLog();
      const contextMissing = log.find((e) => e.action === 'RLS_CONTEXT_MISSING');
      expect(contextMissing).toBeDefined();
    });

    it('clearAuditLog()가 감사 로그를 초기화한다', () => {
      ctx.run({ tenantId: 'test' }, () => {
        rls.wrapSelect('query');
      });

      expect(rls.getAuditLog()).toHaveLength(1);

      rls.clearAuditLog();
      expect(rls.getAuditLog()).toHaveLength(0);
    });
  });

  describe('커스텀 컬럼명', () => {
    it('커스텀 tenant_id 컬럼명을 사용한다', () => {
      const customRls = new RowLevelSecurity(ctx, 'organization_id');

      const result = ctx.run({ tenantId: 'org-001' }, () => {
        return customRls.wrapSelect('SELECT * FROM projects');
      });

      expect(result.tenantCondition).toBe("organization_id = 'org-001'");
    });
  });
});
