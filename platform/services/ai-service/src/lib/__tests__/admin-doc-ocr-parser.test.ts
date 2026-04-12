import { describe, it, expect } from 'vitest';
import { AdminDocOcrParser } from '../admin-doc-ocr-parser.js';

describe('AdminDocOcrParser', () => {
  it('필수 필드 추출 및 PII 마스킹', () => {
    const parser = new AdminDocOcrParser();
    const result = parser.parse('doc-1', 'pdf', [
      { text: '문서번호: ADM-2026-0001', confidence: 0.95, bbox: { x: 0, y: 0, w: 100, h: 20 } },
      { text: '발급일자: 2026-04-12', confidence: 0.9, bbox: { x: 0, y: 30, w: 100, h: 20 } },
      { text: '서명자: 홍길동', confidence: 0.85, bbox: { x: 0, y: 60, w: 100, h: 20 } },
    ]);
    expect(result.fields.length).toBeGreaterThanOrEqual(3);
    const signer = result.fields.find((f) => f.name === 'signerName');
    expect(signer?.masked).toBe(true);
    expect(signer?.value).toMatch(/\*/);
  });

  it('저신뢰도 검수 플래그', () => {
    const parser = new AdminDocOcrParser({ reviewThreshold: 0.9 });
    const result = parser.parse('doc-2', 'image', [
      { text: '문서번호: X-1', confidence: 0.5, bbox: { x: 0, y: 0, w: 10, h: 10 } },
    ]);
    expect(result.requiresReview).toBe(true);
  });

  it('주민번호 마스킹', () => {
    const parser = new AdminDocOcrParser();
    const result = parser.parse('doc-3', 'pdf', [
      { text: '문서번호: A-1 서명자: 홍길동 주민번호 900101-1234567', confidence: 0.9, bbox: { x: 0, y: 0, w: 10, h: 10 } },
    ]);
    const rrn = result.fields.find((f) => f.name === 'rrn');
    expect(rrn?.value).toContain('*');
    expect(rrn?.value).not.toContain('1234567');
  });

  it('빈 블록 거부', () => {
    const parser = new AdminDocOcrParser();
    expect(() => parser.parse('doc-4', 'pdf', [])).toThrow('OCR_EMPTY_BLOCKS');
  });
});
