// MTU-N284 정책 영향 분석 AI 테스트
import { describe, it, expect } from 'vitest';
import {
  comparePolicyTexts,
  analyzeImpacts,
  generatePolicyImpactReport,
  maskPii,
  PolicyImpactAnalysisService,
  type Stakeholder,
  type PolicyChange,
} from '../policy-impact-analysis.js';

describe('MTU-N284 PolicyImpactAnalysis', () => {
  const tenantId = 'tenant-n284';

  it('FR-N284.1: 정책 텍스트 비교', () => {
    const diff = comparePolicyTexts('A\nB\nC', 'A\nB2\nC\nD');
    expect(diff.added).toContain('D');
    expect(diff.modified.length).toBeGreaterThan(0);
  });

  it('PII 마스킹', () => {
    expect(maskPii('연락 010-1111-2222')).toContain('[전화-마스킹]');
  });

  it('FR-N284.2/3: 이해관계자 영향 분석', () => {
    const diff = comparePolicyTexts('기존 환경 규정', '신규 환경 규정 강화\n에너지 효율');
    const stakeholders: Stakeholder[] = [
      { id: 's1', name: '환경단체', category: 'ngo', affectedAreas: ['환경'] },
      { id: 's2', name: '기업', category: 'business', affectedAreas: ['에너지'] },
    ];
    const impacts = analyzeImpacts(diff, stakeholders);
    expect(impacts).toHaveLength(2);
    expect(impacts[0]?.score ?? -1).toBeGreaterThanOrEqual(0);
  });

  it('FR-N284.4: 정책 영향 리포트 + 감사', () => {
    const change: PolicyChange = {
      policyId: 'p1',
      title: '환경 정책 개정',
      oldText: '기존 환경 규정',
      newText: '신규 환경 규정 강화',
      effectiveDate: '2026-05-01',
      dataGrade: 'O',
    };
    const r = generatePolicyImpactReport(tenantId, 'u1', change, [
      { id: 's1', name: '환경단체', category: 'ngo', affectedAreas: ['환경'] },
    ]);
    expect(r.reportId).toMatch(/^pir-/);
    expect(r.summary).toContain('환경 정책 개정');
  });

  it('C등급 차단', () => {
    expect(() =>
      generatePolicyImpactReport(
        tenantId,
        'u1',
        {
          policyId: 'p',
          title: 't',
          oldText: 'a',
          newText: 'b',
          effectiveDate: '2026-01-01',
          dataGrade: 'C',
        },
        [],
      ),
    ).toThrow(/BLOCKED/);
  });

  it('Service 통합 + 감사 로그', () => {
    const svc = new PolicyImpactAnalysisService('tenant-svc-n284');
    svc.analyze(
      {
        policyId: 'p2',
        title: '교통 정책',
        oldText: '기존',
        newText: '신규',
        effectiveDate: '2026-06-01',
        dataGrade: 'O',
      },
      [],
    );
    expect(svc.audit().length).toBeGreaterThan(0);
  });
});
