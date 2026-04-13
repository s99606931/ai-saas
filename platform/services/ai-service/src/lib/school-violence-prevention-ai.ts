// Design Ref: §학교폭력 예방 — 신호 패턴 기반 위험 예측
// Plan SC: FR-R528.1~6

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export type SignalType =
  | 'absenteeism'
  | 'grade_drop'
  | 'peer_report'
  | 'counselor_concern'
  | 'online_conflict'
  | 'self_harm_mention';
export type InterventionTier = 'none' | 'watch' | 'counseling' | 'urgent';

export interface ClassProfile {
  classId: string;
  schoolName: string;
  studentCount: number;
}

export interface SignalReport {
  classId: string;
  signal: SignalType;
  weight: number; // 1~10
  recordedAt: string;
}

export interface RiskAssessment {
  classId: string;
  riskScore: number;
  tier: InterventionTier;
  criticalSignalPresent: boolean;
  recommendedActions: string[];
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

const SIGNAL_MULTIPLIER: Record<SignalType, number> = {
  absenteeism: 1.0,
  grade_drop: 0.8,
  peer_report: 1.5,
  counselor_concern: 1.8,
  online_conflict: 1.3,
  self_harm_mention: 3.0,
};

export class SchoolViolencePreventionAI {
  private classes = new Map<string, ClassProfile>();
  private signals: SignalReport[] = [];
  private auditLog: AuditEntry[] = [];

  private append(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R528.1
  registerClass(profile: ClassProfile, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (profile.studentCount <= 0) throw new Error('학생 수는 1 이상이어야 합니다');
    this.classes.set(profile.classId, { ...profile });
    this.append('REGISTER_CLASS', { classId: profile.classId });
  }

  // Plan SC: FR-R528.2
  reportSignal(report: SignalReport, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (!this.classes.has(report.classId)) throw new Error(`학급 미등록: ${report.classId}`);
    if (report.weight < 1 || report.weight > 10) {
      throw new Error('가중치는 1~10 범위여야 합니다');
    }
    this.signals.push({ ...report });
    this.append('REPORT_SIGNAL', { classId: report.classId, signal: report.signal });
  }

  // Plan SC: FR-R528.3
  assess(classId: string, grade: DataGrade = 'O'): RiskAssessment {
    blockClassifiedData(grade);
    const profile = this.classes.get(classId);
    if (!profile) throw new Error(`학급 미등록: ${classId}`);

    const relevant = this.signals.filter(s => s.classId === classId);
    let riskScore = 0;
    let criticalSignalPresent = false;

    for (const sig of relevant) {
      const multiplier = SIGNAL_MULTIPLIER[sig.signal];
      riskScore += sig.weight * multiplier;
      if (sig.signal === 'self_harm_mention') criticalSignalPresent = true;
    }

    // 학급 크기 대비 정규화 (큰 학급이 작은 학급보다 신호 총량이 크므로)
    const normalizedScore = Math.round((riskScore / Math.max(1, profile.studentCount / 25)) * 100) / 100;

    let tier: InterventionTier;
    if (criticalSignalPresent || normalizedScore >= 50) tier = 'urgent';
    else if (normalizedScore >= 25) tier = 'counseling';
    else if (normalizedScore >= 10) tier = 'watch';
    else tier = 'none';

    const recommendedActions: string[] = [];
    if (tier === 'urgent') {
      recommendedActions.push('즉시 학부모 통지');
      recommendedActions.push('전문 상담사 개입');
      recommendedActions.push('학교폭력대책자치위원회 소집 검토');
    } else if (tier === 'counseling') {
      recommendedActions.push('담임 면담 실시');
      recommendedActions.push('상담 교사 배정');
    } else if (tier === 'watch') {
      recommendedActions.push('주간 관찰 보고서 작성');
    }

    const assessment: RiskAssessment = {
      classId,
      riskScore: normalizedScore,
      tier,
      criticalSignalPresent,
      recommendedActions,
    };
    this.append('ASSESS', { classId, tier, riskScore: normalizedScore });
    return assessment;
  }

  // Plan SC: FR-R528.4
  listClasses(): ClassProfile[] {
    return Array.from(this.classes.values()).map(c => ({ ...c }));
  }

  // Plan SC: FR-R528.5
  getSignals(classId?: string): SignalReport[] {
    return classId ? this.signals.filter(s => s.classId === classId) : [...this.signals];
  }

  // Plan SC: FR-R528.6
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
