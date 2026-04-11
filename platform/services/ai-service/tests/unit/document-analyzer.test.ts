// SVC-AI-ADV-R10 단위 테스트: 공공기관 문서 분석기
// Design Ref: SVC-AI-ADV-R10 DESIGN §2
// Plan SC: FR-ADV10.3~FR-ADV10.8
// CSAP: D-12 시스템 개발 보안, D-08 접근 통제

import { describe, it, expect, vi, beforeEach } from 'vitest';

// PII 마스킹 모의
vi.mock('../../src/lib/pii-masking.js', () => ({
  maskPII: vi.fn((text: string) => text.replace(/\d{6}-\d{7}/g, '***-***')),
}));

import {
  DocumentAnalyzer,
  createDocumentAnalyzer,
  OFFICIAL_DOC_TYPES,
} from '../../src/lib/document-analyzer.js';
import type {
  AnalysisMode,
  OCREngine,
  DocumentAnalysisResult,
} from '../../src/lib/document-analyzer.js';

// ── 모의 프로바이더/엔진 ───────────────────────────────────────────────────

function createJPEGBuffer(size: number = 100): Uint8Array {
  const buf = new Uint8Array(size);
  buf[0] = 0xFF;
  buf[1] = 0xD8;
  buf[2] = 0xFF;
  return buf;
}

function createMockProvider(options: {
  isMultimodal?: boolean;
  chatResponse?: string;
} = {}) {
  const { isMultimodal = true, chatResponse } = options;
  return {
    isMultimodal,
    chat: vi.fn().mockResolvedValue({
      text: chatResponse ?? JSON.stringify({
        text: '추출된 문서 텍스트입니다.',
        tables: [{ headers: ['항목', '내용'], rows: [['1', '값1']], rowCount: 1, columnCount: 2 }],
        seals: [{ type: 'official_seal', location: '우측 하단', confidence: 0.95, description: '기관 직인' }],
        classification: { primaryType: '보고서', confidence: 0.9, reason: '보고서 양식' },
        confidence: 0.88,
      }),
      tokensUsed: 500,
      model: 'test-vlm',
    }),
  };
}

function createMockOCREngine(ocrText: string = 'OCR 추출 텍스트입니다.'): OCREngine {
  return {
    extractText: vi.fn().mockResolvedValue({
      text: ocrText,
      confidence: 0.85,
      language: 'ko',
    }),
  };
}

// ── VLM 분석 테스트 — FR-ADV10.3 ───────────────────────────────────────────

describe('DocumentAnalyzer VLM 분석 (FR-ADV10.3~10.6)', () => {
  it('full_analysis 모드로 전체 분석한다', async () => {
    const provider = createMockProvider();
    const analyzer = new DocumentAnalyzer(provider as never);
    const result = await analyzer.analyze(createJPEGBuffer());

    expect(result.mode).toBe('full_analysis');
    expect(result.method).toBe('vlm');
    expect(result.text).toBeDefined();
    expect(result.tables).toBeDefined();
    expect(result.seals).toBeDefined();
    expect(result.classification).toBeDefined();
    expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
    expect(result.tokensUsed).toBeGreaterThan(0);
  });

  it('extract_text 모드로 텍스트를 추출한다', async () => {
    const provider = createMockProvider({
      chatResponse: '{"text": "전자정부법 제10조 내용입니다.", "confidence": 0.9}',
    });
    const analyzer = new DocumentAnalyzer(provider as never);
    const result = await analyzer.analyze(createJPEGBuffer(), 'extract_text');

    expect(result.mode).toBe('extract_text');
    expect(result.text).toBeDefined();
  });

  it('analyze_table 모드로 표를 분석한다', async () => {
    const provider = createMockProvider({
      chatResponse: JSON.stringify({
        tables: [{ headers: ['번호', '내용', '비고'], rows: [['1', '항목1', '-']], rowCount: 1, columnCount: 3 }],
        confidence: 0.88,
      }),
    });
    const analyzer = new DocumentAnalyzer(provider as never);
    const result = await analyzer.analyze(createJPEGBuffer(), 'analyze_table');

    expect(result.mode).toBe('analyze_table');
    expect(result.tables).toHaveLength(1);
    expect(result.tables?.[0]?.headers).toContain('번호');
    expect(result.tables?.[0]?.columnCount).toBe(3);
  });

  it('detect_seal 모드로 도장을 감지한다', async () => {
    const provider = createMockProvider({
      chatResponse: JSON.stringify({
        seals: [
          { type: 'official_seal', location: '우측 하단', confidence: 0.95, description: '행정안전부 직인' },
          { type: 'signature', location: '좌측 하단', confidence: 0.80, description: '서명' },
        ],
        confidence: 0.9,
      }),
    });
    const analyzer = new DocumentAnalyzer(provider as never);
    const result = await analyzer.analyze(createJPEGBuffer(), 'detect_seal');

    expect(result.mode).toBe('detect_seal');
    expect(result.seals).toHaveLength(2);
    expect(result.seals?.[0]?.type).toBe('official_seal');
  });

  it('classify 모드로 문서 유형을 분류한다', async () => {
    const provider = createMockProvider({
      chatResponse: '{"primaryType": "협조전", "confidence": 0.92, "reason": "협조전 양식 준수"}',
    });
    const analyzer = new DocumentAnalyzer(provider as never);
    const result = await analyzer.analyze(createJPEGBuffer(), 'classify');

    expect(result.mode).toBe('classify');
    expect(result.classification?.primaryType).toBe('협조전');
    expect(result.classification?.confidence).toBe(0.92);
  });

  it('PII 마스킹이 적용된다 (N2SF N-05)', async () => {
    const provider = createMockProvider({
      chatResponse: '{"text": "주민번호 900101-1234567이 포함됩니다.", "confidence": 0.85}',
    });
    const analyzer = new DocumentAnalyzer(provider as never);
    const result = await analyzer.analyze(createJPEGBuffer(), 'extract_text');

    // PII 마스킹 함수가 호출되었는지 확인
    expect(result.text).not.toContain('900101-1234567');
  });

  it('신뢰도를 포함한다', async () => {
    const provider = createMockProvider();
    const analyzer = new DocumentAnalyzer(provider as never);
    const result = await analyzer.analyze(createJPEGBuffer());

    expect(result.confidence).toBeGreaterThan(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });
});

// ── OCR 폴백 — FR-ADV10.7 ──────────────────────────────────────────────────

describe('DocumentAnalyzer OCR 폴백 (FR-ADV10.7)', () => {
  it('VLM 미지원 시 OCR 폴백으로 분석한다', async () => {
    const provider = createMockProvider({
      isMultimodal: false,
      chatResponse: '{"text": "OCR 분석 결과", "confidence": 0.75}',
    });
    const ocrEngine = createMockOCREngine();
    const analyzer = new DocumentAnalyzer(provider as never, ocrEngine);

    const result = await analyzer.analyze(createJPEGBuffer(), 'extract_text');

    expect(result.method).toBe('ocr_fallback');
    expect(ocrEngine.extractText).toHaveBeenCalled();
  });

  it('VLM 실패 시 OCR 폴백을 시도한다', async () => {
    const provider = {
      isMultimodal: true,
      chat: vi.fn()
        .mockRejectedValueOnce(new Error('VLM 오류')) // VLM 분석 실패
        .mockResolvedValueOnce({ // OCR 분석 LLM 호출
          text: '{"text": "폴백 결과", "confidence": 0.7}',
          tokensUsed: 100,
          model: 'test',
        }),
    };
    const ocrEngine = createMockOCREngine();
    const analyzer = new DocumentAnalyzer(provider as never, ocrEngine);

    const result = await analyzer.analyze(createJPEGBuffer(), 'extract_text');
    expect(result.method).toBe('ocr_fallback');
  });

  it('VLM과 OCR 모두 없으면 에러를 발생한다', async () => {
    const provider = createMockProvider({ isMultimodal: false });
    const analyzer = new DocumentAnalyzer(provider as never);

    await expect(
      analyzer.analyze(createJPEGBuffer()),
    ).rejects.toThrow('멀티모달 모델과 OCR 엔진 모두 사용할 수 없습니다');
  });

  it('OCR 폴백 시 텍스트가 없으면 OCR 원본을 사용한다', async () => {
    const provider = createMockProvider({
      isMultimodal: false,
      chatResponse: '{"confidence": 0.6}', // text 필드 없음
    });
    const ocrEngine = createMockOCREngine('OCR 원본 텍스트');
    const analyzer = new DocumentAnalyzer(provider as never, ocrEngine);

    const result = await analyzer.analyze(createJPEGBuffer(), 'extract_text');
    expect(result.text).toContain('OCR 원본 텍스트');
  });

  it('OCR 폴백 신뢰도는 OCR과 LLM 중 낮은 값이다', async () => {
    const provider = createMockProvider({
      isMultimodal: false,
      chatResponse: '{"text": "분석 결과", "confidence": 0.9}',
    });
    // OCR 신뢰도 0.85 < LLM 0.9
    const ocrEngine = createMockOCREngine();
    const analyzer = new DocumentAnalyzer(provider as never, ocrEngine);

    const result = await analyzer.analyze(createJPEGBuffer(), 'extract_text');
    expect(result.confidence).toBeLessThanOrEqual(0.85);
  });
});

// ── 응답 파싱 에러 처리 ─────────────────────────────────────────────────────

describe('DocumentAnalyzer 응답 파싱', () => {
  it('JSON이 아닌 응답은 원본 텍스트로 반환한다', async () => {
    const provider = createMockProvider({
      chatResponse: '이것은 JSON이 아닙니다. 문서 내용입니다.',
    });
    const analyzer = new DocumentAnalyzer(provider as never);
    const result = await analyzer.analyze(createJPEGBuffer(), 'extract_text');

    expect(result.text).toBeDefined();
    expect(result.confidence).toBeLessThanOrEqual(0.5);
  });

  it('잘못된 JSON은 기본 신뢰도 0.3을 반환한다', async () => {
    const provider = createMockProvider({
      chatResponse: '{ invalid json }',
    });
    const analyzer = new DocumentAnalyzer(provider as never);
    const result = await analyzer.analyze(createJPEGBuffer(), 'extract_text');

    expect(result.confidence).toBeLessThanOrEqual(0.5);
  });
});

// ── 상수 테스트 ─────────────────────────────────────────────────────────────

describe('OFFICIAL_DOC_TYPES 상수', () => {
  it('20개 공문서 유형을 정의한다', () => {
    expect(OFFICIAL_DOC_TYPES).toHaveLength(20);
  });

  it('주요 공문서 유형을 포함한다', () => {
    expect(OFFICIAL_DOC_TYPES).toContain('협조전');
    expect(OFFICIAL_DOC_TYPES).toContain('보고서');
    expect(OFFICIAL_DOC_TYPES).toContain('회의록');
    expect(OFFICIAL_DOC_TYPES).toContain('결재문서');
    expect(OFFICIAL_DOC_TYPES).toContain('기안문');
    expect(OFFICIAL_DOC_TYPES).toContain('민원서류');
  });
});

// ── 팩토리 ──────────────────────────────────────────────────────────────────

describe('createDocumentAnalyzer 팩토리', () => {
  it('DocumentAnalyzer 인스턴스를 생성한다', () => {
    const provider = createMockProvider();
    const analyzer = createDocumentAnalyzer(provider as never);
    expect(analyzer).toBeInstanceOf(DocumentAnalyzer);
  });

  it('OCR 엔진을 선택적으로 제공한다', () => {
    const provider = createMockProvider();
    const ocrEngine = createMockOCREngine();
    const analyzer = createDocumentAnalyzer(provider as never, ocrEngine);
    expect(analyzer).toBeInstanceOf(DocumentAnalyzer);
  });
});
