// Design Ref: §공공연금 기금 최적화 AI
// Plan SC: FR-R621.1~5

enum DataGrade { C = 'C', S = 'S', O = 'O' }

type AssetClass = 'domestic_equity' | 'foreign_equity' | 'domestic_bond' | 'foreign_bond' | 'alternative' | 'cash';
type RiskLevel = 'conservative' | 'moderate' | 'aggressive';

interface AssetReturn {
  assetClass: AssetClass;
  expectedReturn: number;
  volatility: number;
  currentWeight: number;
}

interface OptimizationResult {
  portfolioId: string;
  targetAllocation: Array<{ assetClass: AssetClass; weight: number }>;
  expectedAnnualReturn: number;
  expectedRisk: number;
  sharpeRatio: number;
  riskLevel: RiskLevel;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

function blockClassifiedData(grade: DataGrade): void {
  if (grade === DataGrade.C || grade === DataGrade.S) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

const RISK_PROFILE: Record<RiskLevel, Record<AssetClass, number>> = {
  conservative: {
    domestic_equity: 0.15,
    foreign_equity: 0.10,
    domestic_bond: 0.40,
    foreign_bond: 0.20,
    alternative: 0.05,
    cash: 0.10,
  },
  moderate: {
    domestic_equity: 0.25,
    foreign_equity: 0.20,
    domestic_bond: 0.25,
    foreign_bond: 0.15,
    alternative: 0.10,
    cash: 0.05,
  },
  aggressive: {
    domestic_equity: 0.35,
    foreign_equity: 0.30,
    domestic_bond: 0.10,
    foreign_bond: 0.10,
    alternative: 0.13,
    cash: 0.02,
  },
};

const RISK_FREE_RATE = 0.025;

export class PublicPensionFundOptimizerAI {
  private results = new Map<string, OptimizationResult>();
  private readonly audit: AuditEntry[] = [];

  private log(action: string, detail: Record<string, unknown>): void {
    this.audit.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R621.1
  validateReturns(returns: AssetReturn[], grade: DataGrade = DataGrade.O): void {
    blockClassifiedData(grade);
    if (returns.length === 0) throw new Error('자산 수익률 데이터 필요');
    const sum = returns.reduce((a, r) => a + r.currentWeight, 0);
    if (Math.abs(sum - 1) > 0.01) throw new Error(`가중치 합계 오류: ${sum.toFixed(3)}`);
    this.log('VALIDATE_RETURNS', { count: returns.length });
  }

  // Plan SC: FR-R621.2
  private expectedReturn(allocation: Array<{ assetClass: AssetClass; weight: number }>, returns: AssetReturn[]): number {
    let er = 0;
    for (const a of allocation) {
      const r = returns.find((x) => x.assetClass === a.assetClass);
      if (r) er += a.weight * r.expectedReturn;
    }
    return +er.toFixed(4);
  }

  // Plan SC: FR-R621.3
  private portfolioRisk(allocation: Array<{ assetClass: AssetClass; weight: number }>, returns: AssetReturn[]): number {
    let variance = 0;
    for (const a of allocation) {
      const r = returns.find((x) => x.assetClass === a.assetClass);
      if (r) variance += (a.weight * r.volatility) ** 2;
    }
    return +Math.sqrt(variance).toFixed(4);
  }

  // Plan SC: FR-R621.4
  optimize(portfolioId: string, returns: AssetReturn[], risk: RiskLevel, grade: DataGrade = DataGrade.O): OptimizationResult {
    blockClassifiedData(grade);
    this.validateReturns(returns, grade);
    const profile = RISK_PROFILE[risk];
    const allocation: Array<{ assetClass: AssetClass; weight: number }> = (Object.keys(profile) as AssetClass[]).map(
      (assetClass) => ({ assetClass, weight: profile[assetClass] }),
    );
    const er = this.expectedReturn(allocation, returns);
    const pr = this.portfolioRisk(allocation, returns);
    const sharpe = pr > 0 ? +((er - RISK_FREE_RATE) / pr).toFixed(3) : 0;

    const result: OptimizationResult = {
      portfolioId,
      targetAllocation: allocation,
      expectedAnnualReturn: er,
      expectedRisk: pr,
      sharpeRatio: sharpe,
      riskLevel: risk,
    };
    this.results.set(portfolioId, result);
    this.log('OPTIMIZE', { portfolioId, risk, expectedReturn: er });
    return result;
  }

  // Plan SC: FR-R621.5
  getResult(portfolioId: string): OptimizationResult | undefined {
    return this.results.get(portfolioId);
  }

  getAuditLog(): readonly AuditEntry[] {
    return this.audit;
  }
}
