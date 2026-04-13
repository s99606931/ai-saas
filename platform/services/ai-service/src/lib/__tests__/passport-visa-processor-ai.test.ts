import { describe, it, expect } from 'vitest';
import { PassportVisaProcessorAI } from '../passport-visa-processor-ai.js';

describe('SVC-AI-ADV-R432 PassportVisaProcessorAI', () => {
  const svc = new PassportVisaProcessorAI();
  const soon = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
  const mid = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString();
  const far = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

  it('FR-432.2: urgency 분류', () => {
    const r = svc.process([
      { applicantId: 'U', documents: ['photo', 'idCopy', 'application', 'fee'], departureDate: soon },
      { applicantId: 'H', documents: ['photo', 'idCopy', 'application', 'fee'], departureDate: mid },
      { applicantId: 'N', documents: ['photo', 'idCopy', 'application', 'fee'], departureDate: far },
    ]);
    expect(r[0]!.applicantId).toBe('U');
    expect(r[0]!.urgency).toBe('URGENT');
    expect(r.find((x) => x.applicantId === 'H')!.urgency).toBe('HIGH');
    expect(r.find((x) => x.applicantId === 'N')!.urgency).toBe('NORMAL');
  });

  it('FR-432.1: 서류 누락 → INCOMPLETE', () => {
    const r = svc.process([
      { applicantId: 'X', documents: ['photo'], departureDate: far },
    ]);
    expect(r[0]!.status).toBe('INCOMPLETE');
    expect(r[0]!.missing).toContain('fee');
  });

  it('FR-432.3: 완전성 점수', () => {
    const r = svc.process([
      { applicantId: 'X', documents: ['photo', 'idCopy'], departureDate: far },
    ]);
    expect(r[0]!.completeness).toBe(0.5);
  });

  it('FR-432.4: URGENT 우선 정렬', () => {
    const r = svc.process([
      { applicantId: 'N', documents: ['photo', 'idCopy', 'application', 'fee'], departureDate: far },
      { applicantId: 'U', documents: ['photo', 'idCopy', 'application', 'fee'], departureDate: soon },
    ]);
    expect(r[0]!.applicantId).toBe('U');
  });

  it('FR-432.5: C 차단', () => {
    expect(() => svc.process([], 'C')).toThrow('N2SF_BLOCKED');
  });

  it('감사 로그', () => {
    svc.process([
      { applicantId: 'A', documents: ['photo'], departureDate: far },
    ]);
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
