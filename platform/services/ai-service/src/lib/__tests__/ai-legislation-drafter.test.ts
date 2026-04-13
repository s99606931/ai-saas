/**
 * AI 법안 초안 작성기 단위 테스트 — SVC-AI-ADV-R484
 * Plan SC: FR-484.1~6
 */

import { describe, it, expect } from 'vitest';
import { AiLegislationDrafter } from '../ai-legislation-drafter';
import type { LegislationRequest } from '../ai-legislation-drafter';

const mk = (over: Partial<LegislationRequest> = {}): LegislationRequest => ({
  requestId: 'L1',
  title: '디지털 포용 촉진법',
  purpose: '디지털 격차 해소를 통한 포용적 사회 실현',
  category: 'TECHNOLOGY',
  stakeholders: ['시민', '기업', '지방자치단체'],
  ...over,
});

describe('AiLegislationDrafter — R484', () => {
  it('FR-484.1: 카테고리별 조문 생성', () => {
    const d = new AiLegislationDrafter();
    const r = d.draft(mk({ category: 'WELFARE' }));
    expect(r.articles.length).toBeGreaterThanOrEqual(4);
    expect(r.articles[0]).toContain('제1조');
  });

  it('FR-484.2: 이해관계자 조문 포함', () => {
    const d = new AiLegislationDrafter();
    const r = d.draft(mk());
    expect(r.articles.some((a) => a.includes('시민'))).toBe(true);
  });

  it('FR-484.3: SECURITY 충돌경고', () => {
    const d = new AiLegislationDrafter();
    const r = d.draft(mk({ category: 'SECURITY' }));
    expect(r.conflictWarnings.length).toBeGreaterThan(0);
  });

  it('FR-484.4: 명확성 평가', () => {
    const d = new AiLegislationDrafter();
    const score = d.reviewClarity('짧은 문장. 또 짧음. 명확하다.');
    expect(score).toBeGreaterThanOrEqual(50);
  });

  it('FR-484.5: audit 로그', () => {
    const d = new AiLegislationDrafter();
    d.draft(mk());
    expect(d.getAuditLog().length).toBeGreaterThan(0);
  });

  it('FR-484.6: C/S 차단', () => {
    const d = new AiLegislationDrafter();
    expect(() => d.draft(mk(), 'C')).toThrow(/N2SF_BLOCKED/);
    expect(() => d.draft(mk(), 'S')).toThrow(/N2SF_BLOCKED/);
  });
});
