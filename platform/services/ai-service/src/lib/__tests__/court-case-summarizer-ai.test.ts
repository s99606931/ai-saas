import { describe, it, expect } from 'vitest';
import { CourtCaseSummarizerAI } from '../court-case-summarizer-ai.js';

describe('SVC-AI-ADV-R445 CourtCaseSummarizerAI', () => {
  const svc = new CourtCaseSummarizerAI();

  it('FR-445.2: 쟁점 섹션 추출', () => {
    const r = svc.summarize(['쟁점', '원고의 손해배상 청구 가능 여부']);
    expect(r.issues).toContain('손해배상');
    expect(r.found).toContain('issues');
  });

  it('FR-445.3: 3개 섹션 병합', () => {
    const r = svc.summarize([
      '쟁점',
      'A 쟁점',
      '판시사항',
      'B 판시',
      '결론',
      '기각',
    ]);
    expect(r.issues).toBe('A 쟁점');
    expect(r.rulings).toBe('B 판시');
    expect(r.conclusion).toBe('기각');
  });

  it('빈 입력', () => {
    const r = svc.summarize([]);
    expect(r.found).toEqual([]);
  });

  it('섹션 없음 → found 빈 배열', () => {
    const r = svc.summarize(['일반 문장']);
    expect(r.found).toEqual([]);
  });

  it('쟁점만 있음', () => {
    const r = svc.summarize(['쟁점', 'A']);
    expect(r.found).toContain('issues');
    expect(r.found).not.toContain('conclusion');
  });

  it('FR-445.5: S 차단', () => {
    expect(() => svc.summarize([], 'S')).toThrow('N2SF_BLOCKED');
  });

  it('감사 로그', () => {
    svc.summarize(['쟁점', 'X']);
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
