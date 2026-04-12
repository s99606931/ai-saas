import { describe, it, expect } from 'vitest';
import { PartnerEcosystemAI, type Partner } from '../partner-ecosystem-ai';

describe('PartnerEcosystemAI', () => {
  const ai = new PartnerEcosystemAI();
  const partners: Partner[] = [
    {
      partnerId: 'P1',
      name: 'Top',
      joinedAt: '2024-01-01',
      revenueYTD: 200_000_000,
      dealsClosed: 50,
      csatScore: 90,
      certifications: 10,
    },
    {
      partnerId: 'P2',
      name: 'Mid',
      joinedAt: '2024-06-01',
      revenueYTD: 20_000_000,
      dealsClosed: 10,
      csatScore: 75,
      certifications: 3,
    },
    {
      partnerId: 'P3',
      name: 'Low',
      joinedAt: '2025-01-01',
      revenueYTD: 500_000,
      dealsClosed: 1,
      csatScore: 60,
      certifications: 0,
    },
  ];

  it('calculates tier', () => {
    expect(ai.calculateTier(partners[0]!)).toBe('platinum');
    expect(ai.calculateTier(partners[2]!)).toBe('bronze');
  });

  it('assigns lead to highest tier', () => {
    const assigned = ai.assignLead(
      { leadId: 'L1', region: 'KR', industry: 'gov', size: 'large', createdAt: '' },
      partners,
    );
    expect(assigned).toBe('P1');
  });

  it('predicts high churn for inactive partner', () => {
    const churn = ai.predictChurn(partners[2]!, 120);
    expect(churn.risk).toBe('high');
  });

  it('calculates incentive proportional to tier', () => {
    const top = ai.calculateIncentive(partners[0]!);
    const low = ai.calculateIncentive(partners[2]!);
    expect(top).toBeGreaterThan(low);
  });

  it('reports ecosystem health', () => {
    const health = ai.ecosystemHealth(partners);
    expect(health.totalPartners).toBe(3);
    expect(health.tierDistribution.platinum).toBeGreaterThan(0);
    expect(health.healthScore).toBeGreaterThan(0);
  });
});
