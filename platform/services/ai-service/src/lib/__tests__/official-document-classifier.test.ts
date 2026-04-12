import { describe, it, expect } from 'vitest';
import { OfficialDocumentClassifier } from '../official-document-classifier.js';

describe('SVC-AI-ADV-R354 OfficialDocumentClassifier', () => {
  const svc = new OfficialDocumentClassifier();
  svc.registerCategory('재무', ['예산', '결산', '회계']);
  svc.registerCategory('인사', ['채용', '승진', '인사']);

  it('FR-354.1: 분류 및 신뢰도', () => {
    const r = svc.classify('d1', '2026년도 예산 편성', '예산 예산 결산', 'O');
    expect(r.category).toBe('재무');
    expect(r.confidence).toBeGreaterThan(0);
  });

  it('FR-354.2: 미매칭 unclassified', () => {
    const r = svc.classify('d2', 'hello', 'world', 'O');
    expect(r.category).toBe('unclassified');
    expect(r.confidence).toBe(0);
  });

  it('FR-354.3: C/S 차단', () => {
    expect(() => svc.classify('d3', 't', 'b', 'S')).toThrow('N2SF_BLOCKED');
  });

  it('FR-354.4: 감사 로그', () => {
    svc.classify('d4', '인사', '채용 공고', 'O');
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });

  it('여러 카테고리 중 최고점 선택', () => {
    const r = svc.classify('d5', '예산 채용 채용', '채용 채용 승진', 'O');
    expect(r.category).toBe('인사');
  });

  it('매칭 키워드 반환', () => {
    const r = svc.classify('d6', '결산', '회계', 'O');
    expect(r.matchedKeywords.length).toBeGreaterThan(0);
  });
});
