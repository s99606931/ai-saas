// Design Ref: MTU-N422 §AI 윤리 감사
// Plan SC: FR-N422.1~5

export interface PredictionRecord {
  id: string;
  prediction: 0 | 1;
  actual: 0 | 1;
  sensitiveAttr: string;
}

export interface FairnessMetrics {
  attribute: string;
  demographicParity: number;
  equalizedOddsTpr: number;
  equalizedOddsFpr: number;
  perGroup: Array<{
    group: string;
    positiveRate: number;
    truePositiveRate: number;
    falsePositiveRate: number;
  }>;
}

export interface EthicsPrinciple {
  id: string;
  name: string;
  required: boolean;
}

export interface AuditReport {
  modelId: string;
  auditedAt: string;
  fairness: FairnessMetrics;
  transparencyScore: number;
  principleCompliance: Array<{ id: string; compliant: boolean; note?: string }>;
  overallGrade: 'A' | 'B' | 'C' | 'F';
}

export class AIEthicsAudit {
  /** FR-N422.1,2 공정성 측정 */
  measureFairness(records: PredictionRecord[], attribute: string): FairnessMetrics {
    const byGroup = new Map<string, PredictionRecord[]>();
    for (const r of records) {
      const arr = byGroup.get(r.sensitiveAttr) ?? [];
      arr.push(r);
      byGroup.set(r.sensitiveAttr, arr);
    }
    const perGroup: FairnessMetrics['perGroup'] = [];
    for (const [group, recs] of byGroup.entries()) {
      const positives = recs.filter((r) => r.prediction === 1).length;
      const tp = recs.filter((r) => r.prediction === 1 && r.actual === 1).length;
      const fn = recs.filter((r) => r.prediction === 0 && r.actual === 1).length;
      const fp = recs.filter((r) => r.prediction === 1 && r.actual === 0).length;
      const tn = recs.filter((r) => r.prediction === 0 && r.actual === 0).length;
      perGroup.push({
        group,
        positiveRate: +(positives / Math.max(1, recs.length)).toFixed(3),
        truePositiveRate: +(tp / Math.max(1, tp + fn)).toFixed(3),
        falsePositiveRate: +(fp / Math.max(1, fp + tn)).toFixed(3),
      });
    }
    const rates = perGroup.map((g) => g.positiveRate);
    const tprs = perGroup.map((g) => g.truePositiveRate);
    const fprs = perGroup.map((g) => g.falsePositiveRate);
    return {
      attribute,
      demographicParity: rates.length > 1 ? +(Math.max(...rates) - Math.min(...rates)).toFixed(3) : 0,
      equalizedOddsTpr: tprs.length > 1 ? +(Math.max(...tprs) - Math.min(...tprs)).toFixed(3) : 0,
      equalizedOddsFpr: fprs.length > 1 ? +(Math.max(...fprs) - Math.min(...fprs)).toFixed(3) : 0,
      perGroup,
    };
  }

  /** FR-N422.3 투명성 점수 */
  scoreTransparency(checks: {
    hasModelCard: boolean;
    hasFeatureImportance: boolean;
    hasDataLineage: boolean;
    hasExplanations: boolean;
    hasLimitationsDoc: boolean;
  }): number {
    const items = [
      checks.hasModelCard,
      checks.hasFeatureImportance,
      checks.hasDataLineage,
      checks.hasExplanations,
      checks.hasLimitationsDoc,
    ];
    const passed = items.filter(Boolean).length;
    return +(passed / items.length).toFixed(2);
  }

  /** FR-N422.4 원칙 준수 체크 */
  checkPrinciples(
    principles: EthicsPrinciple[],
    evidence: Record<string, boolean>,
  ): AuditReport['principleCompliance'] {
    return principles.map((p) => ({
      id: p.id,
      compliant: evidence[p.id] === true,
      note: evidence[p.id] === false && p.required ? '필수 원칙 미준수' : undefined,
    }));
  }

  /** FR-N422.5 종합 리포트 */
  generateReport(params: {
    modelId: string;
    fairness: FairnessMetrics;
    transparencyScore: number;
    principleCompliance: AuditReport['principleCompliance'];
  }): AuditReport {
    const { fairness, transparencyScore, principleCompliance } = params;
    let demerits = 0;
    if (fairness.demographicParity > 0.2) demerits += 2;
    else if (fairness.demographicParity > 0.1) demerits += 1;
    if (transparencyScore < 0.6) demerits += 2;
    else if (transparencyScore < 0.8) demerits += 1;
    const violated = principleCompliance.filter((p) => !p.compliant).length;
    demerits += violated;

    let grade: AuditReport['overallGrade'] = 'A';
    if (demerits >= 5) grade = 'F';
    else if (demerits >= 3) grade = 'C';
    else if (demerits >= 1) grade = 'B';

    return {
      modelId: params.modelId,
      auditedAt: new Date().toISOString(),
      fairness,
      transparencyScore,
      principleCompliance,
      overallGrade: grade,
    };
  }
}

export const aiEthicsAudit = new AIEthicsAudit();
