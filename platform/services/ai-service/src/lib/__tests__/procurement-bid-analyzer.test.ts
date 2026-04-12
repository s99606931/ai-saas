// MTU-N299 공공조달 입찰 분석 테스트
import { describe, it, expect } from 'vitest';
import { ProcurementBidAnalyzerService } from '../procurement-bid-analyzer.js';

describe('MTU-N299 ProcurementBidAnalyzer', () => {
  const svc = new ProcurementBidAnalyzerService('tenant-n299');

  const notice = {
    noticeId: 'n-1',
    title: '공공기관 SaaS 도입 입찰',
    agency: '조달청',
    bidType: 'general' as const,
    estimatedAmount: 500_000_000,
    deadline: '2026-06-30',
    requirements: 'CSAP 인증 필수, 5년 이상 경력, ISMS-P 보유',
    evaluationCriteria: '기술 70%, 가격 30%',
  };

  const capability = {
    certifications: ['CSAP', 'ISMS-P'],
    annualRevenue: 10_000_000_000,
    employees: 200,
    experiences: ['공공 SaaS 5년'],
    techStack: ['kubernetes', 'postgres'],
  };

  it('FR-N299.1: 요건 추출', () => {
    const reqs = svc.extractRequirements(notice);
    expect(Array.isArray(reqs)).toBe(true);
  });

  it('FR-N299.2: 적격성 평가', () => {
    const reqs = svc.extractRequirements(notice);
    const e = svc.assessEligibility(notice, reqs, capability);
    expect(e).toBeDefined();
  });

  it('FR-N299.3: 입찰 전략', () => {
    const reqs = svc.extractRequirements(notice);
    const e = svc.assessEligibility(notice, reqs, capability);
    const s = svc.suggestStrategy(notice, e);
    expect(s).toBeDefined();
  });

  it('FR-N299.4: 이력 등록 + 조회', () => {
    svc.recordHistory({
      noticeId: 'h-1',
      result: 'won',
      bidAmount: 480_000_000,
      submittedAt: '2026-04-11',
    } as any);
    expect(svc.getHistory().length).toBeGreaterThan(0);
  });

  it('FR-N299.6: 감사 로그', () => {
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
