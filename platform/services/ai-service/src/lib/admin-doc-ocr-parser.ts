// 행정 문서 OCR + AI 구조화 파싱 — FR-N395.1~5
// N2SF: PII 마스킹 필수

export type DocFormat = 'pdf' | 'hwp' | 'image';

export interface OcrBlock {
  text: string;
  confidence: number;
  bbox: { x: number; y: number; w: number; h: number };
}

export interface ExtractedField {
  name: string;
  value: string;
  confidence: number;
  masked: boolean;
}

export interface ParsedAdminDoc {
  docId: string;
  format: DocFormat;
  fields: ExtractedField[];
  overallConfidence: number;
  requiresReview: boolean;
  blockCount: number;
}

export interface FieldExtractor {
  name: string;
  pattern: RegExp;
  isPii: boolean;
}

export const DEFAULT_EXTRACTORS: FieldExtractor[] = [
  { name: 'docNumber', pattern: /문서번호[\s:]*([A-Za-z0-9\-_/]+)/, isPii: false },
  { name: 'issueDate', pattern: /(\d{4}[-./]\d{1,2}[-./]\d{1,2})/, isPii: false },
  { name: 'signerName', pattern: /서명[자인][\s:]*([가-힣]{2,4})/, isPii: true },
  { name: 'phone', pattern: /(0\d{1,2}-?\d{3,4}-?\d{4})/, isPii: true },
  { name: 'rrn', pattern: /(\d{6}-\d{7})/, isPii: true },
];

export interface ParserOptions {
  reviewThreshold: number;
  extractors: FieldExtractor[];
}

export class AdminDocOcrParser {
  private readonly options: ParserOptions;

  constructor(options: Partial<ParserOptions> = {}) {
    this.options = {
      reviewThreshold: options.reviewThreshold ?? 0.8,
      extractors: options.extractors ?? DEFAULT_EXTRACTORS,
    };
  }

  parse(docId: string, format: DocFormat, blocks: OcrBlock[]): ParsedAdminDoc {
    if (blocks.length === 0) throw new Error('OCR_EMPTY_BLOCKS');
    const joinedText = blocks.map((b) => b.text).join('\n');
    const fields: ExtractedField[] = [];

    for (const extractor of this.options.extractors) {
      const match = joinedText.match(extractor.pattern);
      if (!match) continue;
      const raw = match[1] ?? match[0];
      const blockConfidences = blocks
        .filter((b) => b.text.includes(raw))
        .map((b) => b.confidence);
      const avgConf = blockConfidences.length > 0
        ? blockConfidences.reduce((a, b) => a + b, 0) / blockConfidences.length
        : 0.5;
      fields.push({
        name: extractor.name,
        value: extractor.isPii ? this.maskPii(raw, extractor.name) : raw,
        confidence: Number(avgConf.toFixed(3)),
        masked: extractor.isPii,
      });
    }

    const overall =
      fields.length > 0
        ? fields.reduce((sum, f) => sum + f.confidence, 0) / fields.length
        : blocks.reduce((sum, b) => sum + b.confidence, 0) / blocks.length;

    return {
      docId,
      format,
      fields,
      overallConfidence: Number(overall.toFixed(3)),
      requiresReview: overall < this.options.reviewThreshold,
      blockCount: blocks.length,
    };
  }

  private maskPii(value: string, type: string): string {
    if (type === 'rrn') {
      return value.slice(0, 8) + '*******';
    }
    if (type === 'phone') {
      return value.replace(/(\d{2,3}-?\d{3,4})-?(\d{4})/, '$1-****');
    }
    if (type === 'signerName') {
      return value.length > 1 ? `${value[0]}${'*'.repeat(value.length - 1)}` : '*';
    }
    return '***';
  }
}
