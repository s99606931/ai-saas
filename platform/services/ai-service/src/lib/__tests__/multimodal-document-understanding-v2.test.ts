import { describe, it, expect, beforeEach } from 'vitest';
import { MultimodalDocumentUnderstandingV2 } from '../multimodal-document-understanding-v2';

describe('MultimodalDocumentUnderstandingV2', () => {
  let doc: MultimodalDocumentUnderstandingV2;

  beforeEach(() => {
    doc = new MultimodalDocumentUnderstandingV2();
  });

  it('문서를 등록한다', () => {
    doc.registerDocument('d1', '민원 처리 지침', 'text');
    expect(doc.getAuditLog().some(l => l.action === 'REGISTER_DOCUMENT')).toBe(true);
  });

  it('섹션을 추가한다', () => {
    doc.registerDocument('d1', '지침', 'text');
    doc.addSection('d1', '개요', '이 문서는 민원 처리 절차를 설명합니다', 'text');
    expect(doc.getAuditLog().some(l => l.action === 'ADD_SECTION')).toBe(true);
  });

  it('키워드 검색으로 섹션을 찾는다', () => {
    doc.registerDocument('d1', '지침', 'text');
    doc.addSection('d1', '민원 접수', '민원 처리 절차 설명', 'text');
    doc.addSection('d1', '예산 계획', '예산 편성 방법 안내', 'text');
    const results = doc.searchSections('d1', '민원');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]!.sectionTitle).toBe('민원 접수');
  });

  it('문서 요약을 생성한다', () => {
    doc.registerDocument('d1', '지침', 'mixed');
    doc.addSection('d1', '1장', '첫 번째 장 내용입니다');
    doc.addSection('d1', '2장', '두 번째 장 내용입니다');
    doc.addSection('d1', '3장', '세 번째 장 내용입니다');
    const summary = doc.summarize('d1', 2);
    expect(summary.sections.length).toBe(2);
    expect(summary.docTitle).toBe('지침');
  });

  it('쿼리 매칭 없으면 빈 배열을 반환한다', () => {
    doc.registerDocument('d1', '지침', 'text');
    doc.addSection('d1', '개요', '민원 처리');
    const results = doc.searchSections('d1', 'xyz_no_match_term');
    expect(results.length).toBe(0);
  });

  it('C등급 검색을 차단한다', () => {
    doc.registerDocument('d1', '지침', 'text');
    expect(() => doc.searchSections('d1', '민원', 'C' as never)).toThrow('BLOCKED');
  });

  it('미등록 문서 섹션 추가 시 오류를 던진다', () => {
    expect(() => doc.addSection('unknown', '제목', '내용')).toThrow('문서 미등록');
  });
});
