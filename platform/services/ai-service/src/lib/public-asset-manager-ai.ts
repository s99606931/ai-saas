// SVC-AI-ADV-R427 Public Asset Manager AI
// Design Ref: SVC-AI-ADV-R427.design.md
// Plan SC: FR-427.1~5
// CSAP D-06 / N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';
export type Condition = 'GOOD' | 'FAIR' | 'BAD';
export type Recommendation = 'KEEP' | 'REVIEW' | 'DISPOSE';

export interface Asset {
  readonly assetId: string;
  readonly elapsedYears: number;
  readonly usefulLifeYears: number;
  readonly condition: Condition;
}

export interface AssetAdvice {
  readonly assetId: string;
  readonly ageRatio: number;
  readonly recommendation: Recommendation;
  readonly reasonCode: string;
}

export interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

export class PublicAssetManagerAI {
  private readonly auditLog: AuditEntry[] = [];

  evaluate(assets: readonly Asset[], grade: DataGrade = 'O'): readonly AssetAdvice[] {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`N2SF_BLOCKED: ${grade}등급 자산 데이터 차단 (N2SF N-05)`);
    }

    return assets.map((a) => {
      if (a.usefulLifeYears <= 0) {
        throw new Error(`INVALID_LIFE: ${a.assetId}`);
      }
      const ageRatio = Number((a.elapsedYears / a.usefulLifeYears).toFixed(4));

      let recommendation: Recommendation;
      let reasonCode: string;

      if (a.condition === 'BAD') {
        recommendation = 'DISPOSE';
        reasonCode = 'BAD_CONDITION';
      } else if (ageRatio < 0.7) {
        recommendation = 'KEEP';
        reasonCode = 'AGE_OK';
      } else if (ageRatio < 1.0) {
        recommendation = 'REVIEW';
        reasonCode = 'APPROACHING_EOL';
      } else {
        recommendation = 'DISPOSE';
        reasonCode = 'END_OF_LIFE';
      }

      this.record('EVALUATE', a.assetId, { ageRatio, recommendation, reasonCode });
      return { assetId: a.assetId, ageRatio, recommendation, reasonCode };
    });
  }

  getAuditLog(): readonly AuditEntry[] {
    return this.auditLog;
  }

  private record(action: string, target: string, details: Record<string, unknown>): void {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      target,
      details,
    });
  }
}
