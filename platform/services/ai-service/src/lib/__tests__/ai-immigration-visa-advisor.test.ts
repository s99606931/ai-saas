import { describe, it, expect, beforeEach } from 'vitest';
import { AIImmigrationVisaAdvisor, type ApplicantProfile } from '../ai-immigration-visa-advisor';

describe('AIImmigrationVisaAdvisor', () => {
  let ai: AIImmigrationVisaAdvisor;

  const baseProfile = (): ApplicantProfile => ({
    applicantId: 'A1',
    nationality: 'CN',
    age: 30,
    purpose: 'work',
    educationLevel: 'bachelor',
    koreanLevel: 3,
    annualIncome: 35_000_000,
    investmentAmount: 0,
    hasJobOffer: true,
    hasKoreanRelative: false,
  });

  beforeEach(() => {
    ai = new AIImmigrationVisaAdvisor();
  });

  it('박사 + 고용계약 시 E-1 적격', () => {
    const p = baseProfile();
    p.educationLevel = 'phd';
    const r = ai.recommend(p);
    const e1 = r.find((x) => x.visaType === 'E-1')!;
    expect(e1.eligible).toBe(true);
  });

  it('학사 + 고용계약 + 소득 시 E-7 적격', () => {
    const r = ai.recommend(baseProfile());
    const e7 = r.find((x) => x.visaType === 'E-7')!;
    expect(e7.eligible).toBe(true);
  });

  it('1억 투자 시 D-8 적격', () => {
    const p = baseProfile();
    p.purpose = 'investment';
    p.investmentAmount = 150_000_000;
    const r = ai.recommend(p);
    const d8 = r.find((x) => x.visaType === 'D-8')!;
    expect(d8.eligible).toBe(true);
  });

  it('재외동포 시 F-4 적격', () => {
    const p = baseProfile();
    p.hasKoreanRelative = true;
    const r = ai.recommend(p);
    const f4 = r.find((x) => x.visaType === 'F-4')!;
    expect(f4.eligible).toBe(true);
  });

  it('17세 미만 입력 시 오류', () => {
    const p = baseProfile();
    p.age = 15;
    expect(() => ai.recommend(p)).toThrow();
  });

  it('감사 로그에 추천 기록', () => {
    ai.recommend(baseProfile());
    expect(ai.getAuditLog().some((a) => a.action === 'RECOMMEND')).toBe(true);
  });
});
