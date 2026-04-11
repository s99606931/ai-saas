// Text2SQL 자연어→SQL 변환 엔진 -- FR-ADV31.1, FR-ADV31.2, FR-ADV31.6
// Design Ref: SVC-AI-ADV-R31 DESIGN §1, §2, §6
// Plan SC: SC-1 (정확도 85%+), SC-3 (실행 < 10초)
// CSAP: D-12 매개변수화 쿼리, D-08 테넌트별 접근 제어

import { SqlValidator, getSqlValidator, type SqlValidationResult } from './sql-validator';

// -- 타입 정의 ────────────────────────────────────────────────────────────────

/** 테이블 스키마 -- Design §2 */
export interface TableSchema {
  name: string;
  description: string;
  columns: ColumnSchema[];
  primaryKey: string[];
  foreignKeys?: ForeignKey[];
  sampleQueries?: SampleQuery[];
}

/** 컬럼 스키마 */
export interface ColumnSchema {
  name: string;
  type: string;
  description: string;
  nullable: boolean;
  isPrivate?: boolean;
}

/** 외래 키 관계 */
export interface ForeignKey {
  column: string;
  referencesTable: string;
  referencesColumn: string;
}

/** 예시 쿼리 (Few-shot) */
export interface SampleQuery {
  question: string;
  sql: string;
}

/** 스키마 레지스트리 설정 */
export interface SchemaRegistry {
  tables: TableSchema[];
  dialect: 'postgresql' | 'mysql' | 'sqlite';
  schemaName?: string;
}

/** Text2SQL 변환 요청 */
export interface Text2SqlRequest {
  /** 자연어 질의 */
  question: string;
  /** 테넌트 ID (접근 제어) */
  tenantId?: string;
  /** 스키마 컨텍스트 (지정 시 레지스트리 대체) */
  schemaContext?: TableSchema[];
  /** 대화 이력 (다중 턴) */
  conversationHistory?: { question: string; sql: string }[];
  /** 최대 결과 수 */
  maxResults?: number;
}

/** Text2SQL 변환 결과 */
export interface Text2SqlResult {
  /** 생성된 SQL */
  sql: string;
  /** 파라미터 바인딩 값 */
  parameters: unknown[];
  /** SQL 자연어 설명 */
  explanation: string;
  /** 검증 결과 */
  validation: SqlValidationResult;
  /** 사용된 테이블 */
  usedTables: string[];
  /** 신뢰도 (0~1) */
  confidence: number;
  /** 처리 시간 (ms) */
  processingTime: number;
}

/** Text2SQL 설정 */
export interface Text2SqlConfig {
  /** 스키마 레지스트리 */
  schema: SchemaRegistry;
  /** LLM 프로바이더 함수 */
  llmProvider: (prompt: string) => Promise<string>;
  /** SQL 검증기 */
  validator?: SqlValidator;
  /** 기본 최대 결과 수 */
  defaultMaxResults: number;
  /** 비공개 컬럼 노출 차단 */
  hidePrivateColumns: boolean;
}

// -- 감사 로그 ────────────────────────────────────────────────────────────────

function auditLog(action: string, details: Record<string, unknown>): void {
  const entry = {
    timestamp: new Date().toISOString(),
    component: 'text2sql',
    action,
    ...details,
  };
  console.log(`[AUDIT] ${JSON.stringify(entry)}`);
}

// -- Text2SqlEngine 메인 클래스 ───────────────────────────────────────────────

/** Text2SQL 변환 엔진 -- Design §1 */
export class Text2SqlEngine {
  private readonly config: Text2SqlConfig;
  private readonly validator: SqlValidator;

  constructor(config: Text2SqlConfig) {
    this.config = config;
    this.validator = config.validator ?? getSqlValidator();
  }

  // -- 자연어→SQL 변환 ───────────────────────────────────────────────────

  /** 자연어 질의를 SQL로 변환 -- Design §1 */
  async convert(request: Text2SqlRequest): Promise<Text2SqlResult> {
    const startTime = Date.now();

    // 1. 스키마 컨텍스트 추출
    const schemas = request.schemaContext ?? this.config.schema.tables;
    const relevantSchemas = this.selectRelevantSchemas(request.question, schemas);

    // 2. LLM 프롬프트 구성
    const prompt = this.buildPrompt(request, relevantSchemas);

    // 3. LLM SQL 생성
    const llmResponse = await this.config.llmProvider(prompt);
    const rawSql = this.extractSql(llmResponse);

    // 4. SQL 검증 (Design §3)
    const validation = this.validator.validate(rawSql);

    // 5. 파라미터 추출 (Design §4 CSAP D-12)
    const { sql: parameterizedSql, parameters } = validation.isSafe
      ? this.validator.parameterize(validation.sanitizedSql ?? rawSql)
      : { sql: rawSql, parameters: [] };

    // 6. 사용 테이블 추출
    const usedTables = this.extractUsedTables(rawSql, schemas);

    // 7. 신뢰도 계산
    const confidence = this.calculateConfidence(validation, usedTables, request);

    // 8. SQL 설명 생성 (Design §6)
    const explanation = this.generateExplanation(rawSql, usedTables, request.question);

    const processingTime = Date.now() - startTime;

    auditLog('text2sql_converted', {
      question: request.question.slice(0, 100),
      tenantId: request.tenantId,
      isValid: validation.isValid,
      isSafe: validation.isSafe,
      confidence,
      processingTime,
    });

    return {
      sql: validation.isSafe ? parameterizedSql : rawSql,
      parameters,
      explanation,
      validation,
      usedTables,
      confidence,
      processingTime,
    };
  }

  // -- 스키마 선택 ────────────────────────────────────────────────────────

  /** 질의 관련 스키마 선택 -- Design §2 */
  private selectRelevantSchemas(
    question: string,
    allSchemas: TableSchema[],
  ): TableSchema[] {
    const questionLower = question.toLowerCase();
    const scored = allSchemas.map((schema) => {
      let score = 0;

      // 테이블명 매칭
      if (questionLower.includes(schema.name.toLowerCase())) score += 10;

      // 설명 키워드 매칭
      const descWords = schema.description.toLowerCase().split(/\s+/);
      for (const word of descWords) {
        if (word.length > 2 && questionLower.includes(word)) score += 2;
      }

      // 컬럼명 매칭
      for (const col of schema.columns) {
        if (questionLower.includes(col.name.toLowerCase())) score += 5;
        const colDescWords = col.description.toLowerCase().split(/\s+/);
        for (const word of colDescWords) {
          if (word.length > 2 && questionLower.includes(word)) score += 1;
        }
      }

      return { schema, score };
    });

    // 점수 상위 5개 테이블 선택
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .filter((s) => s.score > 0)
      .map((s) => s.schema);
  }

  // -- 프롬프트 구성 ─────────────────────────────────────────────────────

  /** LLM 프롬프트 생성 -- Design §1 */
  private buildPrompt(
    request: Text2SqlRequest,
    schemas: TableSchema[],
  ): string {
    const schemaText = schemas
      .map((s) => {
        const columns = s.columns
          .filter((c) => !this.config.hidePrivateColumns || !c.isPrivate)
          .map((c) => `  ${c.name} ${c.type}${c.nullable ? '' : ' NOT NULL'} -- ${c.description}`)
          .join('\n');

        const fks = s.foreignKeys
          ?.map((fk) => `  FOREIGN KEY (${fk.column}) REFERENCES ${fk.referencesTable}(${fk.referencesColumn})`)
          .join('\n') ?? '';

        return `-- ${s.description}\nCREATE TABLE ${s.name} (\n${columns}\n${fks ? fks + '\n' : ''});`;
      })
      .join('\n\n');

    const fewShot = schemas
      .flatMap((s) => s.sampleQueries ?? [])
      .slice(0, 3)
      .map((q) => `질문: ${q.question}\nSQL: ${q.sql}`)
      .join('\n\n');

    const history = request.conversationHistory
      ?.slice(-3)
      .map((h) => `질문: ${h.question}\nSQL: ${h.sql}`)
      .join('\n\n') ?? '';

    const dialect = this.config.schema.dialect;
    const maxResults = request.maxResults ?? this.config.defaultMaxResults;

    return [
      `당신은 ${dialect} SQL 전문가입니다. 자연어 질문을 안전한 SELECT SQL로 변환합니다.`,
      '',
      '## 규칙',
      '1. SELECT 문만 생성 (INSERT, UPDATE, DELETE 절대 금지)',
      `2. 반드시 LIMIT ${maxResults} 포함`,
      '3. 테이블/컬럼명은 스키마 정의만 사용',
      '4. 문자열 값은 작은따옴표로 감싸기',
      '5. 모호한 경우 가장 안전한 해석 선택',
      '',
      '## 데이터베이스 스키마',
      schemaText,
      '',
      fewShot ? `## 예시\n${fewShot}\n` : '',
      history ? `## 대화 이력\n${history}\n` : '',
      `## 질문`,
      request.question,
      '',
      '## SQL (코드 블록 없이 SQL만 출력)',
    ].join('\n');
  }

  // -- SQL 추출 ──────────────────────────────────────────────────────────

  /** LLM 응답에서 SQL 추출 */
  private extractSql(response: string): string {
    // 코드 블록 내 SQL 추출
    const codeBlock = response.match(/```(?:sql)?\s*\n?([\s\S]*?)```/);
    if (codeBlock) return codeBlock[1]!.trim();

    // SELECT로 시작하는 문장 추출
    const selectMatch = response.match(/(?:WITH|SELECT)[\s\S]*?(?:;|$)/i);
    if (selectMatch) return selectMatch[0].replace(/;$/, '').trim();

    return response.trim();
  }

  // -- 사용 테이블 추출 ──────────────────────────────────────────────────

  private extractUsedTables(sql: string, schemas: TableSchema[]): string[] {
    const tableNames = schemas.map((s) => s.name);
    return tableNames.filter((name) => {
      const regex = new RegExp(`\\b${name}\\b`, 'i');
      return regex.test(sql);
    });
  }

  // -- 신뢰도 계산 ───────────────────────────────────────────────────────

  private calculateConfidence(
    validation: SqlValidationResult,
    usedTables: string[],
    request: Text2SqlRequest,
  ): number {
    let confidence = 0.5;

    // 검증 통과 시 가산
    if (validation.isValid) confidence += 0.2;
    if (validation.isSafe) confidence += 0.1;

    // 테이블 매칭 시 가산
    if (usedTables.length > 0) confidence += 0.1;

    // 경고 수에 따라 감산
    confidence -= validation.warnings.length * 0.05;

    // 대화 이력 존재 시 가산 (컨텍스트 풍부)
    if (request.conversationHistory && request.conversationHistory.length > 0) {
      confidence += 0.05;
    }

    return Math.max(0, Math.min(1, confidence));
  }

  // -- SQL 설명 생성 ─────────────────────────────────────────────────────

  /** SQL → 자연어 설명 -- Design §6 */
  private generateExplanation(
    sql: string,
    usedTables: string[],
    originalQuestion: string,
  ): string {
    const parts: string[] = [];

    if (usedTables.length > 0) {
      parts.push(`테이블: ${usedTables.join(', ')}`);
    }

    if (/\bWHERE\b/i.test(sql)) {
      parts.push('조건 필터 적용');
    }
    if (/\bJOIN\b/i.test(sql)) {
      parts.push('테이블 조인 사용');
    }
    if (/\bGROUP\s+BY\b/i.test(sql)) {
      parts.push('그룹별 집계');
    }
    if (/\bORDER\s+BY\b/i.test(sql)) {
      parts.push('정렬 적용');
    }
    if (/\bCOUNT\b|\bSUM\b|\bAVG\b|\bMAX\b|\bMIN\b/i.test(sql)) {
      parts.push('집계 함수 사용');
    }

    return parts.length > 0
      ? `"${originalQuestion}" → ${parts.join(', ')}`
      : `"${originalQuestion}" 에 대한 SQL 쿼리`;
  }

  // -- 스키마 관리 ────────────────────────────────────────────────────────

  /** 스키마 레지스트리에 테이블 추가 */
  addTable(table: TableSchema): void {
    const existing = this.config.schema.tables.findIndex(
      (t) => t.name === table.name,
    );
    if (existing >= 0) {
      this.config.schema.tables[existing] = table;
    } else {
      this.config.schema.tables.push(table);
    }
  }

  /** 스키마 레지스트리에서 테이블 제거 */
  removeTable(tableName: string): void {
    this.config.schema.tables = this.config.schema.tables.filter(
      (t) => t.name !== tableName,
    );
  }

  /** 전체 스키마 조회 */
  getSchema(): SchemaRegistry {
    return { ...this.config.schema };
  }
}

// -- 팩토리 ──────────────────────────────────────────────────────────────────

let engineInstance: Text2SqlEngine | null = null;

export function getText2SqlEngine(config: Text2SqlConfig): Text2SqlEngine {
  if (!engineInstance) {
    engineInstance = new Text2SqlEngine(config);
  }
  return engineInstance;
}

export function resetText2SqlEngine(): void {
  engineInstance = null;
}
