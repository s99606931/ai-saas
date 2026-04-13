// Design Ref: §국경 통제 리스크 분석 — 입출국 신청 가중 위험도 평가
// Plan SC: FR-R561.1~6

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export type TravelPurpose = 'tourism' | 'business' | 'study' | 'work' | 'diplomatic' | 'transit';

export interface TravelerRequest {
  requestId: string;
  nationalityCode: string;
  purpose: TravelPurpose;
  stayDays: number;
  priorVisits: number;
  overstayHistory: number;
  watchListHit: boolean;
  sponsorVerified: boolean;
}

export interface RiskAssessment {
  requestId: string;
  score: number;
  level: 'allow' | 'review' | 'enhanced' | 'deny';
  reasons: string[];
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

export class BorderControlRiskAnalyzer {
  private readonly highRiskNationalities = new Set<string>();
  private readonly assessments: RiskAssessment[] = [];
  private readonly auditLog: AuditEntry[] = [];

  private append(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R561.1
  registerHighRisk(nationalityCode: string, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (!nationalityCode) throw new Error('국적 코드는 비어있을 수 없습니다');
    this.highRiskNationalities.add(nationalityCode.toUpperCase());
    this.append('REGISTER_HIGH_RISK', { nationalityCode });
  }

  // Plan SC: FR-R561.2
  assess(req: TravelerRequest, grade: DataGrade = 'O'): RiskAssessment {
    blockClassifiedData(grade);
    if (req.stayDays < 0) throw new Error('체류일수는 0 이상이어야 합니다');
    if (req.priorVisits < 0 || req.overstayHistory < 0) {
      throw new Error('방문 이력은 0 이상이어야 합니다');
    }

    let score = 0;
    const reasons: string[] = [];

    if (req.watchListHit) {
      score += 60;
      reasons.push('감시대상 명단 일치');
    }
    if (this.highRiskNationalities.has(req.nationalityCode.toUpperCase())) {
      score += 20;
      reasons.push('고위험 국가 국적');
    }
    if (req.overstayHistory > 0) {
      score += 15 * req.overstayHistory;
      reasons.push(`과거 체류기한 초과 ${req.overstayHistory}회`);
    }
    if (req.stayDays > 180) {
      score += 10;
      reasons.push('장기 체류 요청');
    }
    if (req.purpose === 'work' && !req.sponsorVerified) {
      score += 15;
      reasons.push('취업 목적 후원자 미검증');
    }
    if (req.priorVisits >= 3 && req.overstayHistory === 0) {
      score -= 10;
      reasons.push('정상 반복 방문 감점');
    }
    if (req.purpose === 'diplomatic') {
      score -= 20;
      reasons.push('외교 목적 감점');
    }

    score = Math.max(0, Math.min(100, score));
    const level: RiskAssessment['level'] =
      score >= 70 ? 'deny' : score >= 50 ? 'enhanced' : score >= 25 ? 'review' : 'allow';

    const result: RiskAssessment = { requestId: req.requestId, score, level, reasons };
    this.assessments.push(result);
    this.append('ASSESS', { requestId: req.requestId, level, score });
    return result;
  }

  // Plan SC: FR-R561.3
  batchAssess(reqs: TravelerRequest[]): RiskAssessment[] {
    return reqs.map(r => this.assess(r));
  }

  // Plan SC: FR-R561.4
  summarizeByLevel(): Record<RiskAssessment['level'], number> {
    const summary: Record<RiskAssessment['level'], number> = {
      allow: 0, review: 0, enhanced: 0, deny: 0,
    };
    for (const a of this.assessments) summary[a.level] += 1;
    return summary;
  }

  // Plan SC: FR-R561.5
  listAssessments(level?: RiskAssessment['level']): RiskAssessment[] {
    return level ? this.assessments.filter(a => a.level === level) : [...this.assessments];
  }

  // Plan SC: FR-R561.6
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
