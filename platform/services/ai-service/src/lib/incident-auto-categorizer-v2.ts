// SVC-AI-ADV-R364 Incident Auto-Categorizer v2
// Design Ref: SVC-AI-ADV-R364.design.md
// Plan SC: SC-R364-1~4
// CSAP D-06 / N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';

export interface IncidentInput {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly grade: DataGrade;
}

export interface CategoryAssignment {
  readonly category: string;
  readonly confidence: number;
}

export interface CategorizationResult {
  readonly incidentId: string;
  readonly labels: readonly CategoryAssignment[];
}

export interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

const CATEGORIES: Record<string, string[]> = {
  network: ['네트워크', '연결', 'latency', 'timeout', 'dns'],
  security: ['침해', '해킹', 'phishing', 'malware', '유출'],
  database: ['db', '쿼리', 'deadlock', '데이터베이스'],
  performance: ['느림', '지연', 'cpu', 'memory', '성능'],
  auth: ['로그인', '인증', 'token', '권한'],
};

export class IncidentAutoCategorizerV2 {
  private readonly auditLog: AuditEntry[] = [];

  categorize(incident: IncidentInput, threshold = 0.2): CategorizationResult {
    if (incident.grade === 'C' || incident.grade === 'S') {
      throw new Error(`N2SF_BLOCKED: ${incident.grade}등급 인시던트 차단 (N2SF N-05)`);
    }
    if (threshold < 0 || threshold > 1) {
      throw new Error('INVALID_PARAMS: threshold out of range');
    }

    const text = `${incident.title} ${incident.description}`.toLowerCase();
    const labels: CategoryAssignment[] = [];

    for (const [cat, keywords] of Object.entries(CATEGORIES)) {
      let matches = 0;
      for (const kw of keywords) {
        if (text.includes(kw.toLowerCase())) matches += 1;
      }
      const confidence = keywords.length === 0 ? 0 : matches / keywords.length;
      if (confidence >= threshold) {
        labels.push({ category: cat, confidence: Number(confidence.toFixed(4)) });
      }
    }

    labels.sort((a, b) => b.confidence - a.confidence);

    const result: CategorizationResult = {
      incidentId: incident.id,
      labels,
    };

    this.record('CATEGORIZE', incident.id, { labelCount: labels.length });

    return result;
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
