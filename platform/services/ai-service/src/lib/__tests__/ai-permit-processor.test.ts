import { describe, it, expect } from 'vitest';
import { AIPermitProcessor } from '../ai-permit-processor.js';

describe('SVC-AI-ADV-R455 AIPermitProcessor', () => {
  const svc = new AIPermitProcessor();

  it('FR-455.4: 건축 문서 누락', () => {
    const r = svc.process({
      id: 'a1',
      type: 'building',
      applicant: '홍길동',
      documents: ['blueprint'],
    });
    expect(r.decision).toBe('NEED_DOCS');
    expect(r.missing).toContain('landowner_consent');
    expect(r.missing).toContain('impact_assessment');
  });

  it('FR-455.5: 건축 승인', () => {
    const r = svc.process({
      id: 'a1',
      type: 'building',
      applicant: '홍길동',
      documents: ['blueprint', 'landowner_consent', 'impact_assessment'],
    });
    expect(r.decision).toBe('APPROVED');
  });

  it('FR-455.5: 영업 승인', () => {
    const r = svc.process({
      id: 'a1',
      type: 'business',
      applicant: '김철수',
      documents: ['id_card', 'lease', 'insurance'],
    });
    expect(r.decision).toBe('APPROVED');
  });

  it('FR-455.5: 환경 REVIEW', () => {
    const r = svc.process({
      id: 'a1',
      type: 'environment',
      applicant: '(주)환경',
      documents: ['eia_report', 'mitigation_plan'],
    });
    expect(r.decision).toBe('REVIEW');
  });

  it('환경 문서 누락 → NEED_DOCS', () => {
    const r = svc.process({
      id: 'a1',
      type: 'environment',
      applicant: '(주)환경',
      documents: [],
    });
    expect(r.decision).toBe('NEED_DOCS');
  });

  it('applicant 없음 오류', () => {
    expect(() =>
      svc.process({
        id: 'a1',
        type: 'business',
        applicant: '',
        documents: [],
      }),
    ).toThrow('INVALID_APPLICANT');
  });

  it('FR-455.6: C 차단', () => {
    expect(() =>
      svc.process(
        {
          id: 'a1',
          type: 'business',
          applicant: '홍길동',
          documents: [],
        },
        'C',
      ),
    ).toThrow('N2SF_BLOCKED');
  });

  it('감사 로그', () => {
    svc.process({
      id: 'a1',
      type: 'business',
      applicant: '홍길동',
      documents: ['id_card', 'lease', 'insurance'],
    });
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
