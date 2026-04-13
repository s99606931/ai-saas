// SVC-AI-ADV-R444 공공 부동산 평가 AI
// Design Ref: SVC-AI-ADV-R444.design.md
// Plan SC: FR-444.1~5
// CSAP D-06 / N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';
export type UseType = 'residential' | 'commercial' | 'land';

export interface Target {
  readonly area: number;
  readonly use: UseType;
  readonly year: number;
}

export interface Comparable {
  readonly area: number;
  readonly use: UseType;
  readonly year: number;
  readonly price: number;
}

export interface Appraisal {
  readonly estimatedPrice: number;
  readonly unitPrice: number;
  readonly usedCount: number;
  readonly confidence: number;
}

export interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

export class PublicRealEstateAppraiserAI {
  private readonly auditLog: AuditEntry[] = [];

  appraise(
    target: Target,
    comparables: readonly Comparable[],
    grade: DataGrade = 'O',
  ): Appraisal {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`N2SF_BLOCKED: ${grade}등급 부동산 데이터 차단 (N2SF N-05)`);
    }
    if (target.area <= 0) throw new Error('INVALID_AREA');

    const matched = comparables.filter((c) => c.use === target.use && c.area > 0 && c.price > 0);
    if (matched.length === 0) throw new Error('NO_COMPARABLES: 유사사례 없음');

    let weightedSum = 0;
    let weightTotal = 0;
    for (const c of matched) {
      const unit = c.price / c.area;
      const diff = Math.abs(target.year - c.year);
      const w = Math.max(0.1, 1 - diff * 0.1);
      weightedSum += unit * w;
      weightTotal += w;
    }
    const unitPrice = Number((weightedSum / weightTotal).toFixed(2));
    const estimatedPrice = Number((unitPrice * target.area).toFixed(2));
    const confidence = matched.length >= 3 ? 0.95 : 0.7;

    this.record('APPRAISE', target.use, {
      used: matched.length,
      unitPrice,
      estimatedPrice,
    });
    return {
      estimatedPrice,
      unitPrice,
      usedCount: matched.length,
      confidence,
    };
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
