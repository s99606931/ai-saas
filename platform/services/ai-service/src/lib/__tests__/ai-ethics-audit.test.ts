import { describe, it, expect } from 'vitest';
import { AIEthicsAudit, type PredictionRecord } from '../ai-ethics-audit';

describe('AIEthicsAudit', () => {
  const svc = new AIEthicsAudit();

  const fairRecords: PredictionRecord[] = [
    ...Array.from({ length: 10 }, (_, i): PredictionRecord => ({
      id: `A${i}`,
      prediction: i < 5 ? 1 : 0,
      actual: i < 5 ? 1 : 0,
      sensitiveAttr: 'M',
    })),
    ...Array.from({ length: 10 }, (_, i): PredictionRecord => ({
      id: `B${i}`,
      prediction: i < 5 ? 1 : 0,
      actual: i < 5 ? 1 : 0,
      sensitiveAttr: 'F',
    })),
  ];

  const biasedRecords: PredictionRecord[] = [
    ...Array.from({ length: 10 }, (_, i): PredictionRecord => ({
      id: `A${i}`,
      prediction: i < 9 ? 1 : 0,
      actual: 1,
      sensitiveAttr: 'M',
    })),
    ...Array.from({ length: 10 }, (_, i): PredictionRecord => ({
      id: `B${i}`,
      prediction: i < 2 ? 1 : 0,
      actual: 1,
      sensitiveAttr: 'F',
    })),
  ];

  it('measures fairness for balanced data', () => {
    const metrics = svc.measureFairness(fairRecords, 'gender');
    expect(metrics.demographicParity).toBeLessThan(0.1);
  });

  it('detects bias', () => {
    const metrics = svc.measureFairness(biasedRecords, 'gender');
    expect(metrics.demographicParity).toBeGreaterThan(0.5);
  });

  it('scores transparency', () => {
    const score = svc.scoreTransparency({
      hasModelCard: true,
      hasFeatureImportance: true,
      hasDataLineage: false,
      hasExplanations: true,
      hasLimitationsDoc: false,
    });
    expect(score).toBe(0.6);
  });

  it('checks principles', () => {
    const result = svc.checkPrinciples(
      [
        { id: 'p1', name: '투명성', required: true },
        { id: 'p2', name: '책임성', required: true },
      ],
      { p1: true, p2: false },
    );
    expect(result[0]!.compliant).toBe(true);
    expect(result[1]!.compliant).toBe(false);
  });

  it('generates audit report with grade', () => {
    const metrics = svc.measureFairness(fairRecords, 'gender');
    const report = svc.generateReport({
      modelId: 'M1',
      fairness: metrics,
      transparencyScore: 0.9,
      principleCompliance: [{ id: 'p1', compliant: true }],
    });
    expect(['A', 'B', 'C', 'F']).toContain(report.overallGrade);
  });
});
