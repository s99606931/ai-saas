// SQL 검증기 -- FR-ADV31.3, FR-ADV31.4, FR-ADV31.5, FR-ADV31.7
// Design Ref: SVC-AI-ADV-R31 DESIGN §3, §4, §5, §7
// Plan SC: SC-2 (SQL 주입 0건)
// CSAP: D-12 SQL 주입 방지, 매개변수화 쿼리 강제

// -- 타입 정의 ────────────────────────────────────────────────────────────────

/** SQL 검증 결과 */
export interface SqlValidationResult {
  isValid: boolean;
  isSafe: boolean;
  errors: SqlValidationError[];
  warnings: SqlValidationWarning[];
  sanitizedSql?: string;
  parameters?: unknown[];
}

/** 검증 오류 */
export interface SqlValidationError {
  code: string;
  message: string;
  severity: 'critical' | 'high' | 'medium';
  position?: number;
}

/** 검증 경고 */
export interface SqlValidationWarning {
  code: string;
  message: string;
}

/** 검증 설정 */
export interface SqlValidatorConfig {
  /** 읽기 전용 모드 (SELECT만 허용) */
  readOnly: boolean;
  /** LIMIT 강제 값 (기본 100) */
  defaultLimit: number;
  /** 최대 LIMIT 값 */
  maxLimit: number;
  /** 서브쿼리 깊이 제한 */
  maxSubqueryDepth: number;
  /** UNION 개수 제한 */
  maxUnionCount: number;
  /** 허용 함수 목록 (화이트리스트) */
  allowedFunctions?: string[];
  /** 차단 키워드 (블랙리스트) */
  blockedKeywords: string[];
}

// -- 기본 설정 ────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: SqlValidatorConfig = {
  readOnly: true,
  defaultLimit: 100,
  maxLimit: 1000,
  maxSubqueryDepth: 3,
  maxUnionCount: 5,
  blockedKeywords: [
    'INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'TRUNCATE',
    'GRANT', 'REVOKE', 'CREATE', 'EXEC', 'EXECUTE',
    'MERGE', 'REPLACE', 'LOAD', 'COPY', 'VACUUM',
    'REINDEX', 'CLUSTER', 'COMMENT', 'LOCK', 'UNLOCK',
  ],
};

// -- 위험 패턴 정의 ──────────────────────────────────────────────────────────

const DANGEROUS_PATTERNS: { pattern: RegExp; code: string; message: string }[] = [
  {
    pattern: /;\s*(?:DROP|DELETE|INSERT|UPDATE|ALTER|TRUNCATE|EXEC)/i,
    code: 'SQL_INJECTION_STACKED',
    message: '스택 쿼리 SQL 주입 패턴 감지',
  },
  {
    pattern: /(?:--|#|\/\*)\s*$/m,
    code: 'SQL_COMMENT_INJECTION',
    message: 'SQL 주석 주입 패턴 감지',
  },
  {
    pattern: /'\s*(?:OR|AND)\s+['"]?\d+['"]?\s*=\s*['"]?\d+/i,
    code: 'SQL_TAUTOLOGY',
    message: 'SQL 항진 조건(tautology) 주입 패턴 감지',
  },
  {
    pattern: /UNION\s+(?:ALL\s+)?SELECT/i,
    code: 'SQL_UNION_INJECTION',
    message: 'UNION 기반 SQL 주입 패턴 감지 (승인된 UNION만 허용)',
  },
  {
    pattern: /(?:SLEEP|BENCHMARK|WAITFOR|PG_SLEEP)\s*\(/i,
    code: 'SQL_TIME_BASED',
    message: '시간 기반 SQL 주입 패턴 감지',
  },
  {
    pattern: /(?:LOAD_FILE|INTO\s+OUTFILE|INTO\s+DUMPFILE)/i,
    code: 'SQL_FILE_ACCESS',
    message: '파일 시스템 접근 SQL 패턴 감지',
  },
  {
    pattern: /(?:information_schema|pg_catalog|sys\.)/i,
    code: 'SQL_SCHEMA_PROBE',
    message: '시스템 스키마 탐색 패턴 감지',
  },
];

// -- 감사 로그 ────────────────────────────────────────────────────────────────

function auditLog(action: string, details: Record<string, unknown>): void {
  const entry = {
    timestamp: new Date().toISOString(),
    component: 'sql-validator',
    action,
    ...details,
  };
  console.log(`[AUDIT] ${JSON.stringify(entry)}`);
}

// -- SqlValidator 메인 클래스 ─────────────────────────────────────────────────

/** SQL 안전성 검증기 -- Design §3 */
export class SqlValidator {
  private readonly config: SqlValidatorConfig;

  constructor(config?: Partial<SqlValidatorConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** 전체 검증 실행 -- Design §3 (3단계) */
  validate(sql: string): SqlValidationResult {
    const errors: SqlValidationError[] = [];
    const warnings: SqlValidationWarning[] = [];

    // 빈 쿼리 체크
    const trimmed = sql.trim();
    if (!trimmed) {
      errors.push({
        code: 'EMPTY_SQL',
        message: 'SQL 쿼리가 비어 있습니다',
        severity: 'medium',
      });
      return { isValid: false, isSafe: false, errors, warnings };
    }

    // 1단계: 구문 검증
    this.validateSyntax(trimmed, errors, warnings);

    // 2단계: 보안 검증
    this.validateSecurity(trimmed, errors);

    // 3단계: 구조 검증 (LIMIT, 서브쿼리 등)
    this.validateStructure(trimmed, errors, warnings);

    const isValid = errors.filter((e) => e.severity === 'critical' || e.severity === 'high').length === 0;
    const isSafe = errors.length === 0;

    // 안전한 SQL 생성 (LIMIT 보장)
    const sanitizedSql = isSafe ? this.ensureLimit(trimmed) : undefined;

    if (!isSafe) {
      auditLog('validation_failed', {
        sql: trimmed.slice(0, 200),
        errors: errors.map((e) => e.code),
      });
    }

    return { isValid, isSafe, errors, warnings, sanitizedSql };
  }

  // -- 1단계: 구문 검증 ──────────────────────────────────────────────────

  private validateSyntax(
    sql: string,
    errors: SqlValidationError[],
    warnings: SqlValidationWarning[],
  ): void {
    // 읽기 전용 모드: SELECT/WITH만 허용 -- Design §5
    if (this.config.readOnly) {
      const firstKeyword = sql.match(/^\s*(\w+)/i)?.[1]?.toUpperCase();
      if (firstKeyword !== 'SELECT' && firstKeyword !== 'WITH') {
        errors.push({
          code: 'READ_ONLY_VIOLATION',
          message: `읽기 전용 모드: SELECT/WITH만 허용. 감지: ${firstKeyword}`,
          severity: 'critical',
        });
      }
    }

    // 차단 키워드 검사
    for (const keyword of this.config.blockedKeywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'i');
      if (regex.test(sql)) {
        errors.push({
          code: 'BLOCKED_KEYWORD',
          message: `차단된 SQL 키워드: ${keyword}`,
          severity: 'critical',
        });
      }
    }

    // 세미콜론 다중 문장 차단
    const statementsCount = sql.split(';').filter((s) => s.trim()).length;
    if (statementsCount > 1) {
      errors.push({
        code: 'MULTI_STATEMENT',
        message: '다중 SQL 문장 실행 금지 (단일 쿼리만 허용)',
        severity: 'critical',
      });
    }

    // 괄호 균형 검사
    const openParens = (sql.match(/\(/g) ?? []).length;
    const closeParens = (sql.match(/\)/g) ?? []).length;
    if (openParens !== closeParens) {
      warnings.push({
        code: 'UNBALANCED_PARENS',
        message: `괄호 불일치: 열림 ${openParens}개, 닫힘 ${closeParens}개`,
      });
    }
  }

  // -- 2단계: 보안 검증 ──────────────────────────────────────────────────

  private validateSecurity(sql: string, errors: SqlValidationError[]): void {
    for (const { pattern, code, message } of DANGEROUS_PATTERNS) {
      if (pattern.test(sql)) {
        errors.push({ code, message, severity: 'critical' });
      }
    }
  }

  // -- 3단계: 구조 검증 ──────────────────────────────────────────────────

  private validateStructure(
    sql: string,
    errors: SqlValidationError[],
    warnings: SqlValidationWarning[],
  ): void {
    // 서브쿼리 깊이 검사 -- Design §7
    const depth = this.measureSubqueryDepth(sql);
    if (depth > this.config.maxSubqueryDepth) {
      errors.push({
        code: 'SUBQUERY_DEPTH_EXCEEDED',
        message: `서브쿼리 깊이 초과: ${depth} > ${this.config.maxSubqueryDepth}`,
        severity: 'high',
      });
    }

    // UNION 개수 검사 -- Design §7
    const unionCount = (sql.match(/\bUNION\b/gi) ?? []).length;
    if (unionCount > this.config.maxUnionCount) {
      errors.push({
        code: 'UNION_COUNT_EXCEEDED',
        message: `UNION 개수 초과: ${unionCount} > ${this.config.maxUnionCount}`,
        severity: 'high',
      });
    }

    // LIMIT 미존재 경고
    if (!/\bLIMIT\b/i.test(sql)) {
      warnings.push({
        code: 'NO_LIMIT',
        message: `LIMIT 절 미존재. 기본값 ${this.config.defaultLimit} 적용 권장`,
      });
    }

    // LIMIT 값 초과 검사
    const limitMatch = sql.match(/\bLIMIT\s+(\d+)/i);
    if (limitMatch) {
      const limitValue = parseInt(limitMatch[1]!, 10);
      if (limitValue > this.config.maxLimit) {
        errors.push({
          code: 'LIMIT_EXCEEDED',
          message: `LIMIT 값 초과: ${limitValue} > ${this.config.maxLimit}`,
          severity: 'medium',
        });
      }
    }

    // SELECT * 경고
    if (/SELECT\s+\*/i.test(sql)) {
      warnings.push({
        code: 'SELECT_STAR',
        message: 'SELECT * 사용 감지. 필요한 컬럼만 명시 권장',
      });
    }
  }

  // -- 서브쿼리 깊이 측정 ────────────────────────────────────────────────

  private measureSubqueryDepth(sql: string): number {
    let maxDepth = 0;
    let currentDepth = 0;

    for (const char of sql) {
      if (char === '(') {
        currentDepth++;
        maxDepth = Math.max(maxDepth, currentDepth);
      } else if (char === ')') {
        currentDepth = Math.max(0, currentDepth - 1);
      }
    }

    return maxDepth;
  }

  // -- LIMIT 보장 ────────────────────────────────────────────────────────

  /** LIMIT 절 강제 추가 -- Design §7 */
  ensureLimit(sql: string): string {
    const trimmed = sql.replace(/;\s*$/, '').trim();

    if (/\bLIMIT\b/i.test(trimmed)) {
      // 기존 LIMIT 값 검증 + 상한 적용
      return trimmed.replace(
        /\bLIMIT\s+(\d+)/i,
        (_match, limit) => {
          const value = Math.min(parseInt(limit, 10), this.config.maxLimit);
          return `LIMIT ${value}`;
        },
      );
    }

    return `${trimmed} LIMIT ${this.config.defaultLimit}`;
  }

  // -- 파라미터 추출 ─────────────────────────────────────────────────────

  /** SQL 리터럴 → 파라미터 바인딩 변환 -- Design §4 (CSAP D-12) */
  parameterize(sql: string): { sql: string; parameters: unknown[] } {
    const parameters: unknown[] = [];
    let paramIndex = 1;

    // 문자열 리터럴 → 파라미터
    const parameterized = sql.replace(
      /'([^'\\]*(?:\\.[^'\\]*)*)'/g,
      (_match, value) => {
        // 날짜 리터럴, 빈 문자열 등도 파라미터화
        parameters.push(value);
        return `$${paramIndex++}`;
      },
    );

    // 숫자 리터럴 → 파라미터 (WHERE 절 내)
    const finalSql = parameterized.replace(
      /(?<=\b(?:WHERE|AND|OR|HAVING)\s+\w+\s*(?:=|!=|<>|>=?|<=?)\s*)(\d+(?:\.\d+)?)\b/gi,
      (_match, value) => {
        parameters.push(parseFloat(value));
        return `$${paramIndex++}`;
      },
    );

    return { sql: finalSql, parameters };
  }
}

// -- 팩토리 ──────────────────────────────────────────────────────────────────

let validatorInstance: SqlValidator | null = null;

export function getSqlValidator(
  config?: Partial<SqlValidatorConfig>,
): SqlValidator {
  if (!validatorInstance) {
    validatorInstance = new SqlValidator(config);
  }
  return validatorInstance;
}

export function resetSqlValidator(): void {
  validatorInstance = null;
}
