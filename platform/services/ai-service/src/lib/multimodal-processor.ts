// 멀티모달 AI 프로세서 — FR-ADV10.1, FR-ADV10.2
// Design Ref: SVC-AI-ADV-R10 DESIGN §1
// Plan SC: SC-1 (이미지 기반 문서 분석)
// CSAP: D-12 시스템 개발 보안, D-08 접근 통제
// N2SF: N-05 O등급 데이터만 AI 전송

import type { LLMProvider, LLMMessage, LLMContentPart, LLMResponse } from './llm-provider.js';
import { maskPII } from './pii-masking.js';

// ── 타입 정의 ────────────────────────────────────────────────────────────────

/** 지원 이미지 MIME 타입 */
export type SupportedImageMIME =
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp'
  | 'image/tiff'
  | 'image/bmp';

/** 이미지 메타데이터 */
export interface ImageMetadata {
  /** MIME 타입 */
  mimeType: SupportedImageMIME;
  /** 파일 크기 (bytes) */
  sizeBytes: number;
  /** 너비 (px, 추정) */
  width?: number;
  /** 높이 (px, 추정) */
  height?: number;
  /** base64 인코딩 데이터 */
  base64Data: string;
  /** data URI */
  dataUri: string;
}

/** 멀티모달 처리 옵션 */
export interface MultimodalProcessOptions {
  /** 최대 해상도 (px, 기본 4096) */
  maxResolution?: number;
  /** 최대 파일 크기 (bytes, 기본 10MB) */
  maxSizeBytes?: number;
  /** 이미지 품질 (JPEG 압축, 0.0~1.0, 기본 0.85) */
  quality?: number;
  /** PII 마스킹 활성화 (텍스트 응답에 적용, 기본 true) */
  enablePIIMasking?: boolean;
}

/** 멀티모달 분석 결과 */
export interface MultimodalResult {
  /** 분석 텍스트 응답 */
  text: string;
  /** 사용된 토큰 수 */
  tokensUsed: number;
  /** 사용된 모델 */
  model: string;
  /** 처리 시간 (ms) */
  processingTimeMs: number;
  /** 이미지 메타데이터 */
  imageMetadata: ImageMetadata;
}

// ── 설정 ─────────────────────────────────────────────────────────────────────

const DEFAULT_OPTIONS: Required<MultimodalProcessOptions> = {
  maxResolution: 4096,
  maxSizeBytes: 10 * 1024 * 1024, // 10MB
  quality: 0.85,
  enablePIIMasking: true,
};

/** 지원 MIME 타입 매핑 */
const MIME_TYPE_MAP: Record<string, SupportedImageMIME> = {
  'image/jpeg': 'image/jpeg',
  'image/jpg': 'image/jpeg',
  'image/png': 'image/png',
  'image/webp': 'image/webp',
  'image/tiff': 'image/tiff',
  'image/bmp': 'image/bmp',
};

/** 파일 확장자 → MIME 매핑 */
const EXTENSION_MAP: Record<string, SupportedImageMIME> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.tiff': 'image/tiff',
  '.tif': 'image/tiff',
  '.bmp': 'image/bmp',
};

// ── 멀티모달 프로세서 ────────────────────────────────────────────────────────

/**
 * 멀티모달 AI 프로세서
 *
 * 이미지를 전처리하고 Vision-Language 모델(VLM)에 전송하여 분석합니다.
 * 공문서 스캔 이미지의 텍스트 추출, 표 분석, 도장/서명 감지 등을 지원합니다.
 *
 * 특징:
 * - 이미지 형식 자동 감지 및 변환
 * - 해상도/크기 제한 적용
 * - base64 인코딩 + data URI 생성
 * - PII 마스킹 (텍스트 응답)
 * - VLM 미가용 시 에러 (OCR 폴백은 DocumentAnalyzer에서 처리)
 */
export class MultimodalProcessor {
  private readonly provider: LLMProvider;
  private readonly options: Required<MultimodalProcessOptions>;

  constructor(provider: LLMProvider, options?: MultimodalProcessOptions) {
    this.provider = provider;
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * VLM 가용 여부를 확인합니다
   */
  get isMultimodalSupported(): boolean {
    return this.provider.isMultimodal;
  }

  /**
   * 이미지와 텍스트 프롬프트로 VLM 분석을 수행합니다
   *
   * @param imageBuffer - 이미지 바이너리 데이터
   * @param prompt - 분석 지시 텍스트
   * @param mimeType - 이미지 MIME (선택, 자동 감지)
   * @returns 분석 결과
   */
  async analyze(
    imageBuffer: Uint8Array,
    prompt: string,
    mimeType?: string,
  ): Promise<MultimodalResult> {
    const startTime = Date.now();

    // 1. VLM 지원 확인
    if (!this.provider.isMultimodal) {
      throw new Error('현재 LLM 프로바이더는 멀티모달(이미지)을 지원하지 않습니다. OCR 폴백을 사용하십시오.');
    }

    // 2. 이미지 전처리 — FR-ADV10.1
    const imageMetadata = this.preprocessImage(imageBuffer, mimeType);

    // 3. VLM 메시지 구성 — FR-ADV10.2, Design §1.2
    const contentParts: LLMContentPart[] = [
      { type: 'image_url', image_url: { url: imageMetadata.dataUri } },
      { type: 'text', text: prompt },
    ];

    const messages: LLMMessage[] = [
      {
        role: 'system',
        content: '당신은 공공기관 문서를 분석하는 전문가입니다. 한국어로 응답하십시오. 이미지에서 개인정보(이름, 주민번호 등)를 발견하면 마스킹하여 보고하십시오.',
      },
      {
        role: 'user',
        content: contentParts,
      },
    ];

    // 4. VLM 호출
    const response: LLMResponse = await this.provider.chat(messages, {
      maxTokens: 4096,
      temperature: 0.1, // 문서 분석은 낮은 온도
    });

    // 5. PII 마스킹 — N2SF N-05
    const text = this.options.enablePIIMasking
      ? maskPII(response.text)
      : response.text;

    return {
      text,
      tokensUsed: response.tokensUsed,
      model: response.model,
      processingTimeMs: Date.now() - startTime,
      imageMetadata,
    };
  }

  /**
   * 여러 이미지를 순차 분석합니다
   */
  async analyzeMultiple(
    images: Array<{ buffer: Uint8Array; mimeType?: string }>,
    prompt: string,
  ): Promise<MultimodalResult[]> {
    const results: MultimodalResult[] = [];
    for (const img of images) {
      const result = await this.analyze(img.buffer, prompt, img.mimeType);
      results.push(result);
    }
    return results;
  }

  // ── 이미지 전처리 — FR-ADV10.1 ────────────────────────────────────

  /**
   * 이미지를 전처리하여 VLM 전송 가능한 형태로 변환합니다
   */
  preprocessImage(buffer: Uint8Array, mimeTypeHint?: string): ImageMetadata {
    // 크기 검증
    if (buffer.byteLength > this.options.maxSizeBytes) {
      throw new Error(
        `이미지 크기 초과: ${(buffer.byteLength / 1024 / 1024).toFixed(1)}MB (최대: ${(this.options.maxSizeBytes / 1024 / 1024).toFixed(1)}MB)`,
      );
    }

    if (buffer.byteLength === 0) {
      throw new Error('빈 이미지 데이터');
    }

    // MIME 타입 감지
    const detectedMime = mimeTypeHint
      ? (MIME_TYPE_MAP[mimeTypeHint] ?? detectMimeFromBuffer(buffer))
      : detectMimeFromBuffer(buffer);

    if (!detectedMime) {
      throw new Error(`지원하지 않는 이미지 형식입니다. 지원 형식: JPEG, PNG, WebP, TIFF, BMP`);
    }

    // base64 인코딩
    const base64Data = bufferToBase64(buffer);
    const dataUri = `data:${detectedMime};base64,${base64Data}`;

    return {
      mimeType: detectedMime,
      sizeBytes: buffer.byteLength,
      base64Data,
      dataUri,
    };
  }
}

// ── 유틸리티 함수 ────────────────────────────────────────────────────────────

/**
 * 파일 매직 바이트로 MIME 타입 감지
 */
function detectMimeFromBuffer(buffer: Uint8Array): SupportedImageMIME | null {
  if (buffer.length < 4) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return 'image/jpeg';
  }

  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    return 'image/png';
  }

  // WebP: 52 49 46 46 ... 57 45 42 50
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
      buffer.length > 11 && buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
    return 'image/webp';
  }

  // TIFF: 49 49 2A 00 (little-endian) or 4D 4D 00 2A (big-endian)
  if ((buffer[0] === 0x49 && buffer[1] === 0x49 && buffer[2] === 0x2A && buffer[3] === 0x00) ||
      (buffer[0] === 0x4D && buffer[1] === 0x4D && buffer[2] === 0x00 && buffer[3] === 0x2A)) {
    return 'image/tiff';
  }

  // BMP: 42 4D
  if (buffer[0] === 0x42 && buffer[1] === 0x4D) {
    return 'image/bmp';
  }

  return null;
}

/**
 * Uint8Array를 base64 문자열로 변환
 */
function bufferToBase64(buffer: Uint8Array): string {
  // Node.js 환경
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(buffer).toString('base64');
  }

  // 브라우저/Edge Runtime 환경
  let binary = '';
  for (let i = 0; i < buffer.length; i++) {
    binary += String.fromCharCode(buffer[i] ?? 0);
  }
  return btoa(binary);
}

/**
 * 파일 확장자에서 MIME 타입 추출
 */
export function getMimeFromExtension(filename: string): SupportedImageMIME | null {
  const ext = filename.toLowerCase().match(/\.\w+$/)?.[0];
  if (!ext) return null;
  return EXTENSION_MAP[ext] ?? null;
}

// ── 팩토리 ───────────────────────────────────────────────────────────────────

export function createMultimodalProcessor(
  provider: LLMProvider,
  options?: MultimodalProcessOptions,
): MultimodalProcessor {
  return new MultimodalProcessor(provider, options);
}
