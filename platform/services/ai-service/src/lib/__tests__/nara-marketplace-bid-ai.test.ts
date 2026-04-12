import { describe, it, expect } from 'vitest';
import { NaraMarketplaceBidAi, type BidNotice, type AgencyProfile } from '../nara-marketplace-bid-ai';

describe('NaraMarketplaceBidAi', () => {
  const svc = new NaraMarketplaceBidAi();

  const notices: BidNotice[] = [
    {
      noticeId: 'N1',
      title: 'AI 기반 문서관리 시스템 구축',
      category: '정보화',
      budgetKrw: 500_000_000,
      requiredLicenses: ['SW사업자', 'ISMS'],
      requiredExperienceYears: 3,
      closingDate: '2026-05-01',
      rawText: 'AI 자연어 처리 문서 자동 분류',
    },
    {
      noticeId: 'N2',
      title: '건설 공사 용역',
      category: '건설',
      budgetKrw: 2_000_000_000,
      requiredLicenses: ['건설면허'],
      requiredExperienceYears: 10,
      closingDate: '2026-06-01',
      rawText: '도로 포장 공사',
    },
  ];

  const agency: AgencyProfile = {
    agencyId: 'A1',
    specialties: ['AI', '문서관리'],
    licenses: ['SW사업자', 'ISMS'],
    experienceYears: 5,
    maxBudgetKrw: 1_000_000_000,
  };

  it('normalizes notices', () => {
    const norm = svc.normalizeNotices(notices);
    expect(norm.length).toBe(2);
  });

  it('scores fit higher for matching notice', () => {
    const f1 = svc.scoreFit(notices[0]!, agency);
    const f2 = svc.scoreFit(notices[1]!, agency);
    expect(f1.score).toBeGreaterThan(f2.score);
  });

  it('checks eligibility', () => {
    const e1 = svc.checkEligibility(notices[0]!, agency);
    const e2 = svc.checkEligibility(notices[1]!, agency);
    expect(e1.eligible).toBe(true);
    expect(e2.eligible).toBe(false);
  });

  it('estimates competition', () => {
    const c = svc.estimateCompetition(notices[0]!, 5);
    expect(c.estimatedBidders).toBeGreaterThan(0);
  });

  it('generates recommendations', () => {
    const recs = svc.recommend(notices, agency);
    expect(recs.length).toBe(2);
    expect(recs[0]?.decision).toBe('recommend');
    expect(recs[1]?.decision).toBe('skip');
  });
});
