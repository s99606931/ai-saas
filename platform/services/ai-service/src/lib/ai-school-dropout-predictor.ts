// Design Ref: §학교 중도탈락 예측 — 다변수 위험 스코어링
// Plan SC: FR-R601.1~6

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export type SchoolLevel = 'elementary' | 'middle' | 'high';

export interface StudentRecord {
  studentId: string;
  schoolLevel: SchoolLevel;
  attendanceRate: number; // 0~100
  avgGrade: number; // 0~100
  disciplinaryEvents: number;
  familySupportScore: number; // 0~10
}

export interface DropoutPrediction {
  studentId: string;
  riskScore: number; // 0~100
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  topFactors: string[];
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

export class AISchoolDropoutPredictor {
  private students = new Map<string, StudentRecord>();
  private auditLog: AuditEntry[] = [];

  private append(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R601.1
  registerStudent(record: StudentRecord, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (record.attendanceRate < 0 || record.attendanceRate > 100) {
      throw new Error('출석률은 0~100 범위여야 합니다');
    }
    if (record.avgGrade < 0 || record.avgGrade > 100) {
      throw new Error('평균 성적은 0~100 범위여야 합니다');
    }
    if (record.disciplinaryEvents < 0) throw new Error('징계 이력은 0 이상이어야 합니다');
    if (record.familySupportScore < 0 || record.familySupportScore > 10) {
      throw new Error('가정 지원 점수는 0~10 범위여야 합니다');
    }
    this.students.set(record.studentId, { ...record });
    this.append('REGISTER_STUDENT', { studentId: record.studentId, level: record.schoolLevel });
  }

  // Plan SC: FR-R601.2
  predict(studentId: string, grade: DataGrade = 'O'): DropoutPrediction {
    blockClassifiedData(grade);
    const s = this.students.get(studentId);
    if (!s) throw new Error(`학생 미등록: ${studentId}`);

    const attendanceRisk = (100 - s.attendanceRate) * 0.35;
    const gradeRisk = (100 - s.avgGrade) * 0.25;
    const disciplinaryRisk = Math.min(s.disciplinaryEvents * 8, 30);
    const familyRisk = (10 - s.familySupportScore) * 2;

    const raw = attendanceRisk + gradeRisk + disciplinaryRisk + familyRisk;
    const riskScore = Math.round(Math.min(raw, 100) * 100) / 100;

    const riskLevel: DropoutPrediction['riskLevel'] =
      riskScore >= 75 ? 'critical' : riskScore >= 50 ? 'high' : riskScore >= 25 ? 'medium' : 'low';

    const factors: Array<[string, number]> = [
      ['출석 부족', attendanceRisk],
      ['성적 저하', gradeRisk],
      ['징계 이력', disciplinaryRisk],
      ['가정 지원 부족', familyRisk],
    ];
    factors.sort((a, b) => b[1] - a[1]);
    const topFactors = factors.slice(0, 2).map(f => f[0]);

    this.append('PREDICT', { studentId, riskScore, riskLevel });
    return { studentId, riskScore, riskLevel, topFactors };
  }

  // Plan SC: FR-R601.3
  listAtRisk(minLevel: DropoutPrediction['riskLevel'] = 'high'): DropoutPrediction[] {
    const order = { low: 0, medium: 1, high: 2, critical: 3 } as const;
    const threshold = order[minLevel];
    const results: DropoutPrediction[] = [];
    for (const id of this.students.keys()) {
      const p = this.predict(id);
      if (order[p.riskLevel] >= threshold) results.push(p);
    }
    return results;
  }

  // Plan SC: FR-R601.4
  getStudent(studentId: string): StudentRecord | undefined {
    const s = this.students.get(studentId);
    return s ? { ...s } : undefined;
  }

  // Plan SC: FR-R601.5
  countByLevel(): Record<SchoolLevel, number> {
    const counts: Record<SchoolLevel, number> = { elementary: 0, middle: 0, high: 0 };
    for (const s of this.students.values()) counts[s.schoolLevel]++;
    return counts;
  }

  // Plan SC: FR-R601.6
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
