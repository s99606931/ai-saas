import { describe, it, expect, beforeEach } from 'vitest';
import { IdpV2, type OcrBlock } from '../idp-v2';

describe('IdpV2', () => {
  let svc: IdpV2;

  beforeEach(() => {
    svc = new IdpV2();
    svc.registerRule({ field: 'amount', type: 'amount' });
    svc.registerRule({ field: 'date', type: 'date' });
    svc.registerRule({ field: 'biz_no', type: 'korean-biz-no' });
  });

  it('FR-IDP.1 OCR 구조화', () => {
    const blocks: OcrBlock[] = [
      { text: '두번째', bbox: { x: 0, y: 100, w: 50, h: 20 }, confidence: 0.9 },
      { text: '첫번째', bbox: { x: 0, y: 10, w: 50, h: 20 }, confidence: 0.9 },
    ];
    expect(svc.structure(blocks)).toBe('첫번째 두번째');
  });

  it('FR-IDP.2 필드 추출', () => {
    const fields = svc.extractFields('금액 100,000원 2026-04-11 사업자 123-45-67890');
    expect(fields.find((f) => f.name === 'amount')?.value).toBe('100000');
    expect(fields.find((f) => f.name === 'date')?.value).toBe('2026-04-11');
    expect(fields.find((f) => f.name === 'biz_no')?.value).toBe('123-45-67890');
  });

  it('FR-IDP.3 검증', () => {
    const fields = svc.extractFields('금액 100원');
    expect(fields[0]!.valid).toBe(true);
  });

  it('FR-IDP.4 신뢰도', () => {
    const fields = svc.extractFields('100원');
    expect(svc.documentConfidence(fields)).toBeGreaterThan(0.5);
  });

  it('FR-IDP.5 검토 대기열', () => {
    const low: import('../idp-v2').ExtractedField[] = [{ name: 'amount', value: '100', confidence: 0.5, valid: true }];
    svc.queueForReview('d1', low);
    expect(svc.getReviewQueue().length).toBe(1);
  });
});
