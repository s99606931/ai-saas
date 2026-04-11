// 공공기관 문서 분석기 — FR-ADV10.3~FR-ADV10.8
// Design Ref: SVC-AI-ADV-R10 DESIGN §2
// Plan SC: SC-1~SC-4 (텍스트 추출, 표 분석, 도장 감지, 문서 분류)
// CSAP: D-12 시스템 개발 보안, D-08 접근 통제
// N2SF: N-05 O등급 데이터만 처리, PII 마스킹

import type { LLMProvider, LLMMessage, LLMResponse } from './llm-provider.js';
import { MultimodalProcessor } from './multimodal-processor.js';
import { maskPII } from './pii-masking.js';

// ── 분석 모드 — Design §2.1 ─────────────────────────────────────────────────

/** 문서 분석 모드 */
export type AnalysisMode =
  | 'extract_text'    // 전문 텍스트 추출
  | 'analyze_table'   // 표/차트 구조 분석
  | 'detect_seal'     // 도장/서명 감지
  | 'classify'        // 문서 유형 분류
  | 'full_analysis';  // 전체 통합 분석

// ── 분석 결과 타입 — Design §2.2 ────────────────────────────────────────────

/** 표 구조 */
export interface TableStructure {
  /** 표 번호 */
  tableIndex: number;
  /** 헤더 행 */
  headers: string[];
  /** 데이터 행 */
  rows: string[][];
  /** 행 수 */
  rowCount: number;
  /** 열 수 */
  columnCount: number;
}

/** 도장/서명 감지 결과 */
export interface SealDetection {
  /** 유형 */
  type: 'official_seal' | 'personal_seal' | 'signature' | 'stamp';
  /** 위치 설명 */
  location: string;
  /** 감지 신뢰도 (0.0~1.0) */
  confidence: number;
  /** 추가 설명 */
  description: string;
}

/** 문서 분류 결과 */
export interface DocumentClassification {
  /** 주요 유형 */
  primaryType: string;
  /** 세부 유형 */
  subType?: string;
  /** 분류 신뢰도 */
  confidence: number;
  /** 분류 근거 */
  reason: string;
}

/** 공문서 유형 목록 */
export const OFFICIAL_DOC_TYPES = [
  '협조전', '공고문', '보고서', '회의록', '결재문서',
  '기안문', '시행문', '통보문', '조회문', '회신문',
  '감사보고서', '예산서', '결산서', '계약서', '입찰공고',
  '민원서류', '증명서', '허가서', '인가서', '기타',
] as const;

/** 문서 분석 전체 결과 */
export interface DocumentAnalysisResult {
  /** 분석 모드 */
  mode: AnalysisMode;
  /** 추출된 텍스트 (PII 마스킹 적용) */
  text?: string;
  /** 표/차트 구조 */
  tables?: TableStructure[];
  /** 도장/서명 감지 */
  seals?: SealDetection[];
  /** 문서 분류 */
  classification?: DocumentClassification;
  /** 분석 신뢰도 (0.0~1.0) */
  confidence: number;
  /** 처리 시간 (ms) */
  processingTimeMs: number;
  /** 사용된 토큰 수 */
  tokensUsed: number;
  /** 분석 방법 (vlm / ocr_fallback) */
  method: 'vlm' | 'ocr_fallback';
  /** 원본 응답 (디버그용) */
  rawResponse?: string;
}

// ── OCR 폴백 인터페이스 — FR-ADV10.7 ────────────────────────────────────────

/** OCR 엔진 인터페이스 (DIP) */
export interface OCREngine {
  /** 이미지에서 텍스트 추출 */
  extractText(imageBuffer: Uint8Array): Promise<{
    text: string;
    confidence: number;
    language: string;
  }>;
}

// ── 분석 프롬프트 ────────────────────────────────────────────────────────────

const PROMPTS: Record<AnalysisMode, string> = {
  extract_text:
    `이 문서 이미지의 모든 텍스트를 정확하게 추출하십시오.
원본 레이아웃(제목, 본문, 각주 등)을 최대한 보존하십시오.
개인정보(이름, 주민번호, 전화번호 등)는 [마스킹]으로 표시하십시오.

반드시 다음 JSON 형식으로 응답:
{"text": "추출된 전체 텍스트", "confidence": 0.0~1.0}`,

  analyze_table:
    `이 문서 이미지에서 표(table)를 찾아 구조를 분석하십시오.
각 표의 헤더(열 이름)와 데이터 행을 추출하십시오.

반드시 다음 JSON 형식으로 응답:
{"tables": [{"headers": ["열1","열2"], "rows": [["값1","값2"]], "rowCount": N, "columnCount": N}], "confidence": 0.0~1.0}`,

  detect_seal:
    `이 문서 이미지에서 도장, 서명, 직인을 찾으십시오.
각 도장/서명의 유형(official_seal/personal_seal/signature/stamp), 위치, 설명을 제공하십시오.

반드시 다음 JSON 형식으로 응답:
{"seals": [{"type": "official_seal", "location": "우측 하단", "confidence": 0.9, "description": "기관 직인"}], "confidence": 0.0~1.0}`,

  classify:
    `이 문서 이미지의 유형을 분류하십시오.
공공기관 공문서 유형: 협조전, 공고문, 보고서, 회의록, 결재문서, 기안문, 시행문, 통보문, 조회문, 회신문, 감사보고서, 예산서, 결산서, 계약서, 입찰공고, 민원서류, 증명서, 허가서, 인가서, 기타

반드시 다음 JSON 형식으로 응답:
{"primaryType": "유형명", "subType": "세부유형", "confidence": 0.0~1.0, "reason": "분류 근거"}`,

  full_analysis:
    `이 공문서 이미지를 전체 분석하십시오:
1. 전문 텍스트 추출 (개인정보는 [마스킹])
2. 표가 있으면 구조 분석
3. 도장/서명이 있으면 감지
4. 문서 유형 분류

반드시 다음 JSON 형식으로 응답:
{
  "text": "추출된 텍스트",
  "tables": [{"headers":[],"rows":[],"rowCount":0,"columnCount":0}],
  "seals": [{"type":"","location":"","confidence":0,"description":""}],
  "classification": {"primaryType":"","confidence":0,"reason":""},
  "confidence": 0.0~1.0
}`,
};

// ── 문서 분석기 ──────────────────────────────────────────────────────────────

/**
 * 공공기관 문서 분석기
 *
 * 스캔된 공문서 이미지를 VLM(Vision-Language Model)으로 분석합니다.
 * VLM 미가용 시 OCR 엔진 폴백을 지원합니다.
 *
 * 분석 기능:
 * - 텍스트 추출 (OCR+AI 하이브리드)
 * - 표/차트 구조 분석 (JSON 변환)
 * - 도장/서명 감지 (위치+유형)
 * - 문서 유형 자동 분류
 */
export class DocumentAnalyzer {
  private readonly processor: MultimodalProcessor;
  private readonly provider: LLMProvider;
  private readonly ocrEngine?: OCREngine;

  constructor(provider: LLMProvider, ocrEngine?: OCREngine) {
    this.provider = provider;
    this.processor = new MultimodalProcessor(provider);
    this.ocrEngine = ocrEngine;
  }

  /**
   * 문서 이미지를 분석합니다
   *
   * @param imageBuffer - 이미지 바이너리 데이터
   * @param mode - 분석 모드 (기본: full_analysis)
   * @param mimeType - 이미지 MIME 타입 (선택)
   * @returns 분석 결과
   */
  async analyze(
    imageBuffer: Uint8Array,
    mode: AnalysisMode = 'full_analysis',
    mimeType?: string,
  ): Promise<DocumentAnalysisResult> {
    const startTime = Date.now();
    const prompt = PROMPTS[mode];

    // VLM 가용 시 — 이미지 직접 분석
    if (this.processor.isMultimodalSupported) {
      try {
        const result = await this.processor.analyze(imageBuffer, prompt, mimeType);
        const parsed = this.parseAnalysisResponse(result.text, mode);

        return {
          mode,
          ...parsed,
          confidence: parsed.confidence ?? 0.8,
          processingTimeMs: Date.now() - startTime,
          tokensUsed: result.tokensUsed,
          method: 'vlm',
          rawResponse: result.text,
        };
      } catch (error: unknown) {
        // VLM 실패 시 OCR 폴백 시도
        if (this.ocrEngine) {
          return this.ocrFallback(imageBuffer, mode, startTime);
        }
        throw error;
      }
    }

    // VLM 미가용 — OCR 폴백 — FR-ADV10.7
    if (this.ocrEngine) {
      return this.ocrFallback(imageBuffer, mode, startTime);
    }

    throw new Error(
      '멀티모달 모델과 OCR 엔진 모두 사용할 수 없습니다. ' +
      'VLM 지원 모델(llava, gemma-4-vl 등)을 설정하거나 OCR 엔진을 제공하십시오.',
    );
  }

  // ── OCR 폴백 — FR-ADV10.7 ─────────────────────────────────────────

  private async ocrFallback(
    imageBuffer: Uint8Array,
    mode: AnalysisMode,
    startTime: number,
  ): Promise<DocumentAnalysisResult> {
    // 1. OCR 텍스트 추출
    const ocrResult = await this.ocrEngine!.extractText(imageBuffer);
    const ocrText = maskPII(ocrResult.text); // PII 마스킹 — FR-ADV10.8

    // 2. 추출된 텍스트를 LLM으로 분석
    const llmPrompt = this.buildOCRAnalysisPrompt(ocrText, mode);
    const messages: LLMMessage[] = [
      {
        role: 'system',
        content: '당신은 공공기관 문서를 분석하는 전문가입니다. OCR로 추출된 텍스트를 기반으로 분석하십시오.',
      },
      { role: 'user', content: llmPrompt },
    ];

    const response: LLMResponse = await this.provider.chat(messages, {
      maxTokens: 4096,
      temperature: 0.1,
    });

    const parsed = this.parseAnalysisResponse(response.text, mode);

    // OCR 폴백 시 텍스트가 없으면 OCR 결과 사용
    if (mode === 'extract_text' || mode === 'full_analysis') {
      if (!parsed.text) {
        parsed.text = ocrText;
      }
    }

    return {
      mode,
      ...parsed,
      confidence: Math.min(parsed.confidence ?? 0.6, ocrResult.confidence),
      processingTimeMs: Date.now() - startTime,
      tokensUsed: response.tokensUsed,
      method: 'ocr_fallback',
      rawResponse: response.text,
    };
  }

  private buildOCRAnalysisPrompt(ocrText: string, mode: AnalysisMode): string {
    switch (mode) {
      case 'extract_text':
        return `다음 OCR 추출 텍스트를 정리하십시오:\n\n${ocrText}\n\nJSON 응답: {"text": "정리된 텍스트", "confidence": 0.0~1.0}`;
      case 'analyze_table':
        return `다음 텍스트에서 표 구조를 추출하십시오:\n\n${ocrText}\n\nJSON 응답: {"tables": [...], "confidence": 0.0~1.0}`;
      case 'detect_seal':
        return `다음 텍스트에서 도장/서명 관련 언급을 찾으십시오:\n\n${ocrText}\n\nJSON 응답: {"seals": [...], "confidence": 0.0~1.0}`;
      case 'classify':
        return `다음 문서 텍스트의 유형을 분류하십시오:\n\n${ocrText}\n\nJSON 응답: {"primaryType": "", "confidence": 0.0~1.0, "reason": ""}`;
      case 'full_analysis':
        return `다음 OCR 추출 텍스트를 전체 분석하십시오:\n\n${ocrText}\n\nJSON 응답: {"text": "", "tables": [], "seals": [], "classification": {}, "confidence": 0.0~1.0}`;
    }
  }

  // ── 응답 파싱 ──────────────────────────────────────────────────────

  private parseAnalysisResponse(
    responseText: string,
    mode: AnalysisMode,
  ): Partial<DocumentAnalysisResult> {
    try {
      // JSON 추출
      const jsonMatch = /\{[\s\S]*\}/.exec(responseText);
      if (!jsonMatch) {
        return { text: maskPII(responseText), confidence: 0.5 };
      }

      const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
      const result: Partial<DocumentAnalysisResult> = {
        confidence: Number(parsed['confidence']) || 0.5,
      };

      // 모드별 결과 추출
      if (mode === 'extract_text' || mode === 'full_analysis') {
        if (typeof parsed['text'] === 'string') {
          result.text = maskPII(parsed['text']);
        }
      }

      if (mode === 'analyze_table' || mode === 'full_analysis') {
        if (Array.isArray(parsed['tables'])) {
          result.tables = (parsed['tables'] as Record<string, unknown>[]).map((t, i) => ({
            tableIndex: i,
            headers: Array.isArray(t['headers']) ? (t['headers'] as string[]) : [],
            rows: Array.isArray(t['rows']) ? (t['rows'] as string[][]) : [],
            rowCount: Number(t['rowCount']) || 0,
            columnCount: Number(t['columnCount']) || 0,
          }));
        }
      }

      if (mode === 'detect_seal' || mode === 'full_analysis') {
        if (Array.isArray(parsed['seals'])) {
          result.seals = (parsed['seals'] as Record<string, unknown>[]).map((s) => ({
            type: (s['type'] as SealDetection['type']) ?? 'stamp',
            location: String(s['location'] ?? ''),
            confidence: Number(s['confidence']) || 0,
            description: String(s['description'] ?? ''),
          }));
        }
      }

      if (mode === 'classify' || mode === 'full_analysis') {
        const classObj = mode === 'classify' ? parsed : (parsed['classification'] as Record<string, unknown> | undefined);
        if (classObj && typeof classObj === 'object') {
          result.classification = {
            primaryType: String((classObj as Record<string, unknown>)['primaryType'] ?? '기타'),
            subType: (classObj as Record<string, unknown>)['subType'] as string | undefined,
            confidence: Number((classObj as Record<string, unknown>)['confidence']) || 0,
            reason: String((classObj as Record<string, unknown>)['reason'] ?? ''),
          };
        }
      }

      return result;
    } catch {
      // JSON 파싱 실패 — 원본 텍스트 반환
      return { text: maskPII(responseText), confidence: 0.3 };
    }
  }
}

// ── 팩토리 ───────────────────────────────────────────────────────────────────

/**
 * 문서 분석기 인스턴스 생성
 *
 * @param provider - LLM 프로바이더 (VLM 지원 권장)
 * @param ocrEngine - OCR 엔진 (선택, VLM 폴백용)
 */
export function createDocumentAnalyzer(
  provider: LLMProvider,
  ocrEngine?: OCREngine,
): DocumentAnalyzer {
  return new DocumentAnalyzer(provider, ocrEngine);
}
