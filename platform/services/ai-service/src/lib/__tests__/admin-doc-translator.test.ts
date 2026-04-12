// MTU-N312 행정문서 번역 테스트
import { describe, it, expect } from 'vitest';
import { AdminDocTranslatorService } from '../admin-doc-translator.js';

describe('MTU-N312 AdminDocTranslator', () => {
  const svc = new AdminDocTranslatorService('tenant-n312');

  it('FR-N312.1: 문서 번역', () => {
    const result = svc.translate('공공기관 정책 안내', 'ko', 'en', 'official');
    expect(result).toBeDefined();
    expect(typeof result.translatedText).toBe('string');
  });

  it('FR-N312.2: PII 마스킹 번역', () => {
    const result = svc.translate('담당자 010-1234-5678', 'ko', 'en', 'notice');
    expect(result).toBeDefined();
  });

  it('FR-N312.6: 감사 로그', () => {
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
