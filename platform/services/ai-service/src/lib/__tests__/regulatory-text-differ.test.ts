import { describe, it, expect } from 'vitest';
import { RegulatoryTextDiffer } from '../regulatory-text-differ.js';

describe('SVC-AI-ADV-R365 RegulatoryTextDiffer', () => {
  const svc = new RegulatoryTextDiffer();

  it('FR-365.1: diff 계산', () => {
    const before = '제1조\n제2조\n제3조';
    const after = '제1조\n제2조 수정\n제3조\n제4조';
    const r = svc.diff(before, after);
    expect(r.added).toContain('제4조');
    expect(r.added).toContain('제2조 수정');
    expect(r.removed).toContain('제2조');
  });

  it('FR-365.2: 영향도 점수', () => {
    const r = svc.diff('a\nb\nc', 'a\nb\nc');
    expect(r.impactScore).toBe(0);
  });

  it('높은 변경', () => {
    const r = svc.diff('a\nb', 'c\nd');
    expect(r.impactScore).toBeGreaterThan(0.5);
  });

  it('FR-365.3: C등급 차단', () => {
    expect(() => svc.diff('a', 'b', 'C')).toThrow('N2SF_BLOCKED');
  });

  it('FR-365.4: 감사 로그', () => {
    svc.diff('a', 'b');
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
