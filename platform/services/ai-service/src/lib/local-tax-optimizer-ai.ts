// SVC-AI-ADV-R493 Local Tax Optimizer AI
// Design Ref: SVC-AI-ADV-R493.design.md §지방세최적화
// Plan SC: FR-493.1~6
// CSAP D-06 / N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';

const DATA_GRADE_BLOCK = ['C', 'S'] as const;

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export type TaxType =
  | 'acquisition'
  | 'property'
  | 'auto'
  | 'resident'
  | 'tobacco'
  | 'leisure';

export interface TaxRevenueRecord {
  readonly year: number;
  readonly taxType: TaxType;
  readonly assessedKrw: number;
  readonly collectedKrw: number;
  readonly arrearsKrw: number;
  readonly taxpayerCount: number;
}

export interface CollectionForecast {
  readonly taxType: TaxType;
  readonly nextYearForecastKrw: number;
  readonly collectionRatePct: number;
  readonly priorityAction: 'expand_audit' | 'arrears_collection' | 'taxpayer_education' | 'maintain';
  readonly riskLevel: 'low' | 'medium' | 'high';
}

interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly detail: Record<string, unknown>;
}

export class LocalTaxOptimizerAi {
  private readonly auditLog: AuditEntry[] = [];
  private readonly history: TaxRevenueRecord[] = [];

  ingest(record: TaxRevenueRecord, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (record.assessedKrw < 0 || record.collectedKrw < 0) {
      throw new Error('VALIDATION: 음수 금액 불가');
    }
    this.history.push(record);
    this.appendAudit('INGEST', { year: record.year, taxType: record.taxType });
  }

  forecast(taxType: TaxType): CollectionForecast {
    const rows = this.history
      .filter((r) => r.taxType === taxType)
      .sort((a, b) => a.year - b.year);

    if (rows.length === 0) {
      return {
        taxType,
        nextYearForecastKrw: 0,
        collectionRatePct: 0,
        priorityAction: 'maintain',
        riskLevel: 'low',
      };
    }

    const lastIdx = rows.length - 1;
    const last = rows[lastIdx]!;
    const collectionRatePct =
      last.assessedKrw === 0 ? 0 : (last.collectedKrw / last.assessedKrw) * 100;

    let growth = 1;
    if (rows.length >= 2) {
      const prev = rows[lastIdx - 1]!;
      if (prev.collectedKrw > 0) {
        growth = last.collectedKrw / prev.collectedKrw;
      }
    }
    const nextYearForecastKrw = Math.round(last.collectedKrw * growth);

    let priorityAction: CollectionForecast['priorityAction'] = 'maintain';
    let riskLevel: CollectionForecast['riskLevel'] = 'low';
    if (collectionRatePct < 70) {
      priorityAction = 'arrears_collection';
      riskLevel = 'high';
    } else if (collectionRatePct < 85) {
      priorityAction = 'expand_audit';
      riskLevel = 'medium';
    } else if (last.taxpayerCount < 100) {
      priorityAction = 'taxpayer_education';
      riskLevel = 'medium';
    }

    const forecast: CollectionForecast = {
      taxType,
      nextYearForecastKrw,
      collectionRatePct: Math.round(collectionRatePct * 100) / 100,
      priorityAction,
      riskLevel,
    };

    this.appendAudit('FORECAST', {
      taxType,
      forecastKrw: nextYearForecastKrw,
      riskLevel,
    });
    return forecast;
  }

  totalArrears(): number {
    return this.history.reduce((acc, r) => acc + r.arrearsKrw, 0);
  }

  getAuditLog(): readonly AuditEntry[] {
    return [...this.auditLog];
  }

  private appendAudit(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      detail,
    });
  }
}
