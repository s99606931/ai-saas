import { describe, it, expect, beforeEach } from 'vitest';
import { PublicDocumentSummarizerV2, type Document } from '../public-document-summarizer-v2';

describe('PublicDocumentSummarizerV2', () => {
  let summarizer: PublicDocumentSummarizerV2;

  beforeEach(() => {
    summarizer = new PublicDocumentSummarizerV2();
  });

  it('throws BLOCKED for C grade document', () => {
    const docs: Document[] = [
      { docId: 'D1', content: '기밀 내용입니다.', grade: 'C', category: 'policy' },
    ];
    expect(() => summarizer.summarize(docs)).toThrow('BLOCKED');
  });

  it('throws BLOCKED for S grade document', () => {
    const docs: Document[] = [
      { docId: 'D2', content: '비밀 내용입니다.', grade: 'S', category: 'security' },
    ];
    expect(() => summarizer.summarize(docs)).toThrow('BLOCKED');
  });

  it('extracts first sentence as summary', () => {
    const docs: Document[] = [
      { docId: 'D3', content: '이 문서는 공공 정책에 관한 내용입니다. 추가 세부사항은 다음 섹션을 참조하세요.', grade: 'O', category: 'policy' },
    ];
    const results = summarizer.summarize(docs);
    expect(results[0]!.summary).toBe('이 문서는 공공 정책에 관한 내용입니다');
  });

  it('counts words correctly', () => {
    const docs: Document[] = [
      { docId: 'D4', content: '공공 서비스 정책 문서입니다', grade: 'O', category: 'admin' },
    ];
    const results = summarizer.summarize(docs);
    expect(results[0]!.wordCount).toBe(4);
  });

  it('extracts keywords (top 5 by frequency)', () => {
    const docs: Document[] = [
      { docId: 'D5', content: '예산 예산 예산 정책 정책 서비스 환경 안전 복지', grade: 'O', category: 'budget' },
    ];
    const results = summarizer.summarize(docs);
    expect(results[0]!.keywords[0]).toBe('예산');
    expect(results[0]!.keywords.length).toBeLessThanOrEqual(5);
  });

  it('records audit log', () => {
    summarizer.summarize([
      { docId: 'D6', content: '테스트 문서입니다.', grade: 'O', category: 'test' },
    ]);
    const log = summarizer.getAuditLog();
    expect(log.some(e => e.action === 'document.summarize')).toBe(true);
  });
});
