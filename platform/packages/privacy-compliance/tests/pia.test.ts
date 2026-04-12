// Test Ref: MTU-N456 §pia
import { describe, it, expect } from 'vitest';
import { PiaAssessor, type PiaProcessingItem } from '../src/index.js';

const items: PiaProcessingItem[] = [
  {
    field: 'user.ssn',
    category: 'sensitive',
    purpose: '본인확인',
    legalBasis: 'legal_obligation',
    retentionMonths: 24,
    sharedExternally: false,
  },
  {
    field: 'user.name',
    category: 'identity',
    purpose: '계정 관리',
    legalBasis: 'contract',
    retentionMonths: 36,
    sharedExternally: false,
  },
];

describe('PiaAssessor — FR-PIA.1/2/3', () => {
  it('민감정보 포함 시 high 위험도', () => {
    const a = new PiaAssessor();
    const r = a.assess('user-svc', items);
    expect(r.overallSensitivity).toMatch(/^(high|medium)$/);
    expect(r.items.length).toBe(2);
    expect(r.items[0].sensitivity).toBe('high');
  });

  it('법적 근거 누락 탐지', () => {
    const a = new PiaAssessor();
    const withGap = [...items, { ...items[1], field: 'user.gap', legalBasis: undefined }];
    const r = a.assess('x', withGap);
    expect(r.legalBasisGaps).toContain('user.gap');
  });

  it('민감정보 보호대책 추천 포함', () => {
    const a = new PiaAssessor();
    const r = a.assess('x', items);
    expect(r.recommendedControls.some((c) => c.includes('AES-256'))).toBe(true);
    expect(r.recommendedControls.some((c) => c.includes('RBAC'))).toBe(true);
  });

  it('외부 공유 시 국외이전 대책 추가', () => {
    const a = new PiaAssessor();
    const shared = [{ ...items[0], sharedExternally: true }];
    const r = a.assess('x', shared);
    expect(r.recommendedControls.some((c) => c.includes('국외이전'))).toBe(true);
  });
});

describe('PiaAssessor — FR-PIA.4/5', () => {
  it('보고서 Markdown 렌더링', () => {
    const a = new PiaAssessor();
    const r = a.assess('user-svc', items);
    const md = a.renderReport(r);
    expect(md).toContain('개인정보 영향평가 보고서');
    expect(md).toContain('user.ssn');
    expect(md).toContain('권고 보호대책');
  });

  it('재평가 주기 3년 후', () => {
    const a = new PiaAssessor();
    const now = new Date('2026-04-11T00:00:00Z');
    const r = a.assess('x', items, now);
    expect(new Date(r.nextReviewAt).getUTCFullYear()).toBe(2029);
  });
});
