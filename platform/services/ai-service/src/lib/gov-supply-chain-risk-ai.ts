// SVC-AI-ADV-R472 Government Supply Chain Risk AI
// Design Ref: SVC-AI-ADV-R472.design.md §공급망리스크
// Plan SC: FR-472.1~6
// CSAP D-06 / N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';

export interface Supplier {
  readonly id: string;
  readonly country: string;
  readonly tier: 1 | 2 | 3;
  readonly financialHealth: number; // 0..100
  readonly singleSource: boolean;
  readonly certifications: readonly string[];
}

export interface RiskReport {
  readonly supplierId: string;
  readonly riskScore: number;
  readonly riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  readonly factors: readonly string[];
}

interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly details: Record<string, unknown>;
}

const EMBARGO_COUNTRIES: readonly string[] = ['XX1', 'XX2'];

function block(grade: DataGrade): void {
  if (grade === 'C' || grade === 'S') {
    throw new Error(`N2SF_BLOCKED: ${grade}등급 공급망 데이터 차단 (N2SF N-05)`);
  }
}

export class GovSupplyChainRiskAi {
  private readonly auditLog: AuditEntry[] = [];

  assess(supplier: Supplier, grade: DataGrade = 'O'): RiskReport {
    block(grade);

    const factors: string[] = [];
    let score = 0;

    if (EMBARGO_COUNTRIES.includes(supplier.country)) {
      score += 60;
      factors.push('embargo_country');
    }
    if (supplier.singleSource) {
      score += 25;
      factors.push('single_source');
    }
    if (supplier.financialHealth < 40) {
      score += 20;
      factors.push('poor_financial_health');
    } else if (supplier.financialHealth < 60) {
      score += 10;
      factors.push('moderate_financial_health');
    }
    if (supplier.tier === 3) {
      score += 10;
      factors.push('tier3_visibility');
    }
    if (supplier.certifications.length === 0) {
      score += 15;
      factors.push('no_certifications');
    }

    score = Math.min(100, score);

    const level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' =
      score >= 75 ? 'CRITICAL' : score >= 50 ? 'HIGH' : score >= 25 ? 'MEDIUM' : 'LOW';

    this.appendAudit('SUPPLY_CHAIN_ASSESS', {
      supplierId: supplier.id,
      score,
      level,
    });

    return {
      supplierId: supplier.id,
      riskScore: score,
      riskLevel: level,
      factors,
    };
  }

  assessBatch(suppliers: readonly Supplier[]): readonly RiskReport[] {
    const results = suppliers.map((s) => this.assess(s));
    const critical = results.filter((r) => r.riskLevel === 'CRITICAL').length;
    this.appendAudit('SUPPLY_BATCH', { total: suppliers.length, critical });
    return results;
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
