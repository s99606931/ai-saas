// MTU-N282 공문서 AI 자동 검토 테스트
import { describe, it, expect } from 'vitest';
import { OfficialDocumentReviewService } from '../official-document-reviewer.js';

describe('MTU-N282 OfficialDocumentReviewer', () => {
  const svc = new OfficialDocumentReviewService('tenant-n282');
  const sampleDoc = `## 제목\n공문서 시범안\n## 내용\n상기 사항에 대해 검토바랍니다.\n담당자 010-1234-5678\n## 결론\n승인 요청`;

  it('FR-N282.1: 법령 적합성 검토', () => {
    const r = svc.reviewLegal('u1', 'doc-282-1', sampleDoc);
    expect(r.reviewId).toBeDefined();
    expect(typeof r.overallScore).toBe('number');
  });

  it('FR-N282.2: 행정용어 검토', () => {
    const r = svc.reviewTerms('u1', 'doc-282-2', sampleDoc);
    expect(r.reviewId).toBeDefined();
    expect(r.complianceRate).toBeGreaterThanOrEqual(0);
  });

  it('FR-N282.3: 문서 구조 검증', () => {
    const r = svc.validateStructure(sampleDoc, 'internal');
    expect(typeof r.isValid).toBe('boolean');
    expect(typeof r.score).toBe('number');
  });

  it('FR-N282.4: 종합 리포트', () => {
    const r = svc.generateReport('u1', 'doc-282-4', sampleDoc, 'internal');
    expect(r.reportId).toBeDefined();
    expect(['A', 'B', 'C', 'D', 'F']).toContain(r.overallGrade);
  });

  it('FR-N282.6: 감사 로그', () => {
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
