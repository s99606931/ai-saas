// File Upload 테스트
// Plan SC: FR-FU.1~FR-FU.6

import { describe, it, expect } from 'vitest';
import {
  validateFileUpload,
  detectMimeTypeFromMagicBytes,
  sanitizeFilename,
  calculateSHA256,
  FileUploadError,
  type FileUploadOptions,
} from '../src/file-upload.js';

const pdfContent = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
const pngContent = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const jpgContent = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

const defaultOptions: FileUploadOptions = {
  maxSizeBytes: 10 * 1024 * 1024,
  allowedMimeTypes: ['application/pdf', 'image/png', 'image/jpeg'],
  allowedExtensions: ['.pdf', '.png', '.jpg', '.jpeg'],
};

describe('FR-FU.1: 파일 크기 검증', () => {
  it('최대 크기를 초과하면 에러를 던진다', () => {
    const largeContent = Buffer.alloc(11 * 1024 * 1024, 0x00);
    expect(() =>
      validateFileUpload(
        { filename: 'big.pdf', mimeType: 'application/pdf', content: largeContent },
        defaultOptions,
      ),
    ).toThrow(FileUploadError);
  });

  it('빈 파일은 거부한다', () => {
    expect(() =>
      validateFileUpload(
        { filename: 'empty.pdf', mimeType: 'application/pdf', content: Buffer.alloc(0) },
        defaultOptions,
      ),
    ).toThrow(/빈 파일/);
  });

  it('크기 내 파일은 통과한다', () => {
    const result = validateFileUpload(
      { filename: 'ok.pdf', mimeType: 'application/pdf', content: pdfContent },
      defaultOptions,
    );
    expect(result.size).toBe(pdfContent.length);
  });
});

describe('FR-FU.2: MIME 화이트리스트', () => {
  it('허용되지 않은 MIME 타입 거부', () => {
    expect(() =>
      validateFileUpload(
        { filename: 'evil.exe', mimeType: 'application/x-msdownload', content: pdfContent },
        defaultOptions,
      ),
    ).toThrow(/허용되지 않은 MIME/);
  });

  it('허용된 MIME 타입 통과', () => {
    const result = validateFileUpload(
      { filename: 'doc.pdf', mimeType: 'application/pdf', content: pdfContent },
      defaultOptions,
    );
    expect(result.verifiedMimeType).toBe('application/pdf');
  });
});

describe('FR-FU.3: 매직 바이트 검증', () => {
  it('PDF 매직 바이트 탐지', () => {
    expect(detectMimeTypeFromMagicBytes(pdfContent)).toBe('application/pdf');
  });

  it('PNG 매직 바이트 탐지', () => {
    expect(detectMimeTypeFromMagicBytes(pngContent)).toBe('image/png');
  });

  it('JPG 매직 바이트 탐지', () => {
    expect(detectMimeTypeFromMagicBytes(jpgContent)).toBe('image/jpeg');
  });

  it('알 수 없는 매직 바이트는 null 반환', () => {
    expect(detectMimeTypeFromMagicBytes(Buffer.from([0x00, 0x11, 0x22]))).toBeNull();
  });

  it('확장자 위변조 탐지 (PDF 내용을 PNG로 신고)', () => {
    expect(() =>
      validateFileUpload(
        { filename: 'fake.png', mimeType: 'image/png', content: pdfContent },
        defaultOptions,
      ),
    ).toThrow(/일치하지 않/);
  });

  it('허용되지 않은 확장자 거부', () => {
    expect(() =>
      validateFileUpload(
        { filename: 'doc.txt', mimeType: 'application/pdf', content: pdfContent },
        defaultOptions,
      ),
    ).toThrow(/확장자/);
  });
});

describe('FR-FU.4: 파일명 새니타이제이션', () => {
  it('경로 순회 시도 제거', () => {
    expect(sanitizeFilename('../../etc/passwd')).not.toContain('..');
    expect(sanitizeFilename('../../etc/passwd')).not.toContain('/');
  });

  it('백슬래시 경로 구분자 제거', () => {
    expect(sanitizeFilename('..\\..\\windows\\system32')).not.toContain('\\');
  });

  it('숨김 파일 방지', () => {
    expect(sanitizeFilename('.env')).not.toMatch(/^\./);
  });

  it('제어 문자 제거', () => {
    expect(sanitizeFilename('file\x00name.pdf')).toBe('filename.pdf');
  });

  it('위험한 특수문자 대체', () => {
    const result = sanitizeFilename('file<>:"|?*.pdf');
    expect(result).not.toMatch(/[<>:"|?*]/);
  });

  it('공백을 밑줄로 변환', () => {
    expect(sanitizeFilename('my document.pdf')).toBe('my_document.pdf');
  });

  it('255자 초과 파일명 자르기 (확장자 보존)', () => {
    const long = 'a'.repeat(300) + '.pdf';
    const result = sanitizeFilename(long);
    expect(result.length).toBeLessThanOrEqual(255);
    expect(result).toMatch(/\.pdf$/);
  });

  it('빈 파일명 기본값', () => {
    expect(sanitizeFilename('')).toBe('unnamed');
    expect(sanitizeFilename('...')).toBe('unnamed');
  });
});

describe('FR-FU.5: SHA-256 해시', () => {
  it('동일 내용은 동일 해시', () => {
    expect(calculateSHA256(pdfContent)).toBe(calculateSHA256(pdfContent));
  });

  it('다른 내용은 다른 해시', () => {
    expect(calculateSHA256(pdfContent)).not.toBe(calculateSHA256(pngContent));
  });

  it('64자 16진수 해시', () => {
    const hash = calculateSHA256(pdfContent);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe('FR-FU.6: 메타데이터 반환', () => {
  it('검증된 파일 메타데이터 구조', () => {
    const result = validateFileUpload(
      { filename: 'report.pdf', mimeType: 'application/pdf', content: pdfContent },
      defaultOptions,
    );
    expect(result).toMatchObject({
      sanitizedFilename: 'report.pdf',
      verifiedMimeType: 'application/pdf',
      size: pdfContent.length,
    });
    expect(result.sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it('파일명에 경로가 있으면 새니타이제이션 후 반환', () => {
    const result = validateFileUpload(
      { filename: '../uploads/report.pdf', mimeType: 'application/pdf', content: pdfContent },
      defaultOptions,
    );
    expect(result.sanitizedFilename).not.toContain('..');
    expect(result.sanitizedFilename).not.toContain('/');
  });
});
