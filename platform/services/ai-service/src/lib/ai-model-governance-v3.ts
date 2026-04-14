// Design Ref: SVC-AI-ADV-R651.design.md — AI 모델 거버넌스 자동화 v3
// Plan SC: FR-R651.1~5

import { createHash } from 'crypto';

export type GovernanceStatus = 'APPROVED' | 'CONDITIONAL' | 'REJECTED';

interface ModelSubmission {
  modelId: string;
  version: string;
  owner: string;
  fairness: number;
  explainability: number;
  robustness: number;
  privacy: number;
}
interface GovernanceResult {
  modelId: string;
  maskedOwner: string;
  avgScore: number;
  status: GovernanceStatus;
  failures: string[];
}
interface AuditEntry { timestamp: string; action: string; details?: Record<string, unknown> }

export class AIModelGovernanceV3 {
  private auditLog: AuditEntry[] = [];

  submit(model: ModelSubmission, dataGrade?: string): GovernanceResult {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 AI API 전송 금지 (N2SF N-05)`);
    }
    const metrics: Array<[string, number]> = [
      ['fairness', model.fairness],
      ['explainability', model.explainability],
      ['robustness', model.robustness],
      ['privacy', model.privacy],
    ];
    const failures = metrics.filter(([, v]) => v < 0.5).map(([k]) => k);
    const avgScore =
      metrics.reduce((s, [, v]) => s + v, 0) / metrics.length;

    let status: GovernanceStatus;
    if (failures.length > 0) status = 'REJECTED';
    else if (avgScore >= 0.8) status = 'APPROVED';
    else if (avgScore >= 0.6) status = 'CONDITIONAL';
    else status = 'REJECTED';

    const maskedOwner = createHash('sha256').update(model.owner).digest('hex').slice(0, 16);
    const result: GovernanceResult = {
      modelId: model.modelId,
      maskedOwner,
      avgScore: Number(avgScore.toFixed(4)),
      status,
      failures,
    };
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'SUBMIT_MODEL',
      details: { modelId: model.modelId, version: model.version, status, avgScore: result.avgScore },
    });
    return result;
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
