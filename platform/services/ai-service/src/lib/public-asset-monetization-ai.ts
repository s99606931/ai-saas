// SVC-AI-ADV-R485 Public Asset Monetization AI
// Design Ref: SVC-AI-ADV-R485.design.md §공공자산수익화
// Plan SC: FR-485.1~6
// CSAP D-06 / N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';

export type AssetType = 'LAND' | 'BUILDING' | 'FACILITY' | 'EQUIPMENT' | 'DATA' | 'IP';

export interface PublicAsset {
  readonly assetId: string;
  readonly type: AssetType;
  readonly bookValueKrw: number;
  readonly currentUtilization: number;
  readonly maintenanceCostKrwPerYear: number;
  readonly locationScore: number;
}

export interface MonetizationPlan {
  readonly assetId: string;
  readonly strategy: 'LEASE' | 'SELL' | 'JOINT_VENTURE' | 'DIGITIZE' | 'HOLD';
  readonly expectedAnnualRevenueKrw: number;
  readonly paybackMonths: number;
  readonly risk: 'LOW' | 'MEDIUM' | 'HIGH';
}

interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly details: Record<string, unknown>;
}

function block(grade: DataGrade): void {
  if (grade === 'C' || grade === 'S') {
    throw new Error(`N2SF_BLOCKED: ${grade}등급 자산 데이터 차단 (N2SF N-05)`);
  }
}

export class PublicAssetMonetizationAi {
  private readonly auditLog: AuditEntry[] = [];

  propose(asset: PublicAsset, grade: DataGrade = 'O'): MonetizationPlan {
    block(grade);

    const util = Math.max(0, Math.min(1, asset.currentUtilization));
    let strategy: MonetizationPlan['strategy'];
    let expectedRevenue: number;

    if (asset.type === 'DATA' || asset.type === 'IP') {
      strategy = 'DIGITIZE';
      expectedRevenue = asset.bookValueKrw * 0.15;
    } else if (util < 0.3) {
      strategy = asset.locationScore > 70 ? 'LEASE' : 'SELL';
      expectedRevenue =
        strategy === 'LEASE' ? asset.bookValueKrw * 0.06 : asset.bookValueKrw * 0.8;
    } else if (util < 0.7) {
      strategy = 'JOINT_VENTURE';
      expectedRevenue = asset.bookValueKrw * 0.08;
    } else {
      strategy = 'HOLD';
      expectedRevenue = 0;
    }

    const netRevenue = Math.max(1, expectedRevenue - asset.maintenanceCostKrwPerYear);
    const paybackMonths =
      strategy === 'HOLD' ? Number.POSITIVE_INFINITY : Math.round((asset.bookValueKrw / netRevenue) * 12);

    const risk: MonetizationPlan['risk'] =
      strategy === 'SELL' ? 'HIGH' : strategy === 'JOINT_VENTURE' ? 'MEDIUM' : 'LOW';

    this.appendAudit('ASSET_PROPOSE', {
      assetId: asset.assetId,
      strategy,
      expectedRevenue,
    });

    return {
      assetId: asset.assetId,
      strategy,
      expectedAnnualRevenueKrw: Math.round(expectedRevenue),
      paybackMonths: Number.isFinite(paybackMonths) ? paybackMonths : -1,
      risk,
    };
  }

  portfolioYield(assets: readonly PublicAsset[]): number {
    const plans = assets.map((a) => this.propose(a));
    const total = plans.reduce((acc, p) => acc + p.expectedAnnualRevenueKrw, 0);
    const bookTotal = assets.reduce((acc, a) => acc + a.bookValueKrw, 0);
    const y = bookTotal > 0 ? Math.round((total / bookTotal) * 10000) / 100 : 0;
    this.appendAudit('PORTFOLIO_YIELD', { assets: assets.length, yieldPct: y });
    return y;
  }

  getAuditLog(): readonly AuditEntry[] {
    return [...this.auditLog];
  }

  private appendAudit(action: string, details: Record<string, unknown>): void {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      details,
    });
  }
}
