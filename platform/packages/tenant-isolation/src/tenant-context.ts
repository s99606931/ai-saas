// 테넌트 컨텍스트 관리 (AsyncLocalStorage)
// Design Ref: SVC-TENANT-R14 Plan
// Plan SC: FR-TENANT.2
// CSAP: D-08 접근 통제

import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * 테넌트 컨텍스트 정보
 */
export interface TenantInfo {
  /** 테넌트 ID */
  tenantId: string;
  /** 사용자 역할 */
  role?: string;
  /** SUPER_ADMIN 여부 (테넌트 전환 가능) */
  isSuperAdmin?: boolean;
}

/**
 * 테넌트 컨텍스트 관리자
 *
 * AsyncLocalStorage를 사용하여 요청별 테넌트 ID를 자동 전파합니다.
 * 모든 하위 함수 호출에서 명시적 파라미터 전달 없이 테넌트 ID에 접근 가능합니다.
 */
export class TenantContext {
  private readonly storage = new AsyncLocalStorage<TenantInfo>();

  /**
   * 테넌트 컨텍스트 내에서 콜백 실행
   */
  run<T>(tenant: TenantInfo, callback: () => T): T {
    return this.storage.run(tenant, callback);
  }

  /**
   * 현재 테넌트 정보 반환
   *
   * 컨텍스트 외부에서 호출 시 null 반환
   */
  getCurrentTenant(): TenantInfo | null {
    return this.storage.getStore() ?? null;
  }

  /**
   * 현재 테넌트 ID 반환 (필수)
   *
   * 테넌트 컨텍스트가 없으면 에러 발생
   */
  requireTenantId(): string {
    const tenant = this.getCurrentTenant();
    if (!tenant) {
      throw new TenantContextError('테넌트 컨텍스트가 설정되지 않았습니다');
    }
    return tenant.tenantId;
  }

  /**
   * 요청 헤더에서 테넌트 ID 추출
   *
   * 우선순위: X-Tenant-Id 헤더 > JWT 클레임
   */
  extractTenantId(headers: Record<string, string | string[] | undefined>): string | null {
    // 1. X-Tenant-Id 헤더
    const headerValue = headers['x-tenant-id'];
    if (typeof headerValue === 'string' && headerValue.length > 0) {
      return headerValue;
    }

    return null;
  }

  /**
   * SUPER_ADMIN 테넌트 전환 검증
   *
   * SUPER_ADMIN만 targetTenantId로 전환 가능
   */
  validateTenantSwitch(currentTenant: TenantInfo, targetTenantId: string): boolean {
    if (!currentTenant.isSuperAdmin) {
      return false;
    }
    // SUPER_ADMIN은 모든 테넌트로 전환 가능
    return targetTenantId.length > 0;
  }
}

/**
 * 테넌트 컨텍스트 에러
 */
export class TenantContextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TenantContextError';
  }
}
