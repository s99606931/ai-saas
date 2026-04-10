// 멀티테넌트 데이터 격리 Fastify 플러그인 (통합)
// Design Ref: SVC-TENANT-R14 Plan
// Plan SC: FR-TENANT.1
// CSAP: D-08 접근 통제, D-09 암호화

import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import fp from 'fastify-plugin';
import { TenantContext } from './tenant-context.js';
import { RowLevelSecurity } from './row-level-security.js';
import { TenantEncryption } from './tenant-encryption.js';
import { IsolationValidator } from './isolation-validator.js';

/**
 * 테넌트 격리 플러그인 옵션
 */
export interface TenantIsolationPluginOptions extends FastifyPluginOptions {
  /** 마스터 암호화 키 (hex 64자). 미지정 시 암호화 비활성화 */
  masterKey?: string;
  /** 키 버전 (기본: 1) */
  keyVersion?: number;
  /** tenant_id 컬럼명 (기본: 'tenant_id') */
  tenantColumn?: string;
  /** X-Tenant-Id 헤더 필수 여부 (기본: true) */
  requireTenantHeader?: boolean;
  /** 테넌트 헤더 검사 제외 경로 */
  excludePaths?: string[];
}

/**
 * tenant decorator 타입
 */
export interface TenantDecorator {
  /** 테넌트 컨텍스트 관리자 */
  context: TenantContext;
  /** Row-Level Security 관리자 */
  rls: RowLevelSecurity;
  /** 테넌트별 암호화 (masterKey 제공 시) */
  encryption: TenantEncryption | null;
  /** 격리 검증기 */
  validator: IsolationValidator;
}

// Fastify 타입 확장
declare module 'fastify' {
  interface FastifyInstance {
    tenant: TenantDecorator;
  }
}

/** 기본 제외 경로 (인증 불필요 엔드포인트) */
const DEFAULT_EXCLUDE_PATHS = ['/health', '/ready', '/metadata', '/health/detail', '/health/sla'];

/**
 * tenantIsolationPlugin -- 멀티테넌트 데이터 격리 통합 플러그인
 *
 * 기능:
 * - 요청별 테넌트 컨텍스트 자동 설정 (X-Tenant-Id 헤더)
 * - Row-Level Security 자동 적용
 * - 테넌트별 AES-256-GCM 암호화 (옵션)
 * - 격리 상태 검증 (/tenant/isolation-check)
 */
async function tenantIsolationPluginImpl(
  app: FastifyInstance,
  opts: TenantIsolationPluginOptions,
): Promise<void> {
  const tenantContext = new TenantContext();
  const rls = new RowLevelSecurity(tenantContext, opts.tenantColumn);

  let encryption: TenantEncryption | null = null;
  if (opts.masterKey) {
    encryption = new TenantEncryption(tenantContext, opts.masterKey, opts.keyVersion);
  }

  const validator = new IsolationValidator(tenantContext, rls);

  const excludePaths = [...DEFAULT_EXCLUDE_PATHS, ...(opts.excludePaths ?? [])];
  const requireHeader = opts.requireTenantHeader !== false;

  // Fastify decorator 등록
  app.decorate('tenant', {
    context: tenantContext,
    rls,
    encryption,
    validator,
  });

  // onRequest: 테넌트 컨텍스트 자동 설정
  app.addHook('onRequest', async (request, reply) => {
    // 제외 경로 확인
    if (excludePaths.some((p) => request.url.startsWith(p))) {
      return;
    }

    const tenantId = tenantContext.extractTenantId(
      request.headers as Record<string, string | string[] | undefined>,
    );

    if (!tenantId && requireHeader) {
      reply.status(400).send({
        error: 'Bad Request',
        message: 'X-Tenant-Id 헤더가 필요합니다',
        code: 'TENANT_ID_REQUIRED',
      });
      return;
    }

    if (tenantId) {
      // 테넌트 컨텍스트 저장 (request 객체에)
      (request as unknown as Record<string, unknown>)['tenantInfo'] = {
        tenantId,
        role: request.headers['x-user-role'] as string | undefined,
        isSuperAdmin: request.headers['x-user-role'] === 'SUPER_ADMIN',
      };
    }
  });

  // 격리 검증 엔드포인트
  app.get('/tenant/isolation-check', async (request) => {
    const tenantId = tenantContext.extractTenantId(
      request.headers as Record<string, string | string[] | undefined>,
    );

    if (!tenantId) {
      return {
        success: false,
        error: '격리 검증에는 X-Tenant-Id 헤더가 필요합니다',
      };
    }

    // 테넌트 컨텍스트 내에서 검증 실행
    const report = tenantContext.run(
      { tenantId, isSuperAdmin: false },
      () => validator.validate(),
    );

    return { success: true, data: report };
  });
}

export const tenantIsolationPlugin = fp(tenantIsolationPluginImpl, {
  name: '@public-saas/tenant-isolation',
  fastify: '5.x',
});
