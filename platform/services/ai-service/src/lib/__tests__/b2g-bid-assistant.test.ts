import { describe, it, expect } from 'vitest';
import { B2GBidAssistant, type BidNotice, type CompanyProfile } from '../b2g-bid-assistant';

describe('B2GBidAssistant', () => {
  const svc = new B2GBidAssistant();
  const notice: BidNotice = {
    noticeId: 'N1',
    title: '클라우드 SaaS 구축',
    agency: '행정안전부',
    budget: 800_000_000,
    durationMonths: 10,
    deadline: '2026-06-30',
    requirements: ['클라우드', 'CSAP', '한국어'],
    evaluationCriteria: [
      { name: '기술', weight: 60 },
      { name: '가격', weight: 40 },
    ],
  };
  const company: CompanyProfile = {
    companyId: 'C1',
    capabilities: ['클라우드', '한국어'],
    pastWins: 5,
    avgContractSize: 500_000_000,
    certifications: ['CSAP'],
  };

  it('parses notice text', () => {
    const parsed = svc.parseNotice(
      '예산: 500,000,000원\n기간: 12개월\n마감: 2026-05-20\n자격요건: 클라우드, CSAP',
      'N2',
    );
    expect(parsed.budget).toBe(500_000_000);
    expect(parsed.durationMonths).toBe(12);
    expect(parsed.deadline).toBe('2026-05-20');
    expect(parsed.requirements?.length).toBeGreaterThan(0);
  });

  it('calculates fit score', () => {
    const fit = svc.calculateFit(notice, company);
    expect(fit.matchedRequirements.length).toBe(3);
    expect(fit.score).toBeGreaterThan(0.5);
  });

  it('predicts competition', () => {
    const comp = svc.predictCompetition(notice);
    expect(comp.expectedBidders).toBeGreaterThan(0);
    expect(['low', 'med', 'high']).toContain(comp.level);
  });

  it('predicts win probability', () => {
    const fit = svc.calculateFit(notice, company);
    const comp = svc.predictCompetition(notice);
    const p = svc.winProbability(fit, comp, company.pastWins);
    expect(p).toBeGreaterThan(0);
    expect(p).toBeLessThanOrEqual(0.95);
  });

  it('builds proposal checklist', () => {
    const fit = svc.calculateFit(notice, company);
    const list = svc.buildChecklist(notice, fit);
    expect(list.length).toBeGreaterThan(5);
    expect(list.some((i) => i.includes('평가항목'))).toBe(true);
  });
});
