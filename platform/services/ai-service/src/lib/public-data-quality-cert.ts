// Design Ref: MTU-N413 §공공데이터 품질 인증
// Plan SC: FR-N413.1~5

export interface DatasetMetadata {
  datasetId: string;
  title: string;
  owner: string;
  updateCycle: 'realtime' | 'daily' | 'weekly' | 'monthly' | 'yearly';
  lastUpdatedAt: string;
  fields: Array<{ name: string; type: string; required: boolean }>;
  description?: string;
  license?: string;
}

export interface QualitySample {
  rows: Array<Record<string, unknown>>;
  totalRows: number;
}

export interface QualityScore {
  completeness: number;
  accuracy: number;
  consistency: number;
  timeliness: number;
  overall: number;
}

export interface CertResult {
  datasetId: string;
  grade: 1 | 2 | 3 | 4 | 5;
  score: QualityScore;
  issues: string[];
  certifiedAt: string;
  validUntil: string;
}

export class PublicDataQualityCert {
  /** FR-N413.1 메타 검증 */
  validateMetadata(meta: DatasetMetadata): { ok: boolean; missing: string[] } {
    const missing: string[] = [];
    if (!meta.title) missing.push('title');
    if (!meta.owner) missing.push('owner');
    if (!meta.updateCycle) missing.push('updateCycle');
    if (!meta.lastUpdatedAt) missing.push('lastUpdatedAt');
    if (!meta.fields || meta.fields.length === 0) missing.push('fields');
    if (!meta.license) missing.push('license');
    return { ok: missing.length === 0, missing };
  }

  /** FR-N413.2 품질 측정 */
  measureQuality(meta: DatasetMetadata, sample: QualitySample): QualityScore {
    const requiredFields = meta.fields.filter((f) => f.required).map((f) => f.name);

    // Completeness
    let filled = 0;
    let cells = 0;
    for (const row of sample.rows) {
      for (const f of requiredFields) {
        cells++;
        const v = row[f];
        if (v !== null && v !== undefined && v !== '') filled++;
      }
    }
    const completeness = cells > 0 ? +(filled / cells).toFixed(3) : 1;

    // Accuracy: type 일치율
    let okTypes = 0;
    let totalChecks = 0;
    for (const row of sample.rows) {
      for (const f of meta.fields) {
        const v = row[f.name];
        if (v === undefined || v === null) continue;
        totalChecks++;
        if (this.typeMatches(v, f.type)) okTypes++;
      }
    }
    const accuracy = totalChecks > 0 ? +(okTypes / totalChecks).toFixed(3) : 1;

    // Consistency: 필드 집합 일관성
    const fieldSets = new Set(sample.rows.map((r) => Object.keys(r).sort().join(',')));
    const consistency = +(1 / fieldSets.size).toFixed(3);

    // Timeliness: 주기별 허용 delta
    const timeliness = this.scoreTimeliness(meta);

    const overall = +(
      completeness * 0.3 +
      accuracy * 0.3 +
      consistency * 0.2 +
      timeliness * 0.2
    ).toFixed(3);

    return { completeness, accuracy, consistency, timeliness, overall };
  }

  private typeMatches(v: unknown, type: string): boolean {
    switch (type) {
      case 'string':
        return typeof v === 'string';
      case 'number':
        return typeof v === 'number' && !Number.isNaN(v);
      case 'boolean':
        return typeof v === 'boolean';
      case 'date':
        return typeof v === 'string' && !Number.isNaN(Date.parse(v));
      default:
        return true;
    }
  }

  private scoreTimeliness(meta: DatasetMetadata): number {
    const now = Date.now();
    const last = Date.parse(meta.lastUpdatedAt);
    if (Number.isNaN(last)) return 0;
    const ageDays = (now - last) / (86400 * 1000);
    const budgets: Record<DatasetMetadata['updateCycle'], number> = {
      realtime: 1,
      daily: 2,
      weekly: 14,
      monthly: 60,
      yearly: 730,
    };
    const budget = budgets[meta.updateCycle];
    if (ageDays <= budget) return 1;
    return +Math.max(0, 1 - (ageDays - budget) / budget).toFixed(3);
  }

  /** FR-N413.3 등급 산정 + FR-N413.5 증적 */
  certify(meta: DatasetMetadata, sample: QualitySample): CertResult {
    const metaCheck = this.validateMetadata(meta);
    const score = this.measureQuality(meta, sample);
    const issues: string[] = [];
    if (!metaCheck.ok) issues.push(`메타 누락: ${metaCheck.missing.join(',')}`);
    if (score.completeness < 0.9) issues.push('완전성 미달');
    if (score.accuracy < 0.9) issues.push('정확성 미달');
    if (score.timeliness < 0.7) issues.push('갱신 지연');

    let grade: CertResult['grade'] = 1;
    if (score.overall >= 0.95 && metaCheck.ok) grade = 5;
    else if (score.overall >= 0.9) grade = 4;
    else if (score.overall >= 0.8) grade = 3;
    else if (score.overall >= 0.7) grade = 2;

    const now = new Date();
    const until = new Date(now.getTime() + 365 * 86400 * 1000);
    return {
      datasetId: meta.datasetId,
      grade,
      score,
      issues,
      certifiedAt: now.toISOString(),
      validUntil: until.toISOString(),
    };
  }

  /** FR-N413.4 갱신 필요 탐지 */
  needsRefresh(metas: DatasetMetadata[]): string[] {
    return metas.filter((m) => this.scoreTimeliness(m) < 0.7).map((m) => m.datasetId);
  }
}

export const publicDataQualityCert = new PublicDataQualityCert();
