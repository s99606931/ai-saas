// Design Ref: §민방위 훈련 — 이수율·시나리오별 성과 AI 코치
// Plan SC: FR-R542.1~6

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export type ScenarioType = 'air_raid' | 'chemical' | 'earthquake' | 'fire' | 'flood';

export interface TrainingRecord {
  traineeId: string;
  scenario: ScenarioType;
  completedMinutes: number;
  requiredMinutes: number;
  scoreOutOf100: number;
  year: number;
}

export interface CoachingPlan {
  traineeId: string;
  overallLevel: 'advanced' | 'intermediate' | 'needs_improvement';
  weakScenarios: ScenarioType[];
  recommendedMinutes: number;
  message: string;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

export class CivilDefenseTrainingAI {
  private records: TrainingRecord[] = [];
  private auditLog: AuditEntry[] = [];

  private append(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R542.1
  addRecord(record: TrainingRecord, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (record.completedMinutes < 0 || record.requiredMinutes <= 0) {
      throw new Error('훈련 시간은 유효해야 합니다');
    }
    if (record.scoreOutOf100 < 0 || record.scoreOutOf100 > 100) {
      throw new Error('점수는 0~100 범위여야 합니다');
    }
    if (record.year < 2000 || record.year > 2100) throw new Error('연도가 유효하지 않습니다');
    this.records.push({ ...record });
    this.append('ADD_RECORD', { traineeId: record.traineeId, scenario: record.scenario });
  }

  // Plan SC: FR-R542.2
  completionRate(traineeId: string): number {
    const list = this.records.filter(r => r.traineeId === traineeId);
    if (list.length === 0) return 0;
    const total = list.reduce((s, r) => s + r.requiredMinutes, 0);
    const done = list.reduce((s, r) => s + Math.min(r.completedMinutes, r.requiredMinutes), 0);
    return total === 0 ? 0 : Math.round((done / total) * 10000) / 100;
  }

  // Plan SC: FR-R542.3
  averageScore(traineeId: string): number {
    const list = this.records.filter(r => r.traineeId === traineeId);
    if (list.length === 0) return 0;
    const sum = list.reduce((s, r) => s + r.scoreOutOf100, 0);
    return Math.round((sum / list.length) * 100) / 100;
  }

  // Plan SC: FR-R542.4
  generatePlan(traineeId: string, grade: DataGrade = 'O'): CoachingPlan {
    blockClassifiedData(grade);
    const list = this.records.filter(r => r.traineeId === traineeId);
    if (list.length === 0) throw new Error(`훈련 기록 없음: ${traineeId}`);

    const weakScenarios: ScenarioType[] = list
      .filter(r => r.scoreOutOf100 < 70)
      .map(r => r.scenario);

    const avg = this.averageScore(traineeId);
    const rate = this.completionRate(traineeId);
    const overallLevel: 'advanced' | 'intermediate' | 'needs_improvement' =
      avg >= 85 && rate >= 90 ? 'advanced' : avg >= 70 && rate >= 70 ? 'intermediate' : 'needs_improvement';

    const recommendedMinutes = overallLevel === 'needs_improvement' ? 120 : overallLevel === 'intermediate' ? 60 : 30;
    const message =
      overallLevel === 'advanced'
        ? '우수한 훈련 상태입니다'
        : overallLevel === 'intermediate'
          ? '기본 수준을 유지하고 있습니다'
          : '보충 훈련이 필요합니다';

    const plan: CoachingPlan = { traineeId, overallLevel, weakScenarios, recommendedMinutes, message };
    this.append('GENERATE_PLAN', { traineeId, overallLevel });
    return plan;
  }

  // Plan SC: FR-R542.5
  listRecords(traineeId: string): TrainingRecord[] {
    return this.records.filter(r => r.traineeId === traineeId).map(r => ({ ...r }));
  }

  // Plan SC: FR-R542.6
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
