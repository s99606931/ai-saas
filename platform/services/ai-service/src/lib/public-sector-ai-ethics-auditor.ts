// Design Ref: §공공 AI 윤리 감사 (투명성·공정성·책임성·설명가능성·프라이버시)
// Plan SC: FR-R620.1~5

enum DataGrade { C = 'C', S = 'S', O = 'O' }

type EthicsPrinciple = 'transparency' | 'fairness' | 'accountability' | 'explainability' | 'privacy';

interface AISystem {
  id: string;
  agency: string;
  purpose: string;
  deployedAt: string;
  affectedPopulation: number;
}

interface PrincipleScore {
  principle: EthicsPrinciple;
  score: number;
  findings: string[];
}

interface EthicsAuditReport {
  systemId: string;
  overallScore: number;
  riskLevel: 'compliant' | 'minor_gap' | 'major_gap' | 'non_compliant';
  scores: PrincipleScore[];
  recommendations: string[];
}

interface AuditEvidence {
  systemId: string;
  principle: EthicsPrinciple;
  evidenceType: string;
  passed: boolean;
  note: string;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

function blockClassifiedData(grade: DataGrade): void {
  if (grade === DataGrade.C || grade === DataGrade.S) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

const PRINCIPLES: EthicsPrinciple[] = [
  'transparency', 'fairness', 'accountability', 'explainability', 'privacy',
];

export class PublicSectorAIEthicsAuditor {
  private systems = new Map<string, AISystem>();
  private evidence: AuditEvidence[] = [];
  private readonly auditEntries: AuditEntry[] = [];

  private log(action: string, detail: Record<string, unknown>): void {
    this.auditEntries.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R620.1
  registerSystem(system: AISystem): void {
    if (system.affectedPopulation < 0) throw new Error('영향 인구는 음수일 수 없음');
    this.systems.set(system.id, system);
    this.log('REGISTER_SYSTEM', { id: system.id, agency: system.agency });
  }

  // Plan SC: FR-R620.2
  recordEvidence(evidence: AuditEvidence, grade: DataGrade = DataGrade.O): void {
    blockClassifiedData(grade);
    if (!this.systems.has(evidence.systemId)) {
      throw new Error(`시스템 미등록: ${evidence.systemId}`);
    }
    this.evidence.push(evidence);
    this.log('RECORD_EVIDENCE', {
      systemId: evidence.systemId,
      principle: evidence.principle,
      passed: evidence.passed,
    });
  }

  // Plan SC: FR-R620.3
  private computePrincipleScore(systemId: string, principle: EthicsPrinciple): PrincipleScore {
    const items = this.evidence.filter(e => e.systemId === systemId && e.principle === principle);
    if (items.length === 0) {
      return {
        principle,
        score: 0,
        findings: ['증거 부족 — 감사 불가'],
      };
    }
    const passed = items.filter(e => e.passed).length;
    const score = Math.round((passed / items.length) * 100);
    const findings: string[] = items
      .filter(e => !e.passed)
      .map(e => `${e.evidenceType}: ${e.note}`);
    return { principle, score, findings };
  }

  // Plan SC: FR-R620.4
  audit(systemId: string, grade: DataGrade = DataGrade.O): EthicsAuditReport {
    blockClassifiedData(grade);
    const system = this.systems.get(systemId);
    if (!system) throw new Error(`시스템 미등록: ${systemId}`);

    const scores: PrincipleScore[] = PRINCIPLES.map(p => this.computePrincipleScore(systemId, p));
    const overall = Math.round(
      scores.reduce((acc, s) => acc + s.score, 0) / scores.length,
    );

    const riskLevel: EthicsAuditReport['riskLevel'] = overall >= 85 ? 'compliant'
      : overall >= 70 ? 'minor_gap'
      : overall >= 50 ? 'major_gap' : 'non_compliant';

    const recommendations: string[] = [];
    for (const s of scores) {
      if (s.score < 70) {
        recommendations.push(`${s.principle} 보완 필요 (현재 ${s.score}점)`);
      }
    }
    if (system.affectedPopulation > 100000 && overall < 80) {
      recommendations.push('대규모 영향 시스템 — 긴급 재감사 필요');
    }

    const report: EthicsAuditReport = {
      systemId,
      overallScore: overall,
      riskLevel,
      scores,
      recommendations,
    };
    this.log('AUDIT', { systemId, overall, riskLevel });
    return report;
  }

  // Plan SC: FR-R620.5
  listNonCompliant(grade: DataGrade = DataGrade.O): string[] {
    blockClassifiedData(grade);
    const result: string[] = [];
    for (const system of this.systems.values()) {
      const report = this.audit(system.id, grade);
      if (report.riskLevel === 'non_compliant' || report.riskLevel === 'major_gap') {
        result.push(system.id);
      }
    }
    this.log('LIST_NON_COMPLIANT', { count: result.length });
    return result;
  }

  getAuditLog(): readonly AuditEntry[] {
    return this.auditEntries;
  }
}
