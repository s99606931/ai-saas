// Design Ref: MTU-N473 §자연어 데이터 탐색
// Plan SC: FR-T2A.1~5

export interface ParsedQuery {
  intent: 'count' | 'sum' | 'avg' | 'list' | 'trend';
  target: string;
  filters: Array<{ field: string; op: '=' | '>' | '<' | 'LIKE'; value: string | number }>;
  groupBy?: string;
}

export interface SchemaColumn {
  table: string;
  column: string;
  type: 'int' | 'string' | 'date' | 'decimal';
  pii: boolean;
}

export interface SqlPlan {
  sql: string;
  params: Array<string | number>;
  piiMasked: string[];
}

export class TextToAnalysis {
  private schema: SchemaColumn[] = [];

  registerSchema(columns: SchemaColumn[]): void {
    this.schema = columns;
  }

  /** FR-T2A.1 자연어 쿼리 파서 (룰 기반) */
  parseQuery(text: string): ParsedQuery {
    const lower = text.toLowerCase();
    let intent: ParsedQuery['intent'] = 'list';
    if (lower.includes('개수') || lower.includes('몇')) intent = 'count';
    else if (lower.includes('합계') || lower.includes('총')) intent = 'sum';
    else if (lower.includes('평균')) intent = 'avg';
    else if (lower.includes('추세') || lower.includes('트렌드')) intent = 'trend';

    // target 추출 (단순)
    const targetMatch = text.match(/(민원|신청|사용자|요청)/);
    const target = targetMatch?.[1] ?? 'records';

    const filters: ParsedQuery['filters'] = [];
    const yearMatch = text.match(/(\d{4})년/);
    if (yearMatch) filters.push({ field: 'year', op: '=', value: Number(yearMatch[1]) });
    return { intent, target, filters };
  }

  /** FR-T2A.2 스키마 매핑 */
  mapToSchema(query: ParsedQuery): { table: string; column: string } | undefined {
    const col = this.schema.find((c) => c.column === query.target || c.table === query.target);
    return col ? { table: col.table, column: col.column } : undefined;
  }

  /** FR-T2A.3 매개변수화 SQL 생성 */
  buildSql(query: ParsedQuery, tableName: string): SqlPlan {
    let fn = '*';
    if (query.intent === 'count') fn = 'COUNT(*)';
    else if (query.intent === 'sum') fn = 'SUM(amount)';
    else if (query.intent === 'avg') fn = 'AVG(amount)';

    const params: Array<string | number> = [];
    const where: string[] = [];
    query.filters.forEach((f, i) => {
      where.push(`${f.field} ${f.op} $${i + 1}`);
      params.push(f.value);
    });
    const whereSql = where.length > 0 ? ` WHERE ${where.join(' AND ')}` : '';
    const sql = `SELECT ${fn} FROM ${tableName}${whereSql}`;
    return { sql, params, piiMasked: [] };
  }

  /** FR-T2A.4 결과 자연어 요약 */
  summarizeResult(rows: unknown[], query: ParsedQuery): string {
    if (query.intent === 'count') return `${query.target} 개수는 ${(rows[0] as { count?: number })?.count ?? rows.length}건입니다.`;
    return `${query.target} 관련 ${rows.length}건 조회되었습니다.`;
  }

  /** FR-T2A.5 PII 마스킹 */
  maskPii(row: Record<string, unknown>): Record<string, unknown> {
    const masked: Record<string, unknown> = { ...row };
    for (const col of this.schema) {
      if (col.pii && col.column in masked) {
        const v = String(masked[col.column]);
        masked[col.column] = v.length > 3 ? v.slice(0, 2) + '***' : '***';
      }
    }
    return masked;
  }
}

export const textToAnalysis = new TextToAnalysis();
