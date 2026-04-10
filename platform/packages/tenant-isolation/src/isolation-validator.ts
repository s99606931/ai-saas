// 테넌트 격리 검증 유틸리티
// Design Ref: SVC-TENANT-R14 Plan
// Plan SC: FR-TENANT.5
// CSAP: D-08 접근 통제

import { TenantContext } from './tenant-context.js';
import { RowLevelSecurity } from './row-level-security.js';

/**
 * 격리 검증 결과
 */
export interface IsolationCheckResult {
  /** 검사 항목 이름 */
  check: string;
  /** 통과 여부 */
  passed: boolean;
  /** 상세 메시지 */
  message: string;
}

/**
 * 격리 검증 보고서
 */
export interface IsolationReport {
  /** 검증 시각 */
  timestamp: string;
  /** 현재 테넌트 ID */
  tenantId: string | null;
  /** 전체 통과 여부 */
  allPassed: boolean;
  /** 개별 검사 결과 */
  checks: IsolationCheckResult[];
  /** 통과 수 / 전체 수 */
  summary: string;
}

/**
 * 테넌트 격리 검증기
 *
 * 멀티테넌시 환경에서 데이터 격리가 올바르게 작동하는지 검증합니다.
 */
export class IsolationValidator {
  private readonly tenantContext: TenantContext;
  private readonly rls: RowLevelSecurity;

  constructor(tenantContext: TenantContext, rls: RowLevelSecurity) {
    this.tenantContext = tenantContext;
    this.rls = rls;
  }

  /**
   * 전체 격리 검증 실행
   */
  validate(): IsolationReport {
    const checks: IsolationCheckResult[] = [];

    checks.push(this.checkTenantContext());
    checks.push(this.checkRlsSelectEnforcement());
    checks.push(this.checkRlsInsertEnforcement());
    checks.push(this.checkCrossTenantBlocking());

    const passedCount = checks.filter((c) => c.passed).length;
    const allPassed = checks.every((c) => c.passed);

    return {
      timestamp: new Date().toISOString(),
      tenantId: this.tenantContext.getCurrentTenant()?.tenantId ?? null,
      allPassed,
      checks,
      summary: `${passedCount}/${checks.length} 통과`,
    };
  }

  /**
   * 테넌트 컨텍스트 존재 확인
   */
  private checkTenantContext(): IsolationCheckResult {
    const tenant = this.tenantContext.getCurrentTenant();

    if (tenant && tenant.tenantId.length > 0) {
      return {
        check: 'tenant_context',
        passed: true,
        message: `테넌트 컨텍스트 활성: ${tenant.tenantId}`,
      };
    }

    return {
      check: 'tenant_context',
      passed: false,
      message: '테넌트 컨텍스트가 설정되지 않았습니다',
    };
  }

  /**
   * RLS SELECT 조건 자동 적용 확인
   */
  private checkRlsSelectEnforcement(): IsolationCheckResult {
    try {
      const result = this.rls.wrapSelect('SELECT * FROM users');

      if (result.tenantCondition && result.tenantId) {
        return {
          check: 'rls_select',
          passed: true,
          message: `SELECT에 RLS 조건 적용됨: ${result.tenantCondition}`,
        };
      }

      return {
        check: 'rls_select',
        passed: false,
        message: 'SELECT에 RLS 조건이 적용되지 않았습니다',
      };
    } catch {
      return {
        check: 'rls_select',
        passed: false,
        message: 'RLS SELECT 검증 실패 (테넌트 컨텍스트 없음)',
      };
    }
  }

  /**
   * RLS INSERT tenant_id 자동 주입 확인
   */
  private checkRlsInsertEnforcement(): IsolationCheckResult {
    try {
      const result = this.rls.wrapInsert({ name: 'test' });

      if (result['tenant_id']) {
        return {
          check: 'rls_insert',
          passed: true,
          message: `INSERT에 tenant_id 자동 주입됨: ${String(result['tenant_id'])}`,
        };
      }

      return {
        check: 'rls_insert',
        passed: false,
        message: 'INSERT에 tenant_id가 주입되지 않았습니다',
      };
    } catch {
      return {
        check: 'rls_insert',
        passed: false,
        message: 'RLS INSERT 검증 실패 (테넌트 컨텍스트 없음)',
      };
    }
  }

  /**
   * 교차 테넌트 접근 차단 확인
   */
  private checkCrossTenantBlocking(): IsolationCheckResult {
    const currentTenant = this.tenantContext.getCurrentTenant();

    if (!currentTenant) {
      return {
        check: 'cross_tenant_block',
        passed: false,
        message: '테넌트 컨텍스트 없음으로 검증 불가',
      };
    }

    // 다른 테넌트 ID로 접근 시도
    const otherTenantId = currentTenant.tenantId === 'test-tenant-a'
      ? 'test-tenant-b'
      : 'test-tenant-a';
    const blocked = !this.rls.validateAccess(otherTenantId);

    if (blocked) {
      return {
        check: 'cross_tenant_block',
        passed: true,
        message: `교차 테넌트 접근 차단됨: ${otherTenantId}`,
      };
    }

    return {
      check: 'cross_tenant_block',
      passed: false,
      message: `교차 테넌트 접근이 차단되지 않았습니다: ${otherTenantId}`,
    };
  }
}
