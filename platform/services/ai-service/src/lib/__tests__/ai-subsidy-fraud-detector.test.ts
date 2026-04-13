import { describe, it, expect, beforeEach } from 'vitest';
import { AiSubsidyFraudDetector, type SubsidyApplication } from '../ai-subsidy-fraud-detector';

describe('AiSubsidyFraudDetector', () => {
  let ai: AiSubsidyFraudDetector;

  beforeEach(() => {
    ai = new AiSubsidyFraudDetector();
  });

  const sample = (over: Partial<SubsidyApplication> = {}): SubsidyApplication => ({
    applicationId: 'a-1',
    applicantHashId: 'hash-1',
    subsidyType: 'employment',
    requestedAmountKrw: 10_000_000,
    previousReceivedCount: 0,
    hasMultipleAccounts: false,
    addressMatchesBusinessRegistry: true,
    documentsConsistent: true,
    relatedPartyTransactions: 0,
    ...over,
  });

  it('정상 신청은 auto_approve이다', () => {
    const result = ai.assess(sample());
    expect(result.action).toBe('auto_approve');
    expect(result.fraudProbability).toBeLessThan(0.2);
  });

  it('문서 불일치는 위험 요인이다', () => {
    const result = ai.assess(sample({ documentsConsistent: false }));
    expect(result.riskFactors).toContain('inconsistent_documents');
  });

  it('다중 위험 신호 결합 시 reject이다', () => {
    const result = ai.assess(
      sample({
        hasMultipleAccounts: true,
        addressMatchesBusinessRegistry: false,
        documentsConsistent: false,
        requestedAmountKrw: 100_000_000,
      }),
    );
    expect(result.action).toBe('reject');
    expect(result.fraudProbability).toBeGreaterThanOrEqual(0.7);
  });

  it('만성 수급자는 위험에 추가된다', () => {
    for (let i = 0; i < 5; i++) ai.recordReceipt('hash-2');
    const result = ai.assess(sample({ applicantHashId: 'hash-2' }));
    expect(result.riskFactors).toContain('chronic_recipient');
  });

  it('추적 신청자 수를 반환한다', () => {
    ai.recordReceipt('h-1');
    ai.recordReceipt('h-2');
    expect(ai.totalApplicantsTracked()).toBe(2);
  });

  it('S등급 데이터는 차단된다', () => {
    expect(() => ai.assess(sample(), 'S')).toThrow('BLOCKED');
  });
});
