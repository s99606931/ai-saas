import { describe, it, expect, beforeEach } from 'vitest';
import { AiRecordsManagement, type RecordItem } from '../ai-records-management';

describe('AiRecordsManagement', () => {
  let mgr: AiRecordsManagement;

  beforeEach(() => {
    mgr = new AiRecordsManagement();
  });

  const sample = (over: Partial<RecordItem> = {}): RecordItem => ({
    recordId: 'rec-1',
    title: '예산집행 결의서',
    category: '회계',
    producedAt: '2020-01-01T00:00:00.000Z',
    pages: 12,
    hasPersonalInfo: false,
    hasLegalEvidence: false,
    referencesHistoricalEvent: false,
    ...over,
  });

  it('역사적 사건 참조 기록은 영구보존이다', () => {
    const result = mgr.classify(sample({ referencesHistoricalEvent: true }));
    expect(result.retentionClass).toBe('영구');
    expect(result.requiresPermanentPreservation).toBe(true);
  });

  it('회계 카테고리는 5년 보존이다', () => {
    const result = mgr.classify(sample());
    expect(result.retentionClass).toBe('5년');
  });

  it('법적 증거 기록은 30년이며 암호화 필수이다', () => {
    const result = mgr.classify(sample({ category: '기타', hasLegalEvidence: true }));
    expect(result.retentionClass).toBe('30년');
    expect(result.requiresEncryption).toBe(true);
  });

  it('보존기한 만료 기록만 폐기 대상으로 분류한다', () => {
    mgr.classify(sample({ recordId: 'old-1', producedAt: '2010-01-01T00:00:00.000Z' }));
    mgr.classify(
      sample({ recordId: 'recent-1', producedAt: '2025-01-01T00:00:00.000Z' }),
    );
    const plan = mgr.planDisposal(2026);
    expect(plan.eligibleIds).toContain('old-1');
    expect(plan.blockedIds).toContain('recent-1');
  });

  it('영구보존 기록은 폐기 대상에서 제외된다', () => {
    mgr.classify(
      sample({
        recordId: 'perm-1',
        referencesHistoricalEvent: true,
        producedAt: '1900-01-01T00:00:00.000Z',
      }),
    );
    const plan = mgr.planDisposal(2099);
    expect(plan.blockedIds).toContain('perm-1');
    expect(plan.eligibleIds).not.toContain('perm-1');
  });

  it('C등급 데이터는 차단된다', () => {
    expect(() => mgr.classify(sample(), 'C')).toThrow('BLOCKED');
  });
});
