// Design Ref: §정부 직원 건강 AI — 업무 부담/건강 지표 기반 개입 권고
// Plan SC: FR-R568.1~6

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export interface WellnessSnapshot {
  staffRef: string; // 익명 참조 (실제 ID 아님)
  weeklyOvertimeHours: number;
  stressSelfReport: 1 | 2 | 3 | 4 | 5;
  sleepHours: number;
  exerciseDaysPerWeek: number;
  recentSickDays: number;
  burnoutRisk: 1 | 2 | 3 | 4 | 5;
}

export interface WellnessAssessment {
  staffRef: string;
  wellnessScore: number;
  status: 'healthy' | 'watch' | 'at-risk' | 'critical';
  interventions: string[];
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

export class GovernmentStaffWellnessAI {
  private readonly snapshots = new Map<string, WellnessSnapshot>();
  private readonly auditLog: AuditEntry[] = [];

  private append(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R568.1
  recordSnapshot(snap: WellnessSnapshot, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (snap.weeklyOvertimeHours < 0) throw new Error('초과근무 시간은 0 이상이어야 합니다');
    if (snap.sleepHours < 0 || snap.sleepHours > 24) {
      throw new Error('수면 시간은 0~24 이어야 합니다');
    }
    if (snap.exerciseDaysPerWeek < 0 || snap.exerciseDaysPerWeek > 7) {
      throw new Error('운동 일수는 0~7 이어야 합니다');
    }
    if (snap.recentSickDays < 0) throw new Error('병가 일수는 0 이상이어야 합니다');
    if (!snap.staffRef || snap.staffRef.length < 3) {
      throw new Error('익명 참조가 유효하지 않습니다');
    }
    this.snapshots.set(snap.staffRef, { ...snap });
    this.append('RECORD_SNAPSHOT', { staffRef: snap.staffRef });
  }

  // Plan SC: FR-R568.2
  assess(staffRef: string, grade: DataGrade = 'O'): WellnessAssessment {
    blockClassifiedData(grade);
    const s = this.snapshots.get(staffRef);
    if (!s) throw new Error(`스냅샷 미등록: ${staffRef}`);

    let score = 100;
    const interventions: string[] = [];

    if (s.weeklyOvertimeHours > 20) {
      score -= 25;
      interventions.push('초과근무 축소 조치');
    } else if (s.weeklyOvertimeHours > 10) {
      score -= 10;
      interventions.push('업무 재분배 검토');
    }

    score -= (s.stressSelfReport - 1) * 8;
    if (s.stressSelfReport >= 4) interventions.push('스트레스 상담 프로그램 안내');

    if (s.sleepHours < 6) {
      score -= 15;
      interventions.push('수면 위생 교육');
    } else if (s.sleepHours < 7) {
      score -= 5;
    }

    if (s.exerciseDaysPerWeek < 2) {
      score -= 10;
      interventions.push('사내 체력단련 프로그램 권고');
    }

    if (s.recentSickDays >= 5) {
      score -= 15;
      interventions.push('건강검진 우선 대상');
    }

    score -= (s.burnoutRisk - 1) * 5;
    if (s.burnoutRisk >= 4) interventions.push('번아웃 심층 면담');

    score = Math.max(0, Math.min(100, score));
    const status: WellnessAssessment['status'] =
      score >= 80 ? 'healthy' : score >= 60 ? 'watch' : score >= 40 ? 'at-risk' : 'critical';

    const result: WellnessAssessment = {
      staffRef,
      wellnessScore: Math.round(score),
      status,
      interventions,
    };
    this.append('ASSESS', { staffRef, status, score: result.wellnessScore });
    return result;
  }

  // Plan SC: FR-R568.3
  aggregateByStatus(): Record<WellnessAssessment['status'], number> {
    const summary: Record<WellnessAssessment['status'], number> = {
      healthy: 0, watch: 0, 'at-risk': 0, critical: 0,
    };
    for (const ref of this.snapshots.keys()) {
      const a = this.assess(ref);
      summary[a.status] += 1;
    }
    return summary;
  }

  // Plan SC: FR-R568.4
  listCritical(): WellnessAssessment[] {
    return Array.from(this.snapshots.keys())
      .map(r => this.assess(r))
      .filter(a => a.status === 'critical' || a.status === 'at-risk');
  }

  // Plan SC: FR-R568.5
  listStaffRefs(): string[] {
    return Array.from(this.snapshots.keys());
  }

  // Plan SC: FR-R568.6
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
