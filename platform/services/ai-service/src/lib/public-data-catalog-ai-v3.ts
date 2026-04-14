// Design Ref: SVC-AI-ADV-R649.design.md — AI기반 공공데이터 카탈로그 자동화 v3
// Plan SC: FR-R649.1~5

export type QualityGrade = 'A' | 'B' | 'C' | 'D';

interface DatasetField { name: string; filled: boolean; standardMatched: boolean }
interface Dataset {
  datasetId: string;
  title: string;
  fields: DatasetField[];
  ageDays: number;
}
interface CatalogResult {
  datasetId: string;
  completeness: number;
  freshness: number;
  standardCompliance: number;
  score: number;
  grade: QualityGrade;
}
interface AuditEntry { timestamp: string; action: string; details?: Record<string, unknown> }

export class PublicDataCatalogAIV3 {
  private auditLog: AuditEntry[] = [];

  analyze(dataset: Dataset, dataGrade?: string): CatalogResult {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 AI API 전송 금지 (N2SF N-05)`);
    }
    const total = dataset.fields.length;
    if (total === 0) throw new Error('EMPTY_FIELDS');

    const filled = dataset.fields.filter((f) => f.filled).length;
    const matched = dataset.fields.filter((f) => f.standardMatched).length;

    const completeness = filled / total;
    let freshness: number;
    if (dataset.ageDays <= 30) freshness = 1;
    else freshness = Math.max(0, 1 - (dataset.ageDays - 30) / 365);
    const standardCompliance = matched / total;

    const score = Number(
      (100 * (completeness * 0.4 + freshness * 0.3 + standardCompliance * 0.3)).toFixed(2),
    );

    let grade: QualityGrade;
    if (score >= 90) grade = 'A';
    else if (score >= 75) grade = 'B';
    else if (score >= 60) grade = 'C';
    else grade = 'D';

    const result: CatalogResult = {
      datasetId: dataset.datasetId,
      completeness,
      freshness,
      standardCompliance,
      score,
      grade,
    };
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'ANALYZE_DATASET',
      details: { ...result },
    });
    return result;
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
