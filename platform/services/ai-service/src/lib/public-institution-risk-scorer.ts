// Design Ref: §핵심 알고리즘 — 가중 리스크 점수 + A~F 등급
// Plan SC: FR-R291.1~5

enum DataGrade { C = 'C', S = 'S', O = 'O' }

interface InstitutionRecord {
  id: string;
  name: string;
  scale: string;
  type: string;
}

interface RiskMetrics {
  institutionId: string;
  vulnerabilities: number;
  obsolescenceRate: number;
  complianceRate: number;
  recordedAt: string;
}

interface RiskScoreResult {
  institutionId: string;
  institutionName: string;
  totalRisk: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
}

interface AuditEntry {
  timestamp: string;
  action: string;
  details: Record<string, unknown>;
}

// Plan SC: FR-R291.5
function guardDataGrade(grade: DataGrade): void {
  if (grade === DataGrade.C || grade === DataGrade.S) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export class PublicInstitutionRiskScorer {
  private institutions = new Map<string, InstitutionRecord>();
  private metricsRecords = new Map<string, RiskMetrics>();
  private auditLog: AuditEntry[] = [];

  private log(action: string, details: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, details });
  }

  // Plan SC: FR-R291.1
  registerInstitution(id: string, name: string, scale: string, type: string): void {
    this.institutions.set(id, { id, name, scale, type });
    this.log('REGISTER_INSTITUTION', { id, name, scale, type });
  }

  // Plan SC: FR-R291.2
  recordRiskMetrics(institutionId: string, vulnerabilities: number, obsolescenceRate: number, complianceRate: number, grade: DataGrade = DataGrade.O): void {
    guardDataGrade(grade);
    if (!this.institutions.has(institutionId)) throw new Error(`기관 미등록: ${institutionId}`);
    this.metricsRecords.set(institutionId, { institutionId, vulnerabilities, obsolescenceRate, complianceRate, recordedAt: new Date().toISOString() });
    this.log('RECORD_RISK_METRICS', { institutionId, vulnerabilities, obsolescenceRate, complianceRate });
  }

  // Plan SC: FR-R291.3 + R291.4
  calculateRiskScore(institutionId: string): RiskScoreResult {
    const inst = this.institutions.get(institutionId);
    if (!inst) throw new Error(`기관 미등록: ${institutionId}`);

    const m = this.metricsRecords.get(institutionId);
    if (!m) return { institutionId, institutionName: inst.name, totalRisk: 0, grade: 'A' };

    const vulnerabilityScore = Math.min(100, m.vulnerabilities * 10);
    const obsolescenceScore = Math.min(100, m.obsolescenceRate);
    const complianceScore = Math.min(100, 100 - m.complianceRate);
    const totalRisk = Math.round(vulnerabilityScore * 0.4 + obsolescenceScore * 0.3 + complianceScore * 0.3);

    const grade: 'A' | 'B' | 'C' | 'D' | 'F' =
      totalRisk >= 75 ? 'F' : totalRisk >= 60 ? 'D' : totalRisk >= 45 ? 'C' : totalRisk >= 30 ? 'B' : 'A';

    this.log('CALCULATE_RISK_SCORE', { institutionId, totalRisk, grade });
    return { institutionId, institutionName: inst.name, totalRisk, grade };
  }

  getHighRiskInstitutions(threshold: number = 60): RiskScoreResult[] {
    return Array.from(this.institutions.keys())
      .map(id => this.calculateRiskScore(id))
      .filter(r => r.totalRisk >= threshold)
      .sort((a, b) => b.totalRisk - a.totalRisk);
  }

  // Plan SC: FR-R291.5
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
