// 문서 레이아웃 파서 -- FR-ADV32.1, FR-ADV32.3~32.6
// Design Ref: SVC-AI-ADV-R32 DESIGN §1, §3~§6
// Plan SC: SC-1 (구조 인식 90%+), SC-3 (처리 < 5초/페이지)
// CSAP: D-12 문서 처리 보안, N2SF 문서 등급별 경로 분리

// -- 타입 정의 ────────────────────────────────────────────────────────────────

/** 문서 영역 유형 -- Design §1 */
export type LayoutRegionType =
  | 'title'
  | 'body'
  | 'table'
  | 'image'
  | 'header'
  | 'footer'
  | 'list'
  | 'signature';

/** 바운딩 박스 (좌표) */
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 레이아웃 영역 */
export interface LayoutRegion {
  id: string;
  type: LayoutRegionType;
  bbox: BoundingBox;
  text: string;
  confidence: number;
  pageNumber: number;
  readingOrder: number;
  children?: LayoutRegion[];
  metadata?: Record<string, unknown>;
}

/** 문서 구조 노드 -- Design §3 */
export interface DocumentStructureNode {
  id: string;
  level: number;
  type: 'document' | 'chapter' | 'section' | 'subsection' | 'paragraph' | 'table' | 'image' | 'list';
  title: string;
  content?: string;
  pageNumber: number;
  children: DocumentStructureNode[];
  metadata?: Record<string, unknown>;
}

/** 문서 메타데이터 -- Design §5 */
export interface DocumentMetadata {
  documentTitle?: string;
  author?: string;
  date?: string;
  documentNumber?: string;
  department?: string;
  classification?: string;
  version?: string;
  pageCount: number;
  extractedAt: string;
}

/** 문서 분석 결과 */
export interface DocumentAnalysisResult {
  pages: PageAnalysis[];
  structure: DocumentStructureNode;
  metadata: DocumentMetadata;
  regions: LayoutRegion[];
  processingTime: number;
}

/** 페이지 분석 */
export interface PageAnalysis {
  pageNumber: number;
  regions: LayoutRegion[];
  text: string;
}

/** 파서 설정 */
export interface DocumentLayoutParserConfig {
  /** 최소 텍스트 블록 높이 (px) */
  minBlockHeight: number;
  /** 제목 판정 최소 폰트 크기 비율 (본문 대비) */
  titleFontSizeRatio: number;
  /** LLM 프로바이더 (구조 해석 보조) */
  llmProvider?: (prompt: string) => Promise<string>;
  /** OCR 후처리 활성화 */
  enableOcrPostProcess: boolean;
  /** 한글 교정 사전 */
  correctionDictionary?: Map<string, string>;
}

// -- 기본 설정 ────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: DocumentLayoutParserConfig = {
  minBlockHeight: 10,
  titleFontSizeRatio: 1.3,
  enableOcrPostProcess: true,
};

// -- 감사 로그 ────────────────────────────────────────────────────────────────

function auditLog(action: string, details: Record<string, unknown>): void {
  const entry = {
    timestamp: new Date().toISOString(),
    component: 'document-layout-parser',
    action,
    ...details,
  };
  console.log(`[AUDIT] ${JSON.stringify(entry)}`);
}

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// -- 한글 OCR 후처리 -- Design §4 ────────────────────────────────────────────

const DEFAULT_CORRECTIONS = new Map<string, string>([
  ['뫂', '본'],
  ['홥', '합'],
  ['겿', '것'],
  ['렇', '렇'],
]);

function postProcessOcr(
  text: string,
  dictionary?: Map<string, string>,
): string {
  let result = text;

  // 기본 교정 사전 적용
  const corrections = dictionary ?? DEFAULT_CORRECTIONS;
  for (const [wrong, correct] of corrections) {
    result = result.replace(new RegExp(wrong, 'g'), correct);
  }

  // 불필요한 공백 정리
  result = result.replace(/\s{2,}/g, ' ');

  // 줄바꿈 정리
  result = result.replace(/\n{3,}/g, '\n\n');

  return result.trim();
}

// -- 문서 구조 패턴 (한국 공문서) ──────────────────────────────────────────────

const CHAPTER_PATTERNS = [
  /^제\s*(\d+)\s*장\b/,
  /^(\d+)\.\s+[가-힣]/,
  /^[IVX]+\.\s+/,
  /^[A-Z]\.\s+/,
];

const SECTION_PATTERNS = [
  /^제\s*(\d+)\s*절\b/,
  /^(\d+)\.(\d+)\s+/,
  /^[가나다라마바사]\.\s+/,
];

const SUBSECTION_PATTERNS = [
  /^(\d+)\.(\d+)\.(\d+)\s+/,
  /^\(\d+\)\s+/,
  /^[①②③④⑤⑥⑦⑧⑨⑩]\s*/,
];

// -- 메타데이터 추출 패턴 ─────────────────────────────────────────────────────

const METADATA_PATTERNS = {
  documentNumber: /(?:문서번호|관리번호|제\s*\d+[-\s]\d+\s*호)/,
  date: /\d{4}[\.\-\/]\s?\d{1,2}[\.\-\/]\s?\d{1,2}/,
  author: /(?:작성자|담당자|기안자)\s*[:：]\s*([가-힣]+)/,
  department: /(?:부서|소속|기관)\s*[:：]\s*([가-힣\s]+)/,
  classification: /(?:비공개|공개|대외비|일반|부분공개)/,
};

// -- DocumentLayoutParser 메인 클래스 ─────────────────────────────────────────

/** 문서 레이아웃 파서 -- Design §1 */
export class DocumentLayoutParser {
  private readonly config: DocumentLayoutParserConfig;

  constructor(config?: Partial<DocumentLayoutParserConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // -- 전체 분석 파이프라인 ───────────────────────────────────────────────

  /** 문서 전체 분석 -- Design §1 */
  async analyzeDocument(
    pages: { pageNumber: number; text: string; blocks?: TextBlock[] }[],
  ): Promise<DocumentAnalysisResult> {
    const startTime = Date.now();
    const allRegions: LayoutRegion[] = [];
    const pageAnalyses: PageAnalysis[] = [];

    for (const page of pages) {
      const regions = this.analyzePageLayout(page.pageNumber, page.text, page.blocks);
      allRegions.push(...regions);
      pageAnalyses.push({
        pageNumber: page.pageNumber,
        regions,
        text: page.text,
      });
    }

    // 문서 구조 트리 생성 (Design §3)
    const structure = this.buildStructureTree(allRegions);

    // 메타데이터 추출 (Design §5)
    const fullText = pages.map((p) => p.text).join('\n');
    const metadata = this.extractMetadata(fullText, pages.length);

    const processingTime = Date.now() - startTime;

    auditLog('document_analyzed', {
      pageCount: pages.length,
      regionCount: allRegions.length,
      processingTime,
    });

    return {
      pages: pageAnalyses,
      structure,
      metadata,
      regions: allRegions,
      processingTime,
    };
  }

  // -- 페이지 레이아웃 분석 ──────────────────────────────────────────────

  /** 페이지 내 영역 분류 -- Design §1 */
  analyzePageLayout(
    pageNumber: number,
    text: string,
    _blocks?: TextBlock[],
  ): LayoutRegion[] {
    // OCR 후처리 적용
    const processedText = this.config.enableOcrPostProcess
      ? postProcessOcr(text, this.config.correctionDictionary)
      : text;

    const lines = processedText.split('\n');
    const regions: LayoutRegion[] = [];
    let order = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!.trim();
      if (!line) continue;

      const type = this.classifyRegion(line, i, lines);
      regions.push({
        id: generateId('region'),
        type,
        bbox: { x: 0, y: i * 20, width: 800, height: 20 },
        text: line,
        confidence: 0.85,
        pageNumber,
        readingOrder: order++,
      });
    }

    return regions;
  }

  /** 텍스트 라인 영역 분류 */
  private classifyRegion(
    line: string,
    lineIndex: number,
    allLines: string[],
  ): LayoutRegionType {
    // 표 감지 (구분자 패턴)
    if (/[|│┃┆]/.test(line) || /^\s*[-─━]{3,}/.test(line)) return 'table';

    // 목록 감지
    if (/^[\s]*[•●◦◆▪▸-]\s/.test(line) || /^[\s]*\d+[.)]\s/.test(line)) return 'list';

    // 제목 감지 (패턴 매칭)
    if (CHAPTER_PATTERNS.some((p) => p.test(line))) return 'title';
    if (SECTION_PATTERNS.some((p) => p.test(line))) return 'title';
    if (lineIndex < 5 && line.length < 60 && !/[.。]$/.test(line)) return 'title';

    // 서명/직인 영역
    if (/(?:서명|직인|인|날인|확인자)/.test(line)) return 'signature';

    // 머리글/바닥글 (첫 1줄, 마지막 1줄)
    if (lineIndex === 0 && line.length < 40) return 'header';
    if (lineIndex === allLines.length - 1 && line.length < 40) return 'footer';

    return 'body';
  }

  // -- 문서 구조 트리 생성 ───────────────────────────────────────────────

  /** 계층 구조 생성 -- Design §3 */
  buildStructureTree(regions: LayoutRegion[]): DocumentStructureNode {
    const root: DocumentStructureNode = {
      id: generateId('doc'),
      level: 0,
      type: 'document',
      title: '문서',
      pageNumber: 1,
      children: [],
    };

    let currentChapter: DocumentStructureNode | null = null;
    let currentSection: DocumentStructureNode | null = null;

    for (const region of regions) {
      if (region.type === 'title') {
        const level = this.detectHeadingLevel(region.text);

        if (level === 1) {
          // 장 수준
          currentChapter = {
            id: generateId('chapter'),
            level: 1,
            type: 'chapter',
            title: region.text,
            pageNumber: region.pageNumber,
            children: [],
          };
          root.children.push(currentChapter);
          currentSection = null;
        } else if (level === 2 && currentChapter) {
          // 절 수준
          currentSection = {
            id: generateId('section'),
            level: 2,
            type: 'section',
            title: region.text,
            pageNumber: region.pageNumber,
            children: [],
          };
          currentChapter.children.push(currentSection);
        } else if (level === 3 && currentSection) {
          // 항 수준
          currentSection.children.push({
            id: generateId('subsec'),
            level: 3,
            type: 'subsection',
            title: region.text,
            pageNumber: region.pageNumber,
            children: [],
          });
        } else {
          // 최상위 컨텍스트 없으면 루트에 추가
          root.children.push({
            id: generateId('heading'),
            level: level,
            type: level === 1 ? 'chapter' : 'section',
            title: region.text,
            pageNumber: region.pageNumber,
            children: [],
          });
        }
      } else if (region.type === 'table') {
        const target = currentSection ?? currentChapter ?? root;
        target.children.push({
          id: generateId('table'),
          level: (target.level ?? 0) + 1,
          type: 'table',
          title: '표',
          content: region.text,
          pageNumber: region.pageNumber,
          children: [],
        });
      } else if (region.type === 'body') {
        const target = currentSection ?? currentChapter ?? root;
        target.children.push({
          id: generateId('para'),
          level: (target.level ?? 0) + 1,
          type: 'paragraph',
          title: '',
          content: region.text,
          pageNumber: region.pageNumber,
          children: [],
        });
      }
    }

    // 루트 제목 설정
    const firstTitle = regions.find((r) => r.type === 'title');
    if (firstTitle) root.title = firstTitle.text;

    return root;
  }

  /** 제목 레벨 판정 */
  private detectHeadingLevel(text: string): number {
    if (CHAPTER_PATTERNS.some((p) => p.test(text))) return 1;
    if (SECTION_PATTERNS.some((p) => p.test(text))) return 2;
    if (SUBSECTION_PATTERNS.some((p) => p.test(text))) return 3;
    return 1;
  }

  // -- 메타데이터 추출 ───────────────────────────────────────────────────

  /** 문서 메타데이터 추출 -- Design §5 */
  extractMetadata(fullText: string, pageCount: number): DocumentMetadata {
    const metadata: DocumentMetadata = {
      pageCount,
      extractedAt: new Date().toISOString(),
    };

    // 문서번호
    const docNumMatch = fullText.match(METADATA_PATTERNS.documentNumber);
    if (docNumMatch) metadata.documentNumber = docNumMatch[0];

    // 날짜
    const dateMatch = fullText.match(METADATA_PATTERNS.date);
    if (dateMatch) metadata.date = dateMatch[0];

    // 작성자
    const authorMatch = fullText.match(METADATA_PATTERNS.author);
    if (authorMatch) metadata.author = authorMatch[1];

    // 부서
    const deptMatch = fullText.match(METADATA_PATTERNS.department);
    if (deptMatch) metadata.department = deptMatch[1]!.trim();

    // 분류
    const classMatch = fullText.match(METADATA_PATTERNS.classification);
    if (classMatch) metadata.classification = classMatch[0];

    // 제목 (첫 번째 짧은 줄)
    const lines = fullText.split('\n').map((l) => l.trim()).filter(Boolean);
    for (const line of lines.slice(0, 10)) {
      if (line.length > 5 && line.length < 80 && !/^\d/.test(line)) {
        metadata.documentTitle = line;
        break;
      }
    }

    return metadata;
  }

  // -- 배치 처리 -- Design §6 ────────────────────────────────────────────

  /** 대량 문서 배치 처리 */
  async batchProcess(
    documents: { id: string; pages: { pageNumber: number; text: string }[] }[],
    onProgress?: (completed: number, total: number) => void,
  ): Promise<Map<string, DocumentAnalysisResult>> {
    const results = new Map<string, DocumentAnalysisResult>();

    for (let i = 0; i < documents.length; i++) {
      try {
        const doc = documents[i]!;
        const result = await this.analyzeDocument(doc.pages);
        results.set(doc.id, result);
      } catch (error) {
        auditLog('batch_error', {
          documentId: documents[i]!.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      if (onProgress) {
        onProgress(i + 1, documents.length);
      }
    }

    return results;
  }
}

/** 텍스트 블록 (OCR 출력) */
export interface TextBlock {
  text: string;
  bbox: BoundingBox;
  fontSize?: number;
  fontWeight?: 'normal' | 'bold';
}

// -- 팩토리 ──────────────────────────────────────────────────────────────────

let parserInstance: DocumentLayoutParser | null = null;

export function getDocumentLayoutParser(
  config?: Partial<DocumentLayoutParserConfig>,
): DocumentLayoutParser {
  if (!parserInstance) {
    parserInstance = new DocumentLayoutParser(config);
  }
  return parserInstance;
}

export function resetDocumentLayoutParser(): void {
  parserInstance = null;
}
