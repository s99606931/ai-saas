// Design Ref: §산림 탄소 — 흡수량 기반 크레딧 산정 AI
// Plan SC: FR-R545.1~6

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export type TreeSpecies = 'pine' | 'oak' | 'larch' | 'cedar' | 'chestnut';

export interface ForestPlot {
  plotId: string;
  areaHa: number;
  species: TreeSpecies;
  averageAgeYears: number;
  treeCount: number;
}

export interface CarbonCredit {
  plotId: string;
  annualCO2TonsAbsorbed: number;
  creditTons: number;
  marketValueKRW: number;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

const ABSORPTION_RATE: Record<TreeSpecies, number> = {
  pine: 6.5,
  oak: 7.8,
  larch: 8.2,
  cedar: 7.0,
  chestnut: 6.0,
};

export class ForestCarbonCreditAI {
  private plots = new Map<string, ForestPlot>();
  private auditLog: AuditEntry[] = [];
  private pricePerTonKRW = 25_000;

  private append(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R545.1
  registerPlot(plot: ForestPlot, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (plot.areaHa <= 0) throw new Error('면적은 양수여야 합니다');
    if (plot.averageAgeYears < 0) throw new Error('수령은 0 이상이어야 합니다');
    if (plot.treeCount < 0) throw new Error('나무 수는 0 이상이어야 합니다');
    this.plots.set(plot.plotId, { ...plot });
    this.append('REGISTER_PLOT', { plotId: plot.plotId, species: plot.species });
  }

  // Plan SC: FR-R545.2
  calculateCredit(plotId: string, grade: DataGrade = 'O'): CarbonCredit {
    blockClassifiedData(grade);
    const plot = this.plots.get(plotId);
    if (!plot) throw new Error(`조림지 미등록: ${plotId}`);
    const rate = ABSORPTION_RATE[plot.species];
    // 수령 보정: 성숙림(20년+) 1.0, 청년림(10~20) 0.7, 유령림(<10) 0.4
    const maturityFactor = plot.averageAgeYears >= 20 ? 1.0 : plot.averageAgeYears >= 10 ? 0.7 : 0.4;
    const annualCO2TonsAbsorbed = Math.round(plot.areaHa * rate * maturityFactor * 100) / 100;
    const creditTons = annualCO2TonsAbsorbed;
    const marketValueKRW = Math.round(creditTons * this.pricePerTonKRW);
    const credit: CarbonCredit = { plotId, annualCO2TonsAbsorbed, creditTons, marketValueKRW };
    this.append('CALCULATE_CREDIT', { plotId, creditTons });
    return credit;
  }

  // Plan SC: FR-R545.3
  setPricePerTon(priceKRW: number): void {
    if (priceKRW < 0) throw new Error('가격은 0 이상이어야 합니다');
    this.pricePerTonKRW = priceKRW;
    this.append('SET_PRICE', { price: priceKRW });
  }

  // Plan SC: FR-R545.4
  totalCreditsBySpecies(species: TreeSpecies): number {
    let total = 0;
    for (const [id, p] of this.plots) {
      if (p.species === species) total += this.calculateCredit(id).creditTons;
    }
    return Math.round(total * 100) / 100;
  }

  // Plan SC: FR-R545.5
  listPlots(): ForestPlot[] {
    return Array.from(this.plots.values()).map(p => ({ ...p }));
  }

  // Plan SC: FR-R545.6
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
