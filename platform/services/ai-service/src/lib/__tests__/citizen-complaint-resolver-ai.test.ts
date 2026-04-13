import { describe, it, expect } from 'vitest';
import { CitizenComplaintResolverAI } from '../citizen-complaint-resolver-ai.js';

describe('SVC-AI-ADV-R457 CitizenComplaintResolverAI', () => {
  const svc = new CitizenComplaintResolverAI();
  const faqs = [
    { id: 'faq1', keywords: ['주민등록', '발급'], solution: '주민센터 방문' },
    { id: 'faq2', keywords: ['쓰레기', '분리수거'], solution: '분리수거 안내' },
  ];

  it('FR-457.3: 매칭 성공', () => {
    const r = svc.resolve('주민등록 발급 받으려면', faqs);
    expect(r.matched).toBe(true);
    expect(r.faqId).toBe('faq1');
  });

  it('FR-457.3: 부분 매칭 성공 (0.5 이상)', () => {
    const r = svc.resolve('쓰레기 버리는 방법', faqs);
    // 1/2 = 0.5
    expect(r.matched).toBe(true);
    expect(r.faqId).toBe('faq2');
  });

  it('FR-457.4: 매칭 실패', () => {
    const r = svc.resolve('전혀 다른 내용', faqs);
    expect(r.matched).toBe(false);
    expect(r.recommendation).toBe('HUMAN_REVIEW');
  });

  it('FR-457.5: 대소문자 무관', () => {
    const r = svc.resolve(
      'TEST CASE',
      [{ id: 'f', keywords: ['test', 'case'], solution: 'ok' }],
    );
    expect(r.matched).toBe(true);
  });

  it('빈 민원 오류', () => {
    expect(() => svc.resolve('', faqs)).toThrow('EMPTY_COMPLAINT');
  });

  it('FAQ 없음', () => {
    const r = svc.resolve('주민등록 발급', []);
    expect(r.matched).toBe(false);
  });

  it('FR-457.6: C 차단', () => {
    expect(() => svc.resolve('test', faqs, 'C')).toThrow('N2SF_BLOCKED');
  });

  it('감사 로그', () => {
    svc.resolve('test', faqs);
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
