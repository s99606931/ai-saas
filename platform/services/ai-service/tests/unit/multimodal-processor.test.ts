// SVC-AI-ADV-R10 단위 테스트: 멀티모달 프로세서
// Design Ref: SVC-AI-ADV-R10 DESIGN §1
// Plan SC: FR-ADV10.1, FR-ADV10.2
// CSAP: D-12, D-08

import { describe, it, expect, vi } from 'vitest';

// PII 마스킹 모의
vi.mock('../../src/lib/pii-masking.js', () => ({
  maskPII: vi.fn((text: string) => text.replace(/\d{6}-\d{7}/g, '***-***')),
}));

import {
  MultimodalProcessor,
  getMimeFromExtension,
  createMultimodalProcessor,
} from '../../src/lib/multimodal-processor.js';
import type { SupportedImageMIME } from '../../src/lib/multimodal-processor.js';

// ── 모의 프로바이더 ─────────────────────────────────────────────────────────

function createMockProvider(isMultimodal: boolean = true) {
  return {
    isMultimodal,
    chat: vi.fn().mockResolvedValue({
      text: '{"text": "추출된 텍스트", "confidence": 0.9}',
      tokensUsed: 500,
      model: 'test-vlm',
    }),
  };
}

// ── JPEG 매직 바이트 ────────────────────────────────────────────────────────

function createJPEGBuffer(size: number = 100): Uint8Array {
  const buf = new Uint8Array(size);
  buf[0] = 0xFF; // JPEG 매직 바이트
  buf[1] = 0xD8;
  buf[2] = 0xFF;
  return buf;
}

function createPNGBuffer(size: number = 100): Uint8Array {
  const buf = new Uint8Array(size);
  buf[0] = 0x89; // PNG 매직 바이트
  buf[1] = 0x50;
  buf[2] = 0x4E;
  buf[3] = 0x47;
  return buf;
}

function createBMPBuffer(size: number = 100): Uint8Array {
  const buf = new Uint8Array(size);
  buf[0] = 0x42; // BMP 매직 바이트
  buf[1] = 0x4D;
  return buf;
}

// ── 테스트 ──────────────────────────────────────────────────────────────────

describe('MultimodalProcessor 이미지 전처리 (FR-ADV10.1)', () => {
  it('JPEG 이미지를 전처리한다', () => {
    const provider = createMockProvider();
    const processor = new MultimodalProcessor(provider as never);
    const metadata = processor.preprocessImage(createJPEGBuffer());
    expect(metadata.mimeType).toBe('image/jpeg');
    expect(metadata.base64Data).toBeDefined();
    expect(metadata.dataUri).toContain('data:image/jpeg;base64,');
  });

  it('PNG 이미지를 전처리한다', () => {
    const provider = createMockProvider();
    const processor = new MultimodalProcessor(provider as never);
    const metadata = processor.preprocessImage(createPNGBuffer());
    expect(metadata.mimeType).toBe('image/png');
  });

  it('BMP 이미지를 전처리한다', () => {
    const provider = createMockProvider();
    const processor = new MultimodalProcessor(provider as never);
    const metadata = processor.preprocessImage(createBMPBuffer());
    expect(metadata.mimeType).toBe('image/bmp');
  });

  it('MIME 타입 힌트를 우선 사용한다', () => {
    const provider = createMockProvider();
    const processor = new MultimodalProcessor(provider as never);
    const metadata = processor.preprocessImage(createJPEGBuffer(), 'image/png');
    expect(metadata.mimeType).toBe('image/png');
  });

  it('파일 크기를 기록한다', () => {
    const provider = createMockProvider();
    const processor = new MultimodalProcessor(provider as never);
    const buf = createJPEGBuffer(256);
    const metadata = processor.preprocessImage(buf);
    expect(metadata.sizeBytes).toBe(256);
  });

  it('최대 파일 크기 초과 시 에러를 발생한다', () => {
    const provider = createMockProvider();
    const processor = new MultimodalProcessor(provider as never, { maxSizeBytes: 50 });
    expect(() => processor.preprocessImage(createJPEGBuffer(100))).toThrow('이미지 크기 초과');
  });

  it('빈 이미지 데이터는 에러를 발생한다', () => {
    const provider = createMockProvider();
    const processor = new MultimodalProcessor(provider as never);
    expect(() => processor.preprocessImage(new Uint8Array(0))).toThrow('빈 이미지 데이터');
  });

  it('지원하지 않는 이미지 형식은 에러를 발생한다', () => {
    const provider = createMockProvider();
    const processor = new MultimodalProcessor(provider as never);
    const unknownBuf = new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x00]);
    expect(() => processor.preprocessImage(unknownBuf)).toThrow('지원하지 않는 이미지 형식');
  });
});

describe('MultimodalProcessor VLM 가용성', () => {
  it('멀티모달 지원 프로바이더를 감지한다', () => {
    const provider = createMockProvider(true);
    const processor = new MultimodalProcessor(provider as never);
    expect(processor.isMultimodalSupported).toBe(true);
  });

  it('멀티모달 미지원 프로바이더를 감지한다', () => {
    const provider = createMockProvider(false);
    const processor = new MultimodalProcessor(provider as never);
    expect(processor.isMultimodalSupported).toBe(false);
  });

  it('VLM 미지원 시 analyze 호출하면 에러를 발생한다', async () => {
    const provider = createMockProvider(false);
    const processor = new MultimodalProcessor(provider as never);
    await expect(processor.analyze(createJPEGBuffer(), '분석')).rejects.toThrow('멀티모달');
  });
});

describe('MultimodalProcessor VLM 분석 (FR-ADV10.2)', () => {
  it('VLM으로 이미지를 분석한다', async () => {
    const provider = createMockProvider(true);
    const processor = new MultimodalProcessor(provider as never);
    const result = await processor.analyze(createJPEGBuffer(), '문서를 분석하세요');
    expect(result.text).toBeDefined();
    expect(result.tokensUsed).toBeGreaterThan(0);
    expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
    expect(result.imageMetadata.mimeType).toBe('image/jpeg');
  });

  it('여러 이미지를 순차 분석한다', async () => {
    const provider = createMockProvider(true);
    const processor = new MultimodalProcessor(provider as never);
    const results = await processor.analyzeMultiple(
      [
        { buffer: createJPEGBuffer(), mimeType: 'image/jpeg' },
        { buffer: createPNGBuffer(), mimeType: 'image/png' },
      ],
      '문서를 분석하세요',
    );
    expect(results).toHaveLength(2);
  });
});

describe('getMimeFromExtension 유틸리티', () => {
  it('.jpg → image/jpeg', () => {
    expect(getMimeFromExtension('document.jpg')).toBe('image/jpeg');
  });

  it('.jpeg → image/jpeg', () => {
    expect(getMimeFromExtension('photo.jpeg')).toBe('image/jpeg');
  });

  it('.png → image/png', () => {
    expect(getMimeFromExtension('scan.png')).toBe('image/png');
  });

  it('.webp → image/webp', () => {
    expect(getMimeFromExtension('image.webp')).toBe('image/webp');
  });

  it('.tiff → image/tiff', () => {
    expect(getMimeFromExtension('scan.tiff')).toBe('image/tiff');
  });

  it('.bmp → image/bmp', () => {
    expect(getMimeFromExtension('old.bmp')).toBe('image/bmp');
  });

  it('지원하지 않는 확장자는 null을 반환한다', () => {
    expect(getMimeFromExtension('file.gif')).toBeNull();
  });

  it('확장자 없는 파일은 null을 반환한다', () => {
    expect(getMimeFromExtension('noextension')).toBeNull();
  });

  it('대문자 확장자도 인식한다', () => {
    expect(getMimeFromExtension('SCAN.JPG')).toBe('image/jpeg');
  });
});

describe('createMultimodalProcessor 팩토리', () => {
  it('MultimodalProcessor 인스턴스를 생성한다', () => {
    const provider = createMockProvider();
    const processor = createMultimodalProcessor(provider as never);
    expect(processor).toBeInstanceOf(MultimodalProcessor);
  });
});
