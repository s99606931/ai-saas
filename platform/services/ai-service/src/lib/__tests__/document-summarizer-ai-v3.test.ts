import { describe, it, expect, beforeEach } from 'vitest';
import { DocumentSummarizerAiV3 } from '../document-summarizer-ai-v3';

describe('SVC-AI-ADV-R640 DocumentSummarizerAiV3', () => {
  let svc: DocumentSummarizerAiV3;

  beforeEach(() => {
    svc = new DocumentSummarizerAiV3();
  });

  it('FR-R640.1: 문서 등록', () => {
    svc.registerDocument('d1', '제1호 공문');
    expect(svc.getCompressionRatio('d1')).toBe(0);
  });

  it('FR-R640.2: C등급 본문 차단', () => {
    svc.registerDocument('d1', '제1호');
    expect(() => svc.summarize('d1', '본문입니다. 긴 내용.', 1, 'C')).toThrow(/BLOCKED/);
  });

  it('FR-R640.3: 압축 비율 산출', () => {
    svc.registerDocument('d1', '제1호');
    svc.summarize('d1', '첫 문장. 둘째 문장. 셋째 문장.', 1);
    const ratio = svc.getCompressionRatio('d1');
    expect(ratio).toBeGreaterThan(0);
    expect(ratio).toBeLessThan(1);
  });

  it('FR-R640.4: 긴 문서 목록 반환', () => {
    svc.registerDocument('d1', 'A');
    svc.registerDocument('d2', 'B');
    svc.summarize('d1', '짧은 본문.');
    svc.summarize('d2', 'A'.repeat(200));
    const longs = svc.getLongDocuments(100);
    expect(longs.map((d) => d.docId)).toEqual(['d2']);
  });

  it('FR-R640.5: 감사 로그 기록', () => {
    svc.registerDocument('d1', 'A');
    svc.summarize('d1', '문장 하나. 문장 둘.');
    const log = svc.getAuditLog();
    expect(log.some((e) => e.action === 'SUMMARIZE')).toBe(true);
  });
});
