import { describe, it, expect } from 'vitest';
import { CitizenRightsViolationDetectorAI } from '../citizen-rights-violation-detector-ai.js';

describe('SVC-AI-ADV-R447 CitizenRightsViolationDetectorAI', () => {
  const svc = new CitizenRightsViolationDetectorAI();

  it('FR-447.3: PRIVACY 감지', () => {
    const r = svc.detect('개인정보가 유출되었고 도청당했습니다');
    expect(r.primaryType).toBe('PRIVACY');
    expect(r.severity).toBe('HIGH');
  });

  it('FR-447.4: MED 심각도', () => {
    const r = svc.detect('차별 받았다고 느낍니다');
    expect(r.severity).toBe('MED');
    expect(r.primaryType).toBe('DISCRIMINATION');
  });

  it('FR-447.4: NONE 심각도', () => {
    const r = svc.detect('오늘 날씨가 좋다');
    expect(r.severity).toBe('NONE');
    expect(r.primaryType).toBe('NONE');
  });

  it('LABOR 감지', () => {
    const r = svc.detect('강요된 해고로 임금 미지급');
    expect(r.primaryType).toBe('LABOR');
  });

  it('FREEDOM 감지', () => {
    const r = svc.detect('감시와 검열로 통제받고 있다');
    expect(r.primaryType).toBe('FREEDOM');
  });

  it('빈 문자열', () => {
    const r = svc.detect('');
    expect(r.severity).toBe('NONE');
  });

  it('FR-447.5: C 차단', () => {
    expect(() => svc.detect('x', 'C')).toThrow('N2SF_BLOCKED');
  });

  it('감사 로그', () => {
    svc.detect('x');
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
