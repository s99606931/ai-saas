// Design Ref: §공공 데이터 품질 — 완전성·일관성·정확성·적시성 평가
// Plan SC: FR-R529.1~6

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export interface DatasetRegistration {
  datasetId: string;
  name: string;
  owner: string;
  expectedFields: string[];
  updateFrequencyDays: number;
}

export interface DatasetSample {
  datasetId: string;
  rowCount: number;
  missingFieldCounts: Record<string, number>;
  invalidRowCount: number;
  lastUpdatedAt: string; // ISO
}

export interface QualityReport {
  datasetId: string;
  completeness: number; // 0~100
  accuracy: number; // 0~100
  timeliness: number; // 0~100
  overall: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  issues: string[];
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

export class PublicDataQualityAI {
  private datasets = new Map<string, DatasetRegistration>();
  private samples = new Map<string, DatasetSample>();
  private auditLog: AuditEntry[] = [];

  private append(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R529.1
  registerDataset(reg: DatasetRegistration, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (reg.expectedFields.length === 0) throw new Error('기대 필드 목록이 비어 있습니다');
    if (reg.updateFrequencyDays <= 0) throw new Error('갱신 주기는 1일 이상이어야 합니다');
    this.datasets.set(reg.datasetId, { ...reg, expectedFields: [...reg.expectedFields] });
    this.append('REGISTER_DATASET', { datasetId: reg.datasetId });
  }

  // Plan SC: FR-R529.2
  submitSample(sample: DatasetSample, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (!this.datasets.has(sample.datasetId)) throw new Error(`데이터셋 미등록: ${sample.datasetId}`);
    if (sample.rowCount < 0 || sample.invalidRowCount < 0) {
      throw new Error('행 수는 0 이상이어야 합니다');
    }
    if (sample.invalidRowCount > sample.rowCount) {
      throw new Error('무효 행 수는 전체 행 수를 초과할 수 없습니다');
    }
    this.samples.set(sample.datasetId, {
      ...sample,
      missingFieldCounts: { ...sample.missingFieldCounts },
    });
    this.append('SUBMIT_SAMPLE', { datasetId: sample.datasetId, rowCount: sample.rowCount });
  }

  // Plan SC: FR-R529.3
  evaluate(datasetId: string, currentTimeIso: string, grade: DataGrade = 'O'): QualityReport {
    blockClassifiedData(grade);
    const dataset = this.datasets.get(datasetId);
    if (!dataset) throw new Error(`데이터셋 미등록: ${datasetId}`);
    const sample = this.samples.get(datasetId);
    if (!sample) throw new Error(`샘플 없음: ${datasetId}`);

    const issues: string[] = [];

    // 완전성: 기대 필드의 결측률
    let totalMissing = 0;
    const denom = Math.max(1, sample.rowCount * dataset.expectedFields.length);
    for (const field of dataset.expectedFields) {
      const missing = sample.missingFieldCounts[field] ?? 0;
      totalMissing += missing;
      if (missing > sample.rowCount * 0.1) {
        issues.push(`필드 "${field}" 결측률 10% 초과`);
      }
    }
    const completeness = Math.max(0, Math.round((1 - totalMissing / denom) * 100));

    // 정확성: 무효 행 비율
    const accuracy =
      sample.rowCount === 0 ? 100 : Math.round((1 - sample.invalidRowCount / sample.rowCount) * 100);
    if (accuracy < 80) issues.push(`정확성 저하 (${accuracy}%)`);

    // 적시성: 마지막 갱신 일자와 현재 비교
    const lastUpdated = new Date(sample.lastUpdatedAt).getTime();
    const current = new Date(currentTimeIso).getTime();
    const daysSince = Math.max(0, (current - lastUpdated) / (1000 * 60 * 60 * 24));
    const allowed = dataset.updateFrequencyDays;
    const timeliness =
      daysSince <= allowed ? 100 : Math.max(0, Math.round(100 - ((daysSince - allowed) / allowed) * 50));
    if (timeliness < 70) issues.push(`적시성 저하 (${daysSince.toFixed(1)}일 경과)`);

    const overall = Math.round(completeness * 0.4 + accuracy * 0.4 + timeliness * 0.2);
    const qualityGrade: 'A' | 'B' | 'C' | 'D' | 'F' =
      overall >= 90 ? 'A' : overall >= 80 ? 'B' : overall >= 70 ? 'C' : overall >= 60 ? 'D' : 'F';

    const report: QualityReport = {
      datasetId,
      completeness,
      accuracy,
      timeliness,
      overall,
      grade: qualityGrade,
      issues,
    };
    this.append('EVALUATE', { datasetId, overall, grade: qualityGrade });
    return report;
  }

  // Plan SC: FR-R529.4
  listDatasets(): DatasetRegistration[] {
    return Array.from(this.datasets.values()).map(d => ({ ...d, expectedFields: [...d.expectedFields] }));
  }

  // Plan SC: FR-R529.5
  getSample(datasetId: string): DatasetSample | undefined {
    const s = this.samples.get(datasetId);
    return s ? { ...s, missingFieldCounts: { ...s.missingFieldCounts } } : undefined;
  }

  // Plan SC: FR-R529.6
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
