// 멀티테넌트 RLS 자동화 엔진 -- FR-N286.1~FR-N286.6
// Design Ref: MTU-N286 DESIGN §1~§6
// Plan SC: SC-1 (RLS 적용률 100%), SC-2 (교차 차단 100%), SC-3 (프로비저닝 100%), SC-4 (감사 100%)
// CSAP: D-06 감사 로그, D-08 접근 통제, D-12 개발 보안
// N2SF: 테넌트 데이터 격리 필수

// -- 타입 정의 ────────────────────────────────────────────────────────────────

/** RLS 정책 유형 */
export type RLSPolicyType = 'select' | 'insert' | 'update' | 'delete' | 'all';

/** RLS 정책 상태 */
export type RLSPolicyStatus = 'active' | 'disabled' | 'pending' | 'error';

/** RLS 정책 정의 */
export interface RLSPolicy {
  readonly policyId: string;
  readonly tableName: string;
  readonly tenantColumn: string;    // tenant_id 컬럼명
  readonly policyType: RLSPolicyType;
  readonly policyExpression: string; // SQL 표현식
  readonly status: RLSPolicyStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** 테넌트 RLS 설정 */
export interface TenantRLSConfig {
  readonly tenantId: string;
  readonly policies: RLSPolicy[];
  readonly enabled: boolean;
  readonly tablesProtected: string[];
  readonly lastVerifiedAt: string;
  readonly verificationResult: RLSVerificationResult;
}

/** RLS 검증 결과 */
export interface RLSVerificationResult {
  readonly verified: boolean;
  readonly tablesChecked: number;
  readonly policiesVerified: number;
  readonly violations: RLSViolation[];
  readonly verifiedAt: string;
}

/** RLS 위반 항목 */
export interface RLSViolation {
  readonly violationId: string;
  readonly tableName: string;
  readonly violationType: 'missing_policy' | 'cross_access' | 'policy_disabled' | 'column_missing';
  readonly description: string;
  readonly severity: 'critical' | 'high' | 'medium';
  readonly remediation: string;
}

/** Prisma 미들웨어 설정 */
export interface PrismaMiddlewareConfig {
  readonly tenantId: string;
  readonly contextKey: string;       // 컨텍스트 키명
  readonly enforceOnAllQueries: boolean;
  readonly excludedModels: string[];  // 테넌트 무관 모델
  readonly logViolations: boolean;
}

/** 프로비저닝 결과 */
export interface ProvisioningResult {
  readonly tenantId: string;
  readonly policiesCreated: number;
  readonly tablesConfigured: string[];
  readonly middlewareConfigured: boolean;
  readonly verificationPassed: boolean;
  readonly provisionedAt: string;
}

/** 감사 로그 */
export interface RLSAuditEntry {
  readonly timestamp: string;
  readonly actor: string;
  readonly tenantId: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

// -- 감사 로그 ────────────────────────────────────────────────────────────────

const auditLog: RLSAuditEntry[] = [];

function recordAudit(entry: Omit<RLSAuditEntry, 'timestamp'>): void {
  auditLog.push({ ...entry, timestamp: new Date().toISOString() });
}

export function getRLSAuditLog(tenantId: string): readonly RLSAuditEntry[] {
  return auditLog.filter(e => e.tenantId === tenantId);
}

// -- RLS 정책 저장소 ──────────────────────────────────────────────────────────

const policyStore: Map<string, RLSPolicy[]> = new Map();
const tenantConfigs: Map<string, TenantRLSConfig> = new Map();

/** 보호 대상 테이블 목록 (기본) */
const PROTECTED_TABLES: readonly string[] = [
  'users',
  'documents',
  'approvals',
  'petitions',
  'contracts',
  'audit_logs',
  'configurations',
  'notifications',
  'reports',
  'dashboards',
  'api_keys',
  'sessions',
  'file_uploads',
  'comments',
  'workflows',
];

/** Prisma 미들웨어 제외 모델 (테넌트 무관) */
const EXCLUDED_MODELS: readonly string[] = [
  'system_config',
  'migration_history',
  'health_check',
  'global_settings',
];

// -- PostgreSQL RLS 정책 생성 ─────────────────────────────────────────────────

/** RLS 정책 SQL 생성 -- FR-N286.1 */
export function generateRLSPolicy(
  tableName: string,
  tenantColumn: string = 'tenant_id',
  policyType: RLSPolicyType = 'all',
): RLSPolicy {
  const policyId = `rls-${tableName}-${Date.now()}`;

  // PostgreSQL RLS 정책 SQL 표현식 생성
  const policyExpression = policyType === 'all'
    ? `(${tenantColumn} = current_setting('app.current_tenant_id')::text)`
    : `(${tenantColumn} = current_setting('app.current_tenant_id')::text)`;

  const policy: RLSPolicy = {
    policyId,
    tableName,
    tenantColumn,
    policyType,
    policyExpression,
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return policy;
}

/** RLS SQL DDL 생성 */
export function generateRLSDDL(tableName: string, tenantColumn: string = 'tenant_id'): string[] {
  return [
    `-- RLS 활성화 for ${tableName}`,
    `ALTER TABLE "${tableName}" ENABLE ROW LEVEL SECURITY;`,
    `ALTER TABLE "${tableName}" FORCE ROW LEVEL SECURITY;`,
    '',
    `-- SELECT 정책`,
    `CREATE POLICY "${tableName}_tenant_select" ON "${tableName}"`,
    `  FOR SELECT`,
    `  USING ("${tenantColumn}" = current_setting('app.current_tenant_id')::text);`,
    '',
    `-- INSERT 정책`,
    `CREATE POLICY "${tableName}_tenant_insert" ON "${tableName}"`,
    `  FOR INSERT`,
    `  WITH CHECK ("${tenantColumn}" = current_setting('app.current_tenant_id')::text);`,
    '',
    `-- UPDATE 정책`,
    `CREATE POLICY "${tableName}_tenant_update" ON "${tableName}"`,
    `  FOR UPDATE`,
    `  USING ("${tenantColumn}" = current_setting('app.current_tenant_id')::text)`,
    `  WITH CHECK ("${tenantColumn}" = current_setting('app.current_tenant_id')::text);`,
    '',
    `-- DELETE 정책`,
    `CREATE POLICY "${tableName}_tenant_delete" ON "${tableName}"`,
    `  FOR DELETE`,
    `  USING ("${tenantColumn}" = current_setting('app.current_tenant_id')::text);`,
  ];
}

// -- Prisma 미들웨어 ──────────────────────────────────────────────────────────

/** Prisma 미들웨어 설정 생성 -- FR-N286.2 */
export function createPrismaMiddleware(
  tenantId: string,
  excludedModels: string[] = [...EXCLUDED_MODELS],
): PrismaMiddlewareConfig {
  return {
    tenantId,
    contextKey: 'tenantId',
    enforceOnAllQueries: true,
    excludedModels,
    logViolations: true,
  };
}

/** Prisma 쿼리에 테넌트 필터 주입 */
export function injectTenantFilter(
  model: string,
  operation: string,
  args: Record<string, unknown>,
  config: PrismaMiddlewareConfig,
): Record<string, unknown> {
  // 제외 모델은 필터 미적용
  if (config.excludedModels.includes(model)) {
    return args;
  }

  const tenantId = config.tenantId;

  // 읽기 작업: where 절에 tenant_id 추가
  if (['findMany', 'findFirst', 'findUnique', 'count', 'aggregate'].includes(operation)) {
    const where = (args['where'] as Record<string, unknown>) ?? {};
    return {
      ...args,
      where: { ...where, tenant_id: tenantId },
    };
  }

  // 쓰기 작업: data에 tenant_id 추가
  if (['create', 'createMany'].includes(operation)) {
    const data = (args['data'] as Record<string, unknown>) ?? {};
    if (Array.isArray(data)) {
      return {
        ...args,
        data: data.map(d => ({ ...d, tenant_id: tenantId })),
      };
    }
    return {
      ...args,
      data: { ...data, tenant_id: tenantId },
    };
  }

  // 업데이트/삭제: where에 tenant_id 추가
  if (['update', 'updateMany', 'delete', 'deleteMany'].includes(operation)) {
    const where = (args['where'] as Record<string, unknown>) ?? {};
    return {
      ...args,
      where: { ...where, tenant_id: tenantId },
    };
  }

  return args;
}

// -- RLS 검증 ────────────────────────────────────────────────────────────────

/** RLS 정책 검증 -- FR-N286.3 */
export function verifyRLSPolicies(
  tenantId: string,
  tables: string[] = [...PROTECTED_TABLES],
): RLSVerificationResult {
  const violations: RLSViolation[] = [];
  const policies = policyStore.get(tenantId) ?? [];
  const protectedTables = new Set(policies.map(p => p.tableName));

  // 누락 테이블 검사
  for (const table of tables) {
    if (!protectedTables.has(table)) {
      violations.push({
        violationId: `v-${Date.now()}-${table}`,
        tableName: table,
        violationType: 'missing_policy',
        description: `테이블 '${table}'에 RLS 정책이 없습니다`,
        severity: 'critical',
        remediation: `ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY; 실행 필요`,
      });
    }
  }

  // 비활성 정책 검사
  for (const policy of policies) {
    if (policy.status === 'disabled') {
      violations.push({
        violationId: `v-${Date.now()}-${policy.policyId}`,
        tableName: policy.tableName,
        violationType: 'policy_disabled',
        description: `테이블 '${policy.tableName}'의 RLS 정책이 비활성 상태입니다`,
        severity: 'high',
        remediation: '정책을 활성화하십시오',
      });
    }
  }

  const result: RLSVerificationResult = {
    verified: violations.length === 0,
    tablesChecked: tables.length,
    policiesVerified: policies.length,
    violations,
    verifiedAt: new Date().toISOString(),
  };

  recordAudit({
    actor: 'system',
    tenantId,
    action: 'RLS_VERIFIED',
    target: tenantId,
    details: {
      tablesChecked: result.tablesChecked,
      policiesVerified: result.policiesVerified,
      violationCount: violations.length,
      verified: result.verified,
    },
  });

  return result;
}

// -- 자동 프로비저닝 ──────────────────────────────────────────────────────────

/** 테넌트 RLS 자동 프로비저닝 -- FR-N286.4 */
export function provisionTenantRLS(
  tenantId: string,
  tables: string[] = [...PROTECTED_TABLES],
  tenantColumn: string = 'tenant_id',
): ProvisioningResult {
  const policies: RLSPolicy[] = [];

  // 각 테이블에 대해 RLS 정책 생성
  for (const table of tables) {
    const policy = generateRLSPolicy(table, tenantColumn);
    policies.push(policy);
  }

  // 정책 저장
  policyStore.set(tenantId, policies);

  // Prisma 미들웨어 설정
  const middlewareConfig = createPrismaMiddleware(tenantId);

  // 검증 실행
  const verification = verifyRLSPolicies(tenantId, tables);

  // 테넌트 설정 저장
  const config: TenantRLSConfig = {
    tenantId,
    policies,
    enabled: true,
    tablesProtected: tables,
    lastVerifiedAt: verification.verifiedAt,
    verificationResult: verification,
  };
  tenantConfigs.set(tenantId, config);

  const result: ProvisioningResult = {
    tenantId,
    policiesCreated: policies.length,
    tablesConfigured: tables,
    middlewareConfigured: middlewareConfig.enforceOnAllQueries,
    verificationPassed: verification.verified,
    provisionedAt: new Date().toISOString(),
  };

  recordAudit({
    actor: 'system',
    tenantId,
    action: 'RLS_PROVISIONED',
    target: tenantId,
    details: {
      policiesCreated: result.policiesCreated,
      tablesConfigured: result.tablesConfigured.length,
      verificationPassed: result.verificationPassed,
    },
  });

  return result;
}

// -- RLS 위반 감지 ────────────────────────────────────────────────────────────

/** RLS 위반 실시간 감지 -- FR-N286.5 */
export function detectRLSViolation(
  requestTenantId: string,
  actualTenantId: string,
  tableName: string,
  operation: string,
): { isViolation: boolean; details?: string } {
  if (requestTenantId !== actualTenantId) {
    const details = `교차 테넌트 접근 시도 감지: 요청 테넌트 '${requestTenantId}', 실제 테넌트 '${actualTenantId}', 테이블 '${tableName}', 작업 '${operation}'`;

    recordAudit({
      actor: 'system',
      tenantId: requestTenantId,
      action: 'RLS_VIOLATION_DETECTED',
      target: tableName,
      details: {
        requestTenantId,
        actualTenantId,
        operation,
        severity: 'critical',
      },
    });

    return { isViolation: true, details };
  }

  return { isViolation: false };
}

/** 테넌트 RLS 설정 조회 */
export function getTenantRLSConfig(tenantId: string): TenantRLSConfig | undefined {
  return tenantConfigs.get(tenantId);
}

/** 멀티테넌트 RLS 서비스 */
export class MultitenantRLSService {
  constructor(private readonly tenantId: string) {}

  provision(tables?: string[]): ProvisioningResult {
    return provisionTenantRLS(this.tenantId, tables);
  }

  verify(tables?: string[]): RLSVerificationResult {
    return verifyRLSPolicies(this.tenantId, tables);
  }

  generateDDL(tableName: string): string[] {
    return generateRLSDDL(tableName);
  }

  createMiddleware(): PrismaMiddlewareConfig {
    return createPrismaMiddleware(this.tenantId);
  }

  injectFilter(model: string, op: string, args: Record<string, unknown>): Record<string, unknown> {
    const config = createPrismaMiddleware(this.tenantId);
    return injectTenantFilter(model, op, args, config);
  }

  detectViolation(actualTenantId: string, table: string, op: string): { isViolation: boolean; details?: string } {
    return detectRLSViolation(this.tenantId, actualTenantId, table, op);
  }

  getConfig(): TenantRLSConfig | undefined {
    return getTenantRLSConfig(this.tenantId);
  }

  getAuditLog(): readonly RLSAuditEntry[] {
    return getRLSAuditLog(this.tenantId);
  }
}
