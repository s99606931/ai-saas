import { describe, it, expect } from 'vitest';
import { splitIntoChunks, extractKnowledge, queryKnowledgeBase, generateQualityReport, getKBauditLog } from '../../src/lib/knowledge-base-builder';

const SAMPLE_TEXT = `공공기관 SaaS 프레임워크는 CSAP 인증을 필수로 취득해야 합니다. CSAP 인증은 클라우드 보안 인증제를 의미합니다. 인증 절차는 신청서 제출, 현장 심사, 취약점 점검, 인증 심의를 거칩니다. 인증 유효 기간은 5년이며, 연 1회 사후 관리를 받아야 합니다. CSAP 중등급은 79개 통제 항목을 충족해야 하며, 상등급은 추가 요건이 있습니다. 공공기관은 N2SF 네트워크 보안 프레임워크를 준수해야 합니다. 데이터는 C등급, S등급, O등급으로 분류됩니다. C등급과 S등급 데이터는 외부 클라우드에 저장할 수 없습니다. 모든 보안 관련 활동은 감사 로그에 기록해야 합니다.`;

describe('AI 지식 베이스 구축', () => {
  it('문서를 청크로 분할해야 한다', () => {
    const chunks = splitIntoChunks('doc-1', SAMPLE_TEXT, 200);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.content.length).toBeLessThanOrEqual(300);
    }
  });

  it('지식을 추출해야 한다 (Q&A 쌍)', () => {
    const chunks = splitIntoChunks('doc-1', SAMPLE_TEXT, 200);
    const entries = extractKnowledge(chunks, '보안 가이드', '보안', 'admin');
    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      expect(entry.question).toBeDefined();
      expect(entry.answer).toBeDefined();
      expect(entry.qualityScore).toBeGreaterThanOrEqual(0);
    }
  });

  it('질의 응답이 동작해야 한다', () => {
    const chunks = splitIntoChunks('doc-2', SAMPLE_TEXT, 200);
    extractKnowledge(chunks, '보안 가이드', '보안', 'admin');

    const result = queryKnowledgeBase('CSAP 인증');
    expect(result.answer).toBeDefined();
    expect(result.confidence).toBeGreaterThanOrEqual(0);
  });

  it('관련 없는 질의에 적절히 응답해야 한다', () => {
    const result = queryKnowledgeBase('xyz123 완전히 관련 없는 질의');
    expect(result.answer).toBeDefined();
  });

  it('품질 리포트를 생성해야 한다', () => {
    const report = generateQualityReport();
    expect(report.totalEntries).toBeGreaterThan(0);
    expect(report.avgQualityScore).toBeGreaterThan(0);
  });

  it('감사 로그가 기록되어야 한다', () => {
    expect(getKBauditLog().length).toBeGreaterThan(0);
  });
});
