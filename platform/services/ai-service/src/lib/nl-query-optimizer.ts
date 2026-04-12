// Design Ref: §R176 AI기반자연어DB쿼리최적화
// Plan SC: FR-R176.1~5

export type QueryType = 'SELECT' | 'AGGREGATE' | 'JOIN' | 'SUBQUERY';

export interface NlQuery {
  id: string;
  naturalLanguage: string;
  tenantId: string;
  context?: string; // 테이블/도메인 힌트
}

export interface ParsedQuery {
  queryId: string;
  queryType: QueryType;
  tables: string[];
  conditions: string[];
  sql: string;
  confidence: number; // 0~1
}

export interface OptimizationHint {
  queryId: string;
  hints: string[];
  estimatedSpeedupPct: number;
}

export interface AuditEntry {
  action: string;
  queryId?: string;
  tenantId?: string;
  timestamp: string;
}

export class NlQueryOptimizer {
  private queries = new Map<string, NlQuery>();
  private parsed = new Map<string, ParsedQuery>();
  private auditLog: AuditEntry[] = [];

  // FR-R176.1 자연어 쿼리 등록
  registerQuery(query: NlQuery): void {
    this.queries.set(query.id, query);
    this.auditLog.push({ action: 'QUERY_REGISTERED', queryId: query.id, tenantId: query.tenantId, timestamp: new Date().toISOString() });
  }

  // FR-R176.2 자연어 → SQL 변환 (규칙 기반)
  parse(queryId: string): ParsedQuery {
    const q = this.queries.get(queryId);
    if (!q) throw new Error(`쿼리 ${queryId} 없음`);

    const nl = q.naturalLanguage.toLowerCase();
    const tables = this.extractTables(nl, q.context);
    const conditions = this.extractConditions(nl);

    let queryType: QueryType = 'SELECT';
    if (/평균|합계|count|sum|avg|최대|최소/.test(nl)) queryType = 'AGGREGATE';
    else if (/join|연결|합치/.test(nl)) queryType = 'JOIN';
    else if (/서브쿼리|중에서/.test(nl)) queryType = 'SUBQUERY';

    const sql = this.buildSql(queryType, tables, conditions);

    const result: ParsedQuery = {
      queryId,
      queryType,
      tables,
      conditions,
      sql,
      confidence: tables.length > 0 ? 0.85 : 0.5,
    };

    this.parsed.set(queryId, result);
    this.auditLog.push({ action: 'QUERY_PARSED', queryId, tenantId: q.tenantId, timestamp: new Date().toISOString() });
    return result;
  }

  // FR-R176.3 쿼리 최적화 힌트 생성
  optimize(queryId: string): OptimizationHint {
    const parsed = this.parsed.get(queryId);
    if (!parsed) throw new Error(`파싱된 쿼리 ${queryId} 없음`);

    const hints: string[] = [];
    let speedup = 0;

    if (parsed.conditions.length > 0) {
      hints.push(`WHERE 절 컬럼(${parsed.conditions[0]})에 인덱스 추가 권장`);
      speedup += 40;
    }
    if (parsed.queryType === 'AGGREGATE') {
      hints.push('GROUP BY 연산에 파티셔닝 적용 권장');
      speedup += 20;
    }
    if (parsed.queryType === 'JOIN') {
      hints.push('JOIN 컬럼에 인덱스 추가 권장');
      hints.push('소규모 테이블을 선행 테이블로 배치');
      speedup += 30;
    }
    if (parsed.tables.length > 2) {
      hints.push('다중 테이블 조인 시 쿼리 분리 검토');
      speedup += 10;
    }

    return { queryId, hints, estimatedSpeedupPct: Math.min(70, speedup) };
  }

  // FR-R176.4 SQL 보안 검사 (SQL 주입 방지 — CSAP D-12)
  securityCheck(sql: string): string[] {
    const issues: string[] = [];
    if (/;\s*(drop|delete|update|insert)/i.test(sql)) issues.push('SQL_INJECTION_RISK');
    if (/'\s*or\s*'1'\s*=\s*'1/i.test(sql)) issues.push('TAUTOLOGY_INJECTION');
    if (/--\s/.test(sql)) issues.push('SQL_COMMENT_INJECTION');
    return issues;
  }

  // FR-R176.5 감사 로그 (CSAP D-06)
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }

  private extractTables(nl: string, context?: string): string[] {
    const tables: string[] = [];
    if (context) tables.push(...context.split(',').map((t) => t.trim()));
    const matches = nl.match(/\b[a-z_]+\b/g) ?? [];
    const candidates = matches.filter((w) => w.length > 3 && !['from', 'where', 'select', 'that', 'this', 'have', 'with'].includes(w));
    if (tables.length === 0 && candidates.length > 0) tables.push(candidates[0]!);
    return [...new Set(tables)];
  }

  private extractConditions(nl: string): string[] {
    const conditions: string[] = [];
    const condMatch = nl.match(/(?:where|조건|인 경우)[^\s]+/gi) ?? [];
    if (condMatch.length > 0) conditions.push(condMatch[0]!.replace(/where|조건|인 경우/gi, '').trim());
    return conditions.filter(Boolean);
  }

  private buildSql(type: QueryType, tables: string[], conditions: string[]): string {
    const table = tables[0] ?? 'table';
    const where = conditions.length > 0 ? ` WHERE ${conditions[0]}` : '';
    if (type === 'AGGREGATE') return `SELECT COUNT(*), AVG(column) FROM ${table}${where}`;
    if (type === 'JOIN') return `SELECT a.*, b.* FROM ${table} a JOIN ${tables[1] ?? 'related'} b ON a.id = b.${table}_id${where}`;
    return `SELECT * FROM ${table}${where}`;
  }
}
