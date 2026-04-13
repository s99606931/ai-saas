import { describe, it, expect, beforeEach } from 'vitest';
import { GovernmentReportSummarizerAI } from '../government-report-summarizer-ai';

describe('GovernmentReportSummarizerAI', () => {
  let ai: GovernmentReportSummarizerAI;

  beforeEach(() => {
    ai = new GovernmentReportSummarizerAI();
  });

  it('보고서를 수집한다', () => {
    ai.ingestReport({
      reportId: 'r1',
      title: '환경 정책 보고서',
      body: '# 서론\n환경 오염은 심각하다. 대기오염은 증가하고 있다.\n# 본론\n정부는 대책을 마련해야 한다.',
      publishedAt: 't',
      department: '환경부',
    });
    expect(ai.getReportCount()).toBe(1);
  });

  it('섹션을 분리한다', () => {
    ai.ingestReport({
      reportId: 'r1',
      title: 't',
      body: '# 제1장 서론\n내용1\n# 제2장 본론\n내용2\n# 제3장 결론\n내용3',
      publishedAt: 't',
      department: 'd',
    });
    const sections = ai.splitSections('r1');
    expect(sections.length).toBe(3);
  });

  it('요약 결과를 반환한다', () => {
    ai.ingestReport({
      reportId: 'r1',
      title: 't',
      body: '환경 보호는 중요하다. 환경 정책이 필요하다. 환경 오염은 심각하다. 환경을 지켜야 한다.',
      publishedAt: 't',
      department: 'd',
    });
    const summary = ai.summarize('r1', 2);
    expect(summary.sentences.length).toBeLessThanOrEqual(2);
    expect(summary.keywords.length).toBeGreaterThan(0);
    expect(summary.keywords[0]!.term).toContain('환경');
  });

  it('부서별 보고서 목록을 반환한다', () => {
    ai.ingestReport({
      reportId: 'r1',
      title: 'a',
      body: '본문',
      publishedAt: 't',
      department: '환경부',
    });
    ai.ingestReport({
      reportId: 'r2',
      title: 'b',
      body: '본문',
      publishedAt: 't',
      department: '국토부',
    });
    expect(ai.listReportsByDepartment('환경부').length).toBe(1);
  });

  it('PII를 마스킹한다', () => {
    ai.ingestReport({
      reportId: 'r1',
      title: '제목',
      body: '연락처: test@example.com 입니다',
      publishedAt: 't',
      department: 'd',
    });
    const reports = ai.listReportsByDepartment('d');
    expect(reports[0]!.body).toContain('[EMAIL_MASKED]');
  });

  it('S등급 데이터는 차단한다', () => {
    expect(() =>
      ai.ingestReport(
        { reportId: 'r1', title: 't', body: 'b', publishedAt: 't', department: 'd' },
        'S',
      ),
    ).toThrow('BLOCKED');
  });
});
