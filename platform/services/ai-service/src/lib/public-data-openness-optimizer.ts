// Design Ref: §핵심 알고리즘 — 완전성/최신성/볼륨 점수 + 개방 등급
// Plan SC: FR-R249.1~5

enum DataGrade { C = 'C', S = 'S', O = 'O' }

type OpennessGrade = 'A' | 'B' | 'C' | 'F';

interface DatasetField {
  name: string;
  required: boolean;
  value?: string;
}

interface Dataset {
  id: string;
  name: string;
  fields: DatasetField[];
  lastUpdated: string;
  recordCount: number;
}

interface QualityScore {
  completeness: number;
  freshness: number;
  volume: number;
  overall: number;
}

interface Recommendation {
  type: 'completeness' | 'freshness' | 'metadata' | 'volume';
  description: string;
  priority: 'high' | 'medium' | 'low';
}

interface AuditEntry {
  timestamp: string;
  action: string;
  details: Record<string, unknown>;
}

// Plan SC: FR-R249.5
function guardDataGrade(grade: DataGrade): void {
  if (grade === DataGrade.C || grade === DataGrade.S) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export class PublicDataOpennessOptimizer {
  private datasets = new Map<string, Dataset>();
  private auditLog: AuditEntry[] = [];

  private log(action: string, details: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, details });
  }

  // Plan SC: FR-R249.1
  registerDataset(id: string, name: string, fields: DatasetField[], lastUpdated: string, recordCount: number, grade: DataGrade = DataGrade.O): void {
    guardDataGrade(grade);
    this.datasets.set(id, { id, name, fields, lastUpdated, recordCount });
    this.log('REGISTER_DATASET', { id, name, fieldCount: fields.length, recordCount });
  }

  // Plan SC: FR-R249.2
  evaluateQuality(datasetId: string): QualityScore {
    const dataset = this.datasets.get(datasetId);
    if (!dataset) throw new Error(`데이터셋 미등록: ${datasetId}`);

    // 완전성: 필수 필드 중 값 있는 비율
    const requiredFields = dataset.fields.filter(f => f.required);
    const filledRequired = requiredFields.filter(f => f.value && f.value.trim() !== '').length;
    const completeness = requiredFields.length === 0 ? 100 : Math.round((filledRequired / requiredFields.length) * 100);

    // 최신성: 마지막 업데이트 경과일
    const daysSinceUpdate = Math.floor((Date.now() - new Date(dataset.lastUpdated).getTime()) / (1000 * 60 * 60 * 24));
    let freshness: number;
    if (daysSinceUpdate <= 30) freshness = 100;
    else if (daysSinceUpdate <= 90) freshness = 70;
    else if (daysSinceUpdate <= 365) freshness = 40;
    else freshness = 10;

    // 볼륨: 레코드 수 기반 점수
    let volume: number;
    if (dataset.recordCount >= 10000) volume = 100;
    else if (dataset.recordCount >= 1000) volume = 70;
    else if (dataset.recordCount >= 100) volume = 40;
    else volume = 20;

    const overall = Math.round((completeness * 0.4 + freshness * 0.4 + volume * 0.2));
    this.log('EVALUATE_QUALITY', { datasetId, completeness, freshness, volume, overall });
    return { completeness, freshness, volume, overall };
  }

  // Plan SC: FR-R249.3
  classifyOpenness(datasetId: string): OpennessGrade {
    const score = this.evaluateQuality(datasetId);
    let grade: OpennessGrade;
    if (score.overall >= 80) grade = 'A';
    else if (score.overall >= 60) grade = 'B';
    else if (score.overall >= 40) grade = 'C';
    else grade = 'F';

    this.log('CLASSIFY_OPENNESS', { datasetId, grade, overall: score.overall });
    return grade;
  }

  // Plan SC: FR-R249.4
  getMetadataRecommendations(datasetId: string): Recommendation[] {
    const dataset = this.datasets.get(datasetId);
    if (!dataset) throw new Error(`데이터셋 미등록: ${datasetId}`);

    const score = this.evaluateQuality(datasetId);
    const recommendations: Recommendation[] = [];

    if (score.completeness < 80) {
      recommendations.push({
        type: 'completeness',
        description: '필수 메타데이터 필드를 채워 완전성을 높이십시오',
        priority: 'high',
      });
    }
    if (score.freshness < 70) {
      recommendations.push({
        type: 'freshness',
        description: '데이터를 최근 90일 이내로 업데이트하십시오',
        priority: 'high',
      });
    }
    if (score.volume < 40) {
      recommendations.push({
        type: 'volume',
        description: '더 많은 레코드를 포함하여 데이터 활용도를 높이십시오',
        priority: 'medium',
      });
    }
    if (recommendations.length === 0) {
      recommendations.push({
        type: 'metadata',
        description: '현재 품질 양호 — 정기적인 업데이트 유지를 권고합니다',
        priority: 'low',
      });
    }

    return recommendations;
  }

  // Plan SC: FR-R249.5
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
