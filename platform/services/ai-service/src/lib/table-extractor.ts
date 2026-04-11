// 테이블 추출기 -- FR-ADV32.2
// Design Ref: SVC-AI-ADV-R32 DESIGN §2
// Plan SC: SC-2 (표 추출 정확도 85%+)
// CSAP: D-12 데이터 정합성 검증

// -- 타입 정의 ────────────────────────────────────────────────────────────────

/** 테이블 셀 */
export interface TableCell {
  row: number;
  col: number;
  text: string;
  rowspan: number;
  colspan: number;
  isHeader: boolean;
}

/** 추출된 테이블 */
export interface ExtractedTable {
  id: string;
  pageNumber: number;
  rows: number;
  cols: number;
  cells: TableCell[];
  headers: string[];
  caption?: string;
  confidence: number;
}

/** 테이블 출력 형식 */
export type TableOutputFormat = 'json' | 'csv' | 'markdown' | 'array';

/** 추출기 설정 */
export interface TableExtractorConfig {
  /** 최소 행 수 (표 인식 기준) */
  minRows: number;
  /** 최소 열 수 */
  minCols: number;
  /** 구분자 문자 */
  delimiters: string[];
  /** 헤더 자동 감지 */
  autoDetectHeaders: boolean;
}

// -- 기본 설정 ────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: TableExtractorConfig = {
  minRows: 2,
  minCols: 2,
  delimiters: ['|', '\t', '│', '┃'],
  autoDetectHeaders: true,
};

// -- 감사 로그 ────────────────────────────────────────────────────────────────

function auditLog(action: string, details: Record<string, unknown>): void {
  const entry = {
    timestamp: new Date().toISOString(),
    component: 'table-extractor',
    action,
    ...details,
  };
  console.log(`[AUDIT] ${JSON.stringify(entry)}`);
}

function generateId(): string {
  return `table_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// -- TableExtractor 메인 클래스 ───────────────────────────────────────────────

/** 테이블 추출기 -- Design §2 */
export class TableExtractor {
  private readonly config: TableExtractorConfig;

  constructor(config?: Partial<TableExtractorConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // -- 테이블 탐지 + 추출 ────────────────────────────────────────────────

  /** 텍스트에서 테이블 추출 -- Design §2 */
  extractTables(
    text: string,
    pageNumber: number = 1,
  ): ExtractedTable[] {
    const lines = text.split('\n');
    const tables: ExtractedTable[] = [];
    let tableStart = -1;
    let tableLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const isTableLine = this.isTableLine(line);

      if (isTableLine) {
        if (tableStart === -1) tableStart = i;
        tableLines.push(line);
      } else {
        if (tableLines.length >= this.config.minRows) {
          const table = this.parseTable(tableLines, pageNumber);
          if (table) {
            tables.push(table);
          }
        }
        tableStart = -1;
        tableLines = [];
      }
    }

    // 마지막 테이블 처리
    if (tableLines.length >= this.config.minRows) {
      const table = this.parseTable(tableLines, pageNumber);
      if (table) {
        tables.push(table);
      }
    }

    auditLog('tables_extracted', { pageNumber, count: tables.length });
    return tables;
  }

  /** 라인이 테이블 구성 요소인지 판정 */
  private isTableLine(line: string): boolean {
    // 구분자 포함 여부
    const hasDelimiter = this.config.delimiters.some((d) => line.includes(d));
    if (hasDelimiter) return true;

    // 구분선 패턴 (---, ===, ─── 등)
    if (/^[\s]*[-─━=+]{3,}[\s]*$/.test(line)) return true;

    // 탭 구분 데이터 (2개 이상 탭)
    if ((line.match(/\t/g) ?? []).length >= 1) return true;

    return false;
  }

  // -- 테이블 파싱 ───────────────────────────────────────────────────────

  /** 테이블 라인 파싱 -- Design §2 */
  private parseTable(
    lines: string[],
    pageNumber: number,
  ): ExtractedTable | null {
    // 구분선 필터링
    const dataLines = lines.filter(
      (l) => !/^[\s]*[-─━=+|│┃]+[\s]*$/.test(l),
    );

    if (dataLines.length < this.config.minRows) return null;

    // 구분자 결정
    const delimiter = this.detectDelimiter(dataLines);

    // 셀 파싱
    const rows = dataLines.map((line) =>
      line
        .split(delimiter)
        .map((cell) => cell.trim())
        .filter((cell) => cell.length > 0 || delimiter === '\t'),
    );

    // 최대 열 수
    const maxCols = Math.max(...rows.map((r) => r.length));
    if (maxCols < this.config.minCols) return null;

    // 셀 객체 생성
    const cells: TableCell[] = [];
    const isHeaderRow = this.config.autoDetectHeaders;

    for (let r = 0; r < rows.length; r++) {
      const row = rows[r]!;
      for (let c = 0; c < row.length; c++) {
        cells.push({
          row: r,
          col: c,
          text: row[c]!,
          rowspan: 1,
          colspan: 1,
          isHeader: isHeaderRow && r === 0,
        });
      }
    }

    // 헤더 추출
    const headers: string[] = rows.length > 0 ? rows[0]! : [];

    // 병합 셀 감지
    this.detectMergedCells(cells, rows);

    return {
      id: generateId(),
      pageNumber,
      rows: rows.length,
      cols: maxCols,
      cells,
      headers,
      confidence: this.calculateConfidence(rows, maxCols),
    };
  }

  /** 구분자 자동 감지 */
  private detectDelimiter(lines: string[]): string | RegExp {
    const scores: Record<string, number> = {};

    for (const delim of this.config.delimiters) {
      let total = 0;
      for (const line of lines) {
        total += (line.match(new RegExp(`\\${delim}`, 'g')) ?? []).length;
      }
      scores[delim] = total;
    }

    // 탭 구분자 점수
    let tabCount = 0;
    for (const line of lines) {
      tabCount += (line.match(/\t/g) ?? []).length;
    }
    scores['\t'] = tabCount;

    // 최고 점수 구분자 선택
    const best = Object.entries(scores).sort(([, a], [, b]) => b - a)[0];
    return best ? best[0] : '|';
  }

  /** 병합 셀 감지 -- Design §2 */
  private detectMergedCells(cells: TableCell[], rows: string[][]): void {
    // 빈 셀이 이전 셀과 같은 위치에 있으면 rowspan으로 처리
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r]!;
      for (let c = 0; c < row.length; c++) {
        if (row[c] === '' || row[c] === '""') {
          // 위 셀의 rowspan 증가
          const aboveCell = cells.find(
            (cell) => cell.row === r - 1 && cell.col === c,
          );
          if (aboveCell) {
            aboveCell.rowspan += 1;
          }
        }
      }
    }
  }

  /** 신뢰도 계산 */
  private calculateConfidence(rows: string[][], maxCols: number): number {
    let confidence = 0.5;

    // 행 수 가산
    if (rows.length >= 3) confidence += 0.1;
    if (rows.length >= 5) confidence += 0.1;

    // 열 일관성 가산
    const colCounts = rows.map((r) => r.length);
    const consistent = colCounts.every((c) => c === maxCols);
    if (consistent) confidence += 0.2;

    // 데이터 밀도 가산
    const nonEmpty = rows.flat().filter((c) => c.trim()).length;
    const total = rows.length * maxCols;
    if (total > 0 && nonEmpty / total > 0.7) confidence += 0.1;

    return Math.min(1, confidence);
  }

  // -- 출력 변환 ─────────────────────────────────────────────────────────

  /** 테이블 → JSON 배열 */
  toJson(table: ExtractedTable): Record<string, string>[] {
    const headers = table.headers.length > 0
      ? table.headers
      : Array.from({ length: table.cols }, (_, i) => `col_${i}`);

    const dataRows = table.cells.filter((c) => !c.isHeader);
    const result: Record<string, string>[] = [];

    const rowGroups = new Map<number, TableCell[]>();
    for (const cell of dataRows) {
      const group = rowGroups.get(cell.row) ?? [];
      group.push(cell);
      rowGroups.set(cell.row, group);
    }

    for (const [, cells] of rowGroups) {
      const row: Record<string, string> = {};
      for (const cell of cells) {
        const header = headers[cell.col] ?? `col_${cell.col}`;
        row[header] = cell.text;
      }
      result.push(row);
    }

    return result;
  }

  /** 테이블 → CSV 문자열 */
  toCsv(table: ExtractedTable): string {
    const headers = table.headers;
    const rows: string[][] = [];

    if (headers.length > 0) {
      rows.push(headers);
    }

    const rowGroups = new Map<number, string[]>();
    for (const cell of table.cells) {
      if (cell.isHeader) continue;
      const group = rowGroups.get(cell.row) ?? [];
      group[cell.col] = cell.text;
      rowGroups.set(cell.row, group);
    }

    for (const [, cells] of rowGroups) {
      rows.push(cells);
    }

    return rows
      .map((row) =>
        row.map((cell) => {
          const escaped = (cell ?? '').replace(/"/g, '""');
          return escaped.includes(',') || escaped.includes('"') || escaped.includes('\n')
            ? `"${escaped}"`
            : escaped;
        }).join(','),
      )
      .join('\n');
  }

  /** 테이블 → Markdown */
  toMarkdown(table: ExtractedTable): string {
    const headers = table.headers;
    const lines: string[] = [];

    if (headers.length > 0) {
      lines.push(`| ${headers.join(' | ')} |`);
      lines.push(`| ${headers.map(() => '---').join(' | ')} |`);
    }

    const rowGroups = new Map<number, string[]>();
    for (const cell of table.cells) {
      if (cell.isHeader) continue;
      const group = rowGroups.get(cell.row) ?? [];
      group[cell.col] = cell.text;
      rowGroups.set(cell.row, group);
    }

    for (const [, cells] of rowGroups) {
      lines.push(`| ${cells.map((c) => c ?? '').join(' | ')} |`);
    }

    return lines.join('\n');
  }

  /** 테이블 → 2D 배열 */
  toArray(table: ExtractedTable): string[][] {
    const result: string[][] = [];

    if (table.headers.length > 0) {
      result.push(table.headers);
    }

    const rowGroups = new Map<number, string[]>();
    for (const cell of table.cells) {
      if (cell.isHeader) continue;
      const group = rowGroups.get(cell.row) ?? [];
      group[cell.col] = cell.text;
      rowGroups.set(cell.row, group);
    }

    for (const [, cells] of rowGroups) {
      result.push(cells);
    }

    return result;
  }
}

// -- 팩토리 ──────────────────────────────────────────────────────────────────

let extractorInstance: TableExtractor | null = null;

export function getTableExtractor(
  config?: Partial<TableExtractorConfig>,
): TableExtractor {
  if (!extractorInstance) {
    extractorInstance = new TableExtractor(config);
  }
  return extractorInstance;
}

export function resetTableExtractor(): void {
  extractorInstance = null;
}
