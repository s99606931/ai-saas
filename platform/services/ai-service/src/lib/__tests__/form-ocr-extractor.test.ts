// MTU-N329 양식 OCR 추출 테스트
import { describe, it, expect } from 'vitest';
import { FormOcrExtractorService } from '../form-ocr-extractor.js';

describe('MTU-N329 FormOcrExtractor', () => {
  const svc = new FormOcrExtractorService('tenant-n329');

  it('FR-N329.1: 템플릿 등록', () => {
    const tpl = svc.register('tpl1', '민원신청서', 'civil', [
      { fieldId: 'f1', name: '성명', type: 'text', required: true },
      { fieldId: 'f2', name: '주민번호', type: 'text', required: true, pattern: '\\d{6}-\\d{7}' },
    ]);
    expect(tpl).toBeDefined();
  });

  it('FR-N329.2: OCR 데이터 추출', () => {
    svc.register('tpl2', '신청서', 'civil', [
      { fieldId: 'f1', name: '이름', type: 'text', required: true },
    ]);
    const result = svc.extract('tpl2', {
      f1: { value: '홍길동', confidence: 0.95 },
    });
    expect(result).toBeDefined();
  });

  it('FR-N329.6: 감사 로그', () => {
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
