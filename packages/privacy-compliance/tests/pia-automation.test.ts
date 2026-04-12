/**
 * PIA 자동화 테스트
 * Plan SC: FR-PIA.1~5
 */

import {
  PiaRiskAssessor,
  PiaReportGenerator,
  LEGAL_BASIS_MAP,
  ProcessingActivity,
} from '../src/pia-automation';

const baseActivity = (overrides: Partial<ProcessingActivity> = {}): ProcessingActivity => ({
  activityId: 'a1',
  systemName: '민원시스템',
  dataCategories: ['이름', '연락처'],
  subjectCount: 1000,
  retentionDays: 365,
  crossBorder: false,
  sensitiveData: false,
  childrenData: false,
  automatedDecision: false,
  ...overrides,
});

describe('PiaRiskAssessor', () => {
  const assessor = new PiaRiskAssessor();

  it('LOW: 모든 위험요소 없음', () => {
    const result = assessor.assess(baseActivity());
    expect(result.overallLevel).toBe('LOW');
    expect(result.score).toBe(0);
    expect(result.findings).toEqual([]);
  });

  it('CRITICAL: 민감정보 처리', () => {
    const result = assessor.assess(baseActivity({ sensitiveData: true }));
    expect(result.overallLevel).toBe('CRITICAL');
    expect(result.findings.find((f) => f.code === 'PIA-R02')).toBeDefined();
  });

  it('HIGH: 5만명 이상', () => {
    const result = assessor.assess(baseActivity({ subjectCount: 60000 }));
    expect(result.overallLevel).toBe('MEDIUM');
    expect(result.findings.find((f) => f.code === 'PIA-R01')).toBeDefined();
  });

  it('아동정보 + 국외이전 동시', () => {
    const result = assessor.assess(
      baseActivity({ childrenData: true, crossBorder: true }),
    );
    expect(result.findings.length).toBe(2);
    expect(result.score).toBe(45);
  });

  it('자동화 의사결정 점수 +15', () => {
    const result = assessor.assess(baseActivity({ automatedDecision: true }));
    expect(result.findings.find((f) => f.code === 'PIA-R05')).toBeDefined();
  });

  it('장기 보관 (3년 초과) 점수 +10', () => {
    const result = assessor.assess(baseActivity({ retentionDays: 365 * 5 }));
    expect(result.findings.find((f) => f.code === 'PIA-R06')).toBeDefined();
  });

  it('잘못된 입력 zod 오류', () => {
    expect(() => assessor.assess({ ...baseActivity(), subjectCount: -1 })).toThrow();
  });

  it('CRITICAL 임계: 60+', () => {
    const result = assessor.assess(
      baseActivity({ sensitiveData: true, subjectCount: 100000 }),
    );
    expect(result.overallLevel).toBe('CRITICAL');
    expect(result.score).toBeGreaterThanOrEqual(60);
  });
});

describe('LEGAL_BASIS_MAP', () => {
  it('주요 목적별 법적 근거 매핑', () => {
    expect(LEGAL_BASIS_MAP['민원처리']).toBeDefined();
    expect(LEGAL_BASIS_MAP['인사관리']).toBeDefined();
    expect(LEGAL_BASIS_MAP['마케팅']).toBeDefined();
  });
});

describe('PiaReportGenerator', () => {
  const gen = new PiaReportGenerator();

  it('보고서: 평가 + 법적 근거 + 재평가일 (3년 후)', () => {
    const report = gen.generate(baseActivity({ sensitiveData: true }), '민원처리');
    expect(report.assessment.overallLevel).toBe('CRITICAL');
    expect(report.legalBasis).toContain('개인정보보호법 §15①2 (법령상 의무)');
    expect(report.nextReviewDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('미분류 목적 시 안내 문구', () => {
    const report = gen.generate(baseActivity(), '미정의목적');
    expect(report.legalBasis[0]).toContain('미분류');
  });
});
