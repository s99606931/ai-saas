// Row-Level Security 자동 적용 미들웨어
// Design Ref: SVC-TENANT-R14 Plan
// Plan SC: FR-TENANT.3
// CSAP: D-08 접근 통제

import { TenantContext, TenantContextError } from './tenant-context.js';

/**
 * RLS 쿼리 유형
 */
export type QueryType = 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';

/**
 * RLS 래핑 결과
 */
export interface RlsWrappedQuery {
  /** 원본 쿼리 유형 */
  type: QueryType;
  /** 테넌트 ID가 적용된 WHERE 조건 */
  tenantCondition: string;
  /** 테넌트 ID 값 */
  tenantId: string;
  /** 원본 쿼리 */
  originalQuery: string;
}

/**
 * RLS 감사 이벤트
 */
export interface RlsAuditEvent {
  timestamp: string;
  action: 'RLS_APPLIED' | 'RLS_BYPASS_ATTEMPT' | 'RLS_CONTEXT_MISSING';
  tenantId: string | null;
  queryType: QueryType;
  details: string;
}

/**
 * Row-Level Security 관리자
 *
 * 모든 DB 쿼리에 tenant_id 조건을 자동 추가하여
 * 테넌트 간 데이터 격리를 보장합니다.
 */
export class RowLevelSecurity {
  private readonly tenantContext: TenantContext;
  private readonly tenantColumn: string;
  private readonly auditLog: RlsAuditEvent[] = [];

  constructor(tenantContext: TenantContext, tenantColumn = 'tenant_id') {
    this.tenantContext = tenantContext;
    this.tenantColumn = tenantColumn;
  }

  /**
   * SELECT 쿼리에 RLS 조건 적용
   *
   * WHERE tenant_id = ? 자동 추가
   */
  wrapSelect(query: string): RlsWrappedQuery {
    const tenantId = this.requireTenant('SELECT', query);

    this.recordAudit('RLS_APPLIED', tenantId, 'SELECT', query);

    return {
      type: 'SELECT',
      tenantCondition: `${this.tenantColumn} = '${tenantId}'`,
      tenantId,
      originalQuery: query,
    };
  }

  /**
   * INSERT 쿼리에 tenant_id 자동 주입
   */
  wrapInsert(data: Record<string, unknown>): Record<string, unknown> {
    const tenantId = this.requireTenant('INSERT', JSON.stringify(data));

    this.recordAudit('RLS_APPLIED', tenantId, 'INSERT', 'data insertion');

    return {
      ...data,
      [this.tenantColumn]: tenantId,
    };
  }

  /**
   * UPDATE 쿼리에 RLS 조건 적용
   */
  wrapUpdate(query: string): RlsWrappedQuery {
    const tenantId = this.requireTenant('UPDATE', query);

    this.recordAudit('RLS_APPLIED', tenantId, 'UPDATE', query);

    return {
      type: 'UPDATE',
      tenantCondition: `${this.tenantColumn} = '${tenantId}'`,
      tenantId,
      originalQuery: query,
    };
  }

  /**
   * DELETE 쿼리에 RLS 조건 적용
   */
  wrapDelete(query: string): RlsWrappedQuery {
    const tenantId = this.requireTenant('DELETE', query);

    this.recordAudit('RLS_APPLIED', tenantId, 'DELETE', query);

    return {
      type: 'DELETE',
      tenantCondition: `${this.tenantColumn} = '${tenantId}'`,
      tenantId,
      originalQuery: query,
    };
  }

  /**
   * 교차 테넌트 접근 시도 검증
   *
   * 데이터의 tenant_id와 현재 컨텍스트의 tenant_id 비교
   */
  validateAccess(dataTenantId: string): boolean {
    const currentTenant = this.tenantContext.getCurrentTenant();

    if (!currentTenant) {
      this.recordAudit('RLS_CONTEXT_MISSING', null, 'SELECT', `data tenant: ${dataTenantId}`);
      return false;
    }

    // SUPER_ADMIN은 모든 테넌트 데이터 접근 가능
    if (currentTenant.isSuperAdmin) {
      return true;
    }

    if (currentTenant.tenantId !== dataTenantId) {
      this.recordAudit(
        'RLS_BYPASS_ATTEMPT',
        currentTenant.tenantId,
        'SELECT',
        `교차 테넌트 접근 시도: current=${currentTenant.tenantId}, target=${dataTenantId}`,
      );
      return false;
    }

    return true;
  }

  /**
   * 감사 로그 반환
   */
  getAuditLog(): readonly RlsAuditEvent[] {
    return this.auditLog;
  }

  /**
   * 감사 로그 초기화 (테스트용)
   */
  clearAuditLog(): void {
    this.auditLog.length = 0;
  }

  /**
   * 테넌트 ID 필수 확인
   */
  private requireTenant(queryType: QueryType, query: string): string {
    try {
      return this.tenantContext.requireTenantId();
    } catch (err) {
      if (err instanceof TenantContextError) {
        this.recordAudit('RLS_CONTEXT_MISSING', null, queryType, query);
      }
      throw err;
    }
  }

  /**
   * 감사 이벤트 기록
   */
  private recordAudit(
    action: RlsAuditEvent['action'],
    tenantId: string | null,
    queryType: QueryType,
    details: string,
  ): void {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      tenantId,
      queryType,
      details,
    });
  }
}
