import { describe, it, expect, beforeEach } from 'vitest';
import { AITranslationEngine } from '../ai-translation-engine.js';

describe('SVC-AI-ADV-R398 AITranslationEngine', () => {
  let svc: AITranslationEngine;
  beforeEach(() => {
    svc = new AITranslationEngine();
    svc.registerTerm('민원', { en: 'civil complaint', ja: '民願', zh: '民愿' });
    svc.registerTerm('공공기관', { en: 'public agency', ja: '公共機関', zh: '公共机构' });
  });

  it('FR-388.1: 용어 매핑 번역', () => {
    const r = svc.translate('민원 공공기관', 'en');
    expect(r.translated).toBe('civil complaint public agency');
    expect(r.coverage).toBe(1);
  });

  it('FR-388.2: 미매핑 용어 식별', () => {
    const r = svc.translate('민원 특이용어', 'en');
    expect(r.missingTerms).toContain('특이용어');
    expect(r.coverage).toBe(0.5);
  });

  it('FR-388.3: 일본어 번역', () => {
    const r = svc.translate('공공기관', 'ja');
    expect(r.translated).toBe('公共機関');
  });

  it('FR-388.4: C등급 차단', () => {
    expect(() => svc.translate('민원', 'en', 'C')).toThrow('N2SF_BLOCKED');
  });

  it('FR-388.5: 감사 로그', () => {
    svc.translate('민원', 'en');
    const log = svc.getAuditLog();
    expect(log.length).toBeGreaterThanOrEqual(3); // 2 register + 1 translate
  });

  it('빈 문자열 처리', () => {
    const r = svc.translate('', 'en');
    expect(r.coverage).toBe(1);
    expect(r.translated).toBe('');
  });
});
