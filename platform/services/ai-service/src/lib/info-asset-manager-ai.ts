// Design Ref: §위험점수 — (C→40/S→30/O→10)+exposure×3+min(auditDays/365,1)×30
// Plan SC: SC-R567-1, SC-R567-2, SC-R567-3

interface AssetInput {
  assetId: string;
  assetName: string;
  dataGrade: 'C' | 'S' | 'O';
  exposureLevel: number;
  lastAuditDays: number;
}

type RiskGrade = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
type AuditAction = 'IMMEDIATE_AUDIT' | 'SCHEDULE_AUDIT' | 'MONITOR' | 'ROUTINE';

interface AssetRiskResult {
  assetId: string;
  riskScore: number;
  riskGrade: RiskGrade;
  recommendedAction: AuditAction;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  assetId: string;
  riskGrade: RiskGrade;
  riskScore: number;
}

export class InfoAssetManagerAI {
  private readonly auditLog: AuditEntry[] = [];

  assess(input: AssetInput): AssetRiskResult {
    const { assetId, dataGrade, exposureLevel, lastAuditDays } = input;

    const gradeScore = dataGrade === 'C' ? 40 : dataGrade === 'S' ? 30 : 10;
    const riskScore = gradeScore + exposureLevel * 3 + Math.min(lastAuditDays / 365, 1) * 30;
    const riskGrade = this.classifyRisk(riskScore);
    const recommendedAction = this.buildAction(riskGrade);

    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'ASSET_ASSESSED',
      assetId,
      riskGrade,
      riskScore: Math.round(riskScore * 100) / 100,
    });

    return { assetId, riskScore: Math.round(riskScore * 100) / 100, riskGrade, recommendedAction };
  }

  private classifyRisk(score: number): RiskGrade {
    if (score >= 70) return 'CRITICAL';
    if (score >= 50) return 'HIGH';
    if (score >= 30) return 'MEDIUM';
    return 'LOW';
  }

  private buildAction(grade: RiskGrade): AuditAction {
    if (grade === 'CRITICAL') return 'IMMEDIATE_AUDIT';
    if (grade === 'HIGH') return 'SCHEDULE_AUDIT';
    if (grade === 'MEDIUM') return 'MONITOR';
    return 'ROUTINE';
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
